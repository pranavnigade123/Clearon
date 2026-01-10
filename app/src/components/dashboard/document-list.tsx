/**
 * Document List Component - Modern Design
 * Beautiful document management with enhanced UX
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Globe, 
  Database, 
  Search, 
  Trash2, 
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Filter,
  Calendar,
  HardDrive,
  Eye,
  MoreVertical
} from 'lucide-react';
import { Document, SourceType, ProcessingStatus } from '@/types/database';
import { formatFileSize, formatRelativeTime } from '@/lib/utils';

export function DocumentList() {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ProcessingStatus | 'ALL'>('ALL');
  const [filterType, setFilterType] = useState<SourceType | 'ALL'>('ALL');

  useEffect(() => {
    if (session?.user?.id) {
      fetchDocuments();
    }
  }, [session]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/documents');
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete document');
    }
  };

  const getSourceIcon = (sourceType: SourceType) => {
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

  const getStatusIcon = (status: ProcessingStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'PROCESSING':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'FAILED':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'PENDING':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusColor = (status: ProcessingStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PROCESSING':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getTypeColor = (type: SourceType) => {
    switch (type) {
      case 'PDF':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'WEB':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CSV':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.original_filename?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (doc.url?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'ALL' || doc.processing_status === filterStatus;
    const matchesType = filterType === 'ALL' || doc.source_type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center animate-pulse">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="text-slate-600">Loading your documents...</div>
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

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl">
              <Search className="w-5 h-5 text-white" />
            </div>
            <span>Search & Filter</span>
          </CardTitle>
          <CardDescription>
            Find and organize your documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input
                  placeholder="Search documents by name, filename, or URL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 border-slate-300 focus:border-blue-400 focus:ring-blue-400"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as ProcessingStatus | 'ALL')}
                  className="pl-10 pr-8 py-3 border border-slate-300 rounded-lg text-sm bg-white focus:border-blue-400 focus:ring-blue-400 appearance-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
              
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as SourceType | 'ALL')}
                className="px-4 py-3 border border-slate-300 rounded-lg text-sm bg-white focus:border-blue-400 focus:ring-blue-400"
              >
                <option value="ALL">All Types</option>
                <option value="PDF">PDF</option>
                <option value="WEB">Web</option>
                <option value="CSV">CSV</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Grid */}
      {filteredDocuments.length === 0 ? (
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-r from-slate-400 to-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">
              {documents.length === 0 ? 'No documents yet' : 'No documents match your filters'}
            </h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              {documents.length === 0 
                ? 'Upload your first document to get started with your AI knowledge base'
                : 'Try adjusting your search terms or filter criteria to find what you\'re looking for'
              }
            </p>
            {documents.length === 0 && (
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                Upload Your First Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
                      {getSourceIcon(document.source_type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-xl font-semibold text-slate-900 truncate pr-4">
                          {document.title}
                        </h3>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <Badge className={`${getStatusColor(document.processing_status)} border`}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(document.processing_status)}
                              <span className="font-medium">{document.processing_status}</span>
                            </div>
                          </Badge>
                          <Badge className={`${getTypeColor(document.source_type)} border`}>
                            {document.source_type}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-slate-600">
                        {document.original_filename && (
                          <div className="flex items-center space-x-2">
                            <HardDrive className="w-4 h-4 text-slate-400" />
                            <span>File: {document.original_filename}</span>
                            {document.file_size && (
                              <span className="text-slate-400">
                                ({formatFileSize(document.file_size)})
                              </span>
                            )}
                          </div>
                        )}
                        
                        {document.url && (
                          <div className="flex items-center space-x-2">
                            <Globe className="w-4 h-4 text-slate-400" />
                            <span className="truncate">URL: {document.url}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>Uploaded {formatRelativeTime(document.created_at)}</span>
                          </div>
                          
                          {document.processed_at && (
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                              <span>Processed {formatRelativeTime(document.processed_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {document.error_message && (
                        <Alert variant="destructive" className="mt-4 border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-red-700">
                            {document.error_message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    {document.processing_status === 'COMPLETED' && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-slate-300 hover:border-emerald-400 hover:bg-emerald-50"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteDocument(document.id)}
                      className="border-slate-300 hover:border-red-400 hover:bg-red-50 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}