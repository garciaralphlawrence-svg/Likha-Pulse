# API — PAPH Travel and Tours

Base path `/api`. Interactive docs at `/docs` when the server runs. Errors return `{"detail": "<plain message>"}`.
Staff endpoints need `Authorization: Bearer <token>` from `POST /api/auth/login`.

## Customer (public, no login, rate-limited per IP)
| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/public/parse` | `{text}` | What the AI understood (destination, days, adults, kids, tier, budget, month, travel_date, interests, understood[]) |
| POST | `/public/estimate` | `{text?, input?}` (input wins) | AI recommendation: 3 priced options, verdict, budget check with nearest fits, visa notes, add-ons |
| POST | `/public/requests` | `{customer:{name, contact}, raw_text, input, addons[]}` | `201 {ref, contact}` |
| GET | `/public/requests/{ref}?contact=` | contact = same mobile (last 7 digits) or email | Customer view (status, timeline, AI estimate, approved offer prices only, quotation terms) or 404 |
| POST | `/public/requests/{ref}/actions` | `{contact, action, note, rating?}` with action `customer_accept`, `customer_changes`, `customer_question`, or `customer_feedback` (after booking, `rating` 1 to 5, once) | Customer view |

## Staff
| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/auth/login` | — | `{email, password}` -> `{access_token, user}` (5 failed tries = 15 min lock) |
| GET | `/auth/me` | signed in | role and permissions |
| POST | `/auth/change-password`, `/auth/forgot-password`, `/auth/reset-password` | — | reset code is logged in development only |
| GET | `/requests?view=queue\|approval\|open\|closed\|all` | requests.view | queue = new, AI recommended, drafting, changes requested, or open with a customer question |
| GET | `/requests/{id}` | requests.view | full request + `allowed` steps for your role, `expired`, `waiting_hours`, `terms` |
| POST | `/requests/{id}/actions` | requests.view + workflow role | `{action, note?, option?, lines?, discount?, notes?, assignee?:{id}, reason?}` |
| GET | `/staff` | requests.view | active staff for assigning |
| GET | `/dashboard` | dashboard.view | totals by status, conversion, average quote, top destinations, lost reasons, offers awaiting decision |
| GET | `/catalog` | catalog.view | the sample rates |
| GET | `/owner?range=30\|90\|year\|all&destination=&salesperson=` | owner.view (Owner only) | briefing, customer sentiment (trend, by destination, salesperson and stage, themes, needs attention, star ratings), team performance, revenue and margin, every customer message |
| GET | `/owner/voices.csv` (same filters) | owner.view | every customer message with its mood, score and theme, for Excel |
| GET / PUT | `/settings` | requests.view / settings.manage | `{service_fee_pct, min_margin_pct, validity_days, deposit_pct, balance_days_before}` |
| GET/POST/PATCH | `/users`, `/users/{id}`, GET `/roles` | users.manage | roles ADMIN, AGENT, SALES |
| GET | `/audit?page=` | audit.view | 50 per page, newest first |
| GET | `/health` | — | `{status, app}` |

## Customer care and the Response Clock
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/messages?view=waiting\|all` | requests.view | waiting = no reply yet, most urgent clock first; all = newest first (300 max). Each has mood, theme, reply clock, watched words, suggested-reply key |
| POST | `/messages/{id}/actions` | requests.view | `{action: reply \| open_case \| make_request}`; make_request turns the message into a quotation request |
| GET | `/cases?view=open\|solved` | requests.view | `{items, stats, team}`. Owner sees all; others see their cases, cases on their requests, and unassigned open cases |
| POST | `/cases` | requests.view | `{request_id?, message_id?, text, source}`; same text already open -> 400 |
| POST | `/cases/{id}/actions` | requests.view | `{action: assign \| reply \| step \| note \| solve \| reopen \| traveling, note?, index?, value?, assignee?:{id}}` |
| GET | `/clients/{key}` | requests.view | everything from one traveller (requests, messages, cases, ratings) |
| GET | `/reply-templates` | requests.view | suggested replies (English and Taglish) |
| POST / PUT / DELETE | `/reply-templates`, `/reply-templates/{id}` | replies.manage (Owner) | |
| GET | `/keyword-watch?days=` | owner.view | messages containing the watched words |
| GET | `/team-report?months=`, `/team-report/csv` | owner.view | who handled what, first reply and solve times |
| GET / POST | `/weekly-report`, `/weekly-report/send` | owner.view | emailed when SMTP is set, otherwise written to the log |
| POST | `/import` | import.manage (Owner) | `{file_name, rows:[{date, client, message, channel}]}` (max 5000) |
| GET / POST | `/integrations`, `/integrations/{code}/sync` | requests.view / integrations.manage | Facebook Page comments and Messenger |

Customer steps `customer_question` / `customer_changes` with unhappy words, and `customer_feedback` with 1 or 2 stars, open a
Response Clock case automatically. Staff step `reply` ("I replied") stops a request's reply clock.

## Workflow steps (`action`)
| Step | Who | From | To |
|---|---|---|---|
| `start_offer` | SALES, ADMIN | AI recommended | Offer being drafted (from an AI option; `option` optional) |
| `save_offer` | SALES, ADMIN | drafting, changes requested, approved, sent | drafting; **after approval it goes back to Waiting for approval** |
| `submit` | SALES, ADMIN | drafting, changes requested | Waiting for approval (blocked if below cost) |
| `approve` | AGENT, ADMIN | Waiting for approval | Approved (not by the person who submitted; reason needed under minimum margin; blocked below cost) |
| `request_changes` / `decline` | AGENT, ADMIN | Waiting for approval | Changes requested / Declined (note required) |
| `send` | SALES, AGENT, ADMIN | Approved | Sent to customer (not if expired) |
| `answer` | staff | any open | clears a customer question (note required) |
| `assign` | staff | any open | salespeople may only take a request for themselves |
| `mark_booked` | staff | Customer accepted | Booked |
| `mark_lost` | staff | most open statuses | Lost (`reason`: price, dates, other_agency, no_response, plans_changed) |
