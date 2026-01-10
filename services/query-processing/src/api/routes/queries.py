"""
Query Processing API Routes
FastAPI routes for query processing and response generation
"""

import time
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from loguru import logger

from ...core.config import settings
from ...core.query_engine import QueryEngine
from ...core.response_generator import ResponseGenerator
from ...core.citation_generator import CitationGenerator
from ...shared.database.connection import query_service
from ...shared.models.base import QueryResponse, Citation

router = APIRouter()

# Request models
class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    user_id: UUID
    max_results: int = Field(default=10, ge=1, le=50)
    similarity_threshold: float = Field(default=0.78, ge=0.0, le=1.0)

class QueryResponseModel(BaseModel):
    answer: str
    citations: List[Citation]
    confidence_score: float
    processing_time: float
    sources_used: List[str]
    query_id: Optional[str] = None

# Global services
query_engine = QueryEngine()
response_generator = ResponseGenerator()
citation_generator = CitationGenerator()


@router.post("/query", response_model=QueryResponseModel)
async def process_query(request: QueryRequest):
    """Process a user query and generate response with citations."""
    start_time = time.time()
    
    try:
        logger.info(f"Processing query for user {request.user_id}: {request.query[:100]}...")
        
        # Step 1: Generate query embedding
        query_embedding = await query_engine.generate_query_embedding(request.query)
        
        # Step 2: Perform vector similarity search
        search_results = await query_engine.vector_search(
            query_embedding=query_embedding,
            user_id=request.user_id,
            threshold=request.similarity_threshold,
            limit=request.max_results
        )
        
        if not search_results:
            return QueryResponseModel(
                answer="I couldn't find any relevant information in your documents to answer this question.",
                citations=[],
                confidence_score=0.0,
                processing_time=time.time() - start_time,
                sources_used=[]
            )
        
        # Step 3: Generate response from search results
        response_text, confidence = await response_generator.generate_response(
            query=request.query,
            search_results=search_results
        )
        
        # Step 4: Generate citations
        citations = await citation_generator.generate_citations(search_results)
        
        # Step 5: Extract source information
        sources_used = list(set([
            result.get('document_title', 'Unknown Document') 
            for result in search_results
        ]))
        
        processing_time = time.time() - start_time
        
        # Step 6: Save query to history (optional, don't fail if it errors)
        try:
            query_id = await query_service.save_query_history(
                user_id=request.user_id,
                query_text=request.query,
                response_text=response_text,
                sources_used=[citation.dict() for citation in citations],
                processing_time_ms=int(processing_time * 1000),
                confidence_score=confidence
            )
        except Exception as e:
            logger.warning(f"Failed to save query history: {e}")
            query_id = None
        
        logger.info(f"Query processed successfully in {processing_time:.2f}s")
        
        return QueryResponseModel(
            answer=response_text,
            citations=citations,
            confidence_score=confidence,
            processing_time=processing_time,
            sources_used=sources_used,
            query_id=str(query_id) if query_id else None
        )
        
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(f"Query processing failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Query processing failed: {str(e)}"
        )


@router.get("/history/{user_id}")
async def get_query_history(
    user_id: UUID,
    limit: int = 10,
    offset: int = 0
):
    """Get query history for a user."""
    try:
        # This would typically require authentication to ensure user can only access their own history
        history = await query_service.get_user_query_history(
            user_id=user_id,
            limit=limit,
            offset=offset
        )
        
        return {
            "history": history,
            "total": len(history)
        }
        
    except Exception as e:
        logger.error(f"Failed to get query history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feedback")
async def submit_feedback(
    query_id: str,
    rating: int = Field(..., ge=1, le=5),
    feedback: Optional[str] = None
):
    """Submit feedback for a query response."""
    try:
        # Update query history with feedback
        await query_service.update_query_feedback(
            query_id=query_id,
            rating=rating,
            feedback=feedback
        )
        
        return {"message": "Feedback submitted successfully"}
        
    except Exception as e:
        logger.error(f"Failed to submit feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))