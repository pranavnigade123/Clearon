"""
PDF Document Processor
Handles PDF text extraction with page number preservation for citations
"""

import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import PyPDF2
import pdfplumber
from loguru import logger


class PDFProcessor:
    """PDF document processor with multiple extraction strategies."""
    
    def __init__(self):
        self.supported_extensions = ['.pdf']
    
    def can_process(self, file_path: str) -> bool:
        """Check if file can be processed by this processor."""
        return Path(file_path).suffix.lower() in self.supported_extensions
    
    async def process(self, file_path: str, document_id: str) -> Dict[str, Any]:
        """
        Process PDF document and extract text with page information.
        
        Args:
            file_path: Path to the PDF file
            document_id: Unique document identifier
            
        Returns:
            Dict containing extracted text, metadata, and page information
        """
        try:
            logger.info(f"Processing PDF document: {file_path}")
            
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"PDF file not found: {file_path}")
            
            # Try pdfplumber first (better for complex layouts)
            try:
                result = await self._extract_with_pdfplumber(file_path, document_id)
                logger.info(f"Successfully extracted text using pdfplumber: {len(result['pages'])} pages")
                return result
            except Exception as e:
                logger.warning(f"pdfplumber extraction failed: {e}, trying PyPDF2")
                
                # Fallback to PyPDF2
                result = await self._extract_with_pypdf2(file_path, document_id)
                logger.info(f"Successfully extracted text using PyPDF2: {len(result['pages'])} pages")
                return result
                
        except Exception as e:
            logger.error(f"Failed to process PDF {file_path}: {e}")
            raise Exception(f"PDF processing failed: {str(e)}")
    
    async def _extract_with_pdfplumber(self, file_path: str, document_id: str) -> Dict[str, Any]:
        """Extract text using pdfplumber (better for tables and complex layouts)."""
        pages = []
        total_text = ""
        
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                try:
                    # Extract text from page
                    page_text = page.extract_text()
                    
                    if page_text:
                        page_text = page_text.strip()
                        if page_text:  # Only add non-empty pages
                            pages.append({
                                'page_number': page_num,
                                'text': page_text,
                                'char_count': len(page_text),
                                'word_count': len(page_text.split())
                            })
                            total_text += f"\n\n--- Page {page_num} ---\n{page_text}"
                    
                    # Extract tables if present
                    tables = page.extract_tables()
                    if tables:
                        for table_idx, table in enumerate(tables):
                            table_text = self._format_table(table, page_num, table_idx)
                            if table_text:
                                pages[-1]['text'] += f"\n\n{table_text}"
                                total_text += f"\n\n{table_text}"
                                
                except Exception as e:
                    logger.warning(f"Failed to extract page {page_num}: {e}")
                    continue
        
        if not pages:
            raise Exception("No text could be extracted from PDF")
        
        return {
            'document_id': document_id,
            'total_text': total_text.strip(),
            'pages': pages,
            'total_pages': len(pages),
            'total_chars': sum(p['char_count'] for p in pages),
            'total_words': sum(p['word_count'] for p in pages),
            'extraction_method': 'pdfplumber',
            'metadata': {
                'file_path': file_path,
                'file_size': os.path.getsize(file_path),
                'has_tables': any('Table' in p['text'] for p in pages)
            }
        }
    
    async def _extract_with_pypdf2(self, file_path: str, document_id: str) -> Dict[str, Any]:
        """Extract text using PyPDF2 (fallback method)."""
        pages = []
        total_text = ""
        
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            for page_num, page in enumerate(pdf_reader.pages, 1):
                try:
                    page_text = page.extract_text()
                    
                    if page_text:
                        page_text = page_text.strip()
                        if page_text:  # Only add non-empty pages
                            pages.append({
                                'page_number': page_num,
                                'text': page_text,
                                'char_count': len(page_text),
                                'word_count': len(page_text.split())
                            })
                            total_text += f"\n\n--- Page {page_num} ---\n{page_text}"
                            
                except Exception as e:
                    logger.warning(f"Failed to extract page {page_num}: {e}")
                    continue
        
        if not pages:
            raise Exception("No text could be extracted from PDF")
        
        return {
            'document_id': document_id,
            'total_text': total_text.strip(),
            'pages': pages,
            'total_pages': len(pages),
            'total_chars': sum(p['char_count'] for p in pages),
            'total_words': sum(p['word_count'] for p in pages),
            'extraction_method': 'PyPDF2',
            'metadata': {
                'file_path': file_path,
                'file_size': os.path.getsize(file_path),
                'has_tables': False  # PyPDF2 doesn't detect tables
            }
        }
    
    def _format_table(self, table: List[List[str]], page_num: int, table_idx: int) -> str:
        """Format extracted table data into readable text."""
        if not table or not any(table):
            return ""
        
        try:
            # Filter out empty rows
            filtered_table = [row for row in table if row and any(cell for cell in row if cell)]
            
            if not filtered_table:
                return ""
            
            # Create table text
            table_text = f"\n--- Table {table_idx + 1} on Page {page_num} ---\n"
            
            for row_idx, row in enumerate(filtered_table):
                # Clean and join cells
                clean_row = [str(cell).strip() if cell else "" for cell in row]
                if any(clean_row):  # Only add non-empty rows
                    if row_idx == 0:  # Header row
                        table_text += " | ".join(clean_row) + "\n"
                        table_text += "-" * len(" | ".join(clean_row)) + "\n"
                    else:
                        table_text += " | ".join(clean_row) + "\n"
            
            return table_text
            
        except Exception as e:
            logger.warning(f"Failed to format table on page {page_num}: {e}")
            return ""
    
    def validate_pdf(self, file_path: str) -> Dict[str, Any]:
        """Validate PDF file before processing."""
        try:
            if not os.path.exists(file_path):
                return {'valid': False, 'error': 'File not found'}
            
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                return {'valid': False, 'error': 'File is empty'}
            
            if file_size > 50 * 1024 * 1024:  # 50MB limit
                return {'valid': False, 'error': 'File too large (max 50MB)'}
            
            # Try to open with PyPDF2 to check if it's a valid PDF
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                page_count = len(pdf_reader.pages)
                
                if page_count == 0:
                    return {'valid': False, 'error': 'PDF has no pages'}
                
                if page_count > 1000:  # Reasonable limit
                    return {'valid': False, 'error': 'PDF has too many pages (max 1000)'}
            
            return {
                'valid': True,
                'file_size': file_size,
                'estimated_pages': page_count
            }
            
        except Exception as e:
            return {'valid': False, 'error': f'Invalid PDF file: {str(e)}'}