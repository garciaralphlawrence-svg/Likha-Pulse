# Administrator Guide

## Roles

| Role | Can do |
|---|---|
| **Super Admin** | Everything: users, integrations, AI settings, thresholds, alerts, retention, audit logs |
| **Admin** | Dashboard, manage and review feedback, insights, reports, audit logs |
| **Analyst** | Dashboard, analyze and validate feedback, insights, reports |
| **Viewer** | Read-only dashboard and generated reports |

## First day

1. Sign in with the Super Admin account from the server's `.env`, then change the password (API: `/api/auth/change-password`).
2. **User Management → Add user** for each team member. Give them a temporary password (10+ characters with letters and numbers).
3. **Platform Integrations**: confirm which platforms are connected. Until one is, the sample data keeps the dashboards populated. Delete it once real data arrives.
4. **System Settings**: review the thresholds below.

## Understanding the analysis

- **Sentiment score** (−100 to +100) is direction and strength. Default: ≤ −25 negative, ≥ +25 positive, otherwise neutral.
- **Confidence** (0–100%) is how sure the engine is. It is *not* a guarantee. Items below the review threshold (default 70%)
  and every possible-sarcasm item are marked **Pending review**.
- **Priority** is urgency, judged separately: *critical* (safety, health, legal, fraud, harassment), *high* (very strong
  dissatisfaction, repeated complaints, customers still waiting), *medium* (general complaints, problems, suggestions),
  *low* (questions, compliments). Every item explains its level.
- **Reason** shows the words that drove the decision, e.g. *"changes direction at 'pero'; the part after it is negative"*.

## Daily routine (suggested)

1. Check the notification bell: critical items first.
2. **Priority Concerns** → handle *Critical & high*, then set each to **Resolved** in the detail panel.
3. **Feedback Monitoring** → filter *Review: Pending review* and confirm or correct each item.
4. Weekly: **AI Insights → Generate new analysis** for the last 7 days; monthly: **Reports → Monthly Sentiment Report**.

## Response Clock

Every **Urgent** or **Important** message becomes a case with a deadline (default: Urgent 24 hours, Important 48 hours; first reply within 1 hour and 4 hours).
The color shows how much of the time is used:

| Color | Time used | Meaning |
|---|---|---|
| Green · On track | 0–25% (0–6h for Urgent) | Plenty of time |
| Yellow · Needs progress | 25–50% (6–12h) | Make progress now |
| Orange · At risk | 50–75% (12–18h) | Getting late |
| Red · Due soon | 75–100% (18–24h) | Escalated to the manager automatically, alert sent |
| Overdue | past the deadline | Alert sent |

Each case shows the travel situation (on-trip emergency, lost passport, flight or transfer, hotel, refund, visa, booking, tour),
whether the traveler is on a trip right now, the owner, the first reply time, and a ready **playbook** checklist.
The team logs replies, steps and notes in the timeline and marks the case as solved. Marking a message as done in the Inbox also solves its case.
Change the hours in **Settings → Response clock**. Playbooks are in `backend/app/services/playbooks.json`.

## Human validation

Open any item, change sentiment/emotion/intent/priority, add a note and **Save correction** (or **Confirm AI result**).
The AI's original prediction is preserved. Tick *approved for model evaluation data* only for corrections your team
has agreed can be used to measure or tune the engine.

## Settings reference

| Setting | Default | Effect |
|---|---|---|
| Sentiment thresholds | −25 / +25 | Label cut-offs for new analyses (re-run analysis to apply to older items) |
| Confidence thresholds | 90% / 70% | High-confidence band / manual-review cut-off |
| AI engine | Built-in | Switch to Claude when `ANTHROPIC_API_KEY` is configured |
| Negative spike | 30% | Alert when last week's negative share rises this much vs. the week before |
| Repeated complaints | 3 | Alert when a topic gets this many negative messages in 7 days |
| Unresolved after | 3 days | Alert for open high/critical items |
| Email alerts | off | Also email Admins (needs SMTP variables) |
| Retention | 730 / 1095 days | Feedback / audit logs older than this are deleted nightly |

## Password resets

A Super Admin can set a new password under **User Management → Reset password**. With SMTP configured, users can
request a reset code via `/api/auth/forgot-password`; codes expire after 30 minutes and are stored only as hashes.

## Audit log

Every login (and failed login), review, status change, report, user change, settings change, sync and sample-data
action is recorded with the user, time and IP.

## Privacy

- Author names/IDs are stored as salted hashes by default (`ANONYMIZE_AUTHORS=true`).
- Only data the business is authorized to access through official APIs is collected.
- API keys and tokens live only in server environment variables, never in the database or the browser.
