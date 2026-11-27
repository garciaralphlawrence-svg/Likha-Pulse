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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
