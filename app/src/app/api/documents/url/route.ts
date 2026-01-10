/**
 * URL Processing API Route
 * Handle website URL processing and content extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { url, title, source_type } = body;

    if (!url || !title || source_type !== 'WEB') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Generate content hash based on URL
    const contentHash = createHash('sha256').update(url).digest('hex');

    // Check if URL already processed
    const { data: existingDoc } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('content_hash', contentHash)
      .eq('user_id', session.user.id)
      .single();

    if (existingDoc) {
      return NextResponse.json(
        { error: 'URL already processed' },
        { status: 409 }
      );
    }

    // Create document record in database
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        user_id: session.user.id,
        source_type: 'WEB',
        title,
        url,
        content_hash: contentHash,
        processing_status: 'PENDING',
        metadata: {
          url,
          processedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    // Trigger URL processing by calling the Python microservice
    try {
      const processingResponse = await fetch(
        `${process.env.DOCUMENT_PROCESSING_SERVICE_URL}/api/process-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: document.id,
            url,
            user_id: session.user.id,
          }),
        }
      );

      if (!processingResponse.ok) {
        console.error('Processing service error:', await processingResponse.text());
        // Update document status to failed
        await supabaseAdmin
          .from('documents')
          .update({
            processing_status: 'FAILED',
            error_message: 'Failed to start URL processing',
          })
          .eq('id', document.id);
      }
    } catch (error) {
      console.error('Failed to trigger URL processing:', error);
      // Update document status to failed
      await supabaseAdmin
        .from('documents')
        .update({
          processing_status: 'FAILED',
          error_message: 'Processing service unavailable',
        })
        .eq('id', document.id);
    }

    return NextResponse.json({
      document_id: document.id,
      title: document.title,
      message: 'URL processing started',
      processing_status: 'PENDING',
    });

  } catch (error) {
    console.error('URL processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}