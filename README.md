# Likha Pulse — AI Sentiment Analysis & Feedback Intelligence

Likha Pulse collects comments, reviews and messages from Google Business Profile, Facebook Page
comments and Messenger. It analyzes each one for **sentiment, emotion, intent, topic, sarcasm and urgency**
in English, Filipino and Taglish, and turns the results into dashboards, priority queues, AI insights
and PDF/Excel/CSV reports for management.

**Live demo:** https://garciaralphlawrence-svg.github.io/Likha-Pulse/
(runs fully in your browser with clearly labeled sample data, so no platform is connected).

| | |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2, Alembic, APScheduler |
| Database | PostgreSQL (SQLite supported for local trials and tests) |
| AI / NLP | Built-in context-aware English/Filipino/Taglish engine (free) + optional Claude (Anthropic) engine |
| Security | bcrypt password hashing, JWT sessions, role-based permissions, audit logs, env-based secrets |

## What it does

- **Dashboard**: 8 KPI cards and 10 charts (distribution, trends by day/week/month/year, positive vs. negative,
  platform volume, top topics, complaints, most appreciated, emotions, priorities). All are computed from the
  database and respond to date, platform and sentiment filters.
- **AI executive summary & insights**: generated only from real aggregates, never invented figures.
- **Analysis engine**: reads whole sentences: negation (*hindi maganda*), intensifiers (*sobrang*),
  contrast (*okay naman … pero …*), star ratings, and sarcasm (*"Wow, excellent service! I waited five hours."*).
  Every result has a score (−100..+100), a separate confidence, emotion, intent, topics, priority,
  **a written reason** and a recommended action.
- **Priority detection**: separate from sentiment, e.g. safety/health terms are *critical* even in a neutral question.
- **Human-in-the-loop**: reviewers correct sentiment, emotion, intent or priority; the original AI prediction,
  correction, reviewer and timestamp are kept. Low-confidence and possible-sarcasm items are queued for review.
- **Integrations**: separate modules using official APIs only. Each shows *Not connected* until real credentials
  are configured. Demonstration data is always flagged as sample data.
- **Notifications**: critical/high feedback, negative spikes, repeated complaints and unresolved items,
  de-duplicated, in-app (and optional email).
- **Reports**: 8 report types in PDF, Excel and CSV.
- **Administration**: Super Admin / Admin / Analyst / Viewer roles, user management, settings and audit logs.

## Quick start (local)

```bash
# 1. Backend
cd backend
python -m venv .venv && . .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # set JWT_SECRET, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
                            # for a quick trial use DATABASE_URL=sqlite:///./likha_pulse.db
alembic upgrade head        # PostgreSQL (skip for SQLite: tables are created automatically)
uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :8000)
```

Sign in with the Super Admin email and password from `.env`. When the database is empty, labeled sample data is
loaded so the dashboards have something to show. Delete it any time under **Platform Integrations → Sample data**.

Or run everything with Docker: `docker compose up --build` (after creating `backend/.env`).

## Documentation

- [Architecture & development plan](docs/ARCHITECTURE.md)
- [API reference](docs/API.md) (interactive docs at `http://localhost:8000/docs`)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Administrator guide](docs/ADMIN_GUIDE.md)
- Environment templates: [`backend/.env.example`](backend/.env.example), [`frontend/.env.example`](frontend/.env.example)

## Honest limits

- The built-in engine is rule-based. It handles common English/Filipino/Taglish patterns well, but subtle sarcasm
  and context still need the human review queue, or the optional Claude engine.
- Platform data is only collected after the business authorizes access (Google Business Profile owner/manager;
  Meta Page admin with app permissions approved through Meta App Review). The system never scrapes or bypasses restrictions.

---
Built by **Likha Studio**.
