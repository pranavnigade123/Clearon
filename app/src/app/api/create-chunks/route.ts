/**
 * Create Chunks API Route
 * Manually create chunks for existing documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all completed documents for this user that don't have chunks
    const { data: documents, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, title, metadata')
      .eq('user_id', session.user.id)
      .eq('processing_status', 'COMPLETED');

    if (docError) {
      console.error('Error fetching documents:', docError);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        message: 'No completed documents found',
        documents_processed: 0,
      });
    }

    let totalChunksCreated = 0;
    const processedDocs = [];

    for (const doc of documents) {
      // Check if chunks already exist for this document
      const { data: existingChunks } = await supabaseAdmin
        .from('document_chunks')
        .select('id')
        .eq('document_id', doc.id)
        .limit(1);

      if (existingChunks && existingChunks.length > 0) {
        console.log(`Document ${doc.id} already has chunks, skipping`);
        continue;
      }

      // Get extracted text from metadata
      const extractedText = doc.metadata?.extractedText;
      if (!extractedText) {
        console.log(`Document ${doc.id} has no extracted text, skipping`);
        continue;
      }

      // Create chunks for this document
      const chunksCreated = await createDocumentChunks(doc.id, extractedText, doc.metadata?.contentType || 'PDF');
      totalChunksCreated += chunksCreated;
      
      processedDocs.push({
        id: doc.id,
        title: doc.title,
        chunks_created: chunksCreated,
      });
    }

    return NextResponse.json({
      message: `Successfully created chunks for ${processedDocs.length} documents`,
      total_chunks_created: totalChunksCreated,
      processed_documents: processedDocs,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Create chunks error:', error);
    return NextResponse.json(
      { error: 'Failed to create chunks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Create document chunks for vector search
 */
async function createDocumentChunks(
  documentId: string,
  extractedText: string,
  sourceType: string
): Promise<number> {
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
        return 0;
      } else {
        console.log(`Created ${chunks.length} chunks for document ${documentId}`);
        return chunks.length;
      }
    }
    
    return 0;
    
  } catch (error) {
    console.error(`Error creating chunks for document ${documentId}:`, error);
    return 0;
  }
}