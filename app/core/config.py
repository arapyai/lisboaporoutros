from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Lisboa por Outros API"
    environment: str = "development"
    database_url: str = "sqlite+pysqlite:///./app.db"
    admin_secret_key: str = "change-me"
    admin_access_token_expire_minutes: int = 60
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])


@lru_cache
def get_settings() -> Settings:
    return Settings()
