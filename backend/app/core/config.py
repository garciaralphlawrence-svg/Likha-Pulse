"""Application settings. Every secret comes from environment variables (see .env.example)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "PAPH Travel and Tours"
    environment: str = "development"  # development | production
    database_url: str = "sqlite:///./paph_quotes.db"

    jwt_secret: str = "change-me-in-.env"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 120

    cors_origins: str = "http://localhost:5173"

    # First Owner (ADMIN) account, created on first start if no users exist
    superadmin_email: str = "admin@example.com"
    superadmin_password: str = ""
    superadmin_name: str = "Owner"

    # Loads clearly labeled sample requests when the database has none
    seed_sample_data: bool = True
    # Public request form: max requests/actions per IP per minute
    public_rate_limit: int = 20

    # Facebook Page comments + Messenger (official Meta Graph API, needs Meta app review). Empty = not connected.
    meta_page_id: str = ""
    meta_page_access_token: str = ""
    meta_graph_version: str = "v21.0"

    # Email for the Monday weekly report. Empty = the report is only written to the log.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_tls: bool = True

    # Real Facebook/Messenger names are stored as a short code ("Client 7F3A") unless this is false
    anonymize_authors: bool = True
    author_hash_salt: str = "change-me"
    # Weekly report (Monday 8 AM Philippine time) and the 30-minute Facebook/Messenger sync
    enable_scheduler: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
