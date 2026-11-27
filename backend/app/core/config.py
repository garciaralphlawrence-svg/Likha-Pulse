"""Application settings. Every secret comes from environment variables (see .env.example)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Likha Pulse"
    environment: str = "development"  # development | production
    database_url: str = "sqlite:///./likha_pulse.db"

    jwt_secret: str = "change-me-in-.env"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 120

    cors_origins: str = "http://localhost:5173"

    # First Super Admin, created on first start if no users exist
    superadmin_email: str = "admin@example.com"
    superadmin_password: str = ""
    superadmin_name: str = "Super Admin"

    # Optional Claude (Anthropic) analysis engine
    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-5-5"

    # Optional platform credentials (official APIs only)
    meta_page_id: str = ""
    meta_page_access_token: str = ""
    meta_graph_version: str = "v21.0"

    # Optional SMTP for email notifications / password reset
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_tls: bool = True

    anonymize_authors: bool = True
    author_hash_salt: str = "change-me"
    reports_dir: str = "./generated_reports"
    enable_scheduler: bool = True
    seed_sample_data: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
