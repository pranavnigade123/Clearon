/**
 * Document Upload API Route - Local Storage Version
 * Handle file uploads to local storage and trigger document processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { authOptions } from '@/lib/auth';
import { SourceType } from '@/types/database';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

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

    // Generate S3 key
    const timestamp = Date.now();
    const s3Key = `documents/${session.user.id}/${timestamp}-${file.name}`;

    // Upload file to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || 'default-bucket',
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        uploadedBy: session.user.id,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(uploadCommand);
    console.log(`✅ File uploaded to S3: ${s3Key}`);

    // Create document record in database
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        user_id: session.user.id,
        source_type: sourceType,
        title,
        original_filename: file.name,
        s3_key: s3Key, // S3 object key
        content_hash: contentHash,
        file_size: file.size,
        processing_status: 'PENDING',
        metadata: {
          contentType: file.type,
          uploadedAt: new Date().toISOString(),
          s3Bucket: process.env.AWS_S3_BUCKET,
          s3Key: s3Key,
        },
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error('Database error:', dbError);
      
      // Clean up the uploaded S3 file if database insertion failed
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || 'default-bucket',
          Key: s3Key,
        });
        await s3Client.send(deleteCommand);
        console.log(`🗑️ Cleaned up S3 file: ${s3Key}`);
      } catch (cleanupError) {
        console.warn('Failed to clean up S3 file:', cleanupError);
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

    // Start background processing with S3 key
    processDocumentInBackground(document.id, s3Key, sourceType, session.user.id, title);

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
 * Create document chunks with real embeddings for vector search
 * Splits document text into chunks and generates embeddings using the Python service
 */
async function createDocumentChunks(
  documentId: string,
  extractedText: string,
  sourceType: SourceType
) {
  try {
    console.log(`Creating chunks with embeddings for document ${documentId}`);
    
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
    
    console.log(`Created ${chunks.length} text chunks, now generating embeddings...`);
    
    // Generate embeddings for each chunk using the Python service
    const chunksWithEmbeddings = [];
    for (const chunk of chunks) {
      try {
        // Call the Python embedding service
        const embeddingResponse = await fetch('http://127.0.0.1:8001/api/embeddings/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: chunk.content,
          }),
        });

        if (!embeddingResponse.ok) {
          console.error(`Failed to generate embedding for chunk ${chunk.chunk_index}: ${embeddingResponse.status}`);
          continue; // Skip this chunk if embedding fails
        }

        const embeddingResult = await embeddingResponse.json();
        
        chunksWithEmbeddings.push({
          document_id: documentId,
          content: chunk.content,
          chunk_index: chunk.chunk_index,
          token_count: chunk.token_count,
          source_location: chunk.source_location,
          embedding: embeddingResult.embedding, // Real embedding vector
        });
        
        console.log(`Generated embedding for chunk ${chunk.chunk_index} (dimension: ${embeddingResult.dimension})`);
        
      } catch (error) {
        console.error(`Error generating embedding for chunk ${chunk.chunk_index}:`, error);
        // Continue with other chunks even if one fails
      }
    }
    
    // Insert chunks with embeddings into database
    if (chunksWithEmbeddings.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('document_chunks')
        .insert(chunksWithEmbeddings);
      
      if (error) {
        console.error(`Failed to create chunks for document ${documentId}:`, error);
      } else {
        console.log(`✅ Created ${chunksWithEmbeddings.length} chunks with embeddings for document ${documentId}`);
      }
    } else {
      console.warn(`No chunks with embeddings created for document ${documentId}`);
    }
    
  } catch (error) {
    console.error(`Error creating chunks for document ${documentId}:`, error);
  }
}
async function processDocumentInBackground(
  documentId: string,
  s3Key: string,
  sourceType: SourceType,
  userId: string,
  title: string
) {
  try {
    console.log(`Starting document processing for document ${documentId} from S3: ${s3Key}`);
    
    // For now, we'll pass the S3 key to the Python service
    // The Python service will need to be updated to download from S3
    const processingResponse = await fetch('http://127.0.0.1:8001/api/documents/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_id: documentId,
        s3_key: s3Key, // Pass S3 key instead of file path
        s3_bucket: process.env.AWS_S3_BUCKET,
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
            s3Bucket: process.env.AWS_S3_BUCKET,
            s3Key: s3Key,
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