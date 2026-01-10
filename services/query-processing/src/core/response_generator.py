"""
Response Generator
Generate responses from retrieved document chunks
"""

import re
from typing import List, Dict, Any, Tuple

from loguru import logger

from .config import settings


class ResponseGenerator:
    """Generate responses from retrieved document chunks."""
    
    def __init__(self):
        self.max_context_length = settings.MAX_CONTEXT_LENGTH
        self.response_max_length = settings.RESPONSE_MAX_LENGTH
    
    async def generate_response(
        self,
        query: str,
        search_results: List[Dict[str, Any]]
    ) -> Tuple[str, float]:
        """Generate a response from search results."""
        try:
            if not search_results:
                return "I couldn't find any relevant information to answer your question.", 0.0
            
            logger.info(f"Generating response from {len(search_results)} search results")
            
            # Prepare context from search results
            context = self._prepare_context(search_results)
            
            # Generate response using template-based approach
            # In a production system, you might use an LLM here
            response = await self._generate_template_response(query, context, search_results)
            
            # Calculate confidence score
            confidence = self._calculate_confidence(search_results)
            
            logger.info(f"Generated response with confidence {confidence:.2f}")
            
            return response, confidence
            
        except Exception as e:
            logger.error(f"Response generation failed: {e}")
            return "I encountered an error while generating the response.", 0.0
    
    def _prepare_context(self, search_results: List[Dict[str, Any]]) -> str:
        """Prepare context text from search results."""
        context_parts = []
        current_length = 0
        
        for result in search_results:
            content = result.get('content', '')
            source_info = self._format_source_info(result)
            
            # Add source information
            context_part = f"[Source: {source_info}]\n{content}\n"
            
            # Check if adding this would exceed context length
            if current_length + len(context_part) > self.max_context_length:
                break
            
            context_parts.append(context_part)
            current_length += len(context_part)
        
        return '\n'.join(context_parts)
    
    def _format_source_info(self, result: Dict[str, Any]) -> str:
        """Format source information for context."""
        source_type = result.get('source_type', 'UNKNOWN')
        document_title = result.get('document_title', 'Unknown Document')
        source_location = result.get('source_location', {})
        
        source_info = f"{document_title} ({source_type})"
        
        # Add location information
        if isinstance(source_location, dict):
            if source_location.get('page_number'):
                source_info += f", Page {source_location['page_number']}"
            elif source_location.get('url'):
                source_info += f", URL: {source_location['url']}"
            elif source_location.get('row_id'):
                source_info += f", Row {source_location['row_id']}"
        
        return source_info
    
    async def _generate_template_response(
        self,
        query: str,
        context: str,
        search_results: List[Dict[str, Any]]
    ) -> str:
        """Generate response using template-based approach."""
        try:
            # For now, we'll use a simple template-based approach
            # In a production system, you would integrate with an LLM like OpenAI GPT or similar
            
            # Analyze query type
            query_type = self._analyze_query_type(query)
            
            if query_type == "summary":
                return self._generate_summary_response(context, search_results)
            elif query_type == "specific":
                return self._generate_specific_response(query, context, search_results)
            elif query_type == "comparison":
                return self._generate_comparison_response(query, context, search_results)
            else:
                return self._generate_general_response(query, context, search_results)
                
        except Exception as e:
            logger.error(f"Template response generation failed: {e}")
            return "I found relevant information but encountered an error while formulating the response."
    
    def _analyze_query_type(self, query: str) -> str:
        """Analyze the type of query to determine response strategy."""
        query_lower = query.lower()
        
        summary_keywords = ['summarize', 'summary', 'overview', 'main points', 'key points']
        comparison_keywords = ['compare', 'difference', 'versus', 'vs', 'contrast']
        specific_keywords = ['what is', 'who is', 'when', 'where', 'how', 'why']
        
        if any(keyword in query_lower for keyword in summary_keywords):
            return "summary"
        elif any(keyword in query_lower for keyword in comparison_keywords):
            return "comparison"
        elif any(keyword in query_lower for keyword in specific_keywords):
            return "specific"
        else:
            return "general"
    
    def _generate_summary_response(
        self,
        context: str,
        search_results: List[Dict[str, Any]]
    ) -> str:
        """Generate a summary response."""
        # Extract key sentences from the context
        sentences = self._extract_key_sentences(context, max_sentences=5)
        
        response = "Based on the documents, here are the main points:\n\n"
        for i, sentence in enumerate(sentences, 1):
            response += f"{i}. {sentence}\n"
        
        return response.strip()
    
    def _generate_specific_response(
        self,
        query: str,
        context: str,
        search_results: List[Dict[str, Any]]
    ) -> str:
        """Generate a specific answer response."""
        # Find the most relevant sentence that might answer the question
        best_match = self._find_best_matching_content(query, search_results)
        
        if best_match:
            response = f"Based on the available information: {best_match['content'][:500]}"
            if len(best_match['content']) > 500:
                response += "..."
        else:
            response = "I found relevant information but couldn't identify a specific answer to your question."
        
        return response
    
    def _generate_comparison_response(
        self,
        query: str,
        context: str,
        search_results: List[Dict[str, Any]]
    ) -> str:
        """Generate a comparison response."""
        # Group results by source or topic
        grouped_results = self._group_results_by_source(search_results)
        
        response = "Based on the available information, here's what I found:\n\n"
        
        for source, results in grouped_results.items():
            if len(results) > 0:
                content_summary = results[0]['content'][:200]
                response += f"From {source}: {content_summary}...\n\n"
        
        return response.strip()
    
    def _generate_general_response(
        self,
        query: str,
        context: str,
        search_results: List[Dict[str, Any]]
    ) -> str:
        """Generate a general response."""
        # Find the most relevant content
        best_matches = search_results[:3]  # Top 3 results
        
        response = "Based on your documents, here's what I found:\n\n"
        
        for result in best_matches:
            content = result['content'][:300]
            if len(result['content']) > 300:
                content += "..."
            response += f"{content}\n\n"
        
        return response.strip()
    
    def _extract_key_sentences(self, text: str, max_sentences: int = 5) -> List[str]:
        """Extract key sentences from text."""
        # Simple sentence extraction - could be improved with NLP
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 20]
        
        # Return the first few sentences (simple approach)
        return sentences[:max_sentences]
    
    def _find_best_matching_content(
        self,
        query: str,
        search_results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Find the content that best matches the query."""
        if not search_results:
            return None
        
        # For now, just return the highest similarity result
        return max(search_results, key=lambda x: x.get('similarity', 0))
    
    def _group_results_by_source(
        self,
        search_results: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Group results by source document."""
        grouped = {}
        
        for result in search_results:
            source = result.get('document_title', 'Unknown Source')
            if source not in grouped:
                grouped[source] = []
            grouped[source].append(result)
        
        return grouped
    
    def _calculate_confidence(self, search_results: List[Dict[str, Any]]) -> float:
        """Calculate confidence score for the response."""
        if not search_results:
            return 0.0
        
        # Average similarity of top results
        top_results = search_results[:3]
        avg_similarity = sum(result.get('similarity', 0) for result in top_results) / len(top_results)
        
        # Boost confidence if we have multiple sources
        source_diversity = len(set(result.get('document_id') for result in search_results))
        diversity_boost = min(source_diversity * 0.1, 0.2)
        
        confidence = min(avg_similarity + diversity_boost, 1.0)
        
        return confidence