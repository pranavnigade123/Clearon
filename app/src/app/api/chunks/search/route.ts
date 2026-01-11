/**
 * Chunks Search API Route
 * Search document chunks for the query processing service
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { query_text, max_results = 5 } = await request.json();

    if (!query_text) {
      return NextResponse.json(
        { error: 'Query text required' },
        { status: 400 }
      );
    }

    // For now, do a simple text search since we don't have vector embeddings yet
    // Get all chunks for user's documents and do basic text matching
    const { data: chunks, error } = await supabaseAdmin
      .from('document_chunks')
      .select(`
        id,
        content,
        chunk_index,
        source_location,
        documents!inner(
          id,
          title,
          user_id,
          source_type,
          metadata
        )
      `)
      .eq('documents.user_id', session.user.id)
      .ilike('content', `%${query_text}%`)
      .limit(max_results);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to search chunks' },
        { status: 500 }
      );
    }

    // Format chunks for the query processing service
    const formattedChunks = (chunks || []).map(chunk => ({
      chunk_id: chunk.id,
      document_id: chunk.documents.id,
      content: chunk.content,
      chunk_index: chunk.chunk_index,
      similarity_score: 0.8, // Mock similarity for now
      metadata: {
        title: chunk.documents.title,
        source_type: chunk.documents.source_type,
        source_url: chunk.documents.metadata?.url || null,
        chunk_metadata: chunk.source_location || {}
      }
    }));

    return NextResponse.json({
      chunks: formattedChunks,
      total_found: formattedChunks.length,
      query: query_text,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Chunks search error:', error);
    return NextResponse.json(
      { error: 'Failed to search chunks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}