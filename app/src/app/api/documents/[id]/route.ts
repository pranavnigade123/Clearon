/**
 * Document Management API Route
 * Handle individual document operations (get, delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DatabaseService } from '@/lib/supabase';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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

    const { data, error } = await DatabaseService.getDocumentWithChunks(
      documentId,
      session.user.id
    );

    if (error || !data) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Get document API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // First, get the document to check ownership and get S3 key
    const { data, error: fetchError } = await DatabaseService.getDocumentWithChunks(
      documentId,
      session.user.id
    );

    if (fetchError || !data) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const document = data.document;

    // Delete from S3 if it has an S3 key
    if (document.s3_key) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: document.s3_key,
        });
        await s3Client.send(deleteCommand);
      } catch (s3Error) {
        console.error('S3 deletion error:', s3Error);
        // Continue with database deletion even if S3 fails
      }
    }

    // Delete from database (chunks will be deleted automatically due to CASCADE)
    const { error: deleteError } = await DatabaseService.deleteDocument(
      documentId,
      session.user.id
    );

    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Document deleted successfully',
    });

  } catch (error) {
    console.error('Delete document API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}