"""
Database client for querying document chunks and performing vector search
Uses only Supabase REST API - no direct PostgreSQL connection
"""

import os
from typing import List, Dict, Any, Optional, Tuple
from loguru import logger
from .supabase_client import supabase_client


class DatabaseClient:
    """Client for database operations using only Supabase REST API."""
    
    def __init__(self):
        """Initialize database client with Supabase REST API only."""
        logger.info("Database client configured for Supabase REST API only")
    
    async def initialize(self):
        """Initialize database client - no connection pool needed for REST API."""
        logger.info("Database client initialized with Supabase REST API")
    
    async def search_similar_chunks(
        self, 
        query_embedding: List[float], 
        user_id: str,
        max_results: int = 5,
        similarity_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar document chunks using Supabase REST API vector search.
        """
        logger.info(f"Searching for similar chunks using Supabase REST API for user {user_id}")
        return await supabase_client.search_similar_chunks(
            query_embedding, user_id, max_results, similarity_threshold
        )
    
    async def get_document_chunks(self, document_id: str, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all chunks for a specific document using Supabase REST API.
        
        Args:
            document_id: Document ID
            user_id: User ID for authorization
            
        Returns:
            List of document chunks
        """
        return await supabase_client.get_document_chunks(document_id, user_id)
    
    async def get_user_document_count(self, user_id: str) -> int:
        """Get total number of documents for a user."""
        try:
            documents = await supabase_client.get_user_documents(user_id)
            return len(documents)
        except Exception as e:
            logger.error(f"Error getting document count: {e}")
            return 0
    
    async def get_user_chunk_count(self, user_id: str) -> int:
        """Get total number of chunks for a user."""
        try:
            # Use the chunk search API to get all chunks for the user
            chunks = await supabase_client.get_user_chunks(user_id)
            return len(chunks)
        except Exception as e:
            logger.error(f"Error getting chunk count: {e}")
            return 0
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform database health check using Supabase REST API."""
        return await supabase_client.health_check()
    
    async def close(self):
        """Close database client - no cleanup needed for REST API."""
        logger.info("Database client closed (REST API only)")