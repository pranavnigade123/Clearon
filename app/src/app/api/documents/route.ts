/**
 * Documents API Route
 * Handle document listing and management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { DatabaseService } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('source_type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const options: any = { limit, offset };
    if (sourceType) options.sourceType = sourceType;
    if (status) options.status = status;

    const { data: documents, error } = await DatabaseService.getUserDocuments(
      session.user.id,
      options
    );

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documents: documents || [],
      total: documents?.length || 0,
    });

  } catch (error) {
    console.error('Documents API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}