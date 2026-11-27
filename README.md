# PAPH Travel and Tours — AI Trip Quotation

A customer types their dream trip in plain English, Tagalog or Taglish
(*"gusto ko pumunta London 10 days, 5 star hotel"*). A free, built-in AI quotation analyst
reads it, prices it from the rate catalog, and suggests where to stay and what to do. A salesperson
turns that into an offer, and a travel agent approves it before the customer receives an official quotation.

**Live demo:** https://garciaralphlawrence-svg.github.io/Likha-Pulse/
(runs fully in the browser with clearly labeled **sample** rates and sample requests;
the repository and URL keep their old name for now so existing links keep working).

| | |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2, Alembic |
| Database | PostgreSQL (SQLite for local trials and tests) |
| AI | Built-in rule-based quotation analyst (free, no paid API, same result every time) |
| Security | bcrypt passwords, JWT sessions, role permissions, audit log, strict CSP on the demo |

## The flow

1. **Customer request** (public page, no login): free text plus simple fields (destination, days or dates,
   adults and kids, hotel level Budget / Mid-range / 5-star, budget in ₱ total or per person, interests).
   The AI fills the fields from the text and shows what it understood, so the customer can correct it.
2. **AI quotation analyst**: a price range per person and in total, broken into flights, hotel
   (nights × rooms × rate), tours, transfers, local transport, visa/insurance, peak-season surcharge or off-peak
   saving, child pricing, group discount (6+) and the PAPH service fee. Three options side by side
   (Budget / Best value / Premium) with hotel area, a day-by-day plan, a Philippine-passport visa and
   document checklist, and optional add-ons (insurance, private transfers, pocket WiFi, extra tours).
   If the budget is too low it says so plainly, with the exact ₱ gap and the nearest fit
   (lower hotel level, fewer days, an off-peak month, or a cheaper destination).
   Always labeled "AI recommendation · not yet an offer".
3. **Salesperson** (role SALES): queue of new requests (waiting 24h+ highlighted), takes a request,
   starts the offer from an AI option, edits lines, cost and price, discount and notes, and sends it for approval.
   Cannot approve.
4. **Travel agent** (role AGENT): sees price, margin and the AI-range check, then **Approve**,
   **Ask for changes** (back to sales with a note) or **Decline**. Approval issues a printable quotation
   with reference number, validity date, payment schedule (deposit and balance), inclusions, exclusions,
   cancellation note and document checklist.
5. **Customer tracking** by reference number + mobile/email: Received → Being prepared → Offer ready →
   Accepted → Booked. On "Offer ready" the customer can accept, request changes or ask a question.

**Rules that are enforced (demo and server alike):** only valid steps per role and status; every step is
logged with who, when and why; sales cannot approve; nobody approves their own offer; an offer below cost
cannot be sent or approved; a margin under the minimum (8% by default) needs the agent's written reason;
any change after approval sends it back for approval; quotations expire after 7 days and must be rechecked;
a lost request needs a reason (price, dates, another agency, no response, plans changed).

**Overview for owners and agents:** requests by stage, booking rate, average quote, offers waiting for
a decision, requests waiting 24h+, top destinations and lost reasons.

## Sample rates (replace before real use)

All prices come from `backend/app/quotes/catalog.json`: 12 destinations (London, Paris, Japan, Seoul,
Singapore, Hong Kong, Bangkok, Dubai, Bali, Taiwan, Boracay, El Nido) with flights by season, three hotel levels
per area, tours, transfers and visa notes. **They are sample estimates, not PAPH's real rates.**
Replace that file with PAPH's supplier rates, then run `npm run sync-catalog` in `frontend/`.

## Quick start (local)

```bash
# Backend
cd backend
python -m venv .venv && . .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # set JWT_SECRET, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD (first Owner account)
uvicorn app.main:app --reload --port 8000

# Frontend (another terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173  (staff area at #/staff)
```

Browser-only demo: `npm run build:demo` (uses `frontend/src/demo/demoApi.ts`, sample data only).
Demo sign-ins (sample accounts, shown on the demo sign-in page): `admin@demo.paph` / `Admin2026!`,
`sales@demo.paph` / `Sales2026!`, `agent@demo.paph` / `Agent2026!`.

## Tests

- `cd backend && python -m pytest -q`: API, roles, full flow, and the Python engine against the shared golden quotes.
- `cd frontend && npm run test:engine`: the TypeScript engine and workflow against the same `backend/tests/quote_cases.json`.

The browser and the server use the same catalog, workflow rules and test cases, so a quote is identical in both.
More detail in `docs/` (architecture, API, admin guide, deployment, testing).
