/**
 * Health Check API Route
 * System health monitoring and service status
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {} as Record<string, any>,
    version: '1.0.0',
  };

  try {
    // Check database connection
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('count')
        .limit(1);
      
      health.services.database = {
        status: error ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - startTime,
        error: error?.message,
      };
    } catch (dbError) {
      health.services.database = {
        status: 'unhealthy',
        error: dbError instanceof Error ? dbError.message : 'Database connection failed',
      };
    }

    // Check document processing service
    try {
      const docServiceResponse = await fetch(
        `${process.env.DOCUMENT_PROCESSING_SERVICE_URL}/health`,
        { 
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        }
      );
      
      health.services.documentProcessing = {
        status: docServiceResponse.ok ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - startTime,
        statusCode: docServiceResponse.status,
      };
    } catch (docError) {
      health.services.documentProcessing = {
        status: 'unhealthy',
        error: 'Service unavailable',
      };
    }

    // Check query processing service
    try {
      const queryServiceResponse = await fetch(
        `${process.env.QUERY_PROCESSING_SERVICE_URL}/health`,
        { 
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        }
      );
      
      health.services.queryProcessing = {
        status: queryServiceResponse.ok ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - startTime,
        statusCode: queryServiceResponse.status,
      };
    } catch (queryError) {
      health.services.queryProcessing = {
        status: 'unhealthy',
        error: 'Service unavailable',
      };
    }

    // Check S3 connectivity (basic check)
    health.services.s3 = {
      status: process.env.AWS_S3_BUCKET ? 'configured' : 'not_configured',
      bucket: process.env.AWS_S3_BUCKET || 'not_set',
    };

    // Determine overall health
    const unhealthyServices = Object.values(health.services).filter(
      service => service.status === 'unhealthy'
    );

    if (unhealthyServices.length > 0) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    return NextResponse.json(health, { status: statusCode });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 503 }
    );
  }
}