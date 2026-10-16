import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for backend (parent of app/)
BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables or .env file.
    Follows 12-factor application methodology.
    """
    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR / ".env"), str(BASE_DIR.parent / ".env"), str(Path(__file__).resolve().parent / ".env")),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # Bolna Voice Assistant Configuration
    BOLNA_API_KEY: str = ""
    BOLNA_AGENT_ID: str = ""

    # Application settings
    APP_NAME: str = "KaamSaathi Backend API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # CORS Origins (Comma-separated string or list)
    FRONTEND_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins(self) -> List[str]:
        origins = [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]
        vercel_url = os.environ.get("VERCEL_URL")
        if vercel_url:
            origins.append(f"https://{vercel_url}")
        vercel_branch_url = os.environ.get("VERCEL_BRANCH_URL")
        if vercel_branch_url:
            origins.append(f"https://{vercel_branch_url}")
        return list(dict.fromkeys(origins))

    @property
    def is_supabase_configured(self) -> bool:
        return bool(
            self.SUPABASE_URL 
            and self.SUPABASE_KEY 
            and not self.SUPABASE_URL.startswith("https://your-project")
            and not self.SUPABASE_KEY.startswith("your-supabase")
        )

    @property
    def is_bolna_configured(self) -> bool:
        return bool(
            self.BOLNA_API_KEY 
            and self.BOLNA_AGENT_ID 
            and not self.BOLNA_API_KEY.startswith("bn-your")
            and not self.BOLNA_AGENT_ID.startswith("your-agent")
        )

# Global settings singleton
settings = Settings()
