"""
Web Content Processor
Handles web scraping and content extraction from URLs
"""

import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Any
from loguru import logger

from .base_processor import BaseProcessor


class WebProcessor(BaseProcessor):
    """Web content processor with BeautifulSoup-based scraping."""
    
    def __init__(self):
        self.supported_extensions = []  # Web processor doesn't use file extensions
        self.timeout = 30  # Request timeout in seconds
        self.max_content_length = 10 * 1024 * 1024  # 10MB limit
    
    def can_process(self, file_path: str) -> bool:
        """Check if this is a URL that can be processed."""
        # For web processor, file_path is actually a URL
        return self._is_valid_url(file_path)
    
    def _is_valid_url(self, url: str) -> bool:
        """Check if the provided string is a valid URL."""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc]) and result.scheme in ['http', 'https']
        except Exception:
            return False
    
    async def process(self, url: str, document_id: str) -> Dict[str, Any]:
        """
        Process web content from URL and extract text.
        
        Args:
            url: URL to scrape (file_path parameter is used as URL)
            document_id: Unique document identifier
            
        Returns:
            Dict containing extracted text, metadata, and page information
        """
        try:
            logger.info(f"Processing web content from URL: {url}")
            
            if not self._is_valid_url(url):
                raise ValueError(f"Invalid URL: {url}")
            
            # Fetch web content
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            }
            
            response = requests.get(url, headers=headers, timeout=self.timeout, stream=True)
            response.raise_for_status()
            
            # Check content length
            content_length = response.headers.get('content-length')
            if content_length and int(content_length) > self.max_content_length:
                raise Exception(f"Content too large: {content_length} bytes (max {self.max_content_length})")
            
            # Get content type
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' not in content_type and 'application/xhtml' not in content_type:
                raise Exception(f"Unsupported content type: {content_type}")
            
            # Parse HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract content
            extracted_content = self._extract_content(soup, url)
            
            # Create text representation
            total_text = self._create_text_content(extracted_content, url, document_id)
            
            # Create pages (sections)
            pages = self._create_web_pages(extracted_content, url)
            
            total_words = len(total_text.split())
            
            return {
                'document_id': document_id,
                'total_text': total_text,
                'pages': pages,
                'total_pages': len(pages),
                'total_chars': len(total_text),
                'total_words': total_words,
                'extraction_method': 'BeautifulSoup',
                'metadata': {
                    'url': url,
                    'title': extracted_content.get('title', 'Unknown'),
                    'content_type': content_type,
                    'response_size': len(response.content),
                    'status_code': response.status_code,
                    'has_images': len(extracted_content.get('images', [])) > 0,
                    'has_links': len(extracted_content.get('links', [])) > 0,
                    'domain': urlparse(url).netloc
                }
            }
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch URL {url}: {e}")
            raise Exception(f"Web scraping failed: {str(e)}")
        except Exception as e:
            logger.error(f"Failed to process web content from {url}: {e}")
            raise Exception(f"Web processing failed: {str(e)}")
    
    def _extract_content(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract structured content from HTML."""
        content = {}
        
        # Extract title
        title_tag = soup.find('title')
        content['title'] = title_tag.get_text().strip() if title_tag else 'Unknown Title'
        
        # Extract meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        content['description'] = meta_desc.get('content', '').strip() if meta_desc else ''
        
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'advertisement']):
            element.decompose()
        
        # Extract main content
        main_content = []
        
        # Try to find main content area
        main_selectors = ['main', 'article', '.content', '.main-content', '#content', '#main']
        main_element = None
        
        for selector in main_selectors:
            main_element = soup.select_one(selector)
            if main_element:
                break
        
        if not main_element:
            main_element = soup.find('body') or soup
        
        # Extract headings and paragraphs
        for element in main_element.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'section']):
            text = element.get_text().strip()
            if text and len(text) > 20:  # Only include substantial text
                main_content.append({
                    'tag': element.name,
                    'text': text,
                    'level': int(element.name[1]) if element.name.startswith('h') else 0
                })
        
        content['main_content'] = main_content
        
        # Extract links
        links = []
        for link in soup.find_all('a', href=True):
            href = link.get('href')
            text = link.get_text().strip()
            if href and text:
                absolute_url = urljoin(url, href)
                links.append({'text': text, 'url': absolute_url})
        content['links'] = links[:50]  # Limit to first 50 links
        
        # Extract images
        images = []
        for img in soup.find_all('img', src=True):
            src = img.get('src')
            alt = img.get('alt', '').strip()
            if src:
                absolute_url = urljoin(url, src)
                images.append({'alt': alt, 'src': absolute_url})
        content['images'] = images[:20]  # Limit to first 20 images
        
        return content
    
    def _create_text_content(self, content: Dict[str, Any], url: str, document_id: str) -> str:
        """Create searchable text from extracted content."""
        text_parts = []
        
        # Add header information
        text_parts.append(f"Web Document: {document_id}")
        text_parts.append(f"URL: {url}")
        text_parts.append(f"Title: {content.get('title', 'Unknown')}")
        
        if content.get('description'):
            text_parts.append(f"Description: {content['description']}")
        
        text_parts.append("")
        
        # Add main content
        text_parts.append("Main Content:")
        for item in content.get('main_content', []):
            if item['tag'].startswith('h'):
                text_parts.append(f"\n{'#' * item['level']} {item['text']}")
            else:
                text_parts.append(item['text'])
        
        text_parts.append("")
        
        # Add links section
        if content.get('links'):
            text_parts.append("Referenced Links:")
            for link in content['links'][:10]:  # First 10 links
                text_parts.append(f"- {link['text']}: {link['url']}")
            text_parts.append("")
        
        # Add images section
        if content.get('images'):
            text_parts.append("Images:")
            for img in content['images'][:5]:  # First 5 images
                if img['alt']:
                    text_parts.append(f"- Image: {img['alt']}")
            text_parts.append("")
        
        return "\n".join(text_parts)
    
    def _create_web_pages(self, content: Dict[str, Any], url: str) -> List[Dict[str, Any]]:
        """Create page-like sections from web content."""
        pages = []
        
        # Header page
        header_text = f"Web Page Information\n"
        header_text += f"URL: {url}\n"
        header_text += f"Title: {content.get('title', 'Unknown')}\n"
        if content.get('description'):
            header_text += f"Description: {content['description']}\n"
        
        pages.append({
            'page_number': 1,
            'text': header_text,
            'char_count': len(header_text),
            'word_count': len(header_text.split()),
            'section_type': 'header'
        })
        
        # Content sections
        current_section = ""
        section_count = 2
        
        for item in content.get('main_content', []):
            if item['tag'].startswith('h') and item['level'] <= 2:  # New section on h1, h2
                if current_section.strip():
                    pages.append({
                        'page_number': section_count,
                        'text': current_section.strip(),
                        'char_count': len(current_section),
                        'word_count': len(current_section.split()),
                        'section_type': 'content'
                    })
                    section_count += 1
                
                current_section = f"{'#' * item['level']} {item['text']}\n\n"
            else:
                current_section += f"{item['text']}\n\n"
        
        # Add final section
        if current_section.strip():
            pages.append({
                'page_number': section_count,
                'text': current_section.strip(),
                'char_count': len(current_section),
                'word_count': len(current_section.split()),
                'section_type': 'content'
            })
        
        return pages
    
    def validate_pdf(self, url: str) -> Dict[str, Any]:
        """Validate URL before processing."""
        try:
            if not self._is_valid_url(url):
                return {'valid': False, 'error': 'Invalid URL format'}
            
            # Check if URL is accessible
            try:
                response = requests.head(url, timeout=10, allow_redirects=True)
                
                if response.status_code >= 400:
                    return {'valid': False, 'error': f'URL returned status code: {response.status_code}'}
                
                content_type = response.headers.get('content-type', '').lower()
                if 'text/html' not in content_type and 'application/xhtml' not in content_type:
                    return {'valid': False, 'error': f'Unsupported content type: {content_type}'}
                
                content_length = response.headers.get('content-length')
                if content_length and int(content_length) > self.max_content_length:
                    return {'valid': False, 'error': f'Content too large: {content_length} bytes'}
                
                return {
                    'valid': True,
                    'url': url,
                    'status_code': response.status_code,
                    'content_type': content_type,
                    'content_length': content_length
                }
                
            except requests.RequestException as e:
                return {'valid': False, 'error': f'URL not accessible: {str(e)}'}
            
        except Exception as e:
            return {'valid': False, 'error': f'Validation failed: {str(e)}'}