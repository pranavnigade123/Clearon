"""
Chunking Service
Intelligent document chunking with semantic awareness
"""

import re
from typing import List
from uuid import uuid4

from loguru import logger

from .config import settings
from ..shared.models.base import UnifiedDocument, DocumentChunk, SourceLocation, SourceType


class ChunkingService:
    """Service for creating intelligent document chunks."""
    
    def __init__(self):
        self.chunk_size = settings.CHUNK_SIZE
        self.chunk_overlap = settings.CHUNK_OVERLAP
    
    async def create_chunks(
        self, 
        document: UnifiedDocument, 
        content: str
    ) -> List[DocumentChunk]:
        """Create chunks from document content."""
        try:
            logger.info(f"Creating chunks for document {document.id}")
            
            if document.source_type == SourceType.PDF:
                return await self._chunk_pdf_content(document, content)
            elif document.source_type == SourceType.WEB:
                return await self._chunk_web_content(document, content)
            elif document.source_type == SourceType.CSV:
                return await self._chunk_csv_content(document, content)
            else:
                return await self._chunk_generic_content(document, content)
                
        except Exception as e:
            logger.error(f"Chunking failed for document {document.id}: {e}")
            raise
    
    async def _chunk_pdf_content(
        self, 
        document: UnifiedDocument, 
        content: str
    ) -> List[DocumentChunk]:
        """Create chunks from PDF content, preserving page information."""
        chunks = []
        
        # Split content by pages
        page_pattern = r'\[Page (\d+)\]\n'
        pages = re.split(page_pattern, content)
        
        current_page = 1
        chunk_index = 0
        
        # Process pages (skip first empty element if exists)
        for i in range(1, len(pages), 2):
            if i + 1 < len(pages):
                page_num = int(pages[i])
                page_content = pages[i + 1].strip()
                
                if not page_content:
                    continue
                
                # Create chunks for this page
                page_chunks = await self._create_text_chunks(
                    page_content, 
                    document.id, 
                    chunk_index,
                    page_number=page_num
                )
                
                chunks.extend(page_chunks)
                chunk_index += len(page_chunks)
        
        # If no page markers found, treat as single document
        if not chunks:
            chunks = await self._create_text_chunks(
                content, 
                document.id, 
                0,
                page_number=1
            )
        
        logger.info(f"Created {len(chunks)} chunks for PDF document {document.id}")
        return chunks
    
    async def _chunk_web_content(
        self, 
        document: UnifiedDocument, 
        content: str
    ) -> List[DocumentChunk]:
        """Create chunks from web content."""
        chunks = await self._create_text_chunks(
            content, 
            document.id, 
            0,
            url=document.url
        )
        
        logger.info(f"Created {len(chunks)} chunks for web document {document.id}")
        return chunks
    
    async def _chunk_csv_content(
        self, 
        document: UnifiedDocument, 
        content: str
    ) -> List[DocumentChunk]:
        """Create chunks from CSV content."""
        # For CSV, we might want to chunk by logical sections
        # For now, use generic chunking but preserve row information
        chunks = await self._create_text_chunks(
            content, 
            document.id, 
            0,
            data_type="csv"
        )
        
        logger.info(f"Created {len(chunks)} chunks for CSV document {document.id}")
        return chunks
    
    async def _chunk_generic_content(
        self, 
        document: UnifiedDocument, 
        content: str
    ) -> List[DocumentChunk]:
        """Create chunks from generic content."""
        chunks = await self._create_text_chunks(
            content, 
            document.id, 
            0
        )
        
        logger.info(f"Created {len(chunks)} chunks for document {document.id}")
        return chunks
    
    async def _create_text_chunks(
        self,
        text: str,
        document_id,
        start_index: int,
        page_number: int = None,
        url: str = None,
        data_type: str = None
    ) -> List[DocumentChunk]:
        """Create text chunks with overlap and semantic boundaries."""
        chunks = []
        
        if not text.strip():
            return chunks
        
        # Split text into sentences for better chunking
        sentences = self._split_into_sentences(text)
        
        current_chunk = ""
        current_length = 0
        chunk_index = start_index
        
        for sentence in sentences:
            sentence_length = len(sentence)
            
            # If adding this sentence would exceed chunk size
            if current_length + sentence_length > self.chunk_size and current_chunk:
                # Create chunk
                chunk = await self._create_chunk(
                    current_chunk.strip(),
                    document_id,
                    chunk_index,
                    page_number=page_number,
                    url=url,
                    data_type=data_type
                )
                chunks.append(chunk)
                chunk_index += 1
                
                # Start new chunk with overlap
                overlap_text = self._get_overlap_text(current_chunk, self.chunk_overlap)
                current_chunk = overlap_text + " " + sentence
                current_length = len(current_chunk)
            else:
                # Add sentence to current chunk
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
                current_length += sentence_length
        
        # Add final chunk if there's remaining content
        if current_chunk.strip():
            chunk = await self._create_chunk(
                current_chunk.strip(),
                document_id,
                chunk_index,
                page_number=page_number,
                url=url,
                data_type=data_type
            )
            chunks.append(chunk)
        
        return chunks
    
    async def _create_chunk(
        self,
        content: str,
        document_id,
        chunk_index: int,
        page_number: int = None,
        url: str = None,
        data_type: str = None
    ) -> DocumentChunk:
        """Create a single document chunk."""
        
        # Create source location
        source_location = SourceLocation()
        
        if page_number:
            source_location.page_number = page_number
        if url:
            source_location.url = url
        if data_type:
            source_location.section = data_type
        
        # Estimate token count (rough approximation: 1 token ≈ 4 characters)
        token_count = len(content) // 4
        
        return DocumentChunk(
            id=uuid4(),
            document_id=document_id,
            content=content,
            chunk_index=chunk_index,
            token_count=token_count,
            source_location=source_location
        )
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences for better chunking boundaries."""
        # Simple sentence splitting - could be improved with NLP libraries
        sentence_endings = r'[.!?]+\s+'
        sentences = re.split(sentence_endings, text)
        
        # Clean up sentences
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # If no sentence boundaries found, split by paragraphs
        if len(sentences) <= 1:
            sentences = [p.strip() for p in text.split('\n\n') if p.strip()]
        
        # If still no good splits, split by lines
        if len(sentences) <= 1:
            sentences = [line.strip() for line in text.split('\n') if line.strip()]
        
        return sentences
    
    def _get_overlap_text(self, text: str, overlap_size: int) -> str:
        """Get overlap text from the end of current chunk."""
        if len(text) <= overlap_size:
            return text
        
        # Try to find a good breaking point (sentence or word boundary)
        overlap_text = text[-overlap_size:]
        
        # Find the first complete word
        first_space = overlap_text.find(' ')
        if first_space > 0:
            overlap_text = overlap_text[first_space + 1:]
        
        return overlap_text