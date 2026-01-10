"""
Document Embedding Service
Generates vector embeddings using Sentence Transformers
"""

import numpy as np
from typing import List, Dict, Any, Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
import torch
from sentence_transformers import SentenceTransformer
from loguru import logger

# from ..shared.models.base import DocumentChunk
# We'll define DocumentChunk locally to avoid import issues
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    content: str
    chunk_index: int
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = {}


class EmbeddingService:
    """Service for generating document embeddings using Sentence Transformers."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", batch_size: int = 32):
        """
        Initialize the embedding service.
        
        Args:
            model_name: Name of the Sentence Transformer model to use
            batch_size: Batch size for processing multiple texts
        """
        self.model_name = model_name
        self.batch_size = batch_size
        self.model = None
        self.embedding_dim = 384  # Dimension for all-MiniLM-L6-v2
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Thread pool for CPU-bound operations
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        logger.info(f"Initializing embedding service with model: {model_name}")
        logger.info(f"Using device: {self.device}")
    
    async def initialize(self):
        """Initialize the embedding model asynchronously."""
        try:
            logger.info("Loading Sentence Transformer model...")
            
            # Load model in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            self.model = await loop.run_in_executor(
                self.executor, 
                self._load_model
            )
            
            logger.info(f"Model loaded successfully. Embedding dimension: {self.embedding_dim}")
            
        except Exception as e:
            logger.error(f"Failed to initialize embedding model: {e}")
            raise Exception(f"Embedding service initialization failed: {str(e)}")
    
    def _load_model(self) -> SentenceTransformer:
        """Load the Sentence Transformer model."""
        model = SentenceTransformer(self.model_name)
        model.to(self.device)
        
        # Update embedding dimension based on actual model
        self.embedding_dim = model.get_sentence_embedding_dimension()
        
        return model
    
    async def generate_embeddings(self, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        """
        Generate embeddings for a list of document chunks.
        
        Args:
            chunks: List of DocumentChunk objects
            
        Returns:
            List of DocumentChunk objects with embeddings added
        """
        try:
            if not self.model:
                await self.initialize()
            
            if not chunks:
                return chunks
            
            logger.info(f"Generating embeddings for {len(chunks)} chunks")
            
            # Extract text content from chunks
            texts = [chunk.content for chunk in chunks]
            
            # Generate embeddings in batches
            embeddings = await self._generate_batch_embeddings(texts)
            
            # Add embeddings to chunks
            for chunk, embedding in zip(chunks, embeddings):
                chunk.embedding = embedding.tolist()  # Convert numpy array to list for JSON serialization
            
            logger.info(f"Successfully generated embeddings for {len(chunks)} chunks")
            return chunks
            
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            raise Exception(f"Embedding generation failed: {str(e)}")
    
    async def generate_single_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector as list of floats
        """
        try:
            if not self.model:
                await self.initialize()
            
            logger.debug(f"Generating embedding for text: {text[:100]}...")
            
            # Generate embedding in thread pool
            loop = asyncio.get_event_loop()
            embedding = await loop.run_in_executor(
                self.executor,
                self._encode_single,
                text
            )
            
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating single embedding: {e}")
            raise Exception(f"Single embedding generation failed: {str(e)}")
    
    async def _generate_batch_embeddings(self, texts: List[str]) -> List[np.ndarray]:
        """Generate embeddings for a batch of texts."""
        all_embeddings = []
        
        # Process in batches to manage memory
        for i in range(0, len(texts), self.batch_size):
            batch_texts = texts[i:i + self.batch_size]
            
            logger.debug(f"Processing batch {i//self.batch_size + 1}/{(len(texts) + self.batch_size - 1)//self.batch_size}")
            
            # Generate embeddings for this batch
            loop = asyncio.get_event_loop()
            batch_embeddings = await loop.run_in_executor(
                self.executor,
                self._encode_batch,
                batch_texts
            )
            
            all_embeddings.extend(batch_embeddings)
        
        return all_embeddings
    
    def _encode_single(self, text: str) -> np.ndarray:
        """Encode a single text using the model."""
        return self.model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    
    def _encode_batch(self, texts: List[str]) -> List[np.ndarray]:
        """Encode a batch of texts using the model."""
        embeddings = self.model.encode(
            texts, 
            convert_to_numpy=True, 
            normalize_embeddings=True,
            batch_size=self.batch_size,
            show_progress_bar=False
        )
        
        # Convert to list of individual arrays
        return [embeddings[i] for i in range(len(embeddings))]
    
    async def compute_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """
        Compute cosine similarity between two embeddings.
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Cosine similarity score between -1 and 1
        """
        try:
            # Convert to numpy arrays
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            # Compute cosine similarity
            similarity = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
            
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error computing similarity: {e}")
            return 0.0
    
    async def find_similar_chunks(
        self, 
        query_embedding: List[float], 
        chunk_embeddings: List[Dict[str, Any]], 
        top_k: int = 5,
        threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Find most similar chunks to a query embedding.
        
        Args:
            query_embedding: Query embedding vector
            chunk_embeddings: List of dicts with 'chunk_id' and 'embedding' keys
            top_k: Number of top results to return
            threshold: Minimum similarity threshold
            
        Returns:
            List of similar chunks with similarity scores
        """
        try:
            similarities = []
            
            for chunk_data in chunk_embeddings:
                similarity = await self.compute_similarity(
                    query_embedding, 
                    chunk_data['embedding']
                )
                
                if similarity >= threshold:
                    similarities.append({
                        'chunk_id': chunk_data['chunk_id'],
                        'similarity': similarity,
                        'chunk_data': chunk_data
                    })
            
            # Sort by similarity (descending) and return top_k
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            
            return similarities[:top_k]
            
        except Exception as e:
            logger.error(f"Error finding similar chunks: {e}")
            return []
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the current model."""
        return {
            'model_name': self.model_name,
            'embedding_dimension': self.embedding_dim,
            'device': self.device,
            'batch_size': self.batch_size,
            'is_initialized': self.model is not None
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform a health check on the embedding service."""
        try:
            if not self.model:
                return {
                    'status': 'unhealthy',
                    'error': 'Model not initialized'
                }
            
            # Test embedding generation
            test_text = "This is a test sentence for health check."
            embedding = await self.generate_single_embedding(test_text)
            
            return {
                'status': 'healthy',
                'model_info': self.get_model_info(),
                'test_embedding_length': len(embedding),
                'test_successful': True
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'model_info': self.get_model_info()
            }
    
    def __del__(self):
        """Cleanup resources."""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)