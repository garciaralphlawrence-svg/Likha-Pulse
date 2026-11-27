import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, management, owner, public
from app.api import requests as requests_api
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
    yield


app = FastAPI(title="PAPH Travel and Tours API", version="2.0.0", lifespan=lifespan,
              description="AI travel quotation analyst. A customer sends a trip request (public endpoints under /api/public), "
                          "the free built-in AI prices it and suggests options, a salesperson prepares the offer, and an agent approves, "
                          "asks for changes or declines it. Staff endpoints need POST /api/auth/login, then `Authorization: Bearer <token>`. "
                          "All rates are SAMPLE rates until PAPH's real rates are loaded into app/quotes/catalog.json.")
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
app.include_router(public.router)
app.include_router(requests_api.router)
app.include_router(management.router)
app.include_router(owner.router)


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "app": settings.app_name}
