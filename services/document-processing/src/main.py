"""
Clearon Document Processing Service - Enhanced with PDF Processing
"""

import os
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
from loguru import logger
from pydantic import BaseModel
from typing import Optional, List

from processors import ProcessorFactory
from core.embedding_service import EmbeddingService

# Load environment variables
load_dotenv()

# Configure logging
logger.add("logs/document_processing.log", rotation="1 day", retention="7 days")

app = FastAPI(
    title="Clearon Document Processing Service",
    description="Microservice for processing documents and generating embeddings",
    version="1.0.0",
)

# Simple CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize processor factory and embedding service
processor_factory = ProcessorFactory()
embedding_service = EmbeddingService()


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    dimension: int
    model: str


class ProcessDocumentRequest(BaseModel):
    document_id: str
    file_path: str
    source_type: str
    user_id: str
    title: Optional[str] = None


class ProcessDocumentResponse(BaseModel):
    message: str
    document_id: str
    status: str
    extracted_text: Optional[str] = None
    total_pages: Optional[int] = None
    total_words: Optional[int] = None
    extraction_method: Optional[str] = None


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy", 
        "service": "document-processing",
        "version": "1.0.0",
        "supported_extensions": processor_factory.get_supported_extensions()
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Clearon Document Processing Service",
        "version": "1.0.0",
        "status": "running",
        "supported_extensions": processor_factory.get_supported_extensions()
    }


@app.post("/api/documents/process", response_model=ProcessDocumentResponse)
async def process_document(request: ProcessDocumentRequest):
    """Process document endpoint with actual PDF processing."""
    try:
        logger.info(f"Processing document {request.document_id} for user {request.user_id}")
        logger.info(f"File path: {request.file_path}, Source type: {request.source_type}")

        # Validate required fields
        if not all([request.document_id, request.file_path, request.source_type, request.user_id]):
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Check if file exists (or URL is valid)
        processor = processor_factory.get_processor(request.file_path)
        if not processor:
            logger.error(f"No processor available for file: {request.file_path}")
            raise HTTPException(status_code=400, detail="Unsupported file type")

        # Validate file/URL before processing
        validation_result = processor.validate_pdf(request.file_path)
        if not validation_result['valid']:
            logger.error(f"File/URL validation failed: {validation_result['error']}")
            raise HTTPException(status_code=400, detail=f"Validation failed: {validation_result['error']}")

        logger.info(f"Validation passed for: {request.file_path}")

        # For file paths, check if file exists
        if not request.file_path.startswith(('http://', 'https://')) and not os.path.exists(request.file_path):
            logger.error(f"File not found: {request.file_path}")
            raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

        # Get appropriate processor (again, for consistency)
        processor = processor_factory.get_processor(request.file_path)

        # Process the document
        result = await processor.process(request.file_path, request.document_id)
        
        logger.info(f"Document {request.document_id} processed successfully")
        logger.info(f"Extracted {result['total_pages']} pages, {result['total_words']} words")

        return ProcessDocumentResponse(
            message="Document processed successfully",
            document_id=request.document_id,
            status="completed",
            extracted_text=result['total_text'][:1000] + "..." if len(result['total_text']) > 1000 else result['total_text'],  # Truncate for response
            total_pages=result['total_pages'],
            total_words=result['total_words'],
            extraction_method=result['extraction_method']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing document {request.document_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")


@app.post("/api/documents/validate")
async def validate_document(file_path: str):
    """Validate document before processing."""
    try:
        logger.info(f"Validating document: {file_path}")

        # For file paths, check if file exists
        if not file_path.startswith(('http://', 'https://')) and not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        processor = processor_factory.get_processor(file_path)
        if not processor:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        validation_result = processor.validate_pdf(file_path)
        
        return {
            "valid": validation_result['valid'],
            "error": validation_result.get('error'),
            "file_size": validation_result.get('file_size'),
            "estimated_pages": validation_result.get('estimated_pages'),
            "supported_extensions": processor_factory.get_supported_extensions()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating document {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Document validation failed: {str(e)}")


@app.post("/api/embeddings/generate", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    """Generate embedding for text using Sentence Transformers."""
    try:
        logger.info(f"Generating embedding for text: {request.text[:100]}...")

        # Validate input
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        # Generate embedding using embedding service
        embedding = await embedding_service.generate_single_embedding(request.text)
        
        logger.info(f"Generated embedding with dimension: {len(embedding)}")

        return EmbeddingResponse(
            embedding=embedding,
            dimension=len(embedding),
            model=embedding_service.model_name
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")


@app.get("/api/embeddings/health")
async def embedding_health_check():
    """Check health of embedding service."""
    try:
        health_status = await embedding_service.health_check()
        return health_status

    except Exception as e:
        logger.error(f"Error checking embedding service health: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


if __name__ == "__main__":
    # Create logs directory if it doesn't exist
    os.makedirs("logs", exist_ok=True)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )