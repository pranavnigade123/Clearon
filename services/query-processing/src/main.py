"""
Clearon Query Processing Service - AI-Powered RAG Engine
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
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime

# Load environment variables
load_dotenv()

# Configure logging
logger.add("logs/query_processing.log", rotation="1 day", retention="7 days")

app = FastAPI(
    title="Clearon Query Processing Service",
    description="AI-powered query processing and response generation with RAG",
    version="1.0.0",
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str
    user_id: str
    max_results: Optional[int] = 5
    similarity_threshold: Optional[float] = 0.5
    include_citations: Optional[bool] = True


class Citation(BaseModel):
    document_id: str
    document_title: str
    chunk_id: str
    page_number: Optional[int] = None
    url: Optional[str] = None
    similarity_score: float
    excerpt: str


class QueryResponse(BaseModel):
    query: str
    response: str
    citations: List[Citation]
    processing_time_ms: int
    total_chunks_searched: int
    relevant_chunks_found: int
    confidence_score: float


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    content: str
    embedding: List[float]
    metadata: Dict[str, Any]


@app.get("/health")
async def health_check():
    """Enhanced health check endpoint."""
    return {
        "status": "healthy", 
        "service": "query-processing",
        "version": "1.0.0",
        "features": {
            "vector_search": True,
            "response_generation": True,
            "citation_extraction": True,
            "cross_source_search": True
        }
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Clearon Query Processing Service",
        "version": "1.0.0",
        "status": "running",
        "description": "AI-powered query processing with RAG capabilities"
    }


@app.post("/api/queries/process", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    """
    Process user query with RAG (Retrieval-Augmented Generation).
    
    This endpoint:
    1. Converts the query to embeddings
    2. Performs vector similarity search
    3. Retrieves relevant document chunks
    4. Generates response with citations
    """
    try:
        start_time = datetime.now()
        logger.info(f"Processing query for user {request.user_id}: {request.query}")

        # Validate query
        if not request.query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")

        # Step 1: Generate query embedding
        query_embedding = await generate_query_embedding(request.query)
        
        # Step 2: Perform vector similarity search
        relevant_chunks = await search_similar_chunks(
            query_embedding, 
            request.user_id,
            request.max_results,
            request.similarity_threshold
        )
        
        # Step 3: Generate response with citations
        response_text, citations, confidence = await generate_response_with_citations(
            request.query, 
            relevant_chunks
        )
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        logger.info(f"Query processed successfully. Found {len(relevant_chunks)} relevant chunks")
        
        return QueryResponse(
            query=request.query,
            response=response_text,
            citations=citations,
            processing_time_ms=int(processing_time),
            total_chunks_searched=1000,  # This would come from actual search
            relevant_chunks_found=len(relevant_chunks),
            confidence_score=confidence
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=f"Query processing failed: {str(e)}")


@app.post("/api/search/similarity")
async def similarity_search(
    query_embedding: List[float], 
    user_id: str, 
    max_results: int = 5,
    threshold: float = 0.5
) -> List[DocumentChunk]:
    """Perform vector similarity search across user's documents."""
    try:
        logger.info(f"Performing similarity search for user {user_id}")
        
        # This would integrate with vector database (Supabase pgvector)
        # For now, return mock results
        mock_chunks = await get_mock_document_chunks(user_id, max_results)
        
        return mock_chunks

    except Exception as e:
        logger.error(f"Error in similarity search: {e}")
        raise HTTPException(status_code=500, detail=f"Similarity search failed: {str(e)}")


@app.get("/api/documents/{document_id}/chunks")
async def get_document_chunks(document_id: str, user_id: str) -> List[DocumentChunk]:
    """Get all chunks for a specific document."""
    try:
        logger.info(f"Retrieving chunks for document {document_id}")
        
        # This would query the database for actual chunks
        # For now, return mock data
        return []

    except Exception as e:
        logger.error(f"Error retrieving document chunks: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chunks: {str(e)}")


async def generate_query_embedding(query: str) -> List[float]:
    """Generate embedding for user query."""
    try:
        # This would call the document processing service's embedding endpoint
        # For now, return mock embedding
        logger.debug(f"Generating embedding for query: {query}")
        
        # Mock embedding (384 dimensions for all-MiniLM-L6-v2)
        import random
        return [random.random() for _ in range(384)]
        
    except Exception as e:
        logger.error(f"Error generating query embedding: {e}")
        raise Exception(f"Query embedding generation failed: {str(e)}")


async def search_similar_chunks(
    query_embedding: List[float], 
    user_id: str, 
    max_results: int,
    threshold: float
) -> List[DocumentChunk]:
    """Search for similar document chunks using vector similarity."""
    try:
        logger.debug(f"Searching for similar chunks for user {user_id}")
        
        # This would perform actual vector search in Supabase pgvector
        # For now, return mock results
        return await get_mock_document_chunks(user_id, max_results)
        
    except Exception as e:
        logger.error(f"Error in chunk similarity search: {e}")
        raise Exception(f"Chunk search failed: {str(e)}")


async def generate_response_with_citations(
    query: str, 
    relevant_chunks: List[DocumentChunk]
) -> tuple[str, List[Citation], float]:
    """Generate response based on relevant chunks with proper citations."""
    try:
        logger.debug(f"Generating response for query: {query}")
        
        if not relevant_chunks:
            return (
                "I couldn't find any relevant information in your documents to answer this query. Please try rephrasing your question or upload more relevant documents.",
                [],
                0.0
            )
        
        # Extract content from chunks
        context_texts = [chunk.content for chunk in relevant_chunks]
        
        # Generate response (this would use an LLM in production)
        response_text = await generate_contextual_response(query, context_texts)
        
        # Create citations
        citations = []
        for i, chunk in enumerate(relevant_chunks):
            citation = Citation(
                document_id=chunk.document_id,
                document_title=chunk.metadata.get('title', f'Document {chunk.document_id}'),
                chunk_id=chunk.chunk_id,
                page_number=chunk.metadata.get('page_number'),
                url=chunk.metadata.get('url'),
                similarity_score=0.8 - (i * 0.1),  # Mock decreasing similarity
                excerpt=chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
            )
            citations.append(citation)
        
        # Calculate confidence based on similarity scores and number of sources
        confidence = min(0.95, len(relevant_chunks) * 0.2 + 0.3)
        
        return response_text, citations, confidence
        
    except Exception as e:
        logger.error(f"Error generating response with citations: {e}")
        raise Exception(f"Response generation failed: {str(e)}")


async def generate_contextual_response(query: str, context_texts: List[str]) -> str:
    """Generate response based on query and context (mock implementation)."""
    try:
        # This would use an actual LLM (OpenAI, Anthropic, or local model)
        # For now, create a mock response based on the context
        
        combined_context = " ".join(context_texts[:3])  # Use first 3 chunks
        
        # Simple mock response generation
        if "what" in query.lower():
            response = f"Based on your documents, here's what I found: {combined_context[:300]}..."
        elif "how" in query.lower():
            response = f"According to your documents, here's how this works: {combined_context[:300]}..."
        elif "why" in query.lower():
            response = f"Your documents explain this as follows: {combined_context[:300]}..."
        else:
            response = f"Based on the information in your documents: {combined_context[:300]}..."
        
        return response
        
    except Exception as e:
        logger.error(f"Error in contextual response generation: {e}")
        return "I encountered an error while generating a response. Please try again."


async def get_mock_document_chunks(user_id: str, max_results: int) -> List[DocumentChunk]:
    """Get mock document chunks for testing."""
    mock_chunks = []
    
    for i in range(min(max_results, 3)):
        chunk = DocumentChunk(
            chunk_id=f"chunk_{i+1}",
            document_id=f"doc_{i+1}",
            content=f"This is mock content for chunk {i+1}. It contains relevant information about the user's query and demonstrates how the RAG system retrieves and processes document chunks to generate accurate responses.",
            embedding=[0.1 * j for j in range(384)],  # Mock embedding
            metadata={
                "title": f"Sample Document {i+1}",
                "page_number": i + 1,
                "source_type": "PDF",
                "created_at": "2024-01-01T00:00:00Z"
            }
        )
        mock_chunks.append(chunk)
    
    return mock_chunks


if __name__ == "__main__":
    # Create logs directory if it doesn't exist
    os.makedirs("logs", exist_ok=True)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )