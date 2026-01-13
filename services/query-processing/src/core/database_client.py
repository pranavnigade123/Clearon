"""
Database client for querying document chunks and performing vector search
"""

import os
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import asyncpg
from loguru import logger
import numpy as np


class DatabaseClient:
    """Client for database operations including vector search."""
    
    def __init__(self):
        """Initialize database client with connection parameters."""
        # Use DATABASE_URL for direct PostgreSQL connection
        self.connection_string = os.getenv("DATABASE_URL")
        
        if self.connection_string:
            # Extract project reference for logging
            if "oktdncmkvcvrejohkoar" in self.connection_string:
                logger.info("Database client configured for Supabase project: oktdncmkvcvrejohkoar")
            else:
                logger.info("Database client configured with custom connection string")
        else:
            logger.warning("No DATABASE_URL found, using mock data")
        
        self.pool = None
    
    async def initialize(self):
        """Initialize database connection pool."""
        if not self.connection_string:
            logger.info("No database connection string, using mock data")
            return
            
        try:
            self.pool = await asyncpg.create_pool(
                self.connection_string,
                min_size=1,
                max_size=10,
                command_timeout=30
            )
            logger.info("Database connection pool initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            logger.info("Falling back to mock data")
            self.pool = None
    
    async def search_similar_chunks(
        self, 
        query_embedding: List[float], 
        user_id: str,
        max_results: int = 5,
        similarity_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar document chunks using vector similarity.
        
        Args:
            query_embedding: Query embedding vector
            user_id: User ID to filter documents
            max_results: Maximum number of results to return
            similarity_threshold: Minimum similarity threshold
            
        Returns:
            List of similar chunks with metadata
        """
        if not self.pool:
            logger.info("No database connection, returning mock chunks")
            return await self._get_mock_chunks(user_id, max_results)
        
        try:
            async with self.pool.acquire() as conn:
                # Convert embedding to PostgreSQL array format
                embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'
                
                # SQL query for vector similarity search using pgvector
                query = """
                    SELECT 
                        dc.id as chunk_id,
                        dc.document_id,
                        dc.content,
                        dc.chunk_index,
                        dc.metadata,
                        d.title,
                        d.source_type,
                        d.source_url,
                        1 - (dc.embedding <=> $1::vector) as similarity_score
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    WHERE d.user_id = $2
                        AND 1 - (dc.embedding <=> $1::vector) >= $3
                    ORDER BY dc.embedding <=> $1::vector
                    LIMIT $4
                """
                
                rows = await conn.fetch(
                    query, 
                    embedding_str, 
                    user_id, 
                    similarity_threshold, 
                    max_results
                )
                
                chunks = []
                for row in rows:
                    chunk = {
                        'chunk_id': str(row['chunk_id']),
                        'document_id': str(row['document_id']),
                        'content': row['content'],
                        'chunk_index': row['chunk_index'],
                        'similarity_score': float(row['similarity_score']),
                        'metadata': {
                            'title': row['title'],
                            'source_type': row['source_type'],
                            'source_url': row['source_url'],
                            'chunk_metadata': row['metadata'] or {}
                        }
                    }
                    chunks.append(chunk)
                
                logger.info(f"Found {len(chunks)} similar chunks for user {user_id}")
                return chunks
                
        except Exception as e:
            logger.error(f"Error in vector similarity search: {e}")
            # Fallback to mock data
            return await self._get_mock_chunks(user_id, max_results)
    
    async def get_document_chunks(self, document_id: str, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all chunks for a specific document.
        
        Args:
            document_id: Document ID
            user_id: User ID for authorization
            
        Returns:
            List of document chunks
        """
        if not self.pool:
            logger.info("No database connection, returning empty list")
            return []
        
        try:
            async with self.pool.acquire() as conn:
                query = """
                    SELECT 
                        dc.id as chunk_id,
                        dc.document_id,
                        dc.content,
                        dc.chunk_index,
                        dc.metadata,
                        d.title,
                        d.source_type,
                        d.source_url
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    WHERE dc.document_id = $1 AND d.user_id = $2
                    ORDER BY dc.chunk_index
                """
                
                rows = await conn.fetch(query, document_id, user_id)
                
                chunks = []
                for row in rows:
                    chunk = {
                        'chunk_id': str(row['chunk_id']),
                        'document_id': str(row['document_id']),
                        'content': row['content'],
                        'chunk_index': row['chunk_index'],
                        'metadata': {
                            'title': row['title'],
                            'source_type': row['source_type'],
                            'source_url': row['source_url'],
                            'chunk_metadata': row['metadata'] or {}
                        }
                    }
                    chunks.append(chunk)
                
                return chunks
                
        except Exception as e:
            logger.error(f"Error retrieving document chunks: {e}")
            return []
    
    async def get_user_document_count(self, user_id: str) -> int:
        """Get total number of documents for a user."""
        if not self.pool:
            return 0
        
        try:
            async with self.pool.acquire() as conn:
                result = await conn.fetchval(
                    "SELECT COUNT(*) FROM documents WHERE user_id = $1",
                    user_id
                )
                return result or 0
                
        except Exception as e:
            logger.error(f"Error getting document count: {e}")
            return 0
    
    async def get_user_chunk_count(self, user_id: str) -> int:
        """Get total number of chunks for a user."""
        if not self.pool:
            return 0
        
        try:
            async with self.pool.acquire() as conn:
                result = await conn.fetchval(
                    """
                    SELECT COUNT(dc.*) 
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    WHERE d.user_id = $1
                    """,
                    user_id
                )
                return result or 0
                
        except Exception as e:
            logger.error(f"Error getting chunk count: {e}")
            return 0
    
    async def _get_mock_chunks(self, user_id: str, max_results: int) -> List[Dict[str, Any]]:
        """Generate mock chunks only when no real chunks are found."""
        logger.info(f"Using mock chunks as fallback for user {user_id}")
        
        # Generic mock chunks that don't assume specific content
        mock_chunks = []
        for i in range(min(max_results, 2)):
            chunk = {
                'chunk_id': f"mock_chunk_{i+1}",
                'document_id': f"mock_doc_{i+1}",
                'content': f"This is mock content for chunk {i+1}. The system couldn't find specific information in your documents to answer this query. Please ensure your documents are properly uploaded and processed.",
                'chunk_index': i,
                'similarity_score': 0.5,  # Lower similarity for mock data
                'metadata': {
                    'title': f"Mock Document {i+1}",
                    'source_type': 'PDF',
                    'source_url': None,
                    'chunk_metadata': {
                        'page_number': i + 1,
                        'created_at': '2024-01-01T00:00:00Z'
                    }
                }
            }
            mock_chunks.append(chunk)
        
        return mock_chunks
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform database health check."""
        if not self.pool:
            return {
                'status': 'no_connection',
                'message': 'Database connection not configured'
            }
        
        try:
            async with self.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
                return {
                    'status': 'healthy',
                    'message': 'Database connection successful'
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
    
    async def close(self):
        """Close database connection pool."""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")