# Owner's guide — PAPH Travel and Tours

## Who does what
| Role | In plain words |
|---|---|
| **Owner (ADMIN)** | Sees and does everything: team, settings, sample rates, activity log. Can draft and approve, but never approves an offer they sent for approval themselves. |
| **Agent (AGENT)** | Decides on offers: approve, ask for changes (with a note) or decline. Sees the dashboard and activity log. |
| **Salesperson (SALES)** | Works the request queue: takes a request, starts the offer from the AI option, adjusts prices or discount, sends it for approval, marks sent / booked / lost. Cannot approve. |

The first Owner account is created from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `backend/.env` on first start.
Add the rest in **Team**. Passwords need at least 10 characters with letters and numbers.

## Owner dashboards (Owner only)
The Owner sees how customers feel and how the business is doing: a one-line briefing first, then customer mood over time and by
destination, salesperson and stage, the themes customers complain about (with examples), team performance and revenue with margin.
Filter by period (30 days, 90 days, this year, all), destination or salesperson, and download every customer message as a CSV for Excel.
Agents and salespeople cannot open these pages.

## Response Clock
Urgent cases (stranded travellers, lost passports, transfers, hotels, refunds, anyone on a trip now) must be solved within 24 hours;
important ones within 48 hours. The colour changes every quarter of the time: green, yellow, orange, red (the owner is alerted on
the dashboard), then overdue. Take a case, tick the playbook steps, press "I replied" and "Solved". You can change the targets,
the watched words and the weekly report emails in **Settings**.

## Connecting Facebook and Messenger
1. Create a Meta app at developers.facebook.com and add PAPH's Facebook Page.
2. Ask for these permissions in **App Review**: `pages_read_engagement`, `pages_read_user_content` (comments) and
   `pages_messaging` (Messenger). Meta must approve them before real messages can be read.
3. Make a long-lived Page access token and put `META_PAGE_ID` and `META_PAGE_ACCESS_TOKEN` in `backend/.env`, then restart.
4. **Connections** shows "Connected"; new comments and chats arrive every 30 minutes (or press Sync).
Real names are shown as a short code ("Client 7F3A") while `ANONYMIZE_AUTHORS=true`. Imported files keep the names written in them.

## Weekly report by email
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` in `backend/.env` (for example a Google Workspace or
Zoho mailbox with an app password). The report goes out every Monday at 8:00 AM Philippine time to the emails in Settings, or to
every Owner account when that box is empty. Without SMTP it is only written to the server log.

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
With `SEED_SAMPLE_DATA=true`, an empty database gets about 6 months of closed sample requests (booked, lost, declined, some with
after-trip reviews) plus 10 live requests named "Sample customer: ..." spread across the whole flow, handled by three sample staff
(two salespeople and an agent, with random passwords so nobody can sign in as them). Everything is marked as sample.
Set it to `false` for a clean start.

## Good habits
- Work the queue oldest first; requests waiting more than 24 hours are highlighted.
- Use **Ask for changes** with a clear note instead of declining when the offer can be fixed.
- When a request is lost, pick the honest reason: the dashboard shows why deals are lost.
