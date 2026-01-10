/**
 * User Stats API Route
 * Get user statistics and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get document statistics
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('documents')
      .select('source_type, processing_status, created_at, processed_at')
      .eq('user_id', session.user.id);

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return NextResponse.json(
        { error: 'Failed to fetch document statistics' },
        { status: 500 }
      );
    }

    // Calculate document stats
    const documentStats = {
      total_documents: documents?.length || 0,
      total_chunks: Math.floor((documents?.length || 0) * 15), // Estimate 15 chunks per document
      documents_by_type: documents?.reduce((acc: any, doc) => {
        acc[doc.source_type] = (acc[doc.source_type] || 0) + 1;
        return acc;
      }, {}) || {},
      processing_status_counts: documents?.reduce((acc: any, doc) => {
        acc[doc.processing_status] = (acc[doc.processing_status] || 0) + 1;
        return acc;
      }, {}) || {},
    };

    // For now, return mock query data since we don't have a queries table yet
    const mockRecentQueries = [
      {
        id: '1',
        query_text: 'What are the main findings in the research paper?',
        response_text: 'The research paper presents several key findings about AI applications...',
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        processing_time_ms: 1250,
        confidence_score: 0.92,
        sources_used: ['doc1', 'doc2'],
      },
      {
        id: '2',
        query_text: 'Summarize the financial data from Q3',
        response_text: 'The Q3 financial data shows strong performance across key metrics...',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        processing_time_ms: 890,
        confidence_score: 0.87,
        sources_used: ['doc3'],
      },
    ];

    const stats = {
      documentStats,
      recentQueries: mockRecentQueries,
      totalQueries: mockRecentQueries.length,
      averageResponseTime: mockRecentQueries.reduce((sum, q) => sum + (q.processing_time_ms / 1000), 0) / mockRecentQueries.length,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}