# API Reference

Base URL: `http://localhost:8000`. Interactive OpenAPI docs: **`/docs`** (Swagger) and `/redoc`.

Authenticate with `POST /api/auth/login`, then send `Authorization: Bearer <access_token>` on every request.
Errors return `{"detail": "..."}` with standard status codes (400 validation, 401 not signed in, 403 missing permission,
404 not found, 409 duplicate, 429 too many login attempts).

## Common filter parameters

Used by `/api/feedback`, `/api/dashboard`, `/api/insights/generate` and `/api/reports`:

| Param | Example | Notes |
|---|---|---|
| `date_from`, `date_to` | `2026-11-01` | Dashboard/insights default to the last 30 days |
| `platform` | `google_business`, `facebook_page`, `messenger`, `manual` | |
| `sentiment` | `positive` / `neutral` / `negative` | Uses the human-corrected value when one exists |
| `priority` | `critical,high` | Comma-separated |
| `emotion`, `intent`, `topic` | `frustration`, `complaint`, `Response Time` | `intent` accepts a comma list |
| `review` | `unreviewed` / `pending_review` / `reviewed` | |
| `action` | `open` / `pending_action` / `resolved` / `unresolved` | |
| `search` | `refund` | Text contains |
| `include_sample` | `false` | Exclude labeled sample data |

## Endpoints

| Method & path | Permission | Purpose |
|---|---|---|
| `POST /api/auth/login` | public | `{email, password}` → `{access_token, user}` (5 failed tries locks for 15 min) |
| `GET /api/auth/me` | signed in | Current user and permissions |
| `POST /api/auth/change-password` | signed in | `{current_password, new_password}` |
| `POST /api/auth/forgot-password` | public | Emails a 30-minute reset code (SMTP) |
| `POST /api/auth/reset-password` | public | `{email, token, new_password}` |
| `GET /api/dashboard` | dashboard.view | KPIs, chart series, latest insight. `granularity=day/week/month/year` |
| `GET /api/feedback` | feedback.view | Paged list. `page`, `page_size` (≤200) |
| `GET /api/feedback/{id}` | feedback.view | Full analysis: reason, recommended action, AI vs corrected values, review history |
| `POST /api/feedback` | feedback.manage | Manual entry `{content, author?, rating?}`; analyzed immediately; 409 on duplicate |
| `POST /api/feedback/{id}/review` | feedback.review | `{sentiment?, emotion?, intent?, priority?, note, use_for_evaluation}`; empty = confirm AI result |
| `PATCH /api/feedback/{id}/status` | feedback.manage | `{action_status}` |
| `POST /api/feedback/{id}/reanalyze` | feedback.manage | Re-run analysis with current settings |
| `POST /api/analyze` | feedback.view | Analyze any text without saving |
| `GET /api/meta` | feedback.view | Allowed sentiments, emotions, intents, topics, platforms |
| `POST /api/insights/generate` | insights.generate | Builds an insight report for the filters |
| `GET /api/insights` | dashboard.view | Last 20 insight reports |
| `GET /api/reports/types` | reports.view | The 8 report types |
| `POST /api/reports` | reports.generate | `{report_type, file_format: pdf|xlsx|csv}` + filters |
| `GET /api/reports` / `GET /api/reports/{id}/download` | reports.view | List / download |
| `GET /api/integrations` | dashboard.view | Status, missing env vars, counts per platform |
| `POST /api/integrations/{code}/sync` | integrations.manage | Fetch new items via the official API |
| `POST /api/sample-data` / `DELETE /api/sample-data` | integrations.manage | Load or delete labeled sample data |
| `GET /api/notifications` | signed in | Latest 50 alerts with read state |
| `POST /api/notifications/{id}/read`, `/read-all`, `/check` | signed in / settings.manage | Mark read / run alert rules now |
| `GET/POST /api/users`, `PATCH /api/users/{id}`, `GET /api/roles` | users.manage | User management |
| `GET /api/settings`, `PUT /api/settings/{key}` | settings.manage | `sentiment_thresholds`, `confidence_thresholds`, `ai_provider`, `alerts`, `retention` |
| `GET /api/audit` | audit.view | `action`, `page` |
| `GET /api/cases` | feedback.view | Response Clock cases. `view` = `open` (most urgent first), `solved` or `all`. Returns `items`, `stats` and `team` |
| `POST /api/cases/{id}/actions` | feedback.manage | `{"kind": "assign" \| "reply" \| "step" \| "note" \| "solve" \| "reopen" \| "traveling", "assignee"?, "text"?, "index"?, "value"?}` |
| `GET /api/health` | public | Liveness check |

## Example

```bash
TOKEN=$(curl -s -X POST localhost:8000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@yourcompany.com","password":"..."}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST localhost:8000/api/analyze -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"text":"Okay naman ang service pero sobrang tagal ng response."}'
# → {"sentiment":"negative","score":-76,"emotion":"frustration","topics":["Response Time",...],"reason":"The message changes direction at 'pero'..."}
```
