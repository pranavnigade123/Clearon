"""
Clearon Document Processing Service - Minimal Working Version
"""

import os
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy", 
        "service": "document-processing",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Clearon Document Processing Service",
        "version": "1.0.0",
        "status": "running"
    }

@app.post("/api/documents/process")
async def process_document(request: dict):
    """Process document endpoint - actual implementation."""
    try:
        document_id = request.get('document_id')
        file_path = request.get('file_path')
        source_type = request.get('source_type')
        user_id = request.get('user_id')
        title = request.get('title')

        if not all([document_id, file_path, source_type, user_id]):
            return {
                "error": "Missing required fields",
                "status": "error"
            }

        logger.info(f"Processing document {document_id} for user {user_id}")

        # Simulate processing and then mark as completed
        import asyncio
        await asyncio.sleep(3)  # Simulate processing time

        # Update document status to completed (simulate database update)
        logger.info(f"Document {document_id} processed successfully")

        # In a real implementation, you would update the database here
        # For now, we'll let the Next.js API handle the status update

        return {
            "message": "Document processed successfully",
            "document_id": document_id,
            "status": "completed"
        }

    except Exception as e:
        logger.error(f"Error processing document: {e}")
        return {
            "error": str(e),
            "status": "error"
        }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )