from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Java Agent (Sybase IQ proxy)
    agent_url: str = "http://localhost:8080"
    agent_api_key: str = ""
    agent_timeout_seconds: int = 30
    agent_default_limit: int = 500
    sybase_schema: str = "pref_aruja_sp"
    agent_verify_ssl: bool = True

    # Banco do dashboard
    database_url: str = "sqlite:///./dev.db"

    @property
    def database_url_resolved(self) -> str:
        """Normaliza URL do PostgreSQL para o driver psycopg3 do SQLAlchemy."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    # JWT
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_minutes: int = 15
    jwt_refresh_days: int = 7

    # CORS
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
