"""
Configuration settings for Query Processing Service
"""

import os
from typing import List, Optional

from pydantic_settings import BaseSettings
from pydantic import field_validator


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
    
    # Azure OpenAI Configuration (REQUIRED)
    AZURE_OPENAI_API_KEY: str
    AZURE_OPENAI_ENDPOINT: str
    AZURE_OPENAI_API_VERSION: str = "2024-02-15-preview"
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT: Optional[str] = None
    AZURE_OPENAI_LLM_DEPLOYMENT: Optional[str] = None
    
    # Model Configuration
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536
    LLM_MODEL: str = "gpt-4o-mini"
    
    # Query Processing
    SIMILARITY_THRESHOLD: float = 0.78
    MAX_RESULTS: int = 10
    MAX_CONTEXT_LENGTH: int = 4000
    MAX_OUTPUT_TOKENS: int = 500
    
    # Response generation
    RESPONSE_MAX_LENGTH: int = 1000
    CITATION_MAX_EXCERPT_LENGTH: int = 200
    
    # Security
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    
    # Performance
    MAX_CONCURRENT_QUERIES: int = 10
    QUERY_TIMEOUT: int = 60  # 1 minute
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    @property
    def is_azure_openai(self) -> bool:
        """Check if using Azure OpenAI (always True now)."""
        return True
    
    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v):
        if not v:
            raise ValueError("DATABASE_URL is required")
        return v
    
    @field_validator("SUPABASE_URL")
    @classmethod
    def validate_supabase_url(cls, v):
        if not v:
            raise ValueError("SUPABASE_URL is required")
        return v
    
    @field_validator("SIMILARITY_THRESHOLD")
    @classmethod
    def validate_similarity_threshold(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError("SIMILARITY_THRESHOLD must be between 0.0 and 1.0")
        return v
    
    class Config:
        env_file = "../../.env"  # Load from root .env file
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields


settings = Settings()