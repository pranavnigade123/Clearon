/**
 * User Statistics API Route
 * Provide user analytics and statistics
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

    // Get document statistics
    const { data: documentStats, error: statsError } = await DatabaseService.getUserStats(
      session.user.id
    );

    if (statsError) {
      console.error('Failed to fetch document stats:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch statistics' },
        { status: 500 }
      );
    }

    // Get recent query history
    const { data: recentQueries, error: queriesError } = await DatabaseService.getQueryHistory(
      session.user.id,
      { limit: 10, offset: 0 }
    );

    if (queriesError) {
      console.error('Failed to fetch query history:', queriesError);
      return NextResponse.json(
        { error: 'Failed to fetch query history' },
        { status: 500 }
      );
    }

    // Calculate total queries and average response time
    const totalQueries = recentQueries?.length || 0;
    const averageResponseTime = recentQueries && recentQueries.length > 0
      ? recentQueries
          .filter(q => q.processing_time_ms)
          .reduce((sum, q) => sum + (q.processing_time_ms || 0), 0) / 
        recentQueries.filter(q => q.processing_time_ms).length / 1000 // Convert to seconds
      : 0;

    const stats = {
      documentStats: documentStats?.[0] || {
        total_documents: 0,
        total_chunks: 0,
        documents_by_type: {},
        processing_status_counts: {},
      },
      recentQueries: recentQueries || [],
      totalQueries,
      averageResponseTime,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('User stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}