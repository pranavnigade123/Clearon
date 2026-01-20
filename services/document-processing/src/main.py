"""
Clearon Document Processing Service - Enhanced with PDF Processing
"""

import os
import sys
from pathlib import Path
import tempfile

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
from loguru import logger
from pydantic import BaseModel
from typing import Optional, List
import boto3

# Load environment variables from the root .env file
root_env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(root_env_path)
from botocore.exceptions import ClientError, NoCredentialsError

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

# Initialize processor factory (no sentence-transformers embedding service needed)
processor_factory = ProcessorFactory()
# embedding_service = EmbeddingService()  # Disabled - using Azure OpenAI instead

# Initialize S3 client
s3_client = None
try:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'ap-south-1')
    )
    logger.info("S3 client initialized successfully")
except Exception as e:
    logger.warning(f"Failed to initialize S3 client: {e}")
    s3_client = None


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    dimension: int
    model: str


class ProcessDocumentRequest(BaseModel):
    document_id: str
    file_path: Optional[str] = None  # For local files
    s3_key: Optional[str] = None     # For S3 files
    s3_bucket: Optional[str] = None  # S3 bucket name
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
    """Process document endpoint with support for both local files and S3."""
    try:
        logger.info(f"Processing document {request.document_id} for user {request.user_id}")
        
        # Determine if this is S3 or local file processing
        if request.s3_key and request.s3_bucket:
            logger.info(f"S3 processing: {request.s3_bucket}/{request.s3_key}")
            
            # Download file from S3 and process it
            return await process_s3_document(request)
            
        elif request.file_path:
            logger.info(f"Local file processing: {request.file_path}")
            file_source = request.file_path
        else:
            raise HTTPException(status_code=400, detail="Either file_path or s3_key+s3_bucket must be provided")

        # Validate required fields for local processing
        if not all([request.document_id, request.source_type, request.user_id]):
            raise HTTPException(status_code=400, detail="Missing required fields")

        # For local files, continue with existing logic
        if request.file_path:
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


async def process_s3_document(request: ProcessDocumentRequest) -> ProcessDocumentResponse:
    """Download file from S3 and process it."""
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 client not initialized")
    
    temp_file_path = None
    try:
        logger.info(f"Downloading S3 file: {request.s3_bucket}/{request.s3_key}")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(request.s3_key)[1]) as temp_file:
            temp_file_path = temp_file.name
        
        # Download file from S3
        try:
            s3_client.download_file(request.s3_bucket, request.s3_key, temp_file_path)
            logger.info(f"Successfully downloaded S3 file to: {temp_file_path}")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'NoSuchKey':
                raise HTTPException(status_code=404, detail=f"File not found in S3: {request.s3_key}")
            elif error_code == 'NoSuchBucket':
                raise HTTPException(status_code=404, detail=f"S3 bucket not found: {request.s3_bucket}")
            else:
                raise HTTPException(status_code=500, detail=f"S3 download error: {e}")
        except NoCredentialsError:
            raise HTTPException(status_code=500, detail="AWS credentials not configured")
        
        # Verify file was downloaded
        if not os.path.exists(temp_file_path) or os.path.getsize(temp_file_path) == 0:
            raise HTTPException(status_code=500, detail="Failed to download file from S3")
        
        # Get appropriate processor for the file
        processor = processor_factory.get_processor(temp_file_path)
        if not processor:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Validate the downloaded file
        validation_result = processor.validate_pdf(temp_file_path)
        if not validation_result['valid']:
            raise HTTPException(status_code=400, detail=f"File validation failed: {validation_result['error']}")
        
        logger.info(f"File validation passed for S3 file: {request.s3_key}")
        
        # Process the document
        result = await processor.process(temp_file_path, request.document_id)
        
        logger.info(f"S3 document {request.document_id} processed successfully")
        logger.info(f"Extracted {result['total_pages']} pages, {result['total_words']} words")
        
        # Now create chunks and embeddings
        try:
            logger.info(f"Creating chunks with embeddings for document {request.document_id}")
            
            # First, create the document record in the database
            import httpx
            async with httpx.AsyncClient() as client:
                document_data = {
                    "id": request.document_id,
                    "user_id": request.user_id,
                    "title": request.title or "PDF Document",
                    "source_type": "PDF",
                    "source_url": f"s3://{request.s3_bucket}/{request.s3_key}",
                    "s3_key": request.s3_key,
                    "processing_status": "COMPLETED",
                    "total_pages": result.get('total_pages', 0),
                    "total_words": result.get('total_words', 0),
                    "extraction_method": result.get('extraction_method', 'unknown')
                }
                
                try:
                    doc_response = await client.post(
                        "http://localhost:3000/api/internal/documents/create",
                        json=document_data,
                        timeout=30.0
                    )
                    if doc_response.status_code == 200:
                        logger.info(f"Document record created successfully for {request.document_id}")
                    else:
                        logger.error(f"Failed to create document record: {doc_response.status_code} - {doc_response.text}")
                except Exception as doc_error:
                    logger.error(f"Error creating document record: {doc_error}")
            
            # Create simple chunks directly
            text_content = result['total_text']
            chunk_size = 512  # Match the configured chunk size
            chunks = []
            
            # Simple chunking by splitting text
            words = text_content.split()
            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i + chunk_size]
                chunk_content = ' '.join(chunk_words)
                
                if chunk_content.strip():
                    chunks.append({
                        'content': chunk_content,
                        'chunk_index': i//chunk_size,
                        'metadata': {
                            "source_type": "PDF",
                            "title": request.title or "PDF Document"
                        }
                    })
            
            logger.info(f"Created {len(chunks)} text chunks, now generating embeddings...")
            
            # Generate embeddings for chunks using Azure OpenAI
            from core.openai_service import openai_service
            
            for i, chunk in enumerate(chunks):
                try:
                    # Generate embedding for this chunk
                    embedding = await openai_service.generate_single_embedding(chunk['content'])
                    chunk['embedding'] = embedding
                    
                    logger.info(f"Generated embedding for chunk {i} (dimension: {len(embedding)})")
                    
                    # Store chunk in database via Next.js API
                    async with httpx.AsyncClient() as client:
                        chunk_data = {
                            "document_id": request.document_id,
                            "user_id": request.user_id,
                            "content": chunk['content'],
                            "embedding": chunk['embedding'],
                            "chunk_index": chunk['chunk_index'],
                            "metadata": chunk['metadata']
                        }
                        
                        try:
                            response = await client.post(
                                "http://localhost:3000/api/internal/chunks/create",
                                json=chunk_data,
                                timeout=30.0
                            )
                            if response.status_code == 200:
                                logger.info(f"Successfully stored chunk {i}")
                            else:
                                logger.error(f"Failed to store chunk {i}: {response.status_code} - {response.text}")
                        except Exception as store_error:
                            logger.error(f"Error storing chunk {i}: {store_error}")
                            
                except Exception as embedding_error:
                    logger.error(f"Error generating embedding for chunk {i}: {embedding_error}")
            
            logger.info(f"Document {request.document_id} processing completed successfully - {len(chunks)} chunks created and stored")
            
        except Exception as chunk_error:
            logger.error(f"Failed to create chunks for document {request.document_id}: {chunk_error}")
            # Continue with document processing response even if chunking fails
        
        return ProcessDocumentResponse(
            message="S3 document processed successfully",
            document_id=request.document_id,
            status="completed",
            extracted_text=result['total_text'][:1000] + "..." if len(result['total_text']) > 1000 else result['total_text'],
            total_pages=result['total_pages'],
            total_words=result['total_words'],
            extraction_method=f"s3_{result['extraction_method']}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing S3 document {request.document_id}: {e}")
        raise HTTPException(status_code=500, detail=f"S3 document processing failed: {str(e)}")
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.debug(f"Cleaned up temporary file: {temp_file_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file {temp_file_path}: {e}")


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
    """Generate embedding for text using Azure OpenAI text-embedding-3-small."""
    try:
        logger.info(f"Generating Azure OpenAI embedding for text: {request.text[:100]}...")

        # Validate input
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        # Use Azure OpenAI for embeddings
        from core.openai_service import openai_service
        
        embedding = await openai_service.generate_single_embedding(request.text)
        
        logger.info(f"Generated Azure OpenAI embedding with dimension: {len(embedding)}")

        return EmbeddingResponse(
            embedding=embedding,
            dimension=len(embedding),
            model="text-embedding-3-small (Azure OpenAI)"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        # Fallback to sentence-transformers on any error
        try:
            embedding = await embedding_service.generate_single_embedding(request.text)
            return EmbeddingResponse(
                embedding=embedding,
                dimension=len(embedding),
                model="all-MiniLM-L6-v2 (error-fallback)"
            )
        except Exception as fallback_error:
            logger.error(f"Azure OpenAI embedding failed: {fallback_error}")
            raise HTTPException(status_code=500, detail=f"Azure OpenAI embedding generation failed: {str(e)}")


@app.get("/api/embeddings/health")
async def embedding_health_check():
    """Check health of Azure OpenAI embedding service."""
    try:
        from core.openai_service import openai_service
        
        # Test Azure OpenAI connection
        connection_test = await openai_service.test_connection()
        model_info = await openai_service.get_model_info()
        
        if connection_test:
            return {
                "status": "healthy",
                "provider": "Azure OpenAI",
                "model_info": model_info
            }
        else:
            return {
                "status": "unhealthy",
                "provider": "Azure OpenAI",
                "error": "Connection test failed",
                "model_info": model_info
            }

    except Exception as e:
        logger.error(f"Error checking Azure OpenAI service health: {e}")
        return {
            "status": "unhealthy",
            "provider": "Azure OpenAI",
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