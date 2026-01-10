/**
 * Dashboard Stats Component
 * Display user statistics and analytics
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Globe, 
  Database, 
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  Search
} from 'lucide-react';
import { DocumentStats, QueryHistory } from '@/types/database';
import { formatFileSize, formatRelativeTime } from '@/lib/utils';

interface StatsData {
  documentStats: DocumentStats;
  recentQueries: QueryHistory[];
  totalQueries: number;
  averageResponseTime: number;
}

export function DashboardStats() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session?.user?.id) {
      fetchStats();
    }
  }, [session]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-clearon-600" />
          <span className="ml-2">Loading statistics...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No statistics available
          </h3>
          <p className="text-gray-500">
            Upload some documents and ask questions to see your statistics
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'PDF':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'WEB':
        return <Globe className="w-5 h-5 text-blue-500" />;
      case 'CSV':
        return <Database className="w-5 h-5 text-green-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600';
      case 'PROCESSING':
        return 'text-blue-600';
      case 'FAILED':
        return 'text-red-600';
      case 'PENDING':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Documents</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.documentStats.total_documents}
                </p>
              </div>
              <FileText className="w-8 h-8 text-clearon-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Document Chunks</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.documentStats.total_chunks}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-clearon-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Queries</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalQueries}
                </p>
              </div>
              <Search className="w-8 h-8 text-clearon-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.averageResponseTime.toFixed(1)}s
                </p>
              </div>
              <Clock className="w-8 h-8 text-clearon-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Documents by Type</CardTitle>
          <CardDescription>
            Breakdown of your documents by source type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.documentStats.documents_by_type).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getSourceIcon(type)}
                  <span className="font-medium">{type}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-clearon-600 h-2 rounded-full"
                      style={{
                        width: `${(count / stats.documentStats.total_documents) * 100}%`
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Status</CardTitle>
          <CardDescription>
            Current status of your document processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.documentStats.processing_status_counts).map(([status, count]) => (
              <div key={status} className="text-center">
                <div className={`text-2xl font-bold ${getStatusColor(status)}`}>
                  {count}
                </div>
                <div className="text-sm text-gray-600 capitalize">
                  {status.toLowerCase()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Queries */}
      {stats.recentQueries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Queries</CardTitle>
            <CardDescription>
              Your latest questions and responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentQueries.slice(0, 5).map((query) => (
                <div key={query.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-gray-900 flex-1">
                      {query.query_text}
                    </p>
                    <span className="text-sm text-gray-500 ml-4">
                      {formatRelativeTime(query.created_at)}
                    </span>
                  </div>
                  {query.response_text && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {query.response_text}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    {query.processing_time_ms && (
                      <span>
                        Response time: {(query.processing_time_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                    {query.confidence_score && (
                      <span>
                        Confidence: {Math.round(query.confidence_score * 100)}%
                      </span>
                    )}
                    <span>
                      Sources: {query.sources_used.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Tips</CardTitle>
          <CardDescription>
            Get the most out of Clearon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <p>Upload documents in PDF, CSV, or TXT format for best results</p>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <p>Ask specific questions to get more accurate and relevant answers</p>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <p>Use the citations to verify information and explore source documents</p>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <p>Process web content by providing URLs to articles and documentation</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}