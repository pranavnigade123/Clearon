/**
 * Document Upload API Route
 * Handle file uploads to S3 and trigger document processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { SourceType } from '@/types/database';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const sourceType = formData.get('source_type') as SourceType;

    if (!file || !title || !sourceType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/csv', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      );
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate content hash
    const contentHash = createHash('sha256').update(buffer).digest('hex');

    // Check if document already exists
    const { data: existingDoc } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('content_hash', contentHash)
      .eq('user_id', session.user.id)
      .single();

    if (existingDoc) {
      return NextResponse.json(
        { error: 'Document already exists' },
        { status: 409 }
      );
    }

    // Generate S3 key
    const timestamp = Date.now();
    const s3Key = `documents/${session.user.id}/${timestamp}-${file.name}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        userId: session.user.id,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(uploadCommand);

    // Create document record in database
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        user_id: session.user.id,
        source_type: sourceType,
        title,
        original_filename: file.name,
        s3_key: s3Key,
        content_hash: contentHash,
        file_size: file.size,
        processing_status: 'PENDING',
        metadata: {
          contentType: file.type,
          uploadedAt: new Date().toISOString(),
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

    // Trigger document processing by calling the Python microservice
    try {
      const processingResponse = await fetch(
        `${process.env.DOCUMENT_PROCESSING_SERVICE_URL}/api/process`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: document.id,
            s3_key: s3Key,
            source_type: sourceType,
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
            error_message: 'Failed to start processing',
          })
          .eq('id', document.id);
      }
    } catch (error) {
      console.error('Failed to trigger processing:', error);
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
      message: 'Document uploaded successfully',
      processing_status: 'PENDING',
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}