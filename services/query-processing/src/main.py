"""
Clearon Query Processing Service - Minimal Working Version
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
    title="Clearon Query Processing Service",
    description="Microservice for processing queries and generating responses",
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
        "service": "query-processing",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Clearon Query Processing Service",
        "version": "1.0.0",
        "status": "running"
    }

@app.post("/api/queries/process")
async def process_query():
    """Process query endpoint - placeholder."""
    return {
        "message": "Query processing endpoint - coming soon",
        "status": "placeholder"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )