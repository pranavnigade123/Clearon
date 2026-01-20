"""
Document Processing API Routes
FastAPI routes for document processing operations
"""

import asyncio
from typing import Dict, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from loguru import logger

from core.config import settings
from core.document_processor import DocumentProcessor
from core.embedding_service import EmbeddingService
from shared.database.connection import document_service, query_service
import sys
from pathlib import Path
# Add the services directory to the path to import shared models
sys.path.append(str(Path(__file__).parent.parent.parent.parent))
from shared.models.base import SourceType

router = APIRouter()

# Request models
class ProcessDocumentRequest(BaseModel):
    document_id: UUID
    s3_key: str
    source_type: SourceType
    user_id: UUID

class ProcessUrlRequest(BaseModel):
    document_id: UUID
    url: str
    user_id: UUID

# Global services
document_processor = DocumentProcessor()
embedding_service = EmbeddingService()


@router.post("/process")
async def process_document(
    request: ProcessDocumentRequest,
    background_tasks: BackgroundTasks
):
    """Process a document from S3 storage."""
    try:
        logger.info(f"Starting document processing for {request.document_id}")
        
        # Update status to processing
        await document_service.update_document_status(
            request.document_id, 
            "PROCESSING"
        )
        
        # Add background task for processing
        background_tasks.add_task(
            process_document_task,
            request.document_id,
            request.s3_key,
            request.source_type,
            request.user_id
        )
        
        return {
            "message": "Document processing started",
            "document_id": str(request.document_id),
            "status": "PROCESSING"
        }
        
    except Exception as e:
        logger.error(f"Failed to start document processing: {e}")
        await document_service.update_document_status(
            request.document_id,
            "FAILED",
            str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process-url")
async def process_url(
    request: ProcessUrlRequest,
    background_tasks: BackgroundTasks
):
    """Process content from a URL."""
    try:
        logger.info(f"Starting URL processing for {request.document_id}")
        
        # Update status to processing
        await document_service.update_document_status(
            request.document_id,
            "PROCESSING"
        )
        
        # Add background task for processing
        background_tasks.add_task(
            process_url_task,
            request.document_id,
            request.url,
            request.user_id
        )
        
        return {
            "message": "URL processing started",
            "document_id": str(request.document_id),
            "status": "PROCESSING"
        }
        
    except Exception as e:
        logger.error(f"Failed to start URL processing: {e}")
        await document_service.update_document_status(
            request.document_id,
            "FAILED",
            str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


async def process_document_task(
    document_id: UUID,
    s3_key: str,
    source_type: SourceType,
    user_id: UUID
):
    """Background task for document processing."""
    try:
        logger.info(f"Processing document {document_id} from S3: {s3_key}")
        
        # Process the document based on type
        if source_type == SourceType.PDF:
            result = await document_processor.process_pdf_from_s3(
                s3_key, str(document_id), str(user_id)
            )
        elif source_type == SourceType.CSV:
            result = await document_processor.process_csv_from_s3(
                s3_key, str(document_id), str(user_id)
            )
        else:
            raise ValueError(f"Unsupported source type for S3 processing: {source_type}")
        
        if result.success and result.document and result.chunks:
            # Generate embeddings for chunks using OpenAI
            result.chunks = await document_processor.generate_embeddings_for_chunks(result.chunks)
            
            # Store chunks in database
            await document_service.insert_chunks(result.chunks)
            
            # Update document status to completed
            await document_service.update_document_status(
                document_id,
                "COMPLETED"
            )
            
            logger.info(f"Successfully processed document {document_id}")
            
        else:
            # Update status to failed
            await document_service.update_document_status(
                document_id,
                "FAILED",
                result.error_message or "Processing failed"
            )
            logger.error(f"Document processing failed: {result.error_message}")
            
    except Exception as e:
        logger.error(f"Document processing task failed: {e}")
        await document_service.update_document_status(
            document_id,
            "FAILED",
            str(e)
        )


async def process_url_task(
    document_id: UUID,
    url: str,
    user_id: UUID
):
    """Background task for URL processing."""
    try:
        logger.info(f"Processing URL {url} for document {document_id}")
        
        # Process the URL
        result = await document_processor.process_web_content(
            url, str(document_id), str(user_id)
        )
        
        if result.success and result.document and result.chunks:
            # Generate embeddings for chunks using OpenAI
            result.chunks = await document_processor.generate_embeddings_for_chunks(result.chunks)
            
            # Store chunks in database
            await document_service.insert_chunks(result.chunks)
            
            # Update document status to completed
            await document_service.update_document_status(
                document_id,
                "COMPLETED"
            )
            
            logger.info(f"Successfully processed URL for document {document_id}")
            
        else:
            # Update status to failed
            await document_service.update_document_status(
                document_id,
                "FAILED",
                result.error_message or "URL processing failed"
            )
            logger.error(f"URL processing failed: {result.error_message}")
            
    except Exception as e:
        logger.error(f"URL processing task failed: {e}")
        await document_service.update_document_status(
            document_id,
            "FAILED",
            str(e)
        )


@router.get("/status/{document_id}")
async def get_processing_status(document_id: UUID):
    """Get processing status of a document."""
    try:
        document = await document_service.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {
            "document_id": str(document_id),
            "status": document.get("processing_status"),
            "error_message": document.get("error_message"),
            "processed_at": document.get("processed_at"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get processing status: {e}")
        raise HTTPException(status_code=500, detail=str(e))