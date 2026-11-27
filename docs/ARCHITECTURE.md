# Likha Pulse — Technical Architecture & Development Plan

Likha Pulse is a feedback-intelligence platform. It collects Facebook Page comments and
Messenger chats (and imported past feedback), analyzes each one with an NLP pipeline, and turns
the results into dashboards, priority queues, insights and reports for management.

## 1. System overview

```
                ┌──────────────────────────── Frontend (React + Vite + Tailwind + Recharts) ───────────────────────────┐
                │ Dashboard · Feedback Monitoring · Sentiment Analysis · AI Insights · Priority · Reports · Integrations │
                │ Users · Settings · Audit Logs · Notification center                                                    │
                └───────────────┬──────────────────────────────────────────────────────────────────┬────────────────────┘
                                │ REST/JSON (JWT bearer)                                            │ Demo mode (GitHub Pages):
                                ▼                                                                   │ in-browser adapter, same
┌──────────────────────────── Backend (Python · FastAPI) ─────────────────────────────┐             │ rule engine (TS port),
│ api/        auth · users · feedback · dashboard · analysis · insights · priority    │             │ labeled sample data
│             reports · integrations · notifications · settings · audit               │             ▼
│ core/       config (env) · security (bcrypt, JWT) · RBAC permissions                │
│ nlp/        pipeline ─┬─ RuleEngine  (free: English/Filipino/Taglish lexicon + rules)│
│                       └─ ClaudeEngine (optional: Claude API, structured output)     │
│ services/   ingestion (dedupe) · insights · reports (PDF/XLSX/CSV) · notifications  │
│ integrations/ base · facebook_page · messenger · sample (labeled)                   │
│ jobs/       APScheduler: sync · alerts · retention · Monday weekly report          │
└───────────────────────────────┬─────────────────────────────────────────────────────┘
                                ▼
                     PostgreSQL (SQLite allowed for local dev/tests) · Alembic migrations
```

## 2. Key design decisions

| Decision | Why |
|---|---|
| **Two analysis engines behind one interface** | The free `RuleEngine` works with no API key or cost. When an administrator stores a Claude API key, `ClaudeEngine` takes over for full context/sarcasm understanding. Every result records which engine and model version produced it. |
| **Sentiment, confidence and priority are separate fields** | Sentiment score (−100..+100) is direction/strength; confidence (0..1) is how sure the engine is; priority is urgency. A neutral message can be critical, and a negative one can be low priority. |
| **Configurable thresholds** | Sentiment cut-offs (−25/+25), confidence review thresholds (90/70) and alert rules live in the `system_settings` table, editable by Super Admins. |
| **Human-in-the-loop** | Reviewer corrections never overwrite the AI prediction; both are stored in `human_reviews` with reviewer and timestamp. Dashboards use the corrected value when one exists. |
| **No fake integrations** | Each platform module reports its real status. Without credentials it is `not_connected`, and demonstration data is stored with `is_sample = true` and shown with a "Sample data" badge. |
| **Insights are computed from data** | Insight text is generated from SQL aggregates (counts, deltas, top topics). With Claude enabled, Claude only rewrites those aggregates into prose; it never invents numbers. |
| **Modular integrations** | New platforms implement `BaseIntegration.fetch()` and register in one dictionary. |

## 3. Data model (PostgreSQL)

| Table | Purpose |
|---|---|
| `roles`, `permissions`, `role_permissions` | RBAC: SUPER_ADMIN, ADMIN, ANALYST, VIEWER |
| `users` | bcrypt password hash, role, active flag, reset token hash/expiry |
| `platforms` | Facebook comments, Messenger, manual entry, imported file; status, last sync |
| `reply_templates` | Suggested replies (situation, language en/tl, title, body); defaults from `services/reply_templates.json` |
| `platform_accounts` | Connected page/location per platform; credentials referenced by env var name, never stored in plain text |
| `feedback` | Original content, platform, external reference ID, author (anonymized hash), source URL, created/collected timestamps, `content_hash` for duplicate detection, `is_sample`, review status, resolution status |
| `sentiment_results` | label, score, confidence, engine, model version, reason, sarcasm flag |
| `emotion_results` | primary emotion + per-emotion scores |
| `intent_results` | intent + reason |
| `topic_results` | one row per detected topic/keyword |
| `priority_assessments` | level, reason, recommended action |
| `human_reviews` | field, original value, corrected value, reviewer, timestamp, note |
| `ai_insights` | period, filters, generated text, supporting aggregates (JSON) |
| `notifications` | type, severity, message, dedupe key, read state, recipient |
| `generated_reports` | type, format, period, file path, creator |
| `audit_logs` | actor, action, entity, details, IP, timestamp |
| `system_settings` | key/value JSON for thresholds, AI provider, retention |

Indexes cover `feedback(platform_id, created_at)`, `feedback(content_hash)` (unique per platform),
`sentiment_results(label)`, `priority_assessments(level)` and `audit_logs(created_at)`.

## 4. Analysis pipeline

1. **Normalize**: lower-case, strip URLs/emoji to tokens, expand Taglish shorthand (`sobrang`, `grabe`, `di`, `hindi`).
2. **Sentiment**: lexicon polarity with negation ("hindi maganda"), intensifiers ("sobrang"), contrast handling ("okay naman ... pero ..." — the clause after *pero/but* dominates), star rating when available.
3. **Emotion**, **Intent**, **Topic**: keyword families in English and Filipino plus structural cues (question marks, "pwede po bang", "paki").
4. **Sarcasm**: positive praise words combined with a negative experience marker (long waits, numbers of hours, "pa more") → negative + `possible_sarcasm`; always routed to manual review.
5. **Priority**: rules on safety/health terms, legal threats, repeated complaints from the same author or topic, unresolved age, and strength of negativity. Each assignment includes a written reason.
6. **Confidence**: from signal agreement and coverage; below the configurable threshold → `pending_review`.

With Claude enabled, steps 2–6 are done in one structured-output call per message (JSON schema), with the rule engine as automatic fallback on errors or refusals.

## 5. Security

- Passwords hashed with bcrypt; JWT access tokens (short-lived) signed with `JWT_SECRET` from the environment.
- Role-based permission checks on every route; Super Admin seeded from environment variables on first start.
- Password reset via single-use hashed token (emailed when SMTP is configured; otherwise shown to Super Admin in logs only in development).
- All secrets (DB URL, JWT secret, Claude key, Meta tokens, SMTP) come from environment variables; `.env.example` lists them.
- Audit log on login, user management, settings changes, reviews, report generation and integration changes.
- Author identifiers are stored as salted hashes by default (`ANONYMIZE_AUTHORS=true`).

## 6. Development plan (order followed)

1. Architecture (this document) → 2. Database schema + migration → 3. Auth & RBAC →
4. Dashboard API/UI → 5. Feedback management → 6. NLP engines → 7. Context/emotion/intent/priority →
8. Platform integration modules → 9. Human validation → 10. Insights & reports → 11. Tests →
12. Performance & security review, docs, demo build.
