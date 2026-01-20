"""
Query Engine
Core query processing and vector search functionality with OpenAI integration
"""

import time
from typing import List, Optional, Dict, Any
from uuid import UUID

from loguru import logger

from .config import settings
from .openai_service import openai_service
from ..shared.database.connection import query_service


class QueryEngine:
    """Core query processing engine with OpenAI vector search capabilities."""
    
    def __init__(self):
        self.similarity_threshold = settings.SIMILARITY_THRESHOLD
        self.max_results = settings.MAX_RESULTS
        logger.info("QueryEngine initialized with OpenAI integration")
    
    async def generate_query_embedding(self, query: str) -> List[float]:
        """Generate embedding for a user query using OpenAI."""
        try:
            if not query.strip():
                raise ValueError("Query cannot be empty")
            
            logger.debug(f"Generating OpenAI embedding for query: {query[:100]}...")
            
            # Use OpenAI service to generate embedding
            embedding = await openai_service.generate_query_embedding(query)
            
            return embedding
            
        except Exception as e:
            logger.error(f"Query embedding generation failed: {e}")
            raise
    
    async def vector_search(
        self,
        query_embedding: List[float],
        user_id: UUID,
        threshold: float = None,
        limit: int = None
    ) -> List[Dict[str, Any]]:
        """Perform vector similarity search across user's documents."""
        try:
            threshold = threshold or self.similarity_threshold
            limit = limit or self.max_results
            
            logger.info(f"Performing vector search for user {user_id} with threshold {threshold}")
            
            # Perform vector search using database service
            search_results = await query_service.vector_search(
                query_embedding=query_embedding,
                user_id=user_id,
                threshold=threshold,
                limit=limit
            )
            
            logger.info(f"Found {len(search_results)} relevant chunks")
            
            # Enhance results with additional metadata
            enhanced_results = []
            for result in search_results:
                enhanced_result = {
                    'id': result['id'],
                    'document_id': result['document_id'],
                    'content': result['content'],
                    'source_location': result['source_location'],
                    'document_title': result.get('document_title', 'Unknown Document'),
                    'source_type': result.get('source_type', 'UNKNOWN'),
                    'similarity': result['similarity'],
                    'confidence': result['similarity']  # Use similarity as confidence
                }
                enhanced_results.append(enhanced_result)
            
            # Sort by similarity (highest first)
            enhanced_results.sort(key=lambda x: x['similarity'], reverse=True)
            
            return enhanced_results
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            raise
    
    async def cross_source_search(
        self,
        query_embedding: List[float],
        user_id: UUID,
        source_types: Optional[List[str]] = None,
        threshold: float = None,
        limit: int = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Perform cross-source search across different document types."""
        try:
            # Get all results first
            all_results = await self.vector_search(
                query_embedding=query_embedding,
                user_id=user_id,
                threshold=threshold,
                limit=limit * 3 if limit else None  # Get more results for filtering
            )
            
            # Group results by source type
            results_by_source = {}
            for result in all_results:
                source_type = result.get('source_type', 'UNKNOWN')
                if source_type not in results_by_source:
                    results_by_source[source_type] = []
                results_by_source[source_type].append(result)
            
            # Limit results per source type
            max_per_source = (limit or self.max_results) // len(results_by_source) if results_by_source else limit or self.max_results
            
            for source_type in results_by_source:
                results_by_source[source_type] = results_by_source[source_type][:max_per_source]
            
            logger.info(f"Cross-source search found results in {len(results_by_source)} source types")
            
            return results_by_source
            
        except Exception as e:
            logger.error(f"Cross-source search failed: {e}")
            raise
    
    async def semantic_search(
        self,
        query: str,
        user_id: UUID,
        context_window: int = 3,
        threshold: float = None,
        limit: int = None
    ) -> List[Dict[str, Any]]:
        """Perform semantic search with context window."""
        try:
            # Generate query embedding
            query_embedding = await self.generate_query_embedding(query)
            
            # Perform vector search
            results = await self.vector_search(
                query_embedding=query_embedding,
                user_id=user_id,
                threshold=threshold,
                limit=limit
            )
            
            # Enhance results with context (neighboring chunks)
            enhanced_results = []
            for result in results:
                # For now, just return the result as-is
                # In a more advanced implementation, you could fetch neighboring chunks
                enhanced_results.append(result)
            
            return enhanced_results
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            raise
    
    def calculate_relevance_score(
        self,
        query: str,
        content: str,
        similarity: float
    ) -> float:
        """Calculate relevance score combining similarity and other factors."""
        try:
            # Base score from similarity
            relevance_score = similarity
            
            # Boost score for exact keyword matches
            query_words = set(query.lower().split())
            content_words = set(content.lower().split())
            keyword_overlap = len(query_words.intersection(content_words)) / len(query_words)
            
            # Combine similarity and keyword overlap
            relevance_score = (similarity * 0.8) + (keyword_overlap * 0.2)
            
            return min(relevance_score, 1.0)
            
        except Exception as e:
            logger.warning(f"Relevance score calculation failed: {e}")
            return similarity
    
    async def test_openai_connection(self) -> bool:
        """Test OpenAI API connection."""
        return await openai_service.test_connection()
    
    async def get_openai_model_info(self) -> dict:
        """Get OpenAI model information."""
        return await openai_service.get_model_info()