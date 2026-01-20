/**
 * Internal Chunks Create API Route
 * For use by document processing service - no authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { document_id, user_id, content, embedding, chunk_index, metadata } = body;

    // Validate required fields
    if (!document_id || !user_id || !content || !embedding || chunk_index === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: document_id, user_id, content, embedding, chunk_index' },
        { status: 400 }
      );
    }

    // Validate embedding dimensions (should be 1536 for Azure OpenAI text-embedding-3-small)
    if (!Array.isArray(embedding) || embedding.length !== 1536) {
      return NextResponse.json(
        { error: `Invalid embedding: expected array of 1536 numbers, got ${Array.isArray(embedding) ? embedding.length : typeof embedding}` },
        { status: 400 }
      );
    }

    console.log(`Creating chunk for document ${document_id}, user ${user_id}, chunk ${chunk_index} (embedding dim: ${embedding.length})`);

    // Insert chunk into database
    const { data, error } = await supabaseAdmin
      .from('document_chunks')
      .insert({
        document_id,
        content,
        embedding,
        chunk_index,
        source_location: metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error creating chunk:', error);
      return NextResponse.json(
        { error: 'Failed to create chunk', details: error.message },
        { status: 500 }
      );
    }

    console.log(`Successfully created chunk ${data.id} for document ${document_id}`);

    return NextResponse.json({
      success: true,
      chunk_id: data.id,
      document_id,
      chunk_index,
      embedding_dimension: embedding.length,
      created_at: data.created_at
    });

  } catch (error) {
    console.error('Chunk creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create chunk', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}