"""
Base Document Processor Interface
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseProcessor(ABC):
    """Abstract base class for document processors."""
    
    @abstractmethod
    def can_process(self, file_path: str) -> bool:
        """Check if this processor can handle the given file."""
        pass
    
    @abstractmethod
    async def process(self, file_path: str, document_id: str) -> Dict[str, Any]:
        """
        Process the document and return extracted content.
        
        Args:
            file_path: Path to the document file
            document_id: Unique document identifier
            
        Returns:
            Dict containing:
                - document_id: str
                - total_text: str (complete extracted text)
                - pages: List[Dict] (page-by-page breakdown)
                - total_pages: int
                - total_chars: int
                - total_words: int
                - extraction_method: str
                - metadata: Dict (additional file info)
        """
        pass
    
    @abstractmethod
    def validate_pdf(self, file_path: str) -> Dict[str, Any]:
        """
        Validate document before processing.
        
        Returns:
            Dict containing:
                - valid: bool
                - error: str (if not valid)
                - file_size: int (if valid)
                - estimated_pages: int (if applicable)
        """
        pass