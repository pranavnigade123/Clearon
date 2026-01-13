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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const resolvedParams = await params;
    
    console.log('Status API - Session check:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      documentId: resolvedParams.id 
    });
    
    if (!session?.user?.id) {
      console.log('Status API - No session, returning 401');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const documentId = resolvedParams.id;

    console.log(`Status API - Fetching document ${documentId} for user ${session.user.id}`);

    // Get document status from database
    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('processing_status, error_message, processed_at, processing_started_at, metadata')
      .eq('id', documentId)
      .eq('user_id', session.user.id)
      .single();

    if (error || !document) {
      console.log(`Status API - Document not found: ${documentId}`, error);
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    console.log(`Status API - Document ${documentId} status: ${document.processing_status}`);

    return NextResponse.json({
      status: document.processing_status,
      error: document.error_message,
      processed_at: document.processed_at,
      processing_started_at: document.processing_started_at,
      chunk_count: document.metadata?.chunkCount || 0,
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}