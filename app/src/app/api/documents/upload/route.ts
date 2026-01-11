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
 * Create document chunks for vector search
 * Splits document text into chunks and stores them in the database
 */
async function createDocumentChunks(
  documentId: string,
  extractedText: string,
  sourceType: SourceType
) {
  try {
    console.log(`Creating chunks for document ${documentId}`);
    
    // Simple chunking - split by sentences and group into ~500 character chunks
    const sentences = extractedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentChunk.length + trimmedSentence.length > 500 && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          document_id: documentId,
          content: currentChunk.trim(),
          chunk_index: chunkIndex,
          token_count: Math.floor(currentChunk.length / 4), // Rough estimate
          source_location: {
            chunk_index: chunkIndex,
            source_type: sourceType,
            page_number: Math.floor(chunkIndex / 3) + 1, // Rough estimate
          },
        });
        
        currentChunk = trimmedSentence;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        document_id: documentId,
        content: currentChunk.trim(),
        chunk_index: chunkIndex,
        token_count: Math.floor(currentChunk.length / 4),
        source_location: {
          chunk_index: chunkIndex,
          source_type: sourceType,
          page_number: Math.floor(chunkIndex / 3) + 1,
        },
      });
    }
    
    // Insert chunks into database
    if (chunks.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('document_chunks')
        .insert(chunks);
      
      if (error) {
        console.error(`Failed to create chunks for document ${documentId}:`, error);
      } else {
        console.log(`Created ${chunks.length} chunks for document ${documentId}`);
      }
    }
    
  } catch (error) {
    console.error(`Error creating chunks for document ${documentId}:`, error);
  }
}
async function processDocumentInBackground(
  documentId: string,
  filePath: string,
  sourceType: SourceType,
  userId: string,
  title: string
) {
  try {
    console.log(`Starting real document processing for document ${documentId}`);
    
    // Call the Python document processing service
    const processingResponse = await fetch('http://127.0.0.1:8001/api/documents/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_id: documentId,
        file_path: filePath,
        source_type: sourceType,
        user_id: userId,
        title: title,
      }),
    });

    if (!processingResponse.ok) {
      const errorData = await processingResponse.json().catch(() => ({}));
      throw new Error(`Processing service error: ${processingResponse.status} - ${errorData.detail || processingResponse.statusText}`);
    }

    const processingResult = await processingResponse.json();
    console.log(`Document processing completed for ${documentId}:`, {
      status: processingResult.status,
      pages: processingResult.total_pages,
      words: processingResult.total_words,
      method: processingResult.extraction_method
    });

    if (processingResult.status === 'completed') {
      console.log(`Updating document ${documentId} to COMPLETED status`);
      
      // Mark as completed with extracted content
      const { data, error } = await supabaseAdmin
        .from('documents')
        .update({
          processing_status: 'COMPLETED',
          processed_at: new Date().toISOString(),
          metadata: {
            contentType: sourceType === 'PDF' ? 'application/pdf' : 'text/csv',
            uploadedAt: new Date().toISOString(),
            localPath: filePath,
            extractedText: processingResult.extracted_text,
            chunkCount: Math.floor((processingResult.total_words || 0) / 100), // Estimate chunks
            totalPages: processingResult.total_pages,
            totalWords: processingResult.total_words,
            extractionMethod: processingResult.extraction_method,
          },
        })
        .eq('id', documentId);
      
      if (error) {
        console.error(`Failed to update document ${documentId} status:`, error);
      } else {
        console.log(`Document ${documentId} processing completed successfully - DB updated`);
        
        // Create document chunks for vector search
        await createDocumentChunks(documentId, processingResult.extracted_text, sourceType);
      }
    } else {
      throw new Error(`Processing service returned unexpected status: ${processingResult.status}`);
    }
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    
    // Mark as failed with error details
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        processing_status: 'FAILED',
        error_message: error instanceof Error ? error.message : 'Unknown processing error',
      })
      .eq('id', documentId);
    
    if (updateError) {
      console.error(`Failed to update document ${documentId} to FAILED after error:`, updateError);
    }
  }
}