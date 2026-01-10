"""
Citation Generator
Generate precise citations from search results
"""

from typing import List, Dict, Any
from uuid import UUID

from loguru import logger

from .config import settings
from ..shared.models.base import Citation, SourceType


class CitationGenerator:
    """Generate citations from search results."""
    
    def __init__(self):
        self.max_excerpt_length = settings.CITATION_MAX_EXCERPT_LENGTH
    
    async def generate_citations(
        self,
        search_results: List[Dict[str, Any]]
    ) -> List[Citation]:
        """Generate citations from search results."""
        try:
            if not search_results:
                return []
            
            logger.info(f"Generating citations for {len(search_results)} search results")
            
            citations = []
            seen_documents = set()
            
            for result in search_results:
                # Avoid duplicate citations from the same document
                document_id = result.get('document_id')
                if document_id in seen_documents:
                    continue
                
                citation = await self._create_citation(result)
                if citation:
                    citations.append(citation)
                    seen_documents.add(document_id)
            
            # Sort citations by confidence (highest first)
            citations.sort(key=lambda x: x.confidence, reverse=True)
            
            logger.info(f"Generated {len(citations)} citations")
            return citations
            
        except Exception as e:
            logger.error(f"Citation generation failed: {e}")
            return []
    
    async def _create_citation(self, result: Dict[str, Any]) -> Citation:
        """Create a single citation from a search result."""
        try:
            document_id = result.get('document_id')
            document_title = result.get('document_title', 'Unknown Document')
            source_type = result.get('source_type', 'UNKNOWN')
            content = result.get('content', '')
            source_location = result.get('source_location', {})
            confidence = result.get('similarity', 0.0)
            
            # Format location string
            location = self._format_location(source_type, source_location)
            
            # Create excerpt
            excerpt = self._create_excerpt(content)
            
            # Map source type
            citation_source_type = self._map_source_type(source_type)
            
            citation = Citation(
                document_id=UUID(document_id),
                document_title=document_title,
                source_type=citation_source_type,
                location=location,
                excerpt=excerpt,
                confidence=confidence
            )
            
            return citation
            
        except Exception as e:
            logger.error(f"Failed to create citation: {e}")
            return None
    
    def _format_location(self, source_type: str, source_location: Dict[str, Any]) -> str:
        """Format location information based on source type."""
        try:
            if not isinstance(source_location, dict):
                return "Unknown location"
            
            if source_type == 'PDF':
                page_number = source_location.get('page_number')
                if page_number:
                    return f"Page {page_number}"
                else:
                    return "PDF document"
            
            elif source_type == 'WEB':
                url = source_location.get('url')
                if url:
                    # Shorten URL for display
                    if len(url) > 50:
                        return f"{url[:47]}..."
                    return url
                else:
                    return "Web content"
            
            elif source_type == 'CSV':
                row_id = source_location.get('row_id')
                if row_id:
                    return f"Row {row_id}"
                else:
                    return "CSV data"
            
            else:
                return "Document"
                
        except Exception as e:
            logger.warning(f"Location formatting failed: {e}")
            return "Unknown location"
    
    def _create_excerpt(self, content: str) -> str:
        """Create an excerpt from content."""
        try:
            if not content:
                return "No content available"
            
            # Clean content
            cleaned_content = content.strip()
            
            # If content is short enough, return as-is
            if len(cleaned_content) <= self.max_excerpt_length:
                return cleaned_content
            
            # Try to find a good breaking point (sentence boundary)
            excerpt = cleaned_content[:self.max_excerpt_length]
            
            # Find the last sentence boundary
            last_sentence_end = max(
                excerpt.rfind('.'),
                excerpt.rfind('!'),
                excerpt.rfind('?')
            )
            
            if last_sentence_end > self.max_excerpt_length * 0.7:  # If we found a good break point
                excerpt = excerpt[:last_sentence_end + 1]
            else:
                # Find the last word boundary
                last_space = excerpt.rfind(' ')
                if last_space > self.max_excerpt_length * 0.8:
                    excerpt = excerpt[:last_space] + "..."
                else:
                    excerpt = excerpt + "..."
            
            return excerpt
            
        except Exception as e:
            logger.warning(f"Excerpt creation failed: {e}")
            return content[:100] + "..." if len(content) > 100 else content
    
    def _map_source_type(self, source_type: str) -> SourceType:
        """Map string source type to SourceType enum."""
        try:
            source_type_upper = source_type.upper()
            if source_type_upper == 'PDF':
                return SourceType.PDF
            elif source_type_upper == 'WEB':
                return SourceType.WEB
            elif source_type_upper == 'CSV':
                return SourceType.CSV
            else:
                return SourceType.PDF  # Default fallback
        except Exception:
            return SourceType.PDF  # Default fallback
    
    async def generate_bibliography(
        self,
        citations: List[Citation]
    ) -> List[str]:
        """Generate bibliography entries from citations."""
        try:
            bibliography = []
            
            for citation in citations:
                entry = self._format_bibliography_entry(citation)
                if entry:
                    bibliography.append(entry)
            
            return bibliography
            
        except Exception as e:
            logger.error(f"Bibliography generation failed: {e}")
            return []
    
    def _format_bibliography_entry(self, citation: Citation) -> str:
        """Format a single bibliography entry."""
        try:
            # Basic format: Title. Source Type. Location.
            entry = f"{citation.document_title}. {citation.source_type.value}. {citation.location}."
            return entry
            
        except Exception as e:
            logger.warning(f"Bibliography entry formatting failed: {e}")
            return f"{citation.document_title}. {citation.source_type.value}."
    
    async def validate_citations(
        self,
        citations: List[Citation]
    ) -> List[Citation]:
        """Validate and clean citations."""
        try:
            valid_citations = []
            
            for citation in citations:
                if self._is_valid_citation(citation):
                    valid_citations.append(citation)
                else:
                    logger.warning(f"Invalid citation filtered out: {citation.document_title}")
            
            return valid_citations
            
        except Exception as e:
            logger.error(f"Citation validation failed: {e}")
            return citations  # Return original if validation fails
    
    def _is_valid_citation(self, citation: Citation) -> bool:
        """Check if a citation is valid."""
        try:
            # Basic validation
            if not citation.document_title or not citation.excerpt:
                return False
            
            if citation.confidence < 0.0 or citation.confidence > 1.0:
                return False
            
            if len(citation.excerpt.strip()) < 10:  # Too short to be meaningful
                return False
            
            return True
            
        except Exception:
            return False