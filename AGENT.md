# AGENT.md: rules for the coding agent

Read this file, `PLAN.md` and `STRUCTURE.md` at the start of **every** session. You are building the Campus Auction web app (React + Express + PostgreSQL). Build exactly what the plan says. When something is unclear or missing, **stop and ask**; do not guess.

---

## 0. Prime directive

1. Do not invent. Every file, function, column, endpoint, error code, env var, package, CLI flag and API method you use must exist in the plan, the schema, the installed packages, or code you have opened in this session.
2. Do not claim. Say something worked only if you ran it and saw it work.
3. Do not widen scope. One task at a time, smallest correct change.

"I don't know" and "that's not specified in PLAN.md" are correct answers. A confident wrong answer is the worst outcome.

---

## 1. Sources of truth (highest first)

1. `docs/problem_statement.md` (the brief)
2. `PLAN.md`
3. `server/src/db/migrations/*.sql`
4. `STRUCTURE.md`
5. Existing code

If two sources conflict, **stop and report the conflict**; do not pick one silently. Your own memory of how a library, framework or "typical auction app" works is **not** a source.

---

## 2. Anti-hallucination rules (hard)

- **H1. Verify before you reference.** Before using a file, function, type, column, route or config key, open or search it (`ls`, `cat`, `rg -n`). Before using a package, confirm it is installed (`npm ls <pkg>`). Cite `path:line` when you state a fact about the code.
- **H2. Library APIs come from installed code, not memory.** Check `node_modules/<pkg>/` type definitions or README for the installed version before calling an API from Express 5, Tailwind 4, React Router 6, pg, zod, Vite or the Anthropic SDK. If you cannot find it, say so.
- **H3. No new dependencies** without asking. Give name, reason, and the alternative of not adding it.
- **H4. Never fabricate output.** No invented test results, command output, commit hashes, URLs, version numbers, benchmarks or file contents. If you did not run it, write "not run".
- **H5. "Done" means proven.** A task is done only when `npm run typecheck` passes, `npm test` passes (or the relevant subset, stated), and you exercised the feature yourself (test, `curl`, or UI). Paste the exact commands and the real tail of their output.
- **H6. No fake implementations.** No hard-coded or mock data returned from services, no `// simulated`, no `return []` placeholders, no empty `catch {}`. Unfinished code is `throw new NotImplementedError('<rule id>')`.
- **H7. Nothing outside the plan:** no new endpoints, tables, columns, statuses, notification types, event types, error codes, env vars or config keys. Need one? Propose it and wait.
- **H8. Schema discipline.** Never edit a migration after it is committed; add `002_*.sql`. Never "fix" a failing insert by dropping or loosening a constraint; fix the code.
- **H9. No magic numbers.** Business constants come from `config.rules`. Model names come from env `ASSISTANT_MODEL`.
- **H10. Own mistakes plainly.** If you find you were wrong, say so, then fix it. Do not paper over it.
- **H11. Never weaken a test or a constraint to make something pass.** If the same failure persists after 3 genuine attempts, stop and report your diagnosis instead of changing the test.

---

## 3. Non-negotiable invariants

These protect fairness and security. Violating one is a bug even if tests pass.

- **I1.** Bids are created **only** by `services/bidEngine.ts` (`placeBid`, `setAutoBid`). Nothing else writes `bids`, `auto_bids`, or `auctions.current_price / leader_id / bid_count / closes_at / extension_count`.
- **I2.** Every bid runs in **one transaction** with `SELECT … FOR UPDATE` on the auction row. Bid time = `clock_timestamp()` read **inside** the transaction after the lock. Never trust a client timestamp.
- **I3.** Money is an **integer** number of rupees. No floats, no decimals.
- **I4.** A bid is accepted only if: auction `open`, `bid_time < closes_at`, bidder ≠ seller, bidder ≠ current leader (manual), amount ≥ `min_next_bid`. An auto-bid never exceeds its owner's maximum and obeys the same minimum rule.
- **I5.** SQL is **parameterized** (`$1, $2…`). Never build SQL by string concatenation or template-interpolating user input.
- **I6.** Validate every request body and query with **zod** at the route boundary.
- **I7.** API responses use `dto/mappers.ts` only. Never return `email`, `password_hash`, or another user's `contact` (contact only goes to the seller/winner while `reserved`/`sold`). Never `SELECT *` into a response.
- **I8.** The AI assistant can only **create proposals**. A proposal becomes an auto-bid only through the signed-in user's `confirm` request. Assistant code must **not** import `bidEngine`. Tool results use whitelist mappers (public fields only).
- **I9.** Notifications and SSE events are published **after** the transaction commits, never before.
- **I10.** Passwords: bcrypt. Session: httpOnly cookie. No tokens in `localStorage`. No secrets in the repo; `.env` is git-ignored.
- **I11.** `bids` and `auction_events` are append-only (the database enforces it). Never update or delete them.
- **I12.** `auctions.status` changes only via the transitions in PLAN §5, and every change writes an `auction_events` row.
- **I13.** The client never computes time from its own clock alone: countdowns use the server-time offset.

---

## 4. Layering (see `STRUCTURE.md` §2)

`routes` (thin: zod → service → DTO) → `services` (logic + SQL + transactions) → `engine` (pure functions) / `db`.
`engine/*` imports no DB, no Express, no config, and does no I/O. Client pages call the server only through `client/src/lib/api.ts`.

---

## 5. Working method

**Before coding a task**, write 3 lines:
1. the task in your own words,
2. the PLAN rule IDs it implements,
3. the files you will touch (all must exist in `STRUCTURE.md`).

**While coding**
- Read a file before editing it.
- **Targeted edits, not full rewrites.** Only create whole files when they are new. Show diffs, not entire files, in your reports.
- Keep each change small and focused on one piece of the plan.
- Run `npm run typecheck` and the relevant tests after each change, and fix root causes.
- Do not refactor, rename or "tidy" code outside the task.
- Do not delete files, rename directories, or add top-level directories without asking.
- Do not edit `PLAN.md`, `STRUCTURE.md` or this file, except ticking checklist boxes in `PLAN.md` §3. Propose doc changes to the human.

**Git** (commit history is graded)
- Commit after each completed piece, one logical change per commit, Conventional Commits: `feat(engine): …`, `fix(bids): …`, `test(sale): …`, `docs: …`, `chore: …`.
- Only commit when typecheck and relevant tests pass.
- Never `--amend`, rebase, force-push, or rewrite history. Never commit `.env`, `node_modules`, or `server/uploads/*`.

**Planning stays with the human.** Do not start alternative plans or debate the architecture. Design questions go back to the human, who handles planning in a single chat session.

---

## 6. Ask first (stop and wait for a yes)

- adding a dependency,
- any schema change,
- a new endpoint, status, event type, notification type, error code or env var,
- any deviation from PLAN.md,
- changing engine rules (`engine/*`, `bidEngine.ts`),
- anything that deletes data or files.

---

## 7. Code standards

- TypeScript `strict`. No `any`. No `@ts-ignore` / `@ts-expect-error` (if unavoidable, ask).
- Errors are thrown as `HttpError` with a code from PLAN §7. No swallowed errors.
- No leftover `console.log`, no commented-out code, no TODOs without a rule ID (`// TODO(M5/W3)`).
- Names match the plan's vocabulary (`pending_approval`, `min_next_bid`, `auto_bid`, …).
- Test names start with the rule or test ID (`it('B1: …')`, `it('I-03: …')`).
- UI text is plain and specific: say what happened and what to do next; sentence case; no placeholder lorem.

---

## 8. Version traps (confirmed; if installed type definitions disagree, the installed types win)

- **Express 5:** rejected promises in async handlers are forwarded to the error handler automatically, so no `express-async-errors` and no manual wrapper. Wildcard routes need a name (`/*splat`). `req.query` is read-only; don't reassign it.
- **Tailwind 4:** use `@import "tailwindcss";` in CSS and the `@tailwindcss/vite` plugin. There is no `tailwind.config.js` by default and no `@tailwind base/components/utilities` directives.
- **React Router 6:** use v6 APIs (`BrowserRouter`/`Routes`/`Route`/`Outlet`/`useParams`). Do not use v7 imports.
- **node-postgres:** `bigint` (int8) comes back as a string by default. `db/pool.ts` installs a parser that returns numbers; do not add per-query casts or a second parser.
- **Vite dev:** the proxy forwards `/api` and `/uploads` to port 4000. SSE endpoints must set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive` and flush headers.
- **Postgres:** `clock_timestamp()` (not `now()`) for bid time. `now()` is frozen at transaction start.

---

## 9. Report format (end of every task)

```
Task:            <one line>
Rules:           <PLAN rule IDs implemented>
Files changed:   <paths>
Commands run:    <exact commands> → <real result, trimmed>
Not run / not done: <explicit list, or "none">
Assumptions & questions: <anything you had to decide or need answered>
```

If something is not finished, say exactly what remains. Never summarise unfinished work as complete.
