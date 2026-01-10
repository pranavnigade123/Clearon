"""
Database Connection Utilities for Python Microservices
Async database operations using asyncpg and Supabase
"""

import asyncio
import os
from typing import Any, Dict, List, Optional
from uuid import UUID

import asyncpg
from loguru import logger
from supabase import create_client, Client
from tenacity import retry, stop_after_attempt, wait_exponential

from ..models.base import DocumentChunk, SourceLocation, UnifiedDocument


class DatabaseConnection:
    """Async database connection manager."""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.supabase: Optional[Client] = None
        self._initialize_supabase()
    
    def _initialize_supabase(self):
        """Initialize Supabase client."""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not found, some features may not work")
            return
        
        try:
            self.supabase = create_client(supabase_url, supabase_key)
            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def connect(self) -> None:
        """Establish database connection pool."""
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        try:
            self.pool = await asyncpg.create_pool(
                database_url,
                min_size=1,
                max_size=10,
                command_timeout=60,
                server_settings={
                    'jit': 'off'  # Disable JIT for better performance with short queries
                }
            )
            logger.info("Database connection pool created successfully")
        except Exception as e:
            logger.error(f"Failed to create database connection pool: {e}")
            raise
    
    async def disconnect(self) -> None:
        """Close database connection pool."""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
    
    async def execute_query(
        self, 
        query: str, 
        *args, 
        fetch: bool = False,
        fetchrow: bool = False
    ) -> Any:
        """Execute a database query."""
        if not self.pool:
            raise RuntimeError("Database connection not established")
        
        async with self.pool.acquire() as connection:
            try:
                if fetch:
                    return await connection.fetch(query, *args)
                elif fetchrow:
                    return await connection.fetchrow(query, *args)
                else:
                    return await connection.execute(query, *args)
            except Exception as e:
                logger.error(f"Database query failed: {e}")
                logger.error(f"Query: {query}")
                logger.error(f"Args: {args}")
                raise


class DocumentService:
    """Service for document-related database operations."""
    
    def __init__(self, db: DatabaseConnection):
        self.db = db
    
    async def create_document(self, document: UnifiedDocument) -> UUID:
        """Create a new document record."""
        query = """
        INSERT INTO documents (
            user_id, source_type, title, original_filename, url, s3_key,
            content_hash, file_size, processing_status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
        """
        
        result = await self.db.execute_query(
            query,
            document.user_id,
            document.source_type.value,
            document.title,
            document.original_filename,
            document.url,
            document.s3_key,
            document.content_hash,
            document.file_size,
            document.processing_status.value,
            document.metadata,
            fetchrow=True
        )
        
        return result['id']
    
    async def update_document_status(
        self, 
        document_id: UUID, 
        status: str,
        error_message: Optional[str] = None
    ) -> None:
        """Update document processing status."""
        if error_message:
            query = """
            UPDATE documents 
            SET processing_status = $2, error_message = $3, updated_at = NOW()
            WHERE id = $1
            """
            await self.db.execute_query(query, document_id, status, error_message)
        else:
            query = """
            UPDATE documents 
            SET processing_status = $2, updated_at = NOW(),
                processed_at = CASE WHEN $2 = 'COMPLETED' THEN NOW() ELSE processed_at END
            WHERE id = $1
            """
            await self.db.execute_query(query, document_id, status)
    
    async def get_document(self, document_id: UUID) -> Optional[Dict[str, Any]]:
        """Get document by ID."""
        query = "SELECT * FROM documents WHERE id = $1"
        result = await self.db.execute_query(query, document_id, fetchrow=True)
        return dict(result) if result else None
    
    async def insert_chunks(self, chunks: List[DocumentChunk]) -> None:
        """Batch insert document chunks."""
        if not chunks:
            return
        
        query = """
        INSERT INTO document_chunks (
            document_id, content, chunk_index, token_count, 
            source_location, embedding
        ) VALUES ($1, $2, $3, $4, $5, $6)
        """
        
        chunk_data = [
            (
                chunk.document_id,
                chunk.content,
                chunk.chunk_index,
                chunk.token_count,
                chunk.source_location.dict(),
                chunk.embedding
            )
            for chunk in chunks
        ]
        
        async with self.db.pool.acquire() as connection:
            await connection.executemany(query, chunk_data)
    
    async def get_document_chunks(
        self, 
        document_id: UUID
    ) -> List[Dict[str, Any]]:
        """Get all chunks for a document."""
        query = """
        SELECT * FROM document_chunks 
        WHERE document_id = $1 
        ORDER BY chunk_index
        """
        results = await self.db.execute_query(query, document_id, fetch=True)
        return [dict(row) for row in results]


class QueryService:
    """Service for query-related database operations."""
    
    def __init__(self, db: DatabaseConnection):
        self.db = db
    
    async def vector_search(
        self,
        query_embedding: List[float],
        user_id: Optional[UUID] = None,
        threshold: float = 0.78,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Perform vector similarity search."""
        query = """
        SELECT 
            dc.id,
            dc.document_id,
            dc.content,
            dc.source_location,
            d.title as document_title,
            d.source_type,
            1 - (dc.embedding <=> $1::vector) as similarity
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE 
            ($2::uuid IS NULL OR d.user_id = $2)
            AND d.processing_status = 'COMPLETED'
            AND 1 - (dc.embedding <=> $1::vector) > $3
        ORDER BY dc.embedding <=> $1::vector
        LIMIT $4
        """
        
        results = await self.db.execute_query(
            query, 
            query_embedding, 
            user_id, 
            threshold, 
            limit, 
            fetch=True
        )
        
        return [dict(row) for row in results]
    
    async def save_query_history(
        self,
        user_id: UUID,
        query_text: str,
        response_text: Optional[str] = None,
        sources_used: Optional[List[Dict[str, Any]]] = None,
        processing_time_ms: Optional[int] = None,
        confidence_score: Optional[float] = None
    ) -> UUID:
        """Save query to history."""
        query = """
        INSERT INTO query_history (
            user_id, query_text, response_text, sources_used,
            processing_time_ms, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """
        
        result = await self.db.execute_query(
            query,
            user_id,
            query_text,
            response_text,
            sources_used or [],
            processing_time_ms,
            confidence_score,
            fetchrow=True
        )
        
        return result['id']


# Global database connection instance
db_connection = DatabaseConnection()
document_service = DocumentService(db_connection)
query_service = QueryService(db_connection)


async def initialize_database():
    """Initialize database connection."""
    await db_connection.connect()


async def close_database():
    """Close database connection."""
    await db_connection.disconnect()


# Context manager for database operations
class DatabaseContext:
    """Context manager for database operations."""
    
    async def __aenter__(self):
        if not db_connection.pool:
            await initialize_database()
        return db_connection
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Don't close the connection pool here as it's shared
        pass