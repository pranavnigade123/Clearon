/**
 * Document Status API Route
 * Get processing status of a document
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const documentId = params.id;

    // Get document status from database
    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('processing_status, error_message, processed_at, processing_started_at, chunk_count')
      .eq('id', documentId)
      .eq('user_id', session.user.id)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: document.processing_status,
      error: document.error_message,
      processed_at: document.processed_at,
      processing_started_at: document.processing_started_at,
      chunk_count: document.chunk_count,
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}