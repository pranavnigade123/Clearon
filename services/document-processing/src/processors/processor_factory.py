"""
Processor Factory
Creates appropriate processor based on file type
"""

from pathlib import Path
from typing import Optional
from loguru import logger

from .base_processor import BaseProcessor
from .pdf_processor import PDFProcessor
from .csv_processor import CSVProcessor
from .web_processor import WebProcessor


class ProcessorFactory:
    """Factory for creating document processors based on file type."""
    
    def __init__(self):
        self.processors = [
            PDFProcessor(),
            CSVProcessor(),
            WebProcessor(),
        ]
    
    def get_processor(self, file_path: str) -> Optional[BaseProcessor]:
        """
        Get appropriate processor for the given file.
        
        Args:
            file_path: Path to the file to process (or URL for web content)
            
        Returns:
            Processor instance or None if no suitable processor found
        """
        try:
            # Check if it's a URL first
            if file_path.startswith(('http://', 'https://')):
                logger.info(f"Detected URL, using WebProcessor: {file_path}")
                return WebProcessor()
            
            # Otherwise, check file extension
            file_extension = Path(file_path).suffix.lower()
            logger.info(f"Finding processor for file: {file_path} (extension: {file_extension})")
            
            for processor in self.processors:
                if processor.can_process(file_path):
                    logger.info(f"Selected processor: {processor.__class__.__name__}")
                    return processor
            
            logger.warning(f"No processor found for file: {file_path}")
            return None
            
        except Exception as e:
            logger.error(f"Error selecting processor for {file_path}: {e}")
            return None
    
    def get_supported_extensions(self) -> list[str]:
        """Get list of all supported file extensions."""
        extensions = []
        for processor in self.processors:
            if hasattr(processor, 'supported_extensions'):
                extensions.extend(processor.supported_extensions)
        
        # Add URL support indicator
        extensions.append('URLs (http/https)')
        
        return list(set(extensions))  # Remove duplicates