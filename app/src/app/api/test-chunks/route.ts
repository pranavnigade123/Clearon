/**
 * Test Chunks API Route
 * Test if document chunks are being created and can be retrieved
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get document chunks for the user's documents
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
          user_id
        )
      `)
      .eq('documents.user_id', session.user.id)
      .limit(10);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chunks', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user_id: session.user.id,
      chunks_found: chunks?.length || 0,
      chunks: chunks || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Test chunks error:', error);
    return NextResponse.json(
      { error: 'Failed to test chunks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}