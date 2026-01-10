"""
Clearon Document Processing Service

FastAPI microservice for processing documents (PDFs, web content, CSV files)
and converting them into embeddings for the RAG system.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from loguru import logger

from api.routes import documents
from core.config import settings
from shared.database.connection import initialize_database, close_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Clearon Document Processing Service")
    
    # Initialize database connection
    try:
        await initialize_database()
        logger.info("Database connection initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
    
    yield
    
    # Cleanup
    try:
        await close_database()
        logger.info("Database connection closed")
    except Exception as e:
        logger.error(f"Error closing database: {e}")
    
    logger.info("Shutting down Clearon Document Processing Service")


app = FastAPI(
    title="Clearon Document Processing Service",
    description="Microservice for processing documents and generating embeddings",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router, prefix="/api", tags=["documents"])


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


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )