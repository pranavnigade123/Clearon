/**
 * Internal Vector Similarity Search API
 * Used by Python microservices for vector similarity search
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { query_embedding, user_id, max_results = 10, similarity_threshold = 0.78 } = await request.json();

    if (!query_embedding || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: query_embedding, user_id' },
        { status: 400 }
      );
    }

    if (!Array.isArray(query_embedding) || query_embedding.length !== 1536) {
      return NextResponse.json(
        { error: 'Invalid query_embedding: must be array of 1536 numbers for text-embedding-3-small' },
        { status: 400 }
      );
    }

    console.log(`Vector search for user ${user_id} with threshold ${similarity_threshold}`);

    // Use the database's match_documents function for vector similarity search
    const { data: matches, error } = await supabaseAdmin.rpc('match_documents', {
      query_embedding: query_embedding,
      match_threshold: similarity_threshold,
      match_count: max_results,
      filter_user_id: user_id,
    });

    if (error) {
      console.error('Vector search error:', error);
      return NextResponse.json(
        { error: 'Vector search failed' },
        { status: 500 }
      );
    }

    console.log(`Found ${matches?.length || 0} similar chunks`);

    // Format results for the query processing service
    const formattedChunks = (matches || []).map((match: any) => ({
      chunk_id: match.id,
      document_id: match.document_id,
      content: match.content,
      metadata: {
        title: match.document_title,
        source_type: match.source_type,
        similarity_score: match.similarity,
        chunk_metadata: match.source_location,
      },
    }));

    return NextResponse.json({
      chunks: formattedChunks,
      total_found: formattedChunks.length,
      search_type: 'vector_similarity',
    });

  } catch (error) {
    console.error('Internal vector search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}