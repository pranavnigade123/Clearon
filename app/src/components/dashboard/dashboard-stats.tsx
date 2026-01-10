/**
 * Dashboard Stats Component - Modern Design
 * Beautiful analytics dashboard with enhanced visualizations
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
  Search,
  Zap,
  Target,
  Activity,
  Award,
  Lightbulb
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
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center animate-pulse">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div className="text-slate-600">Loading your analytics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-200 bg-red-50">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription className="text-red-700">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardContent className="text-center py-16">
          <div className="w-20 h-20 bg-gradient-to-r from-slate-400 to-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-3">
            No Analytics Available
          </h3>
          <p className="text-slate-600 max-w-md mx-auto">
            Upload some documents and ask questions to see your usage statistics and insights
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
        return <Database className="w-5 h-5 text-emerald-500" />;
      default:
        return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-emerald-600';
      case 'PROCESSING':
        return 'text-blue-600';
      case 'FAILED':
        return 'text-red-600';
      case 'PENDING':
        return 'text-amber-600';
      default:
        return 'text-slate-600';
    }
  };

  const statCards = [
    {
      title: 'Total Documents',
      value: stats.documentStats.total_documents,
      icon: FileText,
      color: 'from-blue-500 to-cyan-500',
      description: 'Documents in your library'
    },
    {
      title: 'Knowledge Chunks',
      value: stats.documentStats.total_chunks,
      icon: BarChart3,
      color: 'from-purple-500 to-pink-500',
      description: 'Processed text segments'
    },
    {
      title: 'Total Queries',
      value: stats.totalQueries,
      icon: Search,
      color: 'from-emerald-500 to-teal-500',
      description: 'Questions asked'
    },
    {
      title: 'Avg Response Time',
      value: `${stats.averageResponseTime.toFixed(1)}s`,
      icon: Zap,
      color: 'from-amber-500 to-orange-500',
      description: 'AI processing speed'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <Card key={index} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 bg-gradient-to-r ${card.color} rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-600">{card.title}</p>
                <p className="text-3xl font-bold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500">{card.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Documents by Type */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span>Document Distribution</span>
          </CardTitle>
          <CardDescription>
            Breakdown of your knowledge base by content type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(stats.documentStats.documents_by_type).map(([type, count]) => {
              const percentage = (count / stats.documentStats.total_documents) * 100;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getSourceIcon(type)}
                      <span className="font-semibold text-slate-900">{type} Documents</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-500">{percentage.toFixed(1)}%</span>
                      <span className="text-lg font-bold text-slate-900">{count}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span>Processing Status</span>
          </CardTitle>
          <CardDescription>
            Current status of your document processing pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(stats.documentStats.processing_status_counts).map(([status, count]) => (
              <div key={status} className="text-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <div className={`text-3xl font-bold mb-2 ${getStatusColor(status)}`}>
                  {count}
                </div>
                <div className="text-sm font-medium text-slate-700 capitalize mb-1">
                  {status.toLowerCase()}
                </div>
                <div className="text-xs text-slate-500">
                  {status === 'COMPLETED' ? 'Ready to query' :
                   status === 'PROCESSING' ? 'Being processed' :
                   status === 'PENDING' ? 'In queue' : 'Need attention'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Queries */}
      {stats.recentQueries.length > 0 && (
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span>Recent Queries</span>
            </CardTitle>
            <CardDescription>
              Your latest AI conversations and their performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentQueries.slice(0, 5).map((query) => (
                <div key={query.id} className="group border border-slate-200 rounded-xl p-4 hover:border-purple-300 hover:bg-purple-50/50 transition-all duration-300">
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-medium text-slate-900 flex-1 leading-relaxed">
                      {query.query_text}
                    </p>
                    <span className="text-sm text-slate-500 ml-4 flex-shrink-0">
                      {formatRelativeTime(query.created_at)}
                    </span>
                  </div>
                  
                  {query.response_text && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2 leading-relaxed">
                      {query.response_text}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-xs">
                    {query.processing_time_ms && (
                      <div className="flex items-center space-x-1 text-blue-600">
                        <Clock className="w-3 h-3" />
                        <span>{(query.processing_time_ms / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                    {query.confidence_score && (
                      <div className="flex items-center space-x-1 text-emerald-600">
                        <Award className="w-3 h-3" />
                        <span>{Math.round(query.confidence_score * 100)}% confidence</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1 text-purple-600">
                      <FileText className="w-3 h-3" />
                      <span>{query.sources_used.length} sources</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Tips */}
      <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <span>Pro Tips</span>
          </CardTitle>
          <CardDescription>
            Maximize your Clearon experience with these recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: FileText,
                title: "Optimize Document Formats",
                tip: "Upload PDFs, CSVs, and TXT files for best AI processing results",
                color: "text-red-500"
              },
              {
                icon: Search,
                title: "Ask Specific Questions",
                tip: "Use detailed, specific questions to get more accurate and relevant answers",
                color: "text-blue-500"
              },
              {
                icon: CheckCircle,
                title: "Verify with Citations",
                tip: "Always check the source citations to verify information accuracy",
                color: "text-emerald-500"
              },
              {
                icon: Globe,
                title: "Process Web Content",
                tip: "Add URLs to articles and documentation to expand your knowledge base",
                color: "text-purple-500"
              }
            ].map((tip, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 bg-white rounded-xl border border-slate-200">
                <tip.icon className={`w-5 h-5 ${tip.color} flex-shrink-0 mt-0.5`} />
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">{tip.title}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{tip.tip}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}