"""
Supabase REST API client for vector search when direct PostgreSQL connection fails
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
import httpx
from loguru import logger
import json


class SupabaseClient:
    """Client for Supabase REST API operations including vector search."""
    
    def __init__(self):
        """Initialize Supabase client with REST API parameters."""
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if self.supabase_url and self.service_role_key:
            self.base_url = f"{self.supabase_url}/rest/v1"
            self.headers = {
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            logger.info("Supabase REST API client initialized")
        else:
            logger.warning("Supabase configuration missing")
            self.base_url = None
            self.headers = None
    
    async def search_similar_chunks(
        self, 
        query_embedding: List[float], 
        user_id: str,
        max_results: int = 5,
        similarity_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar document chunks using Supabase REST API.
        """
        if not self.base_url:
            logger.warning("Supabase not configured, returning empty results")
            return []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Use Supabase RPC function for vector search
                rpc_data = {
                    "query_embedding": query_embedding,
                    "match_threshold": similarity_threshold,
                    "match_count": max_results,
                    "filter_user_id": user_id
                }
                
                response = await client.post(
                    f"{self.base_url}/rpc/match_documents",
                    headers=self.headers,
                    json=rpc_data
                )
                
                if response.status_code == 200:
                    results = response.json()
                    
                    chunks = []
                    for row in results:
                        chunk = {
                            'chunk_id': str(row['id']),
                            'document_id': str(row['document_id']),
                            'content': row['content'],
                            'chunk_index': 0,  # Not available in this query
                            'similarity_score': float(row['similarity']),
                            'metadata': {
                                'title': row['document_title'],
                                'source_type': row['source_type'],
                                'source_url': None,
                                'chunk_metadata': row.get('source_location', {})
                            }
                        }
                        chunks.append(chunk)
                    
                    logger.info(f"Found {len(chunks)} similar chunks via Supabase API")
                    return chunks
                else:
                    logger.error(f"Supabase API error: {response.status_code} - {response.text}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error in Supabase vector search: {e}")
            return []
    
    async def get_document_chunks(self, document_id: str, user_id: str) -> List[Dict[str, Any]]:
        """Get all chunks for a specific document via REST API."""
        if not self.base_url:
            return []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/document_chunks",
                    headers=self.headers,
                    params={
                        "document_id": f"eq.{document_id}",
                        "select": "id,document_id,content,chunk_index,source_location,created_at"
                    }
                )
                
                if response.status_code == 200:
                    chunks_data = response.json()
                    
                    chunks = []
                    for chunk in chunks_data:
                        formatted_chunk = {
                            'chunk_id': str(chunk['id']),
                            'document_id': str(chunk['document_id']),
                            'content': chunk['content'],
                            'chunk_index': chunk.get('chunk_index', 0),
                            'metadata': {
                                'chunk_metadata': chunk.get('source_location', {}),
                                'created_at': chunk.get('created_at')
                            }
                        }
                        chunks.append(formatted_chunk)
                    
                    logger.info(f"Found {len(chunks)} chunks for document {document_id}")
                    return chunks
                else:
                    logger.error(f"Error fetching document chunks: {response.status_code}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching document chunks: {e}")
            return []
    
    async def get_user_chunks(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all chunks for a user via REST API."""
        if not self.base_url:
            return []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # First get user's documents
                docs_response = await client.get(
                    f"{self.base_url}/documents",
                    headers=self.headers,
                    params={
                        "user_id": f"eq.{user_id}",
                        "select": "id"
                    }
                )
                
                if docs_response.status_code != 200:
                    logger.error(f"Error fetching user documents: {docs_response.status_code}")
                    return []
                
                documents = docs_response.json()
                if not documents:
                    return []
                
                # Get chunks for all user documents
                doc_ids = [doc['id'] for doc in documents]
                chunks_response = await client.get(
                    f"{self.base_url}/document_chunks",
                    headers=self.headers,
                    params={
                        "document_id": f"in.({','.join(doc_ids)})",
                        "select": "id,document_id,content,chunk_index,source_location,created_at"
                    }
                )
                
                if chunks_response.status_code == 200:
                    chunks_data = chunks_response.json()
                    logger.info(f"Found {len(chunks_data)} total chunks for user {user_id}")
                    return chunks_data
                else:
                    logger.error(f"Error fetching user chunks: {chunks_response.status_code}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching user chunks: {e}")
            return []
    
    async def get_user_documents(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all documents for a user via REST API."""
        if not self.base_url:
            return []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/documents",
                    headers=self.headers,
                    params={
                        "user_id": f"eq.{user_id}",
                        "processing_status": "eq.COMPLETED"
                    }
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Error fetching documents: {response.status_code}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching user documents: {e}")
            return []
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform Supabase API health check."""
        if not self.base_url:
            return {
                'status': 'no_configuration',
                'message': 'Supabase not configured'
            }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/documents",
                    headers=self.headers,
                    params={"limit": "1"}
                )
                
                if response.status_code == 200:
                    return {
                        'status': 'healthy',
                        'message': 'Supabase REST API accessible'
                    }
                else:
                    return {
                        'status': 'unhealthy',
                        'error': f"HTTP {response.status_code}"
                    }
                    
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }


# Global instance
supabase_client = SupabaseClient()