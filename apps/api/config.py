from functools import lru_cache

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env."""

    database_url: str = Field(alias="DATABASE_URL")
    jwt_secret: str = Field(alias="JWT_SECRET")
    google_client_id: str = Field(alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(alias="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(alias="GOOGLE_REDIRECT_URI")
    github_client_id: str = Field(alias="GITHUB_CLIENT_ID")
    github_client_secret: str = Field(alias="GITHUB_CLIENT_SECRET")
    github_redirect_uri: str = Field(alias="GITHUB_REDIRECT_URI")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    groq_api_key: str = Field(alias="GROQ_API_KEY")
    frontend_url: AnyHttpUrl = Field(alias="FRONTEND_URL")

    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 7

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()


settings = get_settings()
