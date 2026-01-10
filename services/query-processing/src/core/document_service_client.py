"""
Client for communicating with the Document Processing Service
"""

import httpx
import asyncio
from typing import List, Dict, Any, Optional
from loguru import logger


class DocumentServiceClient:
    """Client for communicating with the document processing microservice."""
    
    def __init__(self, base_url: str = "http://localhost:8001"):
        """
        Initialize the document service client.
        
        Args:
            base_url: Base URL of the document processing service
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = httpx.Timeout(30.0)  # 30 second timeout
        
    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using the document processing service.
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector as list of floats
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/embeddings/generate",
                    json={"text": text}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("embedding", [])
                else:
                    logger.error(f"Embedding generation failed: {response.status_code} - {response.text}")
                    # Return mock embedding as fallback
                    import random
                    return [random.random() for _ in range(384)]
                    
        except Exception as e:
            logger.error(f"Error calling document service for embedding: {e}")
            # Return mock embedding as fallback
            import random
            return [random.random() for _ in range(384)]
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check health of the document processing service.
        
        Returns:
            Health status information
        """
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                response = await client.get(f"{self.base_url}/health")
                
                if response.status_code == 200:
                    return response.json()
                else:
                    return {
                        "status": "unhealthy",
                        "error": f"HTTP {response.status_code}"
                    }
                    
        except Exception as e:
            return {
                "status": "unreachable",
                "error": str(e)
            }