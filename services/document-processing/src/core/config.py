"""
Configuration settings for Document Processing Service
"""

import os
from typing import List, Optional

from pydantic_settings import BaseSettings


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
    
    # Document Processing
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 102
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    # Security
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    
    # Processing limits
    MAX_CONCURRENT_PROCESSING: int = 5
    PROCESSING_TIMEOUT: int = 300  # 5 minutes
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    @property
    def cors_origins(self) -> List[str]:
        """Get CORS origins as a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    @property
    def is_azure_openai(self) -> bool:
        """Check if using Azure OpenAI (always True now)."""
        return True
    
    class Config:
        env_file = "../../.env"  # Load from root .env file
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields


settings = Settings()