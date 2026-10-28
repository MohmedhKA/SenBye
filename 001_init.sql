-- =====================================================================
-- Campus Auction: database schema (PostgreSQL 16+)
-- Place at: server/src/db/migrations/001_init.sql  (applied by `npm run db:migrate`)
-- Conventions: money = integer rupees; all times = timestamptz (UTC);
--              ids = uuid for user-facing rows, bigint identity for logs.
-- Rule: once committed, never edit this file. Change the schema with 002_*.sql.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE auction_status AS ENUM (
  'open', 'pending_approval', 'reserved', 'sold',
  'unsold', 'rejected', 'cancelled', 'failed_pickup'
);
CREATE TYPE item_condition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
CREATE TYPE bid_source     AS ENUM ('manual', 'auto');

-- Shared guard for append-only tables.
CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END $$;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),  -- PUBLIC display name
  email         text NOT NULL,                                              -- PRIVATE
  password_hash text NOT NULL,                                              -- PRIVATE
  contact       text CHECK (char_length(contact) <= 100),                   -- PRIVATE: shown only to the counterparty while reserved/sold
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE categories (
  slug       text PRIMARY KEY,
  label      text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0
);
INSERT INTO categories (slug, label, sort_order) VALUES
  ('cycle', 'Cycles', 1), ('calculator', 'Calculators', 2), ('books', 'Books', 3),
  ('electronics', 'Electronics', 4), ('furniture', 'Hostel & furniture', 5), ('other', 'Other', 9);

-- ------------------------------------------------------------- auctions
-- One row per item = one auction (brief 2.1). Auctions are never deleted; they end in a terminal status.
CREATE TABLE auctions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           uuid NOT NULL REFERENCES users(id),
  title               text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  category            text NOT NULL REFERENCES categories(slug),
  description         text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  condition           item_condition NOT NULL,
  starting_price      integer NOT NULL CHECK (starting_price > 0),
  min_increment       integer NOT NULL CHECK (min_increment > 0),
  closes_at           timestamptz NOT NULL,           -- moves forward on last-minute extensions (3.4)
  original_closes_at  timestamptz NOT NULL,
  extension_count     integer NOT NULL DEFAULT 0,
  status              auction_status NOT NULL DEFAULT 'open',

  -- leading bid; NULL until the first bid
  current_price       integer,
  leader_id           uuid REFERENCES users(id),
  bid_count           integer NOT NULL DEFAULT 0,
  display_price       integer GENERATED ALWAYS AS (COALESCE(current_price, starting_price)) STORED,

  -- sale lifecycle (2.4)
  winner_id           uuid REFERENCES users(id),      -- provisional winner, set when the auction closes with bids
  winning_amount      integer,
  outcome_reason      text,                           -- mandatory for rejected / cancelled / failed_pickup
  closed_at           timestamptz,
  decided_at          timestamptz,                    -- when the seller approved or rejected
  pickup_deadline     timestamptz,                    -- set on approval (approved_at + 72h)
  seller_handover_at  timestamptz,
  buyer_handover_at   timestamptz,
  ending_soon_sent    boolean NOT NULL DEFAULT false,
  relisted_from       uuid REFERENCES auctions(id),

  search              tsvector GENERATED ALWAYS AS (
                        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
                      ) STORED,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT auctions_leader_ck   CHECK ((current_price IS NULL) = (leader_id IS NULL)),
  CONSTRAINT auctions_bids_ck     CHECK ((bid_count = 0) = (current_price IS NULL)),
  CONSTRAINT auctions_price_ck    CHECK (current_price IS NULL OR current_price >= starting_price),
  CONSTRAINT auctions_close_ck    CHECK (closes_at >= original_closes_at),
  CONSTRAINT auctions_winner_ck   CHECK ((status IN ('pending_approval','reserved','sold','rejected','failed_pickup')) = (winner_id IS NOT NULL)),
  CONSTRAINT auctions_reason_ck   CHECK (status NOT IN ('rejected','cancelled','failed_pickup') OR outcome_reason IS NOT NULL),
  CONSTRAINT auctions_reserved_ck CHECK (status <> 'reserved' OR pickup_deadline IS NOT NULL),
  CONSTRAINT auctions_sold_ck     CHECK (status <> 'sold' OR (seller_handover_at IS NOT NULL AND buyer_handover_at IS NOT NULL))
);
CREATE INDEX auctions_open_closes_idx ON auctions (closes_at) WHERE status = 'open';           -- closer tick + "closing soon"
CREATE INDEX auctions_pickup_idx      ON auctions (pickup_deadline) WHERE status = 'reserved'; -- pickup-window expiry
CREATE INDEX auctions_category_idx    ON auctions (category);
CREATE INDEX auctions_seller_idx      ON auctions (seller_id);
CREATE INDEX auctions_leader_idx      ON auctions (leader_id);
CREATE INDEX auctions_price_idx       ON auctions (display_price);
CREATE INDEX auctions_search_idx      ON auctions USING gin (search);
CREATE INDEX auctions_title_trgm_idx  ON auctions USING gin (title gin_trgm_ops);

CREATE TABLE auction_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  path       text NOT NULL,                            -- file name under server/uploads/
  position   smallint NOT NULL DEFAULT 0,
  UNIQUE (auction_id, position)
);

-- ----------------------------------------------------------------- bids
-- PUBLIC, append-only log of VALID bids only (rejected attempts are never stored).
CREATE TABLE bids (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auction_id       uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id        uuid NOT NULL REFERENCES users(id),
  amount           integer NOT NULL CHECK (amount > 0),
  source           bid_source NOT NULL,
  placed_at        timestamptz NOT NULL,               -- database clock_timestamp() taken under the auction row lock
  caused_extension boolean NOT NULL DEFAULT false,
  UNIQUE (auction_id, amount)                          -- every bid must beat the last, so an amount never repeats
);
CREATE INDEX bids_auction_idx ON bids (auction_id, id);
CREATE INDEX bids_bidder_idx  ON bids (bidder_id);
CREATE TRIGGER bids_append_only BEFORE UPDATE OR DELETE ON bids FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- PUBLIC maximums (brief 2.3: nothing about bidding is private). Raise-only; never deleted.
CREATE TABLE auto_bids (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auction_id  uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id   uuid NOT NULL REFERENCES users(id),
  max_amount  integer NOT NULL CHECK (max_amount > 0),
  priority_at timestamptz NOT NULL DEFAULT clock_timestamp(),  -- tie-break: earlier wins; reset when the max is raised
  via         text NOT NULL DEFAULT 'user' CHECK (via IN ('user', 'assistant')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_id, bidder_id)
);

-- Audit trail: every state change gets a row, so every outcome has a clear record (2.4).
-- type: created|edited|bid|extended|closed|unsold|approved|rejected|cancelled|handover_seller|handover_buyer|sold|failed_pickup|relisted
CREATE TABLE auction_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  type       text NOT NULL,
  actor_id   uuid REFERENCES users(id),                -- NULL = system (closer)
  data       jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX auction_events_idx ON auction_events (auction_id, id);
CREATE TRIGGER auction_events_append_only BEFORE UPDATE OR DELETE ON auction_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ------------------------------------------------------- notifications
-- Persistent feed (2.5). SSE pushes new rows; browser pop-ups mirror them.
-- type: outbid|new_bid|auto_bid_exceeded|extended|ending_soon|closed|won_pending|approved|rejected|cancelled|
--       handover|sold|failed_pickup|unsold|want_match|question|answer
CREATE TABLE notifications (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  auction_id uuid REFERENCES auctions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_at    timestamptz
);
CREATE INDEX notifications_user_idx ON notifications (user_id, id DESC);

-- ---------------------------------------------------------------- wants
-- 3.3 "Never miss what you need": matched when a listing is created, stored even if the user is offline.
CREATE TABLE wants (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keywords   text NOT NULL CHECK (char_length(keywords) BETWEEN 2 AND 100),
  category   text REFERENCES categories(slug),         -- optional narrowing
  max_price  integer NOT NULL CHECK (max_price > 0),   -- matches when auction.starting_price <= max_price
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wants_active_idx ON wants (active) WHERE active;
CREATE TABLE want_matches (                            -- one alert per (want, auction)
  want_id     bigint NOT NULL REFERENCES wants(id) ON DELETE CASCADE,
  auction_id  uuid   NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (want_id, auction_id)
);

-- ------------------------------------------------------------ questions
-- 3.2 Public Q&A. Seller-authored rows with is_faq = true are pre-answered FAQs.
CREATE TABLE questions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auction_id  uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  asker_id    uuid NOT NULL REFERENCES users(id),
  body        text NOT NULL CHECK (char_length(body) BETWEEN 5 AND 280),
  answer      text CHECK (char_length(answer) <= 1000),
  answered_at timestamptz,
  is_faq      boolean NOT NULL DEFAULT false,          -- pinned to the top of the thread
  status      text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_auction_idx   ON questions (auction_id, created_at);
CREATE INDEX questions_rate_idx      ON questions (asker_id, created_at);
CREATE INDEX questions_body_trgm_idx ON questions USING gin (body gin_trgm_ops);

-- ------------------------------------------------------------ assistant
-- 3.1 The model may only CREATE a proposal. Only the signed-in user's explicit confirm turns it into an auto-bid.
CREATE TABLE assistant_messages (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_messages_idx ON assistant_messages (user_id, id);
CREATE TABLE assistant_proposals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  max_amount integer NOT NULL CHECK (max_amount > 0),
  summary    text NOT NULL,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
