"""
OpenAI Integration Service for Query Processing
Handles query embeddings and LLM-based response generation (supports Azure OpenAI)
"""

import asyncio
from typing import List, Optional, Dict, Any, Tuple
import openai
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import settings


class OpenAIService:
    """Service for OpenAI API interactions in query processing (supports Azure OpenAI)."""
    
    def __init__(self):
        self.embedding_model = settings.EMBEDDING_MODEL
        self.embedding_dimensions = settings.EMBEDDING_DIMENSIONS
        self.llm_model = settings.LLM_MODEL
        self.max_tokens = settings.MAX_OUTPUT_TOKENS
        self.client = self._create_client()
    
    def _create_client(self) -> openai.AsyncOpenAI:
        """Create Azure OpenAI client."""
        logger.info("Initializing Azure OpenAI client for query processing")
        return openai.AsyncAzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_version=settings.AZURE_OPENAI_API_VERSION
        )
    
    def _get_embedding_model_name(self) -> str:
        """Get the embedding model name for Azure OpenAI API calls."""
        return settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT or self.embedding_model
    
    def _get_llm_model_name(self) -> str:
        """Get the LLM model name for Azure OpenAI API calls."""
        return settings.AZURE_OPENAI_LLM_DEPLOYMENT or self.llm_model
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_query_embedding(self, query: str) -> List[float]:
        """Generate embedding for a user query."""
        try:
            if not query.strip():
                raise ValueError("Query cannot be empty")
            
            model_name = self._get_embedding_model_name()
            logger.debug(f"Generating query embedding for: {query[:100]}...")
            
            # Prepare embedding request
            embedding_kwargs = {
                "model": model_name,
                "input": [query.strip()]
            }
            
            # Add dimensions for direct OpenAI (Azure OpenAI handles this in deployment)
            if not settings.is_azure_openai:
                embedding_kwargs["dimensions"] = self.embedding_dimensions
            
            response = await self.client.embeddings.create(**embedding_kwargs)
            
            embedding = response.data[0].embedding
            logger.debug(f"Generated query embedding with {len(embedding)} dimensions")
            
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            raise
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_response(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        max_context_length: Optional[int] = None
    ) -> Tuple[str, float]:
        """Generate a response using OpenAI LLM based on query and retrieved context."""
        try:
            max_context = max_context_length or settings.MAX_CONTEXT_LENGTH
            model_name = self._get_llm_model_name()
            provider = "Azure OpenAI" if settings.is_azure_openai else "OpenAI"
            
            logger.info(f"Generating LLM response using {provider} ({model_name}) for query with {len(context_chunks)} context chunks")
            
            # Prepare context from chunks
            context_text = self._prepare_context(context_chunks, max_context)
            
            # Create system prompt
            system_prompt = self._create_system_prompt()
            
            # Create user prompt with query and context
            user_prompt = self._create_user_prompt(query, context_text, context_chunks)
            
            logger.debug(f"System prompt length: {len(system_prompt)}")
            logger.debug(f"User prompt length: {len(user_prompt)}")
            
            # Generate response using OpenAI
            response = await self.client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=0.1,  # Low temperature for factual responses
                top_p=0.9
            )
            
            generated_response = response.choices[0].message.content
            
            # Calculate confidence based on context relevance
            confidence = self._calculate_confidence(context_chunks)
            
            logger.info(f"Generated response with confidence {confidence:.2f}")
            
            return generated_response, confidence
            
        except Exception as e:
            logger.error(f"Failed to generate LLM response: {e}")
            return "I encountered an error while generating the response. Please try again.", 0.0
    
    def _prepare_context(self, chunks: List[Dict[str, Any]], max_length: int) -> str:
        """Prepare context text from retrieved chunks."""
        context_parts = []
        current_length = 0
        
        for i, chunk in enumerate(chunks):
            content = chunk.get('content', '')
            source_info = self._format_source_info(chunk)
            
            # Format chunk with source information
            chunk_text = f"[Source {i+1}: {source_info}]\n{content}\n"
            
            # Check if adding this chunk would exceed max length
            if current_length + len(chunk_text) > max_length:
                break
            
            context_parts.append(chunk_text)
            current_length += len(chunk_text)
        
        return '\n'.join(context_parts)
    
    def _format_source_info(self, chunk: Dict[str, Any]) -> str:
        """Format source information for a chunk."""
        doc_title = chunk.get('document_title', 'Unknown Document')
        source_type = chunk.get('source_type', 'UNKNOWN')
        source_location = chunk.get('source_location', {})
        
        source_info = f"{doc_title} ({source_type})"
        
        # Add specific location information
        if source_type == 'PDF' and 'page_number' in source_location:
            source_info += f", Page {source_location['page_number']}"
        elif source_type == 'WEB' and 'url' in source_location:
            source_info += f", URL: {source_location['url']}"
        elif source_type == 'CSV' and 'row_number' in source_location:
            source_info += f", Row {source_location['row_number']}"
        
        return source_info
    
    def _create_system_prompt(self) -> str:
        """Create system prompt for the LLM."""
        return """You are a helpful AI assistant that answers questions based on provided context documents. 

Your responsibilities:
1. Answer questions accurately using ONLY the information provided in the context
2. Include specific citations with source numbers (e.g., [Source 1], [Source 2])
3. If the context doesn't contain enough information, clearly state this limitation
4. Provide concise, well-structured responses
5. Maintain a professional and helpful tone

Guidelines:
- Always cite your sources using the [Source X] format
- Don't make up information not present in the context
- If multiple sources support a point, cite all relevant sources
- Be specific about what information comes from which source
- If the context is insufficient, suggest what additional information might be needed"""
    
    def _create_user_prompt(self, query: str, context: str, chunks: List[Dict[str, Any]]) -> str:
        """Create user prompt with query and context."""
        source_list = []
        for i, chunk in enumerate(chunks):
            source_info = self._format_source_info(chunk)
            source_list.append(f"Source {i+1}: {source_info}")
        
        sources_summary = '\n'.join(source_list)
        
        return f"""Question: {query}

Available Sources:
{sources_summary}

Context Information:
{context}

Please answer the question based on the provided context. Include citations using [Source X] format and be specific about which information comes from which source."""
    
    def _calculate_confidence(self, chunks: List[Dict[str, Any]]) -> float:
        """Calculate confidence score based on context quality."""
        if not chunks:
            return 0.0
        
        # Base confidence on similarity scores
        similarities = [chunk.get('similarity', 0.0) for chunk in chunks]
        avg_similarity = sum(similarities) / len(similarities)
        
        # Boost confidence if we have multiple relevant sources
        source_bonus = min(len(chunks) * 0.1, 0.3)
        
        # Calculate final confidence (0.0 to 1.0)
        confidence = min(avg_similarity + source_bonus, 1.0)
        
        return confidence
    
    async def test_connection(self) -> bool:
        """Test OpenAI API connection."""
        try:
            provider = "Azure OpenAI" if settings.is_azure_openai else "OpenAI"
            logger.info(f"Testing {provider} API connection...")
            
            # Test embedding endpoint
            embedding_model = self._get_embedding_model_name()
            embedding_kwargs = {
                "model": embedding_model,
                "input": ["test connection"]
            }
            
            # Add dimensions for direct OpenAI
            if not settings.is_azure_openai:
                embedding_kwargs["dimensions"] = self.embedding_dimensions
            
            embedding_response = await self.client.embeddings.create(**embedding_kwargs)
            
            # Test chat completion endpoint
            llm_model = self._get_llm_model_name()
            chat_response = await self.client.chat.completions.create(
                model=llm_model,
                messages=[{"role": "user", "content": "Hello, this is a test."}],
                max_tokens=10
            )
            
            if (embedding_response.data and len(embedding_response.data) > 0 and
                chat_response.choices and len(chat_response.choices) > 0):
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
        """Get information about the current models."""
        provider = "Azure OpenAI" if settings.is_azure_openai else "OpenAI"
        
        info = {
            "provider": provider,
            "embedding_model": self.embedding_model,
            "embedding_dimensions": self.embedding_dimensions,
            "llm_model": self.llm_model,
            "max_tokens": self.max_tokens,
        }
        
        if settings.is_azure_openai:
            info.update({
                "azure_endpoint": settings.AZURE_OPENAI_ENDPOINT,
                "api_version": settings.AZURE_OPENAI_API_VERSION,
                "embedding_deployment": settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
                "llm_deployment": settings.AZURE_OPENAI_LLM_DEPLOYMENT,
                "api_key_configured": bool(settings.AZURE_OPENAI_API_KEY)
            })
        else:
            info.update({
                "base_url": settings.OPENAI_BASE_URL or "https://api.openai.com/v1",
                "api_key_configured": bool(settings.OPENAI_API_KEY and 
                                        settings.OPENAI_API_KEY != "your-actual-openai-api-key-here")
            })
        
        return info


# Global instance
openai_service = OpenAIService()