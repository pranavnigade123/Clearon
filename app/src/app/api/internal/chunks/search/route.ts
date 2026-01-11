/**
 * Internal Chunks Search API Route
 * For use by microservices - no authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { query_text, user_id, max_results = 5 } = await request.json();

    if (!query_text || !user_id) {
      return NextResponse.json(
        { error: 'Query text and user_id required' },
        { status: 400 }
      );
    }

    console.log(`Internal API: Searching chunks for user ${user_id} with query: ${query_text}`);

    // Get all chunks for user's documents and do basic text matching
    const searchTerms = query_text.toLowerCase().split(' ').filter(term => term.length > 2);
    
    let query = supabaseAdmin
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
      .eq('documents.user_id', user_id);

    // Search for any of the terms in the content (case-insensitive)
    if (searchTerms.length > 0) {
      const searchConditions = searchTerms.map(term => `content.ilike.%${term}%`).join(',');
      query = query.or(searchConditions);
    } else {
      // If no good search terms, just get all chunks for the user
      query = query.limit(max_results);
    }

    const { data: chunks, error } = await query.limit(max_results);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to search chunks' },
        { status: 500 }
      );
    }

    console.log(`Found ${chunks?.length || 0} chunks for user ${user_id}`);

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
      user_id: user_id,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Internal chunks search error:', error);
    return NextResponse.json(
      { error: 'Failed to search chunks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}