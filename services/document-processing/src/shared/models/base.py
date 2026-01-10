"""
Clearon Shared Data Models
Base models and types used across Python microservices
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, validator


class SourceType(str, Enum):
    """Document source types."""
    PDF = "PDF"
    WEB = "WEB"
    CSV = "CSV"


class ProcessingStatus(str, Enum):
    """Document processing status."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SourceLocation(BaseModel):
    """Source location information for citations."""
    # For PDFs
    page_number: Optional[int] = None
    # For web content
    url: Optional[str] = None
    section: Optional[str] = None
    # For CSV
    row_id: Optional[int] = None
    column_headers: Optional[List[str]] = None
    # Common
    start_char: Optional[int] = None
    end_char: Optional[int] = None

    class Config:
        extra = "allow"


class UnifiedDocument(BaseModel):
    """Unified document model for processed documents."""
    id: Optional[UUID] = None
    user_id: UUID
    source_type: SourceType
    title: str
    original_filename: Optional[str] = None
    url: Optional[str] = None
    s3_key: Optional[str] = None
    content: str
    content_hash: Optional[str] = None
    file_size: Optional[int] = None
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None

    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }


class DocumentChunk(BaseModel):
    """Document chunk with embedding."""
    id: Optional[UUID] = None
    document_id: UUID
    content: str
    chunk_index: int
    token_count: Optional[int] = None
    source_location: SourceLocation
    embedding: Optional[List[float]] = None
    created_at: Optional[datetime] = None

    @validator('content')
    def content_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        return v.strip()

    @validator('chunk_index')
    def chunk_index_non_negative(cls, v):
        if v < 0:
            raise ValueError('Chunk index must be non-negative')
        return v

    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }


class Citation(BaseModel):
    """Citation information for query responses."""
    document_id: UUID
    document_title: str
    source_type: SourceType
    location: str  # Page number, URL, or row identifier
    excerpt: str
    confidence: float = Field(ge=0.0, le=1.0)

    @validator('excerpt')
    def excerpt_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Excerpt cannot be empty')
        return v.strip()

    class Config:
        use_enum_values = True
        json_encoders = {
            UUID: lambda v: str(v)
        }


class QueryResponse(BaseModel):
    """Query processing response."""
    answer: str
    citations: List[Citation]
    confidence_score: float = Field(ge=0.0, le=1.0)
    processing_time: float = Field(ge=0.0)
    sources_used: List[str]

    @validator('answer')
    def answer_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Answer cannot be empty')
        return v.strip()

    class Config:
        use_enum_values = True


class ProcessingResult(BaseModel):
    """Result of document processing operation."""
    success: bool
    document: Optional[UnifiedDocument] = None
    chunks: Optional[List[DocumentChunk]] = None
    error_message: Optional[str] = None
    processing_time: float = Field(ge=0.0)

    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }


class EmbeddingRequest(BaseModel):
    """Request for generating embeddings."""
    texts: List[str]
    model_name: str = "all-MiniLM-L6-v2"

    @validator('texts')
    def texts_not_empty(cls, v):
        if not v:
            raise ValueError('Texts list cannot be empty')
        for text in v:
            if not text or not text.strip():
                raise ValueError('Text content cannot be empty')
        return v


class EmbeddingResponse(BaseModel):
    """Response containing generated embeddings."""
    embeddings: List[List[float]]
    model_name: str
    dimension: int
    processing_time: float = Field(ge=0.0)

    @validator('embeddings')
    def embeddings_not_empty(cls, v):
        if not v:
            raise ValueError('Embeddings list cannot be empty')
        return v


class HealthCheck(BaseModel):
    """Health check response."""
    status: str = "healthy"
    service: str
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    dependencies: Dict[str, str] = Field(default_factory=dict)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }