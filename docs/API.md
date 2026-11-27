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
| POST | `/public/requests/{ref}/actions` | `{contact, action, note}` with action `customer_accept`, `customer_changes`, `customer_question` | Customer view |

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
| GET / PUT | `/settings` | requests.view / settings.manage | `{service_fee_pct, min_margin_pct, validity_days, deposit_pct, balance_days_before}` |
| GET/POST/PATCH | `/users`, `/users/{id}`, GET `/roles` | users.manage | roles ADMIN, AGENT, SALES |
| GET | `/audit?page=` | audit.view | 50 per page, newest first |
| GET | `/health` | — | `{status, app}` |

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
