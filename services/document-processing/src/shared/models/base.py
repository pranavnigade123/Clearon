"""
Base data models for document processing
"""

from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime


class DocumentChunk(BaseModel):
    """Represents a chunk of processed document content."""
    
    chunk_id: str
    document_id: str
    content: str
    chunk_index: int
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = {}
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ProcessedDocument(BaseModel):
    """Represents a fully processed document."""
    
    document_id: str
    title: str
    source_type: str
    source_url: Optional[str] = None
    total_pages: Optional[int] = None
    total_words: int
    extraction_method: str
    chunks: List[DocumentChunk] = []
    processing_status: str = "completed"
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }