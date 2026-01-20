"""
OpenAI Integration Service
Handles embeddings and LLM interactions using OpenAI API or Azure OpenAI
"""

import asyncio
from typing import List, Optional, Dict, Any
import openai
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import settings


class OpenAIService:
    """Service for OpenAI API interactions (supports both OpenAI and Azure OpenAI)."""
    
    def __init__(self):
        self.embedding_model = settings.EMBEDDING_MODEL
        self.embedding_dimensions = settings.EMBEDDING_DIMENSIONS
        self.llm_model = settings.LLM_MODEL
        self.client = self._create_client()
    
    def _create_client(self) -> openai.AsyncOpenAI:
        """Create Azure OpenAI client."""
        logger.info("Initializing Azure OpenAI client")
        return openai.AsyncAzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_version=settings.AZURE_OPENAI_API_VERSION
        )
    
    def _get_embedding_model_name(self) -> str:
        """Get the embedding model name for Azure OpenAI API calls."""
        return settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT or self.embedding_model
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_embeddings(
        self, 
        texts: List[str], 
        batch_size: int = 100
    ) -> List[List[float]]:
        """Generate embeddings for a list of texts using OpenAI API."""
        try:
            if not texts:
                return []
            
            model_name = self._get_embedding_model_name()
            provider = "Azure OpenAI" if settings.is_azure_openai else "OpenAI"
            
            logger.info(f"Generating embeddings for {len(texts)} texts using {provider} ({model_name})")
            
            all_embeddings = []
            
            # Process in batches to avoid API limits
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                
                logger.debug(f"Processing batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}")
                
                # Prepare embedding request
                embedding_kwargs = {
                    "model": model_name,
                    "input": batch
                }
                
                # Azure OpenAI handles dimensions in deployment configuration
                response = await self.client.embeddings.create(**embedding_kwargs)
                
                batch_embeddings = [data.embedding for data in response.data]
                all_embeddings.extend(batch_embeddings)
                
                # Small delay between batches to respect rate limits
                if i + batch_size < len(texts):
                    await asyncio.sleep(0.1)
            
            logger.info(f"Successfully generated {len(all_embeddings)} embeddings")
            return all_embeddings
            
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_single_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        try:
            if not text.strip():
                raise ValueError("Text cannot be empty")
            
            model_name = self._get_embedding_model_name()
            logger.debug(f"Generating single embedding for text: {text[:100]}...")
            
            # Prepare embedding request
            embedding_kwargs = {
                "model": model_name,
                "input": [text]
            }
            
            # Azure OpenAI handles dimensions in deployment configuration
            response = await self.client.embeddings.create(**embedding_kwargs)
            
            embedding = response.data[0].embedding
            logger.debug(f"Generated embedding with {len(embedding)} dimensions")
            
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to generate single embedding: {e}")
            raise
    
    async def test_connection(self) -> bool:
        """Test OpenAI API connection."""
        try:
            provider = "Azure OpenAI" if settings.is_azure_openai else "OpenAI"
            logger.info(f"Testing {provider} API connection...")
            
            model_name = self._get_embedding_model_name()
            
            # Prepare embedding request
            embedding_kwargs = {
                "model": model_name,
                "input": ["test connection"]
            }
            
            # Azure OpenAI handles dimensions in deployment configuration
            response = await self.client.embeddings.create(**embedding_kwargs)
            
            if response.data and len(response.data) > 0:
                logger.info(f"{provider} API connection successful")
                return True
            else:
                logger.error(f"{provider} API connection failed: No data returned")
                return False
                
        except Exception as e:
            provider = "Azure OpenAI" if settings.is_azure_openai else "OpenAI"
            logger.error(f"{provider} API connection failed: {e}")
            return False
    
    async def get_model_info(self) -> Dict[str, Any]:
        """Get information about the current Azure OpenAI models."""
        return {
            "provider": "Azure OpenAI",
            "embedding_model": self.embedding_model,
            "embedding_dimensions": self.embedding_dimensions,
            "llm_model": self.llm_model,
            "azure_endpoint": settings.AZURE_OPENAI_ENDPOINT,
            "api_version": settings.AZURE_OPENAI_API_VERSION,
            "embedding_deployment": settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
            "llm_deployment": settings.AZURE_OPENAI_LLM_DEPLOYMENT,
            "api_key_configured": bool(settings.AZURE_OPENAI_API_KEY)
        }


# Global instance
openai_service = OpenAIService()