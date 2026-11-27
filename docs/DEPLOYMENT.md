# Deployment — PAPH Travel and Tours

## Public demo (no server)
The GitHub Pages demo is the frontend built with `npm run build:demo`. It runs the same engine and workflow in the browser with
clearly labeled sample data saved in the visitor's browser only.

## Full system
1. Server with Docker (or Python 3.11 + Node 20) and PostgreSQL 16.
2. `backend/.env` from `backend/.env.example`: set `ENVIRONMENT=production`, a long random `JWT_SECRET`, `DATABASE_URL`,
   `CORS_ORIGINS` (your frontend address) and the first Owner account. Never commit `.env`.
3. `docker compose up -d --build` (runs `alembic upgrade head`, then the API on port 8000; the web app on port 5173).
   Without Docker: `cd backend && pip install -r requirements.txt && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000`,
   then `cd frontend && npm ci && VITE_API_URL=https://api.example.com npm run build` and serve `frontend/dist`.
4. Put both behind HTTPS (e.g. Caddy or Nginx with Let's Encrypt).
5. Sign in as the Owner, add the team, review the settings, and replace the sample rates (see ADMIN_GUIDE.md).

## Security notes
- Passwords are bcrypt-hashed; sessions are signed JWTs (2 hours by default); 5 failed sign-ins lock the email for 15 minutes.
- Public endpoints are rate-limited per IP (`PUBLIC_RATE_LIMIT`) and only accept known fields with length limits.
- Customers see their request only with the reference number plus the same mobile number or email, and never see costs or margins.
- Every workflow step and admin change is written to the activity log.
- The server refuses to start in production with the default `JWT_SECRET`.
