from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "OLL PARKS API"
    environment: str = Field(default="dev")

    database_url: str = Field(
        default="postgresql+psycopg://oll:oll@localhost:5432/oll_parks"
    )

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    pappers_api_key: str | None = None
    microsoft_tenant_id: str | None = None
    microsoft_client_id: str | None = None
    microsoft_client_secret: str | None = None
    visial_qie_base_url: str | None = None
    visial_qie_api_key: str | None = None
    jwt_secret: str = Field(default="change-me-in-prod")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expires_minutes: int = Field(default=60 * 24)


@lru_cache
def get_settings() -> Settings:
    return Settings()
