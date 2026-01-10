/**
 * Health Check API Route - Simplified Version
 * System health monitoring and service status
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {} as Record<string, any>,
    version: '1.0.0',
  };

  try {
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

    // Basic environment check
    health.services.environment = {
      status: 'healthy',
      nodeEnv: process.env.NODE_ENV || 'development',
      nextjsVersion: '16.1.1',
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