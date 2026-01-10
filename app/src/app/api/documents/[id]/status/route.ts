/**
 * Document Status API Route
 * Check processing status of a specific document
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const documentId = params.id;

    const { data: document, error } = await supabase
      .from('documents')
      .select('id, processing_status, error_message, processed_at')
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
      document_id: document.id,
      processing_status: document.processing_status,
      error_message: document.error_message,
      processed_at: document.processed_at,
    });

  } catch (error) {
    console.error('Document status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}