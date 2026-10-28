# SenBye

> Build the place where campus competes fairly for them, and every item finds its next owner.

**SenBye** is an auction marketplace designed for campus seniors graduating and leaving behind items (cycles, calculators, books, hostel appliances), enabling juniors to compete and buy fairly via timed auctions.

## Tech Stack
- **Frontend**: React 18, Vite 6, TypeScript, Tailwind CSS 4, React Router 6
- **Backend**: Node.js ≥ 20, Express 5, TypeScript (`tsx`), zod 3, `pg` driver (raw SQL, no ORM)
- **Database**: PostgreSQL
- **Realtime**: Server-Sent Events (SSE)
- **AI**: Anthropic API (`@anthropic-ai/sdk`) with tool calling and rule-based fallback

## Quick Start

### 1. Requirements
- Node.js ≥ 20.x
- Local PostgreSQL instance with user `mohmedh`

### 2. Setup Database
```bash
npm run db:setup
```

### 3. Install & Migrate
```bash
npm install
npm run db:migrate
```

### 4. Run Development Servers
```bash
npm run dev
```
- Client runs at: `http://localhost:5173`
- Server runs at: `http://localhost:4000`

### 5. Running Tests
```bash
npm test
npm run typecheck
```
