# Owner's guide — PAPH Travel and Tours

## Who does what
| Role | In plain words |
|---|---|
| **Owner (ADMIN)** | Sees and does everything: team, settings, sample rates, activity log. Can draft and approve, but never approves an offer they sent for approval themselves. |
| **Agent (AGENT)** | Decides on offers: approve, ask for changes (with a note) or decline. Sees the dashboard and activity log. |
| **Salesperson (SALES)** | Works the request queue: takes a request, starts the offer from the AI option, adjusts prices or discount, sends it for approval, marks sent / booked / lost. Cannot approve. |

The first Owner account is created from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `backend/.env` on first start.
Add the rest in **Team**. Passwords need at least 10 characters with letters and numbers.

## Settings (Owner only)
- **Service fee** (default 10%): PAPH's fee added to every AI estimate and new offer.
- **Minimum margin** (default 8%): below this the agent must write a reason to approve. Below cost can never be approved.
- **Offer validity** (default 7 days): after this the quotation shows "rates must be rechecked" and the customer cannot accept it.
- **Deposit** (default 30%) and **balance due** (default 30 days before departure) for the payment schedule on the quotation.

## Sample rates — replace before real use
Every price comes from `backend/app/quotes/catalog.json`. It is **sample data** (rough peso estimates for 12 destinations) so the
demo works. Replace it with PAPH's real contracted rates: flights per season, hotel nightly rates per level and area, tours, transfers,
visa fees and add-ons. Visa and document notes are general guides for Philippine passport holders; always check the latest requirements.
After editing, run `npm run sync-catalog` in `frontend/`, then `node scripts/quote-test.mjs --update` to refresh the shared test numbers,
and run both test suites.

## Sample requests
With `SEED_SAMPLE_DATA=true`, an empty database gets 10 requests named "Sample customer: ..." spread across the whole flow.
They are marked as samples everywhere. Set it to `false` for a clean start.

## Good habits
- Work the queue oldest first; requests waiting more than 24 hours are highlighted.
- Use **Ask for changes** with a clear note instead of declining when the offer can be fixed.
- When a request is lost, pick the honest reason: the dashboard shows why deals are lost.
