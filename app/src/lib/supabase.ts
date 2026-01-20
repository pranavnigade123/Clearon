/**
 * Supabase Client Configuration
 * Database connection and utilities for Next.js application
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client for browser/client-side operations
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Utility functions for common database operations
export class DatabaseService {
  /**
   * Get user's documents with optional filtering
   */
  static async getUserDocuments(
    userId: string,
    options?: {
      sourceType?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.sourceType) {
      query = query.eq('source_type', options.sourceType);
    }

    if (options?.status) {
      query = query.eq('processing_status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    return query;
  }

  /**
   * Get document with its chunks
   */
  static async getDocumentWithChunks(documentId: string, userId: string) {
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (docError || !document) {
      return { data: null, error: docError };
    }

    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index');

    return {
      data: { document, chunks: chunks || [] },
      error: chunksError,
    };
  }

  /**
   * Search documents using vector similarity
   */
  static async searchDocuments(
    queryEmbedding: number[],
    userId: string,
    options?: {
      threshold?: number;
      limit?: number;
    }
  ) {
    return supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: options?.threshold || 0.78,
      match_count: options?.limit || 10,
      filter_user_id: userId,
    });
  }

  /**
   * Get user document statistics
   */
  static async getUserStats(userId: string) {
    return supabase.rpc('get_user_document_stats', {
      user_uuid: userId,
    });
  }

  /**
   * Create or update user preferences
   */
  static async upsertUserPreferences(userId: string, preferences: Partial<any>) {
    return supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          ...preferences,
        },
        {
          onConflict: 'user_id',
        }
      );
  }

  /**
   * Save query to history
   */
  static async saveQueryHistory(
    userId: string,
    query: string,
    response?: string,
    sources?: any[],
    processingTime?: number,
    confidence?: number
  ) {
    return supabase.from('query_history').insert({
      user_id: userId,
      query_text: query,
      response_text: response,
      sources_used: sources || [],
      processing_time_ms: processingTime,
      confidence_score: confidence,
    });
  }

  /**
   * Get user's query history
   */
  static async getQueryHistory(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ) {
    let query = supabase
      .from('query_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    return query;
  }

  /**
   * Update document processing status
   */
  static async updateDocumentStatus(
    documentId: string,
    status: string,
    errorMessage?: string
  ) {
    const updateData: any = {
      processing_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'COMPLETED') {
      updateData.processed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    return supabaseAdmin
      .from('documents')
      .update(updateData)
      .eq('id', documentId);
  }

  /**
   * Batch insert document chunks
   */
  static async insertDocumentChunks(chunks: any[]) {
    return supabaseAdmin.from('document_chunks').insert(chunks);
  }

  /**
   * Delete document and all associated chunks
   */
  static async deleteDocument(documentId: string, userId: string) {
    // Chunks will be deleted automatically due to CASCADE
    return supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId);
  }
}

// Real-time subscriptions helper
export class RealtimeService {
  /**
   * Subscribe to document processing status updates
   */
  static subscribeToDocumentUpdates(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel('document-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to new document insertions
   */
  static subscribeToNewDocuments(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel('new-documents')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }
}