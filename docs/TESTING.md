# Testing — PAPH Travel and Tours

## Backend
```bash
cd backend
.venv/Scripts/python -m pytest -q      # macOS/Linux: .venv/bin/python -m pytest -q
```
- `tests/test_quotes.py`: the text reader (English/Tagalog/Taglish cases), the **golden numbers** (the Python engine must give exactly
  the same prices, options, nearest fits and sentences as the TypeScript engine), the London showcase rules, and every workflow guard
  (roles, below cost, low margin needs a reason, no self-approval, edit after approval goes back for approval, expiry, lost reason).
- `tests/test_api.py`: sign-in, roles, public form validation, tracking with the right contact only, the full flow to Booked,
  the ask-for-changes path, settings validation, assigning, dashboard numbers and the activity log.

## Frontend
```bash
cd frontend
npm run sync-catalog     # copies catalog.json, workflow.json and quote_cases.json from the backend
npm run test:engine      # same cases and golden numbers against the TypeScript engine
npm run build:demo       # type-check and build the GitHub Pages demo
```

## Shared test cases
`backend/tests/quote_cases.json` holds the parse cases, the recommend inputs and the golden results. If you change prices or wording
on purpose, run `node scripts/quote-test.mjs --update` in `frontend/` (it rewrites the golden numbers from the TypeScript engine),
then run `pytest` to confirm the Python engine still matches.
