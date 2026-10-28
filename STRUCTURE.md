# Campus Auction: STRUCTURE.md

The target project skeleton. Create **exactly these paths**, nothing else, in the first 30 minutes (M0). Rule IDs refer to `PLAN.md`. Status:

- `[real]` fully implemented at M0
- `[stub]` created at M0 with typed signatures that `throw new NotImplementedError('<rule id>')`, implemented in the milestone shown
- `[later]` created in the milestone shown, not at M0

---

## 1. Directory tree

```
campus-auction/
├── AGENT.md                      [real]  rules for the coding agent (read first, every session)
├── PLAN.md                       [real]  the plan, rules, API contract, milestones
├── STRUCTURE.md                  [real]  this file
├── README.md                     [real]  run instructions + assumptions (finalised in M7)
├── package.json                  [real]  npm workspaces: server, client; root scripts
├── .gitignore                    [real]  node_modules, dist, .env, server/uploads/*
├── .env.example                  [real]  every env var the app reads (and only those)
├── docker-compose.yml            [real]  optional Postgres 16 for dev
├── docs/
│   └── problem_statement.md      [real]  the brief, copied verbatim (source of truth #1)
├── scripts/
│   ├── setup-db.sh               [real]  native Postgres on Linux: role + dev DB + test DB
│   └── first-commits.sh          [later] helper for the opening commit series (optional)
│
├── server/
│   ├── package.json              [real]
│   ├── tsconfig.json             [real]  strict, noEmit, ESNext + Bundler resolution
│   ├── vitest.config.ts          [real]  node env; integration tests set NODE_ENV=test
│   ├── uploads/.gitkeep          [real]  photo storage dir (contents git-ignored)
│   ├── src/
│   │   ├── index.ts              [real]  createApp() + listen + startCloser()
│   │   ├── config.ts             [real]  env + ALL business constants (config.rules)
│   │   ├── errors.ts             [real]  HttpError, NotImplementedError, error codes (PLAN §7)
│   │   │
│   │   ├── db/
│   │   │   ├── pool.ts           [real]  pg Pool, int8→number parser, withTx()
│   │   │   ├── migrate.ts        [real]  runs migrations/*.sql in order, once each
│   │   │   ├── seed.ts           [stub]  demo data (M7)
│   │   │   └── migrations/
│   │   │       └── 001_init.sql  [real]  the schema, exactly as delivered
│   │   │
│   │   ├── engine/               PURE logic: no db, no express, no I/O
│   │   │   ├── rules.ts          [real]  nextMinBid(), extendedClose()      (B1, E1)
│   │   │   └── autoBid.ts        [real]  resolveAutoBids()                  (A3–A6)
│   │   │
│   │   ├── services/             all business logic + SQL lives here
│   │   │   ├── bidEngine.ts      [stub]  placeBid(), setAutoBid()           (B*, E1, A*)  M2
│   │   │   ├── auctionService.ts [stub]  create/edit/cancel/relist/list/get (L*, BR*)     M1
│   │   │   ├── saleService.ts    [stub]  close, approve, reject, handover,
│   │   │   │                             failedPickup, expirePickups        (C*, S*)      M3
│   │   │   ├── closer.ts         [stub]  1 s ticker → closeDue, endingSoon, expirePickups  M3
│   │   │   ├── notifier.ts       [stub]  notify() inserts rows (+ SSE push after commit)   M4
│   │   │   ├── sseHub.ts         [stub]  in-memory auction + user channels, heartbeat      M2
│   │   │   ├── wantsService.ts   [stub]  CRUD + matching                    (W*)          M5
│   │   │   ├── questionsService.ts [stub] ask/similar/answer/faq/hide       (Q*)          M5
│   │   │   ├── assistantService.ts [stub] chat loop, tools, proposals       (AI*)         M6
│   │   │   ├── assistantTools.ts [stub]  tool schemas + WHITELIST mappers   (AI2, AI5)    M6
│   │   │   └── authService.ts    [stub]  register/login/hash/verify                       M1
│   │   │
│   │   ├── dto/
│   │   │   └── mappers.ts        [stub]  row → AuctionSummary/Detail/Question/…; the ONLY
│   │   │                                 place allowed to shape API output (PLAN §7)       M1
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts           [real]  optionalAuth, requireAuth, session cookie helpers
│   │   │   ├── error.ts          [real]  error handler (HttpError, ZodError → JSON)
│   │   │   └── upload.ts         [real]  multer: 1–5 images, type + size limits
│   │   │
│   │   └── routes/               thin: parse (zod) → call service → map DTO → respond
│   │       ├── index.ts          [real]  mounts every router under /api
│   │       ├── auth.ts           [stub]  /auth/*
│   │       ├── meta.ts           [real]  GET /meta
│   │       ├── auctions.ts       [stub]  /auctions, /auctions/:id, cancel, relist, /me/auctions
│   │       ├── bids.ts           [stub]  POST /auctions/:id/bids, PUT …/auto-bid
│   │       ├── sale.ts           [stub]  approve, reject, handover, failed-pickup
│   │       ├── questions.ts      [stub]  /auctions/:id/questions*, /questions/:qid/*
│   │       ├── wants.ts          [stub]  /wants*
│   │       ├── notifications.ts  [stub]  /notifications*
│   │       ├── assistant.ts      [stub]  /assistant/*
│   │       └── stream.ts         [stub]  GET /auctions/:id/stream, GET /me/stream
│   │
│   └── test/
│       ├── engine/
│       │   ├── autoBid.test.ts   [stub]  the 7 cases + property test (PLAN §6, §9)
│       │   └── rules.test.ts     [stub]  nextMinBid, extendedClose boundaries
│       ├── integration/
│       │   ├── helpers.ts        [stub]  test DB reset (TRUNCATE), user/auction factories
│       │   ├── bidding.test.ts   [stub]  I-01, I-02, I-03, I-08
│       │   ├── sale.test.ts      [stub]  I-04…I-07
│       │   ├── wants-questions.test.ts [stub] I-09, I-10
│       │   ├── privacy.test.ts   [stub]  I-11
│       │   └── assistant.test.ts [stub]  I-12
│       └── setup.ts              [stub]  runs migrations against TEST_DATABASE_URL
│
└── client/
    ├── package.json              [real]
    ├── index.html                [real]
    ├── vite.config.ts            [real]  react plugin + @tailwindcss/vite; proxy /api and /uploads → :4000
    ├── tsconfig.json             [real]  strict, noEmit
    └── src/
        ├── main.tsx              [real]  mounts <App/> with the router
        ├── App.tsx               [real]  route table (PLAN §8)
        ├── index.css             [real]  `@import "tailwindcss";` + design tokens
        ├── lib/
        │   ├── api.ts            [real]  typed fetch wrapper (credentials, error → ApiError)
        │   ├── types.ts          [stub]  TS types mirroring PLAN §7 DTOs
        │   ├── clock.ts          [stub]  server-time offset + useCountdown()    (BR3)    M2
        │   ├── stream.ts         [stub]  EventSource helpers for both SSE streams        M2
        │   ├── browserNotify.ts  [stub]  permission button + show on hidden tab (N2, N3) M4
        │   └── format.ts         [real]  ₹ formatting, relative time
        ├── context/
        │   └── AuthContext.tsx   [stub]  current user, login/logout                      M1
        ├── components/
        │   ├── Layout.tsx        [real]  header, nav, notification bell slot, <Outlet/>
        │   ├── AuctionCard.tsx   [stub]  summary card with its own countdown             M1
        │   ├── Countdown.tsx     [stub]  renders useCountdown()                          M2
        │   ├── BidPanel.tsx      [stub]  manual bid + auto-bid forms, public maxima      M2
        │   ├── BidHistory.tsx    [stub]  full history table                              M2
        │   ├── QASection.tsx     [stub]  thread + similar-question hint + seller actions M5
        │   ├── SellerActions.tsx [stub]  approve/reject/handover/cancel by status        M3
        │   └── NotificationBell.tsx [stub] unread count + dropdown                       M4
        └── pages/
            ├── BrowsePage.tsx        [stub]  search + filters + grid                     M1
            ├── AuctionPage.tsx       [stub]  detail page                                 M2
            ├── NewListingPage.tsx    [stub]  create (also used for edit/relist)          M1
            ├── MyListingsPage.tsx    [stub]  /me/selling                                 M1
            ├── MyBidsPage.tsx        [stub]  /me/bidding                                 M2
            ├── WantsPage.tsx         [stub]  saved wants                                 M5
            ├── AssistantPage.tsx     [stub]  chat + proposal confirm cards               M6
            ├── NotificationsPage.tsx [stub]  full feed                                   M4
            └── AuthPages.tsx         [stub]  login + register                            M1
```

---

## 2. Layering rules (enforced in review)

| Layer | May import | Must not |
|---|---|---|
| `routes/*` | `services/*`, `dto/*`, `middleware/*`, zod | contain SQL or business rules |
| `services/*` | `db/*`, `engine/*`, `config`, `errors`, other services | import `express`, read `req`/`res` |
| `engine/*` | nothing from this project except types | import `db`, `express`, `config`, or touch the clock/network |
| `dto/mappers.ts` | types | be bypassed: no route returns a raw DB row |
| `assistantService/Tools` | `auctionService` (read-only functions), `dto` whitelist mappers | import `bidEngine`, or `setAutoBid` (AI3) |
| `client/pages` | `components`, `lib`, `context` | call `fetch` directly (use `lib/api.ts`) |

Single-writer rules (PLAN invariants):
- Only `bidEngine.ts` writes `bids`, `auto_bids`, and `auctions.current_price / leader_id / bid_count / closes_at / extension_count`.
- Only `saleService.ts` (and `auctionService.cancel`) changes `auctions.status`.
- Every status change and every bid writes an `auction_events` row.

---

## 3. Dependencies (use these exact packages; anything else needs approval)

**server**
- runtime: `express@5`, `pg`, `zod@3`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `cors`, `multer`, `dotenv`, `@anthropic-ai/sdk`
- dev: `typescript`, `tsx`, `vitest`, `@types/node`, `@types/express`, `@types/pg`, `@types/bcryptjs`, `@types/jsonwebtoken`, `@types/cookie-parser`, `@types/cors`, `@types/multer`

**client**
- runtime: `react@18`, `react-dom@18`, `react-router-dom@6`
- dev: `vite@6`, `@vitejs/plugin-react`, `tailwindcss@4`, `@tailwindcss/vite`, `typescript`, `@types/react`, `@types/react-dom`

**root**
- dev: `concurrently`

---

## 4. Environment variables (complete list)

| Variable | Used by | Default / note |
|---|---|---|
| `PORT` | server | `4000` |
| `DATABASE_URL` | server | `postgres://campus:campus@localhost:5432/campus_auction` |
| `TEST_DATABASE_URL` | tests | `postgres://campus:campus@localhost:5432/campus_auction_test` |
| `JWT_SECRET` | server | required outside dev |
| `CLIENT_ORIGIN` | server (CORS) | `http://localhost:5173` |
| `ALLOWED_EMAIL_DOMAIN` | server | optional sign-up restriction |
| `EXTENSION_WINDOW_SECONDS` | server | `30` (tests/demo only) |
| `EXTENSION_SECONDS` | server | `60` (tests/demo only) |
| `ANTHROPIC_API_KEY` | assistant | optional; empty → rule-based fallback |
| `ASSISTANT_MODEL` | assistant | `claude-sonnet-5-5`; never hard-code a model name elsewhere |

---

## 5. Root scripts

| Command | Does |
|---|---|
| `npm run db:setup` | native Postgres on Linux (`scripts/setup-db.sh`) |
| `npm run db:up` | Postgres via Docker Compose (optional) |
| `npm run db:migrate` | apply pending migrations |
| `npm run db:seed` | load demo data |
| `npm run dev` | server (`tsx watch`) + client (Vite) together |
| `npm test` | server tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` in server and client |

---

## 6. Naming and conventions

- Files: `camelCase.ts` for modules, `PascalCase.tsx` for React components and pages.
- DB columns `snake_case`; API JSON `snake_case` (matches DB and PLAN §7); TS locals `camelCase`.
- Error codes, notification types, event types and statuses are string literals defined once (`errors.ts`, `notifier.ts`, schema comments). Never invent new ones.
- Test names start with the rule or test ID, e.g. `it('B1: first bid below starting price → BID_TOO_LOW')`.
- Stubs are never silent: `throw new NotImplementedError('B3')`. A function that returns fake data is a bug.
