from pydantic_settings import BaseSettings
from typing import Optional
import secrets


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Leadway MRAS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/mras_db"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # Email
    SENDGRID_API_KEY: Optional[str] = None
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@leadwayhealth.com"
    EMAIL_FROM_NAME: str = "Leadway Health MRAS"

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # File Storage
    UPLOAD_DIR: str = "./uploads"
    DOCUMENTS_DIR: str = "./documents"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
