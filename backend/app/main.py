import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, feedback, management
from app.api import cases as cases_api
from app.api import team_tools
from app.core.config import get_settings
from app.db import Base, SessionLocal, engine
from app.bootstrap import bootstrap

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.environment == "production" and settings.jwt_secret in ("", "change-me-in-.env"):
        raise RuntimeError("Set a strong JWT_SECRET before running in production.")
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(engine)  # dev convenience; PostgreSQL uses Alembic migrations
        from app.db import add_missing_sqlite_columns
        add_missing_sqlite_columns()
    with SessionLocal() as db:
        bootstrap(db)
    sched = None
    if settings.enable_scheduler:
        from app.jobs import start_scheduler
        sched = start_scheduler()
    yield
    if sched:
        sched.shutdown(wait=False)


app = FastAPI(title="Likha Pulse API", version="1.0.0", lifespan=lifespan,
              description="AI-powered sentiment analysis and feedback intelligence. Authenticate with POST /api/auth/login, "
                          "then send `Authorization: Bearer <token>`.")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def security_headers(request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return resp


app.include_router(auth.router)
app.include_router(feedback.router)
app.include_router(management.router)
app.include_router(cases_api.router)
app.include_router(team_tools.router)


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "app": settings.app_name}
