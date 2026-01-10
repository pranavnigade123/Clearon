/**
 * Clearon Database Types
 * TypeScript interfaces for database entities
 */

export type SourceType = 'PDF' | 'WEB' | 'CSV';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Document {
  id: string;
  user_id: string;
  source_type: SourceType;
  title: string;
  original_filename?: string;
  url?: string;
  s3_key?: string;
  content_hash?: string;
  file_size?: number;
  processing_status: ProcessingStatus;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  processed_at?: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  token_count?: number;
  source_location: SourceLocation;
  embedding?: number[];
  created_at: string;
}

export interface SourceLocation {
  // For PDFs
  page_number?: number;
  // For web content
  url?: string;
  section?: string;
  // For CSV
  row_id?: number;
  column_headers?: string[];
  // Common
  start_char?: number;
  end_char?: number;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  chunk_size: number;
  chunk_overlap: number;
  max_results: number;
  preferred_citation_style: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface QueryHistory {
  id: string;
  user_id: string;
  query_text: string;
  response_text?: string;
  sources_used: Citation[];
  processing_time_ms?: number;
  confidence_score?: number;
  feedback_rating?: number;
  created_at: string;
}

export interface Citation {
  document_id: string;
  document_title: string;
  source_type: SourceType;
  location: string; // Page number, URL, or row identifier
  excerpt: string;
  confidence: number;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  confidence_score: number;
  processing_time: number;
  sources_used: string[];
}

export interface DocumentStats {
  total_documents: number;
  total_chunks: number;
  documents_by_type: Record<SourceType, number>;
  processing_status_counts: Record<ProcessingStatus, number>;
}

// API Request/Response types
export interface UploadDocumentRequest {
  file?: File;
  url?: string;
  title: string;
  source_type: SourceType;
}

export interface UploadDocumentResponse {
  document_id: string;
  message: string;
  processing_status: ProcessingStatus;
}

export interface ProcessQueryRequest {
  query: string;
  max_results?: number;
  similarity_threshold?: number;
}

export interface ProcessQueryResponse extends QueryResponse {
  query_id: string;
}

// Supabase specific types
export interface Database {
  public: {
    Tables: {
      documents: {
        Row: Document;
        Insert: Omit<Document, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Document, 'id' | 'created_at' | 'updated_at'>>;
      };
      document_chunks: {
        Row: DocumentChunk;
        Insert: Omit<DocumentChunk, 'id' | 'created_at'>;
        Update: Partial<Omit<DocumentChunk, 'id' | 'created_at'>>;
      };
      user_preferences: {
        Row: UserPreferences;
        Insert: Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'>>;
      };
      query_history: {
        Row: QueryHistory;
        Insert: Omit<QueryHistory, 'id' | 'created_at'>;
        Update: Partial<Omit<QueryHistory, 'id' | 'created_at'>>;
      };
    };
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          filter_user_id?: string;
        };
        Returns: {
          id: string;
          document_id: string;
          content: string;
          source_location: SourceLocation;
          similarity: number;
        }[];
      };
      get_user_document_stats: {
        Args: {
          user_uuid: string;
        };
        Returns: DocumentStats[];
      };
    };
  };
}