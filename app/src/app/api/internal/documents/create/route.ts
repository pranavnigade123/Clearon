/**
 * Internal Documents Create API Route
 * For use by document processing service - no authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, 
      user_id, 
      title, 
      source_type, 
      source_url, 
      processing_status,
      s3_key,
      total_pages, // Will be stored in metadata
      total_words, // Will be stored in metadata
      extraction_method // Will be stored in metadata
    } = body;

    // Validate required fields
    if (!id || !user_id || !title || !source_type) {
      return NextResponse.json(
        { error: 'Missing required fields: id, user_id, title, source_type' },
        { status: 400 }
      );
    }

    console.log(`Creating document record: ${id} - ${title} for user ${user_id}`);

    // Prepare metadata with processing information
    const metadata = {
      total_pages: total_pages || 0,
      total_words: total_words || 0,
      extraction_method: extraction_method || 'unknown'
    };

    // Insert document into database
    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        id,
        user_id,
        title,
        source_type,
        url: source_url,
        s3_key: s3_key,
        content_hash: `hash_${id}`, // Simple hash for now
        processing_status: processing_status || 'COMPLETED',
        metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error creating document:', error);
      return NextResponse.json(
        { error: 'Failed to create document', details: error.message },
        { status: 500 }
      );
    }

    console.log(`Successfully created document ${data.id}`);

    return NextResponse.json({
      success: true,
      document_id: data.id,
      title: data.title,
      processing_status: data.processing_status,
      created_at: data.created_at
    });

  } catch (error) {
    console.error('Document creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}