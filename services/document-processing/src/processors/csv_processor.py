"""
CSV Document Processor
Handles CSV file processing with structured data conversion
"""

import os
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any
from loguru import logger

from .base_processor import BaseProcessor


class CSVProcessor(BaseProcessor):
    """CSV document processor with pandas-based parsing."""
    
    def __init__(self):
        self.supported_extensions = ['.csv']
    
    def can_process(self, file_path: str) -> bool:
        """Check if file can be processed by this processor."""
        return Path(file_path).suffix.lower() in self.supported_extensions
    
    async def process(self, file_path: str, document_id: str) -> Dict[str, Any]:
        """
        Process CSV document and convert to searchable text format.
        
        Args:
            file_path: Path to the CSV file
            document_id: Unique document identifier
            
        Returns:
            Dict containing extracted text, metadata, and structure information
        """
        try:
            logger.info(f"Processing CSV document: {file_path}")
            
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"CSV file not found: {file_path}")
            
            # Read CSV with pandas
            try:
                # Try different encodings
                for encoding in ['utf-8', 'latin-1', 'cp1252']:
                    try:
                        df = pd.read_csv(file_path, encoding=encoding)
                        logger.info(f"Successfully read CSV with {encoding} encoding")
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    raise Exception("Could not read CSV with any supported encoding")
                
            except Exception as e:
                raise Exception(f"Failed to parse CSV: {str(e)}")
            
            if df.empty:
                raise Exception("CSV file is empty")
            
            # Convert DataFrame to searchable text
            text_content = self._convert_dataframe_to_text(df, document_id)
            
            # Generate metadata
            metadata = {
                'file_path': file_path,
                'file_size': os.path.getsize(file_path),
                'rows': len(df),
                'columns': len(df.columns),
                'column_names': df.columns.tolist(),
                'data_types': df.dtypes.astype(str).to_dict(),
                'has_header': True,  # Assume first row is header
                'memory_usage': df.memory_usage(deep=True).sum()
            }
            
            # Create pages (chunks) for large CSVs
            pages = self._create_csv_pages(df, document_id)
            
            total_words = len(text_content.split())
            
            return {
                'document_id': document_id,
                'total_text': text_content,
                'pages': pages,
                'total_pages': len(pages),
                'total_chars': len(text_content),
                'total_words': total_words,
                'extraction_method': 'pandas',
                'metadata': metadata
            }
            
        except Exception as e:
            logger.error(f"Failed to process CSV {file_path}: {e}")
            raise Exception(f"CSV processing failed: {str(e)}")
    
    def _convert_dataframe_to_text(self, df: pd.DataFrame, document_id: str) -> str:
        """Convert DataFrame to searchable text format."""
        text_parts = []
        
        # Add header information
        text_parts.append(f"CSV Document: {document_id}")
        text_parts.append(f"Columns: {', '.join(df.columns.tolist())}")
        text_parts.append(f"Total Rows: {len(df)}")
        text_parts.append("")
        
        # Add column descriptions
        text_parts.append("Column Information:")
        for col in df.columns:
            dtype = str(df[col].dtype)
            non_null = df[col].count()
            unique_vals = df[col].nunique()
            text_parts.append(f"- {col}: {dtype}, {non_null} non-null values, {unique_vals} unique values")
        text_parts.append("")
        
        # Add sample data (first 10 rows)
        text_parts.append("Sample Data (First 10 Rows):")
        sample_df = df.head(10)
        
        for idx, row in sample_df.iterrows():
            row_text = f"Row {idx + 1}: "
            row_items = []
            for col, value in row.items():
                if pd.notna(value):
                    row_items.append(f"{col}={value}")
            row_text += ", ".join(row_items)
            text_parts.append(row_text)
        
        text_parts.append("")
        
        # Add summary statistics for numeric columns
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 0:
            text_parts.append("Numeric Column Statistics:")
            for col in numeric_cols:
                stats = df[col].describe()
                text_parts.append(f"{col}: mean={stats['mean']:.2f}, std={stats['std']:.2f}, min={stats['min']}, max={stats['max']}")
            text_parts.append("")
        
        # Add categorical summaries
        categorical_cols = df.select_dtypes(include=['object']).columns
        if len(categorical_cols) > 0:
            text_parts.append("Categorical Column Summaries:")
            for col in categorical_cols:
                top_values = df[col].value_counts().head(5)
                text_parts.append(f"{col} top values: {', '.join([f'{val}({count})' for val, count in top_values.items()])}")
            text_parts.append("")
        
        return "\n".join(text_parts)
    
    def _create_csv_pages(self, df: pd.DataFrame, document_id: str) -> List[Dict[str, Any]]:
        """Create page-like chunks for large CSV files."""
        pages = []
        rows_per_page = 100  # Process 100 rows per "page"
        
        # Header page
        header_text = f"CSV Structure - {document_id}\n"
        header_text += f"Columns: {', '.join(df.columns.tolist())}\n"
        header_text += f"Total Rows: {len(df)}, Total Columns: {len(df.columns)}\n"
        
        pages.append({
            'page_number': 1,
            'text': header_text,
            'char_count': len(header_text),
            'word_count': len(header_text.split()),
            'row_range': 'Header',
            'type': 'header'
        })
        
        # Data pages
        for i in range(0, len(df), rows_per_page):
            page_num = (i // rows_per_page) + 2  # Start from page 2
            end_idx = min(i + rows_per_page, len(df))
            chunk_df = df.iloc[i:end_idx]
            
            page_text = f"--- CSV Data Page {page_num} (Rows {i+1}-{end_idx}) ---\n"
            
            for idx, row in chunk_df.iterrows():
                row_items = []
                for col, value in row.items():
                    if pd.notna(value):
                        row_items.append(f"{col}: {value}")
                page_text += f"Row {idx + 1}: {', '.join(row_items)}\n"
            
            pages.append({
                'page_number': page_num,
                'text': page_text,
                'char_count': len(page_text),
                'word_count': len(page_text.split()),
                'row_range': f'{i+1}-{end_idx}',
                'type': 'data'
            })
        
        return pages
    
    def validate_pdf(self, file_path: str) -> Dict[str, Any]:
        """Validate CSV file before processing."""
        try:
            if not os.path.exists(file_path):
                return {'valid': False, 'error': 'File not found'}
            
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                return {'valid': False, 'error': 'File is empty'}
            
            if file_size > 100 * 1024 * 1024:  # 100MB limit for CSV
                return {'valid': False, 'error': 'File too large (max 100MB)'}
            
            # Try to read first few rows to validate CSV format
            try:
                sample_df = pd.read_csv(file_path, nrows=5)
                row_count = len(sample_df)
                col_count = len(sample_df.columns)
                
                if col_count == 0:
                    return {'valid': False, 'error': 'CSV has no columns'}
                
                return {
                    'valid': True,
                    'file_size': file_size,
                    'estimated_rows': 'Unknown',  # Would need to count all rows
                    'columns': col_count,
                    'sample_columns': sample_df.columns.tolist()[:5]
                }
                
            except Exception as e:
                return {'valid': False, 'error': f'Invalid CSV format: {str(e)}'}
            
        except Exception as e:
            return {'valid': False, 'error': f'Validation failed: {str(e)}'}