"""Application configuration, loaded from environment variables / .env."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "dev-only-insecure-secret-key"
    environment: str = "development"
    site_name: str = "My Portfolio"

    admin_username: str = "admin"
    admin_password: str = "admin"

    database_url: str = "sqlite:///./portfolio.db"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
