"""
Document Processing Core
Main document processing logic for different file types
"""

import asyncio
import io
import time
from typing import List, Optional
from uuid import UUID, uuid4

import boto3
import pandas as pd
import PyPDF2
import requests
from bs4 import BeautifulSoup
from loguru import logger

from .config import settings
from .chunking_service import ChunkingService
from ..shared.models.base import (
    UnifiedDocument, DocumentChunk, ProcessingResult, 
    SourceType, ProcessingStatus, SourceLocation
)


class DocumentProcessor:
    """Main document processor for handling different file types."""
    
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.chunking_service = ChunkingService()
    
    async def process_pdf_from_s3(
        self, 
        s3_key: str, 
        document_id: str, 
        user_id: str
    ) -> ProcessingResult:
        """Process a PDF document from S3 storage."""
        start_time = time.time()
        
        try:
            logger.info(f"Processing PDF from S3: {s3_key}")
            
            # Download file from S3
            response = self.s3_client.get_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=s3_key
            )
            file_content = response['Body'].read()
            
            # Extract text from PDF
            text_content, metadata = await self._extract_pdf_text(file_content)
            
            if not text_content.strip():
                return ProcessingResult(
                    success=False,
                    error_message="No text content found in PDF",
                    processing_time=time.time() - start_time
                )
            
            # Create unified document
            document = UnifiedDocument(
                id=UUID(document_id),
                user_id=UUID(user_id),
                source_type=SourceType.PDF,
                title=metadata.get('title', 'PDF Document'),
                content=text_content,
                processing_status=ProcessingStatus.PROCESSING,
                metadata=metadata
            )
            
            # Create chunks
            chunks = await self.chunking_service.create_chunks(
                document, text_content
            )
            
            return ProcessingResult(
                success=True,
                document=document,
                chunks=chunks,
                processing_time=time.time() - start_time
            )
            
        except Exception as e:
            logger.error(f"PDF processing failed: {e}")
            return ProcessingResult(
                success=False,
                error_message=str(e),
                processing_time=time.time() - start_time
            )
    
    async def process_csv_from_s3(
        self, 
        s3_key: str, 
        document_id: str, 
        user_id: str
    ) -> ProcessingResult:
        """Process a CSV document from S3 storage."""
        start_time = time.time()
        
        try:
            logger.info(f"Processing CSV from S3: {s3_key}")
            
            # Download file from S3
            response = self.s3_client.get_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=s3_key
            )
            file_content = response['Body'].read()
            
            # Parse CSV content
            text_content, metadata = await self._extract_csv_text(file_content)
            
            if not text_content.strip():
                return ProcessingResult(
                    success=False,
                    error_message="No data found in CSV",
                    processing_time=time.time() - start_time
                )
            
            # Create unified document
            document = UnifiedDocument(
                id=UUID(document_id),
                user_id=UUID(user_id),
                source_type=SourceType.CSV,
                title=metadata.get('title', 'CSV Data'),
                content=text_content,
                processing_status=ProcessingStatus.PROCESSING,
                metadata=metadata
            )
            
            # Create chunks
            chunks = await self.chunking_service.create_chunks(
                document, text_content
            )
            
            return ProcessingResult(
                success=True,
                document=document,
                chunks=chunks,
                processing_time=time.time() - start_time
            )
            
        except Exception as e:
            logger.error(f"CSV processing failed: {e}")
            return ProcessingResult(
                success=False,
                error_message=str(e),
                processing_time=time.time() - start_time
            )
    
    async def process_web_content(
        self, 
        url: str, 
        document_id: str, 
        user_id: str
    ) -> ProcessingResult:
        """Process web content from a URL."""
        start_time = time.time()
        
        try:
            logger.info(f"Processing web content from: {url}")
            
            # Fetch web content
            text_content, metadata = await self._extract_web_content(url)
            
            if not text_content.strip():
                return ProcessingResult(
                    success=False,
                    error_message="No content found at URL",
                    processing_time=time.time() - start_time
                )
            
            # Create unified document
            document = UnifiedDocument(
                id=UUID(document_id),
                user_id=UUID(user_id),
                source_type=SourceType.WEB,
                title=metadata.get('title', 'Web Content'),
                url=url,
                content=text_content,
                processing_status=ProcessingStatus.PROCESSING,
                metadata=metadata
            )
            
            # Create chunks
            chunks = await self.chunking_service.create_chunks(
                document, text_content
            )
            
            return ProcessingResult(
                success=True,
                document=document,
                chunks=chunks,
                processing_time=time.time() - start_time
            )
            
        except Exception as e:
            logger.error(f"Web content processing failed: {e}")
            return ProcessingResult(
                success=False,
                error_message=str(e),
                processing_time=time.time() - start_time
            )
    
    async def _extract_pdf_text(self, file_content: bytes) -> tuple[str, dict]:
        """Extract text content from PDF bytes."""
        try:
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text_parts = []
            metadata = {
                'total_pages': len(pdf_reader.pages),
                'page_texts': {}
            }
            
            for page_num, page in enumerate(pdf_reader.pages, 1):
                try:
                    page_text = page.extract_text()
                    if page_text.strip():
                        text_parts.append(f"[Page {page_num}]\n{page_text}")
                        metadata['page_texts'][page_num] = page_text
                except Exception as e:
                    logger.warning(f"Failed to extract text from page {page_num}: {e}")
                    continue
            
            # Get PDF metadata
            if pdf_reader.metadata:
                metadata.update({
                    'title': pdf_reader.metadata.get('/Title', ''),
                    'author': pdf_reader.metadata.get('/Author', ''),
                    'subject': pdf_reader.metadata.get('/Subject', ''),
                    'creator': pdf_reader.metadata.get('/Creator', ''),
                })
            
            full_text = '\n\n'.join(text_parts)
            return full_text, metadata
            
        except Exception as e:
            logger.error(f"PDF text extraction failed: {e}")
            raise
    
    async def _extract_csv_text(self, file_content: bytes) -> tuple[str, dict]:
        """Extract and format CSV content as text."""
        try:
            # Try different encodings
            encodings = ['utf-8', 'latin-1', 'cp1252']
            df = None
            
            for encoding in encodings:
                try:
                    csv_content = file_content.decode(encoding)
                    df = pd.read_csv(io.StringIO(csv_content))
                    break
                except (UnicodeDecodeError, pd.errors.ParserError):
                    continue
            
            if df is None:
                raise ValueError("Could not parse CSV file")
            
            # Convert DataFrame to readable text format
            text_parts = []
            
            # Add header information
            text_parts.append(f"CSV Data with {len(df)} rows and {len(df.columns)} columns")
            text_parts.append(f"Columns: {', '.join(df.columns.tolist())}")
            text_parts.append("")
            
            # Add sample data (first few rows)
            sample_size = min(10, len(df))
            text_parts.append(f"Sample data (first {sample_size} rows):")
            
            for idx, row in df.head(sample_size).iterrows():
                row_text = f"Row {idx + 1}: "
                row_items = []
                for col, value in row.items():
                    if pd.notna(value):
                        row_items.append(f"{col}: {value}")
                row_text += ", ".join(row_items)
                text_parts.append(row_text)
            
            # Add summary statistics for numeric columns
            numeric_cols = df.select_dtypes(include=['number']).columns
            if len(numeric_cols) > 0:
                text_parts.append("")
                text_parts.append("Numeric column summaries:")
                for col in numeric_cols:
                    stats = df[col].describe()
                    text_parts.append(f"{col}: mean={stats['mean']:.2f}, std={stats['std']:.2f}, min={stats['min']}, max={stats['max']}")
            
            metadata = {
                'rows': len(df),
                'columns': len(df.columns),
                'column_names': df.columns.tolist(),
                'numeric_columns': numeric_cols.tolist(),
                'data_types': df.dtypes.to_dict()
            }
            
            full_text = '\n'.join(text_parts)
            return full_text, metadata
            
        except Exception as e:
            logger.error(f"CSV text extraction failed: {e}")
            raise
    
    async def _extract_web_content(self, url: str) -> tuple[str, dict]:
        """Extract text content from a web page."""
        try:
            # Set up headers to mimic a real browser
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            # Fetch the web page
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            # Parse HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
            
            # Extract title
            title = soup.find('title')
            title_text = title.get_text().strip() if title else 'Web Content'
            
            # Extract main content
            # Try to find main content areas
            main_content = None
            for selector in ['main', 'article', '.content', '#content', '.post', '.entry']:
                main_content = soup.select_one(selector)
                if main_content:
                    break
            
            if not main_content:
                main_content = soup.find('body')
            
            if not main_content:
                main_content = soup
            
            # Extract text
            text_content = main_content.get_text()
            
            # Clean up text
            lines = (line.strip() for line in text_content.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text_content = ' '.join(chunk for chunk in chunks if chunk)
            
            metadata = {
                'title': title_text,
                'url': url,
                'content_length': len(text_content),
                'extracted_at': time.time()
            }
            
            return text_content, metadata
            
        except Exception as e:
            logger.error(f"Web content extraction failed: {e}")
            raise