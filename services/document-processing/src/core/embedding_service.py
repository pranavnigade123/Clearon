"""
Embedding Service
Generate embeddings using Sentence Transformers
"""

import asyncio
from typing import List
import time

from sentence_transformers import SentenceTransformer
from loguru import logger

from .config import settings


class EmbeddingService:
    """Service for generating text embeddings."""
    
    def __init__(self):
        self.model_name = settings.EMBEDDING_MODEL
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load the embedding model."""
        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []
        
        try:
            start_time = time.time()
            logger.info(f"Generating embeddings for {len(texts)} texts")
            
            # Run embedding generation in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(
                None, 
                self._generate_embeddings_sync, 
                texts
            )
            
            processing_time = time.time() - start_time
            logger.info(f"Generated {len(embeddings)} embeddings in {processing_time:.2f}s")
            
            return embeddings.tolist()
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    def _generate_embeddings_sync(self, texts: List[str]):
        """Synchronous embedding generation."""
        if not self.model:
            raise RuntimeError("Embedding model not loaded")
        
        # Clean texts
        cleaned_texts = [text.strip() for text in texts if text.strip()]
        
        if not cleaned_texts:
            return []
        
        # Generate embeddings
        embeddings = self.model.encode(
            cleaned_texts,
            batch_size=32,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        return embeddings
    
    async def generate_single_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        embeddings = await self.generate_embeddings([text])
        return embeddings[0] if embeddings else []
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings produced by this model."""
        if not self.model:
            return 384  # Default for all-MiniLM-L6-v2
        
        return self.model.get_sentence_embedding_dimension()