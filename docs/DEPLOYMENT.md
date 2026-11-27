# Deployment

## 1. Database

Create a PostgreSQL 14+ database (managed options: Neon, Supabase, Render, Railway, or your own server) and set
`DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME`.

## 2. Backend (FastAPI)

Any host that runs Docker or Python works (Render, Railway, Fly.io, a VPS).

```bash
cd backend
cp .env.example .env     # fill in every REQUIRED value; ENVIRONMENT=production
docker build -t likha-pulse-api .
docker run -d --env-file .env -p 8000:8000 likha-pulse-api   # runs `alembic upgrade head` then uvicorn
```

Production checklist:
- `ENVIRONMENT=production` (the app refuses to start with the default JWT secret).
- Long random `JWT_SECRET` and `AUTHOR_HASH_SALT`; strong `SUPERADMIN_PASSWORD` (change it after first login).
- `CORS_ORIGINS` set to the exact frontend URL.
- Serve over HTTPS (the platform's TLS, or a reverse proxy such as Caddy/Nginx).
- Back up the database daily; keep `generated_reports/` on a persistent volume or regenerate reports as needed.
- Run a single API instance when the built-in scheduler is enabled (or set `ENABLE_SCHEDULER=false` on extra
  instances), so syncs and alerts don't run twice.

## 3. Frontend

```bash
cd frontend
echo "VITE_API_URL=https://your-api.example.com" > .env.production
npm ci && npm run build      # static files in dist/
```

Host `dist/` on any static host (Cloudflare Pages, Netlify, Vercel, Nginx). Routing uses `#/` URLs, so no rewrite rules are needed.

`docker compose up --build` runs PostgreSQL, the API and the web app together for an on-premise install.

## 4. Connecting platforms (official APIs only)

| Platform | Requirements | Environment variables |
|---|---|---|
| Facebook Page comments | Page admin; Meta app with `pages_read_engagement` and `pages_read_user_content` approved through App Review; long-lived Page access token | `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN` |
| Messenger | Same Meta app plus `pages_messaging` approval | same as above |

After setting the variables, restart the API, open **Platform Integrations** and click **Sync now**. The scheduler
then syncs every 30 minutes. OAuth access tokens expire, so use a refresh process or long-lived Page tokens and
update the variables when they change. If a sync fails, the integration shows **Error** with the platform's message.

**Weekly report email**: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (and `SMTP_TLS`). The job runs every
Monday 00:00 UTC (8:00 AM Philippine time). Without SMTP nothing is sent; the job only logs.

**Upgrading an existing database**: run `alembic upgrade head`. Migration `c4e8a2f17d30` adds the team-tool columns and
retires Google reviews (sample Google rows are deleted; any real ones are kept as imported history).

## 5. Optional Claude engine

Set `ANTHROPIC_API_KEY` (and optionally `CLAUDE_MODEL`, default `claude-opus-5-5`), restart, then choose **Claude**
under **System Settings → AI analysis engine**. Each analyzed message is one API request billed by Anthropic.
If Claude is unavailable or declines a request, the built-in engine is used automatically for that message.

## 6. Public demo (GitHub Pages)

```bash
cd frontend && npm run build:demo     # dist/ built with base /Likha-Pulse/ and in-browser demo mode
```
Publish `dist/` to the `gh-pages` branch. The demo never contacts a server.
