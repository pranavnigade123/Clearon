"""
Configuration settings for Document Processing Service
"""

import os
from typing import List

from pydantic import BaseSettings, validator


class Settings(BaseSettings):
    """Application settings."""
    
    # Service configuration
    SERVICE_NAME: str = "document-processing"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    
    # AWS S3
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: str
    
    # AI/ML Configuration
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 102
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    # Security
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # Processing limits
    MAX_CONCURRENT_PROCESSING: int = 5
    PROCESSING_TIMEOUT: int = 300  # 5 minutes
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    @validator("ALLOWED_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator("DATABASE_URL")
    def validate_database_url(cls, v):
        if not v:
            raise ValueError("DATABASE_URL is required")
        return v
    
    @validator("SUPABASE_URL")
    def validate_supabase_url(cls, v):
        if not v:
            raise ValueError("SUPABASE_URL is required")
        return v
    
    @validator("AWS_S3_BUCKET")
    def validate_s3_bucket(cls, v):
        if not v:
            raise ValueError("AWS_S3_BUCKET is required")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()