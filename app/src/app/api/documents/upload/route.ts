/**
 * Document Upload API Route - Local Storage Version
 * Handle file uploads to local storage and trigger document processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';
import { SourceType } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    // Get session using the shared authOptions
    const session = await getServerSession(authOptions);
    
    console.log('Session check:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      userEmail: session?.user?.email 
    });

    if (!session?.user?.id) {
      console.log('No session or user ID found');
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
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
    const { data: existingDoc, error: checkError } = await supabaseAdmin
      .from('documents')
      .select('id, title')
      .eq('content_hash', contentHash)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing document:', checkError);
      return NextResponse.json(
        { error: 'Failed to check for existing documents' },
        { status: 500 }
      );
    }

    if (existingDoc) {
      return NextResponse.json(
        { error: `This document has already been uploaded as "${existingDoc.title}"` },
        { status: 409 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads');
    const userDir = join(uploadsDir, session.user.id);
    
    try {
      await mkdir(userDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate local file path
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = join(userDir, fileName);
    const relativePath = `uploads/${session.user.id}/${fileName}`;

    // Save file locally
    await writeFile(filePath, buffer);

    // Create document record in database
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        user_id: session.user.id,
        source_type: sourceType,
        title,
        original_filename: file.name,
        s3_key: relativePath, // Using local path instead of S3 key
        content_hash: contentHash,
        file_size: file.size,
        processing_status: 'PENDING',
        metadata: {
          contentType: file.type,
          uploadedAt: new Date().toISOString(),
          localPath: filePath,
        },
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error('Database error:', dbError);
      
      // Clean up the uploaded file if database insertion failed
      try {
        await unlink(filePath);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file:', cleanupError);
      }
      
      // Handle specific database errors
      if (dbError?.code === '23505' && dbError?.message?.includes('content_hash')) {
        return NextResponse.json(
          { error: 'This document has already been uploaded' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    // Update document status to processing and start background processing
    await supabaseAdmin
      .from('documents')
      .update({
        processing_status: 'PROCESSING',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', document.id);

    // Start background processing simulation (replace with actual processing later)
    processDocumentInBackground(document.id, filePath, sourceType, session.user.id, title);

    return NextResponse.json({
      document_id: document.id,
      message: 'Document uploaded successfully',
      processing_status: 'PROCESSING',
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Background document processing simulation
 * In production, this would be handled by the Python microservice
 */
async function processDocumentInBackground(
  documentId: string,
  filePath: string,
  sourceType: SourceType,
  userId: string,
  title: string
) {
  try {
    console.log(`Starting background processing for document ${documentId}`);
    
    // Simulate processing time (2-8 seconds)
    const processingTime = Math.random() * 6000 + 2000;
    
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate processing success/failure (95% success rate)
    const success = Math.random() > 0.05;
    
    if (success) {
      // Mark as completed
      await supabaseAdmin
        .from('documents')
        .update({
          processing_status: 'COMPLETED',
          processed_at: new Date().toISOString(),
          chunk_count: Math.floor(Math.random() * 50) + 10, // Simulate chunk count
          metadata: {
            contentType: sourceType === 'PDF' ? 'application/pdf' : 'text/csv',
            uploadedAt: new Date().toISOString(),
            localPath: filePath,
            processingTime: Math.round(processingTime),
            extractedText: `Processed content from ${title}`,
          },
        })
        .eq('id', documentId);
      
      console.log(`Document ${documentId} processing completed successfully`);
    } else {
      // Mark as failed
      await supabaseAdmin
        .from('documents')
        .update({
          processing_status: 'FAILED',
          error_message: 'Processing failed during content extraction',
        })
        .eq('id', documentId);
      
      console.log(`Document ${documentId} processing failed`);
    }
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    
    // Mark as failed
    await supabaseAdmin
      .from('documents')
      .update({
        processing_status: 'FAILED',
        error_message: 'Internal processing error',
      })
      .eq('id', documentId);
  }
}