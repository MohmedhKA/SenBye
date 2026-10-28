# Campus Auction: PLAN.md

> Build the place where campus competes fairly for them, and every item finds its next owner.

Build window: 8–10 hours, same evening. This file is the single plan. The brief is `docs/problem_statement.md`.

**Source-of-truth order (if two disagree, stop and ask):** brief → `PLAN.md` → `001_init.sql` (+ later migrations) → `STRUCTURE.md` → code.
Rule IDs (`L1`, `B3`, `E1`, …) are used in commits, tests and code comments.

---

## 1. Goal and what gets judged

Seniors list leaving-campus items as individual timed auctions. Juniors bid fairly. Every auction ends in an explicit, recorded outcome, and a sale completes only on confirmed handover.

Fairness comes from four things: one server clock, atomic bidding, fully public bids and maximums, and last-minute extensions. Judges will look at:

1. the correctness of the bidding engine,
2. a clean sale lifecycle where every outcome is recorded,
3. what we chose to build from Section 3 of the brief and why,
4. process: public repo from the start, one commit per finished piece, one planning chat.

---

## 2. Locked decisions (do not re-decide)

| Area | Decision |
|---|---|
| Frontend | React 18, Vite 6, TypeScript, Tailwind 4 (`@tailwindcss/vite`), React Router 6 |
| Backend | Node ≥ 20, Express 5, TypeScript (run with `tsx`), zod 3 for validation |
| Database | PostgreSQL 16, raw SQL migrations, `pg` driver, **no ORM** |
| Realtime | Server-Sent Events (one stream per auction, one per user) |
| Auth | Email + password (bcryptjs), JWT in an httpOnly cookie named `token`, 7 days |
| Money | Integer rupees. Never floats. |
| Time | `clock_timestamp()` from the database, taken **after** the auction row is locked |
| Bid safety | One transaction, `SELECT … FOR UPDATE` on the auction row |
| Closing | 1-second server ticker **and** a lazy check inside `placeBid` |
| Uploads | Local disk `server/uploads/`, 1–5 images, JPEG/PNG/WebP, ≤ 3 MB each |
| AI | Anthropic API with tool calling (`@anthropic-ai/sdk`); model name only from env `ASSISTANT_MODEL`; rule-based fallback without a key |
| Tests | Vitest. Engine = pure unit tests; flows = integration tests on a real Postgres test DB |
| Single process | In-memory SSE hub. Documented limit: scaling out would need Postgres `LISTEN/NOTIFY`. |

---

## 3. Brief → implementation checklist

Tick a box only when the feature works end to end and its tests pass.

### 2.1 Listings
- [ ] Each item is its own auction → `auctions` row per item (L1)
- [ ] Create with title, category, description, condition, photos, starting price, min increment, closing time (L2)
- [ ] Different items close at different times → per-row `closes_at`
- [ ] Seller can edit (L3) or cancel (L4)

### 2.2 Browsing
- [ ] Keyword search (BR1)
- [ ] Filter by category, condition, price, closing soon (BR2)
- [ ] Card/page shows item details, leading bid, full bid history, its own countdown (BR3)

### 2.3 Bidding
- [ ] First bid ≥ starting price; later bids ≥ current + increment (B1)
- [ ] No bids after close (B3)
- [ ] Every bid stores bidder, amount, time (B5)
- [ ] Bids **and maximums** are public (B6)

### 2.4 Closing and sale
- [ ] Bidding stops at closing time (C1)
- [ ] Highest valid bid = provisional winner (C2)
- [ ] No bids → `unsold`; seller can relist manually (C3, L5)
- [ ] Seller approves or rejects the winning price (S1, S2)
- [ ] Approved → reserved for winner; confirmed handover completes the sale (S2, S4)
- [ ] Rejection, seller cancellation, failed pickup each recorded with a clear outcome (S3, L4, S5)

### 2.5 Notifications
- [ ] Opt-in browser notifications; same alerts pop up when the app is open in a background tab (N1–N3)

### 3. Key features, in build order
- [ ] 3.4 Last-minute extension (E1)
- [ ] 3.5 Automatic bidding (A1–A6)
- [ ] 3.3 Never miss what you need (W1–W4)
- [ ] 3.2 Questions before bidding (Q1–Q8)
- [ ] 3.1 AI assistant (AI1–AI7)

### 4. Process
- [ ] Public GitHub repo created first
- [ ] One commit per finished piece (commit plan in Section 12)
- [ ] All planning in this one chat; link submitted at the end

**Why this order:** 3.4 and 3.5 live in the bid engine and are cheapest to build with it. Wants reuse notifications. Q&A is independent. The AI assistant depends on everything above (it creates auto-bids), so it goes last and is time-boxed.

---

## 4. Business rules

### Listings
- **L1** Any signed-in user can sell and bid. A seller can never bid on their own auction.
- **L2** Create: `title` 3–100 chars; `category` ∈ `categories.slug`; `description` ≤ 2000; `condition` ∈ {new, like_new, good, fair, poor}; `starting_price` integer 1–1,000,000; `min_increment` integer ≥ 1; `closes_at` between now + 10 min and now + 30 days; 1–5 photos. Optional: up to 5 seller FAQs `{question, answer}` (Q7).
- **L3** Edit: seller only, status `open` only. No bids yet → every field editable (`closes_at` must still be ≥ now + 10 min). After the first bid → **only `description`** is editable (`LISTING_LOCKED` otherwise).
- **L4** Cancel: seller only, status `open` only, `reason` required (3–200 chars). Status becomes `cancelled`; all bidders are notified.
- **L5** Relist: seller only, from `unsold`, `rejected`, `cancelled`, `failed_pickup`. Creates a **new** auction copying fields and photos, with a new `closes_at` from the request and `relisted_from` set.

### Browsing
- **BR1** Search: `search @@ websearch_to_tsquery('english', q) OR title ILIKE '%q%'`.
- **BR2** Filters: `category`, `condition`, `min_price`/`max_price` (on `display_price`), `closing_soon=true` (closes within 24 h). Default status filter `open`. Sorts: `ending_soon` (default), `newest`, `price_asc`, `price_desc`. Pagination `page`, `limit` (default 20, max 50).
- **BR3** The detail page always shows: details, photos, leader and current price, `min_next_bid`, full bid history, public auto-bid maximums, countdown.

### Bidding
- **B1** `min_next_bid` = `starting_price` if no bids, else `current_price + min_increment`. A bid below it is rejected (`BID_TOO_LOW`).
- **B2** Bid amounts are integers ≤ 10,000,000.
- **B3** Reject when status ≠ `open` or `bid_time ≥ closes_at` (`AUCTION_CLOSED`). `bid_time` is the database clock under the row lock.
- **B4** A seller cannot bid (`OWN_AUCTION`). The current leader cannot place a manual bid (`ALREADY_LEADING`); they raise their auto-bid max instead.
- **B5** Every valid bid is stored with bidder, amount, `placed_at`, `source` (manual or auto). Rejected attempts are not stored.
- **B6** Public: bidder display names, amounts, times, auto-bid maximums. Private: email, password hash, contact (S2).

### Closing
- **C1** At `closes_at` the auction stops accepting bids.
- **C2** With ≥ 1 bid: status → `pending_approval`, `winner_id` = leader, `winning_amount` = `current_price`, `closed_at` set.
- **C3** With 0 bids: status → `unsold`, `outcome_reason` = "No bids".
- **C4** The closer uses `FOR UPDATE SKIP LOCKED` so a tick never double-processes. `placeBid` closes lazily if it finds an expired open auction, then rejects with `AUCTION_CLOSED`.
- **C5** Ending soon: when an open auction is within 10 min of close and `ending_soon_sent = false`, notify its bidders and seller once, then set the flag.

### Extension (3.4)
- **E1** If a valid bid arrives when `closes_at − bid_time ≤ 30 s`, set `closes_at = bid_time + 60 s`, increment `extension_count`, mark `caused_extension`, write an `extended` event, notify bidders, and broadcast the new `closes_at`. Applied **once per triggering action**; every row created in that action shares the same `bid_time`. Never shortens, no cap on count.

### Automatic bidding (3.5)
- **A1** A buyer sets a maximum per auction. It must be ≥ `min_next_bid` (`AUTO_BID_TOO_LOW`).
- **A2** Maximums are **raise-only** and are never cancelled or lowered (`AUTO_BID_LOWER`). They are public.
- **A3** The app bids for the buyer only as much as needed to keep them in the lead, and never above their maximum.
- **A4** Automatic bids obey the same minimum rule as manual bids (B1) and are stored with `source = 'auto'`.
- **A5** Setting a maximum when not leading places an immediate bid (counts as a valid bid for E1). Raising it while leading places no bid.
- **A6** Resolution algorithm: Section 6.

### Sale
- **S1** Seller approve (from `pending_approval`): status → `reserved`, `decided_at` set, `pickup_deadline` = now + 72 h. Winner notified.
- **S2** While `reserved` or `sold`, seller and winner can see each other's `contact`. Nobody else ever can.
- **S3** Seller reject (from `pending_approval`): `reason` required; status → `rejected`; winner notified. There is no approval timeout (documented limit).
- **S4** Handover: in `reserved`, the seller and the winner each confirm. When both timestamps are set, status → `sold`.
- **S5** Failed pickup: in `reserved`, either seller or winner may report it with a `reason`; or the closer sets it when `pickup_deadline` passes (reason "Pickup window expired"). Both parties notified.
- **S6** Every transition writes an `auction_events` row and uses the transition table in Section 5.

### Wants (3.3)
- **W1** A want = `keywords`, optional `category`, `max_price`. It matches an auction when status is `open`, `starting_price ≤ max_price`, the category matches (if set), and `search @@ plainto_tsquery('english', keywords)`.
- **W2** On listing creation, in the same transaction, match all active wants of other users and write `want_match` notifications.
- **W3** On want creation, match against currently open auctions immediately.
- **W4** At most one alert per (want, auction) via `want_matches`. Alerts are stored, so offline users see them on next sign-in.

### Questions (3.2)
- **Q1** Signed-in users except the seller can ask. Public thread per auction.
- **Q2** Body 5–280 chars; URLs (`https?://` or `www.`) are rejected.
- **Q3** Limits: ≤ 3 unanswered questions per user per auction; ≤ 10 questions per user per hour (`RATE_LIMITED`).
- **Q4** Exact duplicates (case/whitespace-normalized) on the same auction are rejected (`DUPLICATE_QUESTION`).
- **Q5** `GET …/questions/similar?q=` returns up to 3 visible questions on this auction with `similarity(body, q) ≥ 0.4`. The UI shows them before the user posts.
- **Q6** Seller answers, toggles FAQ (pinned first) and hides questions. Hidden ones are visible only to the seller.
- **Q7** Seller can pre-write ≤ 5 FAQs at listing time (`is_faq = true`, already answered).
- **Q8** Notify the seller on a new question, and the asker on an answer.

### Notifications (2.5)
- **N1** Every notification is a stored row, pushed over `GET /api/me/stream`, and shown in the in-app feed.
- **N2** The browser permission is requested only by a button click (never on page load).
- **N3** When a notification arrives over SSE, `document.hidden` is true and permission is `granted`, show `new Notification(title, {body, tag})`. No service worker.

| Event | Recipients | `type` |
|---|---|---|
| New bid | Seller | `new_bid` |
| Overtaken as leader | Previous leader | `outbid` |
| Auto-bid max exceeded by others | That bidder | `auto_bid_exceeded` |
| Closing time extended | All bidders | `extended` |
| Ending soon | Bidders + seller | `ending_soon` |
| Auction closed with bids | Winner (`won_pending`), seller (`closed`), other bidders (`closed`) | |
| Approved / rejected | Winner | `approved` / `rejected` |
| Cancelled | All bidders | `cancelled` |
| Other side confirmed handover | Counterparty | `handover` |
| Sold | Both | `sold` |
| Failed pickup | Both | `failed_pickup` |
| Unsold | Seller | `unsold` |
| Want matched | Wanter | `want_match` |
| Question / answer | Seller / asker | `question` / `answer` |

### AI assistant (3.1)
- **AI1** Tab "Assistant": `POST /api/assistant/chat {message}` → `{reply, proposals[]}`. History is stored.
- **AI2** The model has exactly three tools: `search_auctions(query, category?, max_price?)`, `get_auction(id)`, `propose_bid(auction_id, max_amount)`. `propose_bid` only inserts a `pending` row in `assistant_proposals`.
- **AI3** **Never acts without the student's go-ahead:** a proposal becomes an auto-bid only when the signed-in user calls `POST /assistant/proposals/:id/confirm`. Assistant code must not import `placeBid` or `setAutoBid`.
- **AI4** **Never exceeds the agreed limit:** confirm takes `max_amount` ≤ the proposal's `max_amount` (user may lower, never raise) and ≥ `min_next_bid`. It calls `setAutoBid(via='assistant')`, so engine rules A1–A5 apply.
- **AI5** **Never reveals account details:** tool results are built by an explicit whitelist mapper (public auction fields and public bidder display names only). No email, contact or password hash ever enters the model context.
- **AI6** Listing text is untrusted data: passed to the model inside clearly delimited blocks, with a system instruction to ignore instructions inside it. Proposals expire after 30 min (`expired`).
- **AI7** Fallback without an API key: a rule-based parser (category keyword + "under/below/up to ₹N") that runs `search_auctions` and returns the best match with a proposal.

---

## 5. Auction state machine

```
open ──cancel──────────────────────────────▶ cancelled
open ──closes, 0 bids──────────────────────▶ unsold
open ──closes, ≥1 bid──▶ pending_approval ──approve──▶ reserved ──both confirm──▶ sold
                                    └──reject──▶ rejected          └──failure / 72h──▶ failed_pickup
```

| From | To | Who | Required | Side effects |
|---|---|---|---|---|
| open | cancelled | seller | reason | event, notify bidders |
| open | unsold | system (closer) | 0 bids | event, notify seller |
| open | pending_approval | system (closer) | ≥ 1 bid | winner set, event, notify winner/seller/others |
| pending_approval | reserved | seller | none | `pickup_deadline`, event, notify winner, reveal contacts |
| pending_approval | rejected | seller | reason | event, notify winner |
| reserved | sold | seller **and** winner (both confirm) | both timestamps | event, notify both |
| reserved | failed_pickup | seller, winner, or system (deadline) | reason | event, notify both |

Terminal: `sold`, `unsold`, `rejected`, `cancelled`, `failed_pickup`. Only these transitions exist; the schema's CHECK constraints reject inconsistent rows.

---

## 6. Bid engine spec

### `placeBid(auctionId, bidderId, amount)`: one transaction
1. `SELECT … FROM auctions WHERE id = $1 FOR UPDATE`.
2. `t = clock_timestamp()`.
3. Reject: not found; not open or `t ≥ closes_at` (also close lazily, C4); seller (B4); leader (B4); `amount < min_next_bid` (B1).
4. Insert the manual bid; update `current_price`, `leader_id`, `bid_count`.
5. Extension (E1) using `t`.
6. Load `auto_bids`; run `resolveAutoBids`; insert the returned rows (`source='auto'`, same `t`); update price and leader.
7. Insert events and notifications. Commit. **Then** broadcast over SSE.

### `setAutoBid(auctionId, bidderId, max, via)`
Lock, `t`, validate (open, not seller, `max ≥ min_next_bid`, not lower than existing max). Upsert `auto_bids` (`priority_at` = `clock_timestamp()` on create or raise). If the bidder is not the leader: record their capacity and run `resolveAutoBids`; the first auto row is their immediate bid. Then the same steps 5–7.

### `resolveAutoBids(snapshot, caps)` is a pure function (`engine/autoBid.ts`)
Inputs: `startingPrice`, `increment`, `currentPrice | null`, `leaderId | null`, and `caps = [{bidderId, max, priorityAt}]`. Output: the planned bids, final price, final leader.

Let `N` = next minimum bid. Loop:
1. Challenger C = the cap (not the leader) with `max ≥ N`, highest `max` first, ties by earlier `priorityAt`. None → stop.
2. No leader yet → C bids `N`.
3. Leader cap `M_L` = leader's auto max, or the current price if none. If `M_L < N + increment` (the leader cannot answer even C's minimum bid) → C bids `N` and leads.
4. Otherwise the higher cap wins (tie → earlier `priorityAt`):
   - **C wins:** final = `min(C.max, M_L + inc)`. Leader's last bid = `min(M_L, final − inc)`, then C bids `final`.
   - **Leader wins:** final = `min(M_L, C.max + inc)`. C's last bid = `min(C.max, final − inc)`, then the leader bids `final`.
5. Repeat until nobody else can legally bid. Intermediate rungs of the bid war are skipped (they would be outbid in the same instant). At most 2 rows per pair.

**Verified in a prototype before this plan was written** (start 1000, increment 50). The implementation must reproduce these as unit tests:

| # | Situation | Planned bids | Final |
|---|---|---|---|
| 1 | No bids; C sets auto 1800 | C 1000 | C at 1000 |
| 2 | Leader B manual 1200; A has auto 1800 | A 1250 | A at 1250 |
| 3 | Leader B manual 1900; A has auto 1800 | none | B at 1900 |
| 4 | A auto 1800 leads at 1700; C sets auto 1820 | A 1770, C 1820 | C at 1820 |
| 5 | Same, C's max 1800 (A set first) | C 1750, A 1800 | A at 1800 |
| 6 | A auto 1740 leads at 1700; C auto 1900 | C 1750 | C at 1750 (A can't answer by one increment) |
| 7 | Leader L auto 1800 at 1000; C1 auto 1500; C2 auto 1700 | C2 1700, L 1750 | L at 1750 |

The prototype also passed 20,000 randomized cases with these invariants. Keep them as a property test:
- amounts strictly increase,
- every bid ≥ previous price + increment (or the starting price for the first),
- no bid exceeds its bidder's max,
- the last planned bid belongs to the final leader at the final price,
- no other cap can still legally bid.

### Concurrency
Two bids on one auction are serialized by the row lock; `UNIQUE (auction_id, amount)` is a second safety net.

---

## 7. API contract

Errors: `{ "error": { "code": "BID_TOO_LOW", "message": "…", "details": {…} } }`. Success returns the JSON body directly (201 for creates). All inputs validated with zod.

**Error codes (complete list):** `VALIDATION` 400 · `UNAUTHENTICATED` 401 · `BAD_CREDENTIALS` 401 · `FORBIDDEN` 403 · `OWN_AUCTION` 403 · `NOT_FOUND` 404 · `EMAIL_TAKEN` 409 · `AUCTION_CLOSED` 409 · `ALREADY_LEADING` 409 · `BID_TOO_LOW` 409 (`details.min_next_bid`) · `AUTO_BID_TOO_LOW` 409 · `AUTO_BID_LOWER` 409 · `LISTING_LOCKED` 409 · `INVALID_STATE` 409 · `DUPLICATE_QUESTION` 409 · `PROPOSAL_NOT_PENDING` 409 · `RATE_LIMITED` 429 · `INTERNAL` 500.

| Endpoint | Auth | Body / query | Success |
|---|---|---|---|
| `POST /api/auth/register` | – | `{name, email, password(≥8), contact?}` | 201 `{user}` + cookie |
| `POST /api/auth/login` | – | `{email, password}` | `{user}` + cookie |
| `POST /api/auth/logout` | – | – | 204 |
| `GET /api/auth/me` | opt | – | `{user}` or `{user:null}` |
| `GET /api/meta` | – | – | `{categories, conditions, rules, server_time}` |
| `GET /api/auctions` | – | `q, category, condition, min_price, max_price, closing_soon, status, sort, page, limit` | `{items: AuctionSummary[], total, page, limit}` |
| `POST /api/auctions` | ✔ | multipart: fields (L2) + `photos[]` + optional `faqs` JSON | 201 `AuctionDetail` |
| `GET /api/auctions/:id` | opt | – | `AuctionDetail` |
| `PATCH /api/auctions/:id` | ✔ seller | editable fields (L3) | `AuctionDetail` |
| `POST /api/auctions/:id/cancel` | ✔ seller | `{reason}` | `AuctionDetail` |
| `POST /api/auctions/:id/relist` | ✔ seller | `{closes_at}` | 201 `AuctionDetail` |
| `POST /api/auctions/:id/bids` | ✔ | `{amount}` | 201 `{bid, auction}` |
| `PUT /api/auctions/:id/auto-bid` | ✔ | `{max_amount}` | `{auto_bid, auction}` |
| `POST /api/auctions/:id/approve` | ✔ seller | – | `AuctionDetail` |
| `POST /api/auctions/:id/reject` | ✔ seller | `{reason}` | `AuctionDetail` |
| `POST /api/auctions/:id/handover` | ✔ seller or winner | – | `AuctionDetail` |
| `POST /api/auctions/:id/failed-pickup` | ✔ seller or winner | `{reason}` | `AuctionDetail` |
| `GET /api/me/auctions` | ✔ | `role=selling\|bidding` | `AuctionSummary[]` |
| `GET /api/auctions/:id/questions` | opt | – | `Question[]` (FAQ first, then newest) |
| `GET /api/auctions/:id/questions/similar` | ✔ | `q` | `Question[]` (≤ 3) |
| `POST /api/auctions/:id/questions` | ✔ | `{body}` | 201 `Question` |
| `POST /api/questions/:qid/answer` | ✔ seller | `{answer}` | `Question` |
| `POST /api/questions/:qid/faq` | ✔ seller | `{is_faq}` | `Question` |
| `POST /api/questions/:qid/hide` | ✔ seller | – | 204 |
| `GET/POST /api/wants`, `DELETE /api/wants/:id` | ✔ | `{keywords, category?, max_price}` | `Want` / `Want[]` |
| `GET /api/notifications` | ✔ | `limit, before` | `{items, unread_count}` |
| `POST /api/notifications/read` | ✔ | `{ids?}` (none = all) | 204 |
| `POST /api/assistant/chat` | ✔ | `{message}` | `{reply, proposals}` |
| `GET /api/assistant/history` | ✔ | – | `{messages, proposals}` |
| `POST /api/assistant/proposals/:id/confirm` | ✔ | `{max_amount}` | `{auto_bid, auction}` |
| `POST /api/assistant/proposals/:id/cancel` | ✔ | – | 204 |
| `GET /api/auctions/:id/stream` | – | SSE | events below |
| `GET /api/me/stream` | ✔ | SSE | events below |

**DTOs** (explicit mappers; never `SELECT *` into a response):
- `AuctionSummary`: `id, title, category, condition, starting_price, min_increment, display_price, current_price|null, bid_count, leader_name|null, closes_at, status, photo|null, seller{id,name}`.
- `AuctionDetail` = Summary + `description, original_closes_at, extension_count, min_next_bid, photos[], bids[{id, bidder{id,name}, amount, source, placed_at, caused_extension}], auto_bids[{bidder{id,name}, max_amount, via}], winner{id,name}|null, outcome_reason|null, counterparty_contact|null` (contact only for seller/winner while reserved or sold), `server_time`.
- Never returned anywhere: `email`, `password_hash`, any other user's `contact`.

**SSE events**
- `/auctions/:id/stream`: `snapshot` on connect; `bid` `{bids[], current_price, leader_name, bid_count, closes_at, extension_count, min_next_bid}`; `status` `{status}`; `question`; `heartbeat` `{server_time}` every 15 s.
- `/me/stream`: `notification` `{id, type, title, body, auction_id, created_at}`; `heartbeat`.

---

## 8. Frontend

Routes: `/` browse · `/auctions/:id` · `/sell/new` · `/sell/:id/edit` · `/me/selling` · `/me/bidding` · `/wants` · `/assistant` · `/notifications` · `/login` · `/register`.

- Countdown: `useCountdown(closesAt)` uses a server-time offset (from `/api/meta` and SSE heartbeats), never the raw local clock. It updates instantly on a `bid` event carrying a new `closes_at`.
- All server access goes through `lib/api.ts`; no `fetch` inside components.
- Auction page shows: gallery, leader and price, `min_next_bid`, bid form, auto-bid form (with public maximums list), full history, Q&A, seller actions by status.
- Empty and error states: say what happened and what to do next.
- UI is restrained: neutral palette, one accent colour, one typeface family. Responsive, visible focus states.

---

## 9. Testing (Vitest)

**Engine unit tests (pure):** the 7 table cases in Section 6; the property test; `nextMinBid`; `extendedClose` boundaries (exactly 30.000 s extends, 30.001 s does not, after close → none).

**Integration tests (real Postgres `campus_auction_test`):**
- `I-01` 20 parallel identical bids → exactly one succeeds.
- `I-02` Bid below minimum, first bid below start, bid after close, seller bids, leader re-bids → correct error codes.
- `I-03` Extension at 30 s boundary; the new `closes_at` is stored.
- `I-04` Closer: bids → `pending_approval` with winner; none → `unsold`.
- `I-05` Approve → reserved; both handovers → sold; one handover → still reserved.
- `I-06` Reject / cancel / failed pickup each store reason and an event row.
- `I-07` Pickup-deadline expiry → `failed_pickup`.
- `I-08` Auto-bid end to end (cases 2, 4, 5).
- `I-09` Want created before a listing → notification exists after the listing is created.
- `I-10` Q&A: duplicate, rate limit, URL block.
- `I-11` **Privacy:** no response in the suite contains `email`, `password_hash`, or another user's `contact`.
- `I-12` Assistant: tool results contain no private fields; proposal confirm cannot exceed the proposal max; confirming twice → `PROPOSAL_NOT_PENDING`.

---

## 10. Milestones and commits

Commit after every completed piece (Conventional Commits). The history is judged; never rewrite it.

| Time | Milestone | Done when |
|---|---|---|
| 0:00–0:30 | **M0** repo, docs, schema, skeleton | App boots, `npm run db:migrate` applies `001_init.sql`, typecheck passes |
| 0:30–2:30 | **M1** auth, listings, photos, browse + filters | L1–L5, BR1–BR3 work in the UI |
| 2:30–4:30 | **M2** bid engine + auction page + SSE | B1–B6, E1, A1–A6; engine tests green; two browser tabs show live bids and countdown |
| 4:30–5:30 | **M3** closing, approval, handover, outcomes | C1–C5, S1–S6; `I-04…I-07` green |
| 5:30–6:15 | **M4** notifications | N1–N3; table in Section 4 implemented |
| 6:15–7:15 | **M5** wants + Q&A | W1–W4, Q1–Q8 |
| 7:15–9:00 | **M6** AI assistant | AI1–AI7; `I-12` green |
| 9:00–10:00 | **M7** seed data, README, demo run | Judges can sign in with demo accounts and see every feature |

**If behind:** drop Q&A similarity first (keep rate limits), then the LLM layer (keep the rule-based fallback). Never cut the engine tests.

**Seed data (M7):** 3 demo users; ~12 auctions across all categories with different closing times, including one closing in ~2 minutes (to show the extension); bids including one public auto-bid max; an unsold example and a `pending_approval` example; two Q&A threads; one want.

---

## 11. Assumptions to state in the README

- Leaders cannot rebid manually; they raise their auto-bid maximum.
- Maximums are raise-only (they are public, so retreating would be a bluff).
- Edits lock after the first bid (description only).
- Cancel only while open. Reserved items that fall through end as `failed_pickup`.
- Approval has no timeout; the pickup window is 72 h.
- An auto-bid must still satisfy the minimum increment, so a maximum within one increment of the leader's can lose (case 6).
- Intermediate steps of an auto-bid war are not written to history; the last two bids are.
- Out of scope: payments, email/SMS, offering the item to the runner-up after a failed pickup, image moderation, multi-server realtime.
