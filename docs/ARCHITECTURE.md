# Architecture — PAPH Travel and Tours (AI travel quotation analyst)

## The flow in plain words
1. **Customer** (public page, no login) types a trip in English, Tagalog or Taglish, e.g. *"gusto ko pumunta London 10 days, 5 star hotel"*.
   The AI fills in the form (destination, days, travellers, hotel level, budget, month, interests). The customer can correct it.
2. **AI Quotation Analyst** (free, rule-based, no paid API) prices three options (Budget / Best value / Premium) as a low-to-high range,
   per person and in total, line by line: flights, hotel (nights x rate x rooms), tours, transfers, local transport, visa, insurance when
   required, peak-season surcharge or off-peak saving, group discount, and the PAPH service fee. It suggests the hotel area and a
   day-by-day plan that fits the customer's interests. If the budget is too low it says so and gives the nearest fit
   (lower hotel level, fewer days, a quieter month, or a cheaper destination) with the exact peso difference.
   It is labeled *AI recommendation, not yet an offer*.
3. **Salesperson** (role SALES) opens the request from the queue, starts an offer from an AI option, edits lines, prices and discount,
   then sends it for approval. A salesperson can never approve.
4. **Agent** (role AGENT) compares the offer with the AI range and the margin, then approves, asks for changes (with a note) or declines.
   Approval issues the quotation (reference number, validity date, payment schedule, inclusions/exclusions, visa checklist).
5. **Customer** tracks the request with the reference number and the same mobile/email, and can accept, ask a question, or request changes.
   After a booked trip the customer can rate it once (1 to 5 stars and a comment).
6. **Owner dashboards** (ADMIN only): every customer message (trip request, questions, change requests, after-trip reviews) is read by the
   free sentiment engine (`app/sentiment/rule_engine.py`, English/Tagalog/Taglish) and summed up as a one-line briefing, mood trend,
   mood by destination, salesperson and stage, themes customers complain about, team performance (response time, approval and booking
   rates, margin) and revenue (booked, margin, pipeline, funnel, lost reasons). Logic: `app/quotes/owner.py`.

## Response Clock and customer care
- Every customer issue becomes a **case** with a deadline: urgent 24 hours, important 48 hours (settings). The colour changes as
  time runs out: green (under 25% used), yellow, orange, red (escalated to the owner), overdue. Quotation requests and unanswered
  messages run on the same clock (reply within 24 hours by default).
- Cases open automatically from unhappy Facebook/Messenger messages, unhappy customer questions or change requests, and 1-2 star
  after-trip ratings; staff can also open one. Each case has a playbook checklist (`playbooks.json`), an owner and a trail.
- Team tools: client history, suggested replies (`reply_templates.json`), keyword watch, team report (CSV), weekly report
  (Monday 8 AM Philippine time, by email when SMTP is set), and importing past messages from Excel/CSV.
- Facebook Page comments and Messenger come in through Meta's official Graph API (`app/integrations/platforms.py`) every
  30 minutes once connected. Real names are stored as a salted code ("Client 7F3A") while `ANONYMIZE_AUTHORS=true`;
  imported files keep the names written in the file, because the owner chose to import them.

## Rules (enforced in one place: `app/quotes/workflow.py`, twin of `frontend/src/quote/workflow.ts`)
- One request = one reference number (`PAPH-2026-0001`, counter per year, row-locked).
- Statuses: AI recommended -> Offer being drafted -> Waiting for approval -> Approved / Changes requested / Declined -> Sent to customer
  -> Customer accepted -> Booked, or Lost (with a reason: price, dates, other agency, no response, plans changed).
- Only valid steps per role and status (`workflow.json`). Every step is saved in the request's trail (who, when, from, to, why)
  and in the activity log.
- Offer below cost: cannot be sent for approval or approved. Margin under the minimum (default 8%): the agent must write a reason.
- The person who sent an offer for approval cannot approve it. Any edit after approval sends it back to *Waiting for approval*.
- Quotations are valid for 7 days (setting). Expired offers are flagged "rates must be rechecked" and cannot be accepted.

## Code map
| Path | What it is |
|---|---|
| `backend/app/quotes/catalog.json` | **Sample rates** (12 destinations, 3 hotel levels, tours, flights, visa notes, add-ons, pricing rules). Replace with PAPH's real rates. |
| `backend/app/quotes/workflow.json` | Statuses, steps, which role may do which step, lost reasons |
| `backend/app/quotes/engine.py` | Reads the free text and prices the trip (deterministic: same inputs, same numbers) |
| `backend/app/quotes/workflow.py` | Requests, offers, totals, guard rules, quotation terms |
| `backend/app/quotes/owner.py` | Owner report: briefing, sentiment, team, revenue, CSV of customer messages |
| `backend/app/quotes/history.py` + `sample_history.json` | ~6 months of seeded sample past requests (same random sequence as the TypeScript twin) |
| `backend/app/quotes/clock.py` | Response Clock: stages, cases, playbook steps, clock stats |
| `backend/app/quotes/care.py` | Messages, suggested replies, keyword watch, client history, team and weekly reports, imports, sample messages |
| `backend/app/integrations/` | Facebook Page comments and Messenger (official Graph API; not connected without credentials) |
| `backend/app/sentiment/` | Free customer sentiment engine and its word lists |
| `backend/app/quotes/views.py` | Sales queue rows, customer tracking view (never shows costs or margin), dashboard |
| `backend/app/api/public.py` | Customer endpoints (no login, rate-limited) |
| `backend/app/api/requests.py` | Staff queue, request detail and workflow steps |
| `backend/app/api/management.py` | Dashboard, sample rates, staff, users, settings, activity log |
| `frontend/src/quote/*.ts` | The same engine/workflow/views in TypeScript; the GitHub Pages demo runs them in the browser |

The Python and TypeScript engines are kept identical by `backend/tests/quote_cases.json` (golden numbers checked by both
`pytest` and `npm run test:engine`). After editing any shared JSON in `backend/app/quotes` or the cases, run `npm run sync-catalog`
in `frontend/`.

## Database
| Table | Purpose |
|---|---|
| `users`, `roles`, `permissions`, `role_permissions` | Staff accounts and roles ADMIN (Owner), AGENT, SALES |
| `travel_requests` | One row per request: lookup columns (ref, status, customer, destination, assignee, sample flag) + `data` JSON with the full request |
| `ref_counters` | Last reference number per year |
| `customer_messages` | Facebook comments, Messenger chats and imported messages (`data` JSON; `external_id` prevents duplicates) |
| `cases` | Response Clock cases (`CASE-0001`), linked to a request or a message |
| `reply_templates` | Suggested replies (defaults seeded from `reply_templates.json`) |
| `counters` | Running numbers for cases and messages |
| `audit_logs` | Who did what (sign-ins, every workflow step, user and setting changes) |
| `system_settings` | Quotation terms: service fee %, minimum margin %, validity days, deposit %, balance due days |

PostgreSQL in production (Alembic migration `a1f0c0de2026`); SQLite works for local trials and tests.
