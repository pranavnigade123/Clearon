"""
Clearon Query Processing Service

FastAPI microservice for processing user queries, performing vector search,
and generating responses with citations.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from loguru import logger

from api.routes import queries
from core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Clearon Query Processing Service")
    yield
    logger.info("Shutting down Clearon Query Processing Service")


app = FastAPI(
    title="Clearon Query Processing Service",
    description="Microservice for processing queries and generating responses",
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
app.include_router(queries.router, prefix="/api", tags=["queries"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "query-processing"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Clearon Query Processing Service",
        "version": "1.0.0",
        "status": "running"
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )