"""
Intelligent Document Chunking Service
Enhanced chunking with semantic awareness and configurable parameters
"""

import re
from typing import List, Dict, Any, Optional
from uuid import uuid4
from dataclasses import dataclass

from loguru import logger

from .config import settings
from ..shared.models.base import UnifiedDocument, DocumentChunk, SourceLocation, SourceType


@dataclass
class ChunkConfig:
    """Configuration for document chunking."""
    chunk_size: int = 512  # Target chunk size in tokens
    overlap_size: int = 102  # 20% overlap (512 * 0.2)
    min_chunk_size: int = 50  # Minimum viable chunk size
    max_chunk_size: int = 1024  # Maximum chunk size
    respect_boundaries: bool = True  # Respect sentence/paragraph boundaries
    preserve_structure: bool = True  # Maintain document structure info


class ChunkingService:
    """Enhanced service for creating intelligent document chunks with semantic awareness."""
    
    def __init__(self, config: Optional[ChunkConfig] = None):
        self.config = config or ChunkConfig()
        
        # Use settings if available, otherwise use config defaults
        self.chunk_size = getattr(settings, 'CHUNK_SIZE', self.config.chunk_size)
        self.chunk_overlap = getattr(settings, 'CHUNK_OVERLAP', self.config.overlap_size)
        
        # Enhanced patterns for better text processing
        self.sentence_endings = re.compile(r'[.!?]+\s+')
        self.paragraph_breaks = re.compile(r'\n\s*\n')
        self.heading_patterns = re.compile(r'^#{1,6}\s+.+$', re.MULTILINE)
        self.list_patterns = re.compile(r'^\s*[-*+•]\s+.+$', re.MULTILINE)
    
    async def create_chunks(
        self, 
        document: UnifiedDocument, 
        content: str
    ) -> List[DocumentChunk]:
        """Create chunks from document content with enhanced intelligence."""
        try:
            logger.info(f"Creating intelligent chunks for document {document.id}")
            
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
        """Create chunks from PDF content, preserving page information with enhanced logic."""
        chunks = []
        
        # Split content by pages
        page_pattern = r'\[Page (\d+)\]\n'
        pages = re.split(page_pattern, content)
        
        chunk_index = 0
        
        # Process pages (skip first empty element if exists)
        for i in range(1, len(pages), 2):
            if i + 1 < len(pages):
                page_num = int(pages[i])
                page_content = pages[i + 1].strip()
                
                if not page_content:
                    continue
                
                # Enhanced chunking for this page
                page_chunks = await self._create_intelligent_chunks(
                    page_content, 
                    document.id, 
                    chunk_index,
                    source_info={'page_number': page_num, 'type': 'pdf_page'}
                )
                
                chunks.extend(page_chunks)
                chunk_index += len(page_chunks)
        
        # If no page markers found, treat as single document
        if not chunks:
            chunks = await self._create_intelligent_chunks(
                content, 
                document.id, 
                0,
                source_info={'page_number': 1, 'type': 'pdf_document'}
            )
        
        # Add intelligent overlap between chunks
        chunks = self._add_intelligent_overlap(chunks, content)
        
        logger.info(f"Created {len(chunks)} intelligent chunks for PDF document {document.id}")
        return chunks
    
    async def _chunk_web_content(
        self, 
        document: UnifiedDocument, 
        content: str
    ) -> List[DocumentChunk]:
        """Create chunks from web content with structure awareness."""
        
        # Detect headings and sections for better chunking
        sections = self._detect_web_sections(content)
        
        chunks = []
        chunk_index = 0
        
        if sections and len(sections) > 1:
            # Structure-aware chunking
            for section in sections:
                section_chunks = await self._create_intelligent_chunks(
                    section['content'], 
                    document.id, 
                    chunk_index,
                    source_info={
                        'url': document.url, 
                        'section': section['title'],
                        'type': 'web_section'
                    }
                )
                chunks.extend(section_chunks)
                chunk_index += len(section_chunks)
        else:
            # Standard chunking
            chunks = await self._create_intelligent_chunks(
                content, 
                document.id, 
                0,
                source_info={'url': document.url, 'type': 'web_document'}
            )
        
        chunks = self._add_intelligent_overlap(chunks, content)
        
        logger.info(f"Created {len(chunks)} intelligent chunks for web document {document.id}")
        return chunks
    
    async def _chunk_csv_content(
        self, 
        document: UnifiedDocument, 
        content: str
    ) -> List[DocumentChunk]:
        """Create chunks from CSV content with data structure awareness."""
        
        # Detect CSV structure for better chunking
        csv_sections = self._detect_csv_sections(content)
        
        chunks = []
        chunk_index = 0
        
        for section in csv_sections:
            section_chunks = await self._create_intelligent_chunks(
                section['content'], 
                document.id, 
                chunk_index,
                source_info={
                    'data_type': 'csv',
                    'section': section['type'],
                    'rows': section.get('row_count', 0)
                }
            )
            chunks.extend(section_chunks)
            chunk_index += len(section_chunks)
        
        chunks = self._add_intelligent_overlap(chunks, content)
        
        logger.info(f"Created {len(chunks)} intelligent chunks for CSV document {document.id}")
        return chunks
    
    async def _chunk_generic_content(
        self, 
        document: UnifiedDocument, 
        content: str
    ) -> List[DocumentChunk]:
        """Create chunks from generic content with enhanced processing."""
        chunks = await self._create_intelligent_chunks(
            content, 
            document.id, 
            0,
            source_info={'type': 'generic_document'}
        )
        
        chunks = self._add_intelligent_overlap(chunks, content)
        
        logger.info(f"Created {len(chunks)} intelligent chunks for document {document.id}")
        return chunks
    
    async def _create_intelligent_chunks(
        self,
        text: str,
        document_id,
        start_index: int,
        source_info: Dict[str, Any] = None
    ) -> List[DocumentChunk]:
        """Create text chunks with enhanced semantic awareness."""
        chunks = []
        
        if not text.strip():
            return chunks
        
        source_info = source_info or {}
        
        # Use paragraph-based chunking for better semantic boundaries
        if self.config.respect_boundaries:
            paragraphs = self._split_into_paragraphs(text)
            chunks = await self._chunk_by_paragraphs(
                paragraphs, document_id, start_index, source_info
            )
        else:
            # Fallback to sentence-based chunking
            sentences = self._split_into_sentences(text)
            chunks = await self._chunk_by_sentences(
                sentences, document_id, start_index, source_info
            )
        
        # Filter and validate chunks
        chunks = self._validate_chunks(chunks)
        
        return chunks
    
    async def _chunk_by_paragraphs(
        self, 
        paragraphs: List[str], 
        document_id, 
        start_index: int,
        source_info: Dict[str, Any]
    ) -> List[DocumentChunk]:
        """Chunk text by paragraphs for better semantic coherence."""
        chunks = []
        current_chunk = ""
        current_tokens = 0
        chunk_index = start_index
        
        for paragraph in paragraphs:
            paragraph_tokens = self._estimate_tokens(paragraph)
            
            # If adding this paragraph would exceed chunk size
            if current_tokens + paragraph_tokens > self.chunk_size and current_chunk:
                # Create chunk from current content
                chunk = await self._create_enhanced_chunk(
                    current_chunk.strip(),
                    document_id,
                    chunk_index,
                    source_info
                )
                chunks.append(chunk)
                chunk_index += 1
                
                # Start new chunk with current paragraph
                current_chunk = paragraph
                current_tokens = paragraph_tokens
            else:
                # Add paragraph to current chunk
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph
                current_tokens += paragraph_tokens
        
        # Add final chunk if there's remaining content
        if current_chunk.strip():
            chunk = await self._create_enhanced_chunk(
                current_chunk.strip(),
                document_id,
                chunk_index,
                source_info
            )
            chunks.append(chunk)
        
        return chunks
    
    async def _chunk_by_sentences(
        self, 
        sentences: List[str], 
        document_id, 
        start_index: int,
        source_info: Dict[str, Any]
    ) -> List[DocumentChunk]:
        """Chunk text by sentences with overlap."""
        chunks = []
        current_chunk = ""
        current_tokens = 0
        chunk_index = start_index
        
        for sentence in sentences:
            sentence_tokens = self._estimate_tokens(sentence)
            
            # If adding this sentence would exceed chunk size
            if current_tokens + sentence_tokens > self.chunk_size and current_chunk:
                # Create chunk
                chunk = await self._create_enhanced_chunk(
                    current_chunk.strip(),
                    document_id,
                    chunk_index,
                    source_info
                )
                chunks.append(chunk)
                chunk_index += 1
                
                # Start new chunk with overlap
                overlap_text = self._get_intelligent_overlap(current_chunk, self.chunk_overlap)
                current_chunk = overlap_text + " " + sentence if overlap_text else sentence
                current_tokens = self._estimate_tokens(current_chunk)
            else:
                # Add sentence to current chunk
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
                current_tokens += sentence_tokens
        
        # Add final chunk if there's remaining content
        if current_chunk.strip():
            chunk = await self._create_enhanced_chunk(
                current_chunk.strip(),
                document_id,
                chunk_index,
                source_info
            )
            chunks.append(chunk)
        
        return chunks
    
    async def _create_enhanced_chunk(
        self,
        content: str,
        document_id,
        chunk_index: int,
        source_info: Dict[str, Any]
    ) -> DocumentChunk:
        """Create a single document chunk with enhanced metadata."""
        
        # Create source location with enhanced information
        source_location = SourceLocation()
        
        if 'page_number' in source_info:
            source_location.page_number = source_info['page_number']
        if 'url' in source_info:
            source_location.url = source_info['url']
        if 'section' in source_info:
            source_location.section = source_info['section']
        
        # Enhanced token count estimation
        token_count = self._estimate_tokens(content)
        
        return DocumentChunk(
            id=uuid4(),
            document_id=document_id,
            content=content,
            chunk_index=chunk_index,
            token_count=token_count,
            source_location=source_location
        )
    
    def _split_into_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs for better semantic boundaries."""
        paragraphs = self.paragraph_breaks.split(text)
        return [p.strip() for p in paragraphs if p.strip()]
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Enhanced sentence splitting with better boundary detection."""
        # First try paragraph splitting
        paragraphs = self._split_into_paragraphs(text)
        
        sentences = []
        for paragraph in paragraphs:
            # Split paragraph into sentences
            para_sentences = self.sentence_endings.split(paragraph)
            para_sentences = [s.strip() for s in para_sentences if s.strip()]
            sentences.extend(para_sentences)
        
        # If no good sentence boundaries found, split by lines
        if len(sentences) <= 1:
            sentences = [line.strip() for line in text.split('\n') if line.strip()]
        
        return sentences
    
    def _detect_web_sections(self, content: str) -> List[Dict[str, Any]]:
        """Detect sections in web content for better chunking."""
        sections = []
        
        # Find headings
        headings = list(self.heading_patterns.finditer(content))
        
        if headings:
            for i, heading in enumerate(headings):
                start_pos = heading.start()
                end_pos = headings[i + 1].start() if i + 1 < len(headings) else len(content)
                
                section_content = content[start_pos:end_pos].strip()
                section_title = heading.group().strip()
                
                sections.append({
                    'title': section_title,
                    'content': section_content,
                    'start': start_pos,
                    'end': end_pos
                })
        else:
            # No headings found, treat as single section
            sections.append({
                'title': 'Main Content',
                'content': content,
                'start': 0,
                'end': len(content)
            })
        
        return sections
    
    def _detect_csv_sections(self, content: str) -> List[Dict[str, Any]]:
        """Detect logical sections in CSV content."""
        sections = []
        
        # Split by major sections (header, data, summary)
        lines = content.split('\n')
        
        # Header section (first few lines with column info)
        header_lines = []
        data_lines = []
        
        in_data = False
        for line in lines:
            if 'Column' in line or 'Total Rows' in line or not in_data:
                if 'Row' in line and ':' in line:
                    in_data = True
                    data_lines.append(line)
                else:
                    header_lines.append(line)
            else:
                data_lines.append(line)
        
        if header_lines:
            sections.append({
                'type': 'header',
                'content': '\n'.join(header_lines),
                'row_count': 0
            })
        
        if data_lines:
            sections.append({
                'type': 'data',
                'content': '\n'.join(data_lines),
                'row_count': len(data_lines)
            })
        
        # If no clear structure, treat as single section
        if not sections:
            sections.append({
                'type': 'full_csv',
                'content': content,
                'row_count': len(lines)
            })
        
        return sections
    
    def _add_intelligent_overlap(self, chunks: List[DocumentChunk], full_text: str) -> List[DocumentChunk]:
        """Add intelligent overlap between chunks based on semantic boundaries."""
        if len(chunks) <= 1:
            return chunks
        
        for i in range(len(chunks) - 1):
            current_chunk = chunks[i]
            next_chunk = chunks[i + 1]
            
            # Add semantic overlap
            overlap_text = self._get_intelligent_overlap(current_chunk.content, self.chunk_overlap)
            if overlap_text and overlap_text not in next_chunk.content:
                next_chunk.content = overlap_text + " " + next_chunk.content
                next_chunk.token_count = self._estimate_tokens(next_chunk.content)
        
        return chunks
    
    def _get_intelligent_overlap(self, text: str, overlap_size: int) -> str:
        """Get intelligent overlap text that respects semantic boundaries."""
        if len(text) <= overlap_size:
            return text
        
        # Try to find a good breaking point (sentence boundary)
        sentences = self._split_into_sentences(text)
        
        if len(sentences) > 1:
            # Take the last sentence(s) that fit within overlap size
            overlap_text = ""
            for sentence in reversed(sentences):
                potential_overlap = sentence + " " + overlap_text if overlap_text else sentence
                if self._estimate_tokens(potential_overlap) <= overlap_size:
                    overlap_text = potential_overlap
                else:
                    break
            
            if overlap_text:
                return overlap_text.strip()
        
        # Fallback to word boundary
        overlap_text = text[-overlap_size * 4:]  # Rough character estimate
        first_space = overlap_text.find(' ')
        if first_space > 0:
            overlap_text = overlap_text[first_space + 1:]
        
        return overlap_text.strip()
    
    def _validate_chunks(self, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        """Validate and filter chunks based on quality criteria."""
        valid_chunks = []
        
        for chunk in chunks:
            token_count = self._estimate_tokens(chunk.content)
            
            # Update token count
            chunk.token_count = token_count
            
            # Filter based on size and content quality
            if (token_count >= self.config.min_chunk_size and 
                token_count <= self.config.max_chunk_size and
                chunk.content.strip() and
                len(chunk.content.split()) >= 5):  # At least 5 words
                valid_chunks.append(chunk)
            else:
                logger.debug(f"Filtered out chunk {chunk.id}: {token_count} tokens")
        
        return valid_chunks
    
    def _estimate_tokens(self, text: str) -> int:
        """Enhanced token count estimation."""
        # More accurate estimation: ~3.5 characters per token on average
        # This accounts for spaces and punctuation
        return max(1, len(text) // 4)
    
    def get_chunk_statistics(self, chunks: List[DocumentChunk]) -> Dict[str, Any]:
        """Get comprehensive statistics about the chunks."""
        if not chunks:
            return {}
        
        token_counts = [chunk.token_count for chunk in chunks]
        content_lengths = [len(chunk.content) for chunk in chunks]
        
        return {
            'total_chunks': len(chunks),
            'avg_tokens_per_chunk': sum(token_counts) / len(token_counts),
            'min_tokens': min(token_counts),
            'max_tokens': max(token_counts),
            'total_tokens': sum(token_counts),
            'avg_content_length': sum(content_lengths) / len(content_lengths),
            'chunk_size_distribution': {
                'small': len([c for c in token_counts if c < 200]),
                'medium': len([c for c in token_counts if 200 <= c < 600]),
                'large': len([c for c in token_counts if c >= 600])
            }
        }