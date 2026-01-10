"""
Configuration settings for Query Processing Service
"""

import os
from typing import List

from pydantic import BaseSettings, validator


class Settings(BaseSettings):
    """Application settings."""
    
    # Service configuration
    SERVICE_NAME: str = "query-processing"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    
    # AI/ML Configuration
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    SIMILARITY_THRESHOLD: float = 0.78
    MAX_RESULTS: int = 10
    MAX_CONTEXT_LENGTH: int = 4000
    
    # Query processing
    RESPONSE_MAX_LENGTH: int = 1000
    CITATION_MAX_EXCERPT_LENGTH: int = 200
    
    # Security
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # Performance
    MAX_CONCURRENT_QUERIES: int = 10
    QUERY_TIMEOUT: int = 60  # 1 minute
    
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
    
    @validator("SIMILARITY_THRESHOLD")
    def validate_similarity_threshold(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError("SIMILARITY_THRESHOLD must be between 0.0 and 1.0")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()