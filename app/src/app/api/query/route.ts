/**
 * Query Processing API Route
 * Handle user queries and coordinate with query processing microservice
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { DatabaseService } from '@/lib/supabase';

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
    const { query, max_results = 10, similarity_threshold = 0.78 } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    try {
      // Call the Python query processing microservice
      const queryResponse = await fetch(
        `${process.env.QUERY_PROCESSING_SERVICE_URL}/api/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query.trim(),
            user_id: session.user.id,
            max_results,
            similarity_threshold,
          }),
        }
      );

      if (!queryResponse.ok) {
        const errorText = await queryResponse.text();
        console.error('Query processing service error:', errorText);
        return NextResponse.json(
          { error: 'Query processing failed' },
          { status: 500 }
        );
      }

      const result = await queryResponse.json();
      const processingTime = Date.now() - startTime;

      // Save query to history
      try {
        await DatabaseService.saveQueryHistory(
          session.user.id,
          query.trim(),
          result.answer,
          result.citations,
          processingTime,
          result.confidence_score
        );
      } catch (historyError) {
        console.error('Failed to save query history:', historyError);
        // Don't fail the request if history saving fails
      }

      // Add processing time to response
      return NextResponse.json({
        ...result,
        processing_time: processingTime,
      });

    } catch (serviceError) {
      console.error('Query processing service unavailable:', serviceError);
      
      // Fallback: try to provide a basic response using direct database search
      try {
        // This is a simplified fallback - in a real implementation,
        // you might want to implement basic search functionality
        return NextResponse.json(
          { 
            error: 'Query processing service is currently unavailable. Please try again later.',
            service_status: 'unavailable'
          },
          { status: 503 }
        );
      } catch (fallbackError) {
        console.error('Fallback query processing failed:', fallbackError);
        return NextResponse.json(
          { error: 'Query processing is currently unavailable' },
          { status: 503 }
        );
      }
    }

  } catch (error) {
    console.error('Query API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}