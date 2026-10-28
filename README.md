<p align="center">
  <img src="client/public/logo-mark.png" alt="SenBye Logo" width="130" />
</p>

<h1 align="center">SenBye — Campus Auction Marketplace</h1>

<p align="center">
  <strong>“Seniors move on. Good stuff moves forward.”</strong><br/>
  <em>Where graduating seniors pass down valuable campus gear to juniors through fair, transparent, and anti-sniped auctions.</em>
</p>

---

**SenBye** solves the chaotic end-of-semester campus rush when graduating seniors need to pass down bicycles, scientific calculators, engineering textbooks, lab gear, and hostel appliances to incoming juniors. Instead of unorganized WhatsApp group spam or unfair backroom deals, SenBye provides a competitive, transparent, and verified campus auction platform.

---

## ⚡ Quick Start for Judges & Evaluators

### 1. Prerequisites
- **Node.js**: v20.x or newer
- **PostgreSQL**: 14+ running locally (default database: `senbye`, user: `mohmedh`, password: `password` or configured via `.env`)

### 2. Setup & Database Seeding
```bash
# 1. Install root, server, and client dependencies
npm install

# 2. Run schema migrations
npm run db:migrate

# 3. Populate rich realistic campus demo data
npm run db:seed
```

### 3. Run Development Servers
```bash
npm run dev
```
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **API Server & SSE**: [http://localhost:4000](http://localhost:4000)

---

## 🎓 Demo Accounts & Evaluation Script

The database is pre-seeded with 3 active demo students (password for all is `password123`):

| User | Role / Description | Email | Password |
|---|---|---|---|
| **Arun Senior** | Graduating B.Tech 4th year (Seller) | `arun@campus.edu` | `password123` |
| **Priya Junior** | 3rd Year CSE (Bidder & Leader) | `priya@campus.edu` | `password123` |
| **Rahul Sophomore** | 2nd Year ECE (Challenger & Wanters) | `rahul@campus.edu` | `password123` |

### 5-Minute Feature Walkthrough Tour

1. **Anti-Sniping Live Extension (Rule E1)**:
   - Open two browser tabs (or an incognito window). Sign into Tab 1 as **Priya** and Tab 2 as **Rahul**.
   - Navigate to the **"Btwin Rockrider 26T MTB Cycle"** listing (pre-seeded to close in **~2 minutes**).
   - Watch the live countdown ticking synchronously using server-offset clock sync.
   - When the countdown drops below **30 seconds**, submit a bid as Rahul.
   - **Result**: Anti-sniping triggers instantly across both tabs via SSE, displaying the warning flash and extending `closes_at` by **+60 seconds**!

2. **Transparent Automatic Bidding (Rules A1–A6)**:
   - Navigate to the **"Casio fx-991EX ClassWiz Calculator"** listing.
   - Notice the **Auto-Bid Caps Table** showing Priya's and Rahul's public maximums.
   - Submit a new manual bid or raise your proxy cap. The pure bid resolution engine automatically calculates the minimal winning increment without writing superfluous intermediate bid spam.

3. **Sale Lifecycle, Contact Disclosure & Dual Handover (Rules S1–S5)**:
   - Sign in as **Arun** (Seller):
     - Check **"GATE CSE Core Textbook Bundle"**: It is in `pending_approval` state. Test the "Approve Winning Bid" or "Reject with Reason" controls.
     - Check **"Ergonomic High-Back Study Chair"**: It is in `reserved` state with a 72-hour pickup deadline countdown.
   - Notice **Rule S2 Contact Disclosure**: Arun and Priya can exclusively see each other's verified phone numbers (`+91-98765-11111` and `+91-98765-22222`) to arrange collection at the hostel room. Other students see nothing.
   - Test **Dual Handover Confirmation (Rule S4)**: Both parties confirm item pickup. When both timestamps are set, status transitions automatically to `sold`.

4. **Saved Wants & Match Engine (Rules W1–W4)**:
   - Click the **"Wants"** tab in the navigation.
   - Create a saved want (e.g., "Casio calculator", max budget ₹800).
   - SenBye's match engine immediately checks against existing open auctions (`search @@ plainto_tsquery('english', keywords)`), logs duplicate-free records in `want_matches`, and sends instant notifications.

5. **Public Anti-Spam Q&A Thread (Rules Q1–Q8)**:
   - Open any auction page and scroll to the Q&A thread.
   - Notice pinned **FAQs** authored by the seller.
   - Start typing in the "Ask Question" box: SenBye runs live debounced `pg_trgm` similarity search (`similarity >= 0.4`) to suggest already-answered questions before you post!
   - Spam protection prevents links (`https://` or `www.`), duplicate questions, and rate-limits unanswered spam.

6. **AI Assistant with Safety Guarantees (Rules AI1–AI7)**:
   - Click the **"Assistant"** tab.
   - Ask: *"Can you help me find a cycle under 2500 and set up a bid?"*
   - Powered by Google Gemma 4 (with OpenRouter and deterministic Rule AI7 fallbacks).
   - **Rule AI3 Guarantee**: The assistant *never* places a bid automatically. It generates an interactive **Bid Proposal Card**.
   - **Rule AI4 Boundary**: The student can adjust their auto-bid ceiling down, but can never exceed the agreed proposal ceiling before confirming.

---

## 🏗️ Architecture & Core Invariants

SenBye follows a strict, single-writer layered architecture:

```
campus-auction/
├── server/
│   ├── src/
│   │   ├── engine/           Pure functions: no DB, no clock, no I/O (Rules B1, E1, A3–A6)
│   │   ├── services/         Transactional business logic and SQL
│   │   │   ├── bidEngine.ts  Sole writer of bids and auction price state
│   │   │   ├── saleService.ts Sole writer of post-close status transitions
│   │   │   ├── closer.ts     1s ticker daemon checking due closings and 72h pickup expiry
│   │   │   ├── wantsService.ts Full-text search matching engine (Rule W1–W4)
│   │   │   ├── questionsService.ts pg_trgm similarity thread and anti-spam
│   │   │   └── assistantService.ts Multi-provider AI loop with proposal state machine
│   │   ├── dto/mappers.ts    Strict whitelist mappers (Rule AI5, Privacy Rule I-11)
│   │   └── routes/           Thin Express routes with zod schema validation
│   └── test/                 Vitest unit and PostgreSQL integration test suites
└── client/
    ├── src/
    │   ├── lib/              API fetch wrapper, server clock sync, SSE stream listeners
    │   ├── components/       Countdown, BidPanel, BidHistory, SellerActions, QASection
    │   └── pages/            Browse, Detail, Listing CRUD, MySales, MyBids, Wants, Assistant
```

### Safety & Concurrency Guarantees
- **Row-Level Serialization**: Bids acquire `SELECT ... FROM auctions WHERE id = $1 FOR UPDATE`. Race conditions on simultaneous bids are strictly serialized. `UNIQUE (auction_id, amount)` acts as a secondary database constraint.
- **Clock Authority**: Extensions are calculated using PostgreSQL's authoritative transaction clock (`clock_timestamp()`). The client UI synchronizes against server time via `/api/meta` offsets and SSE heartbeats.
- **Privacy Audit**: No database passwords, bcrypt hashes, user emails, or unreserved phone numbers are ever leaked over public REST endpoints or LLM contexts.

---

## 🧪 Automated Verification Suite

Run all tests across the pure engine and database integration suites:

```bash
# Run 30 integration and engine test cases
npm test

# Run TypeScript typechecks across backend and frontend
npm run typecheck
```

### Test Coverage Highlights
- `I-01`: 20 parallel identical bids $\rightarrow$ exactly one succeeds, 19 rejected (concurrency test).
- `I-02`: Rejection error codes (bid below start, seller bid, leader re-bid, bid below min).
- `I-03`: Anti-sniping extension at 30s boundary extends `closes_at` by 60s.
- `I-04`: Closer daemon closes due auctions with winner or unsold.
- `I-05`: Approve $\rightarrow$ reserved $\rightarrow$ contact disclosure $\rightarrow$ dual handover $\rightarrow$ sold.
- `I-06` & `I-07`: Reject / cancel / failed pickup outcome reasons and 72h deadline expiry.
- `I-08`: Auto-bid resolution reproducing all 7 reference test cases.
- `I-09`: Saved wants full-text search match engine and notification dispatch.
- `I-10`: Public Q&A URL blocking, duplicate rejection, and `pg_trgm` similarity search.
- `I-11`: Full privacy audit across all endpoints.
- `I-12`: AI Assistant whitelist privacy, proposal confirmation boundaries, and 30-min expiration.

---

## 📌 Stated Assumptions

As specified in the hackathon brief and master architecture plan:
1. **Leader Re-Bidding**: Current leaders cannot place lower manual bids; they increase their capacity by updating their auto-bid maximum.
2. **Raise-Only Auto-Bids**: Maximums are public to prevent hidden shill games; retreating an announced maximum is disallowed.
3. **Edit Locking**: Listing details (price, duration, photos) are immutable after the first bid is accepted; only the textual description can be edited.
4. **Cancellation**: Sellers may only cancel an auction while status is `open` (with a mandatory reason logged in `auction_events`). Reserved transactions that fall through transition to `failed_pickup`.
5. **Pickup Window**: Seller approval has no timeout; once approved, the handover pickup deadline is 72 hours.
6. **Increment Priority**: Competing proxy bids skip intermediate war rungs; only the final two decisive bids are stored.
7. **Scope Boundaries**: Payments are out of scope (direct campus cash/UPI on physical item handover); image moderation and multi-datacenter replication are excluded.

---

*Built with ❤️ for campus communities.*
