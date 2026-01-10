/**
 * Query Interface Component
 * Handle user queries and display responses with citations
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Search, 
  MessageSquare, 
  Clock, 
  ExternalLink,
  FileText,
  Globe,
  Database,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Loader2
} from 'lucide-react';
import { QueryResponse, Citation, SourceType } from '@/types/database';
import { formatProcessingTime } from '@/lib/utils';

interface QueryHistoryItem {
  id: string;
  query: string;
  response?: QueryResponse;
  timestamp: Date;
  isLoading: boolean;
  error?: string;
}

export function QueryInterface() {
  const { data: session } = useSession();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    const queryId = Math.random().toString(36).substring(7);
    const newQuery: QueryHistoryItem = {
      id: queryId,
      query: query.trim(),
      timestamp: new Date(),
      isLoading: true,
    };

    setHistory(prev => [...prev, newQuery]);
    setQuery('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: newQuery.query,
          max_results: 10,
          similarity_threshold: 0.78,
        }),
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const result: QueryResponse = await response.json();

      setHistory(prev => prev.map(item => 
        item.id === queryId 
          ? { ...item, response: result, isLoading: false }
          : item
      ));

    } catch (error) {
      setHistory(prev => prev.map(item => 
        item.id === queryId 
          ? { 
              ...item, 
              isLoading: false, 
              error: error instanceof Error ? error.message : 'Query failed' 
            }
          : item
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const getSourceIcon = (sourceType: SourceType) => {
    switch (sourceType) {
      case 'PDF':
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'WEB':
        return <Globe className="w-4 h-4 text-blue-500" />;
      case 'CSV':
        return <Database className="w-4 h-4 text-green-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderCitation = (citation: Citation, index: number) => (
    <div key={index} className="border rounded-lg p-3 bg-gray-50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getSourceIcon(citation.source_type)}
          <span className="font-medium text-sm">{citation.document_title}</span>
          <Badge variant="outline" className="text-xs">
            {citation.source_type}
          </Badge>
        </div>
        <span className="text-xs text-gray-500">
          {Math.round(citation.confidence * 100)}% match
        </span>
      </div>
      <p className="text-sm text-gray-700 mb-2">"{citation.excerpt}"</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Location: {citation.location}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => copyToClipboard(citation.excerpt)}
        >
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Query Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>Ask a Question</span>
          </CardTitle>
          <CardDescription>
            Ask questions about your uploaded documents and get answers with citations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              placeholder="What would you like to know about your documents?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isProcessing}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!query.trim() || isProcessing}
              className="bg-clearon-600 hover:bg-clearon-700"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Query History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Conversation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 max-h-96 overflow-y-auto">
              {history.map((item) => (
                <div key={item.id} className="space-y-4">
                  {/* User Query */}
                  <div className="flex justify-end">
                    <div className="bg-clearon-600 text-white rounded-lg px-4 py-2 max-w-xs lg:max-w-md">
                      <p className="text-sm">{item.query}</p>
                      <p className="text-xs text-clearon-200 mt-1">
                        {item.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2 max-w-xs lg:max-w-2xl">
                      {item.isLoading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Thinking...</span>
                        </div>
                      ) : item.error ? (
                        <Alert variant="destructive">
                          <AlertDescription>{item.error}</AlertDescription>
                        </Alert>
                      ) : item.response ? (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-800">{item.response.answer}</p>
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatProcessingTime(item.response.processing_time)}</span>
                            </div>
                            <span>
                              Confidence: {Math.round(item.response.confidence_score * 100)}%
                            </span>
                            <span>
                              {item.response.citations.length} sources
                            </span>
                          </div>

                          {/* Citations */}
                          {item.response.citations.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                Sources
                              </h4>
                              <div className="space-y-2">
                                {item.response.citations.map((citation, index) => 
                                  renderCitation(citation, index)
                                )}
                              </div>
                            </div>
                          )}

                          {/* Feedback Buttons */}
                          <div className="flex items-center space-x-2 pt-2 border-t">
                            <Button size="sm" variant="ghost" className="text-xs">
                              <ThumbsUp className="w-3 h-3 mr-1" />
                              Helpful
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs">
                              <ThumbsDown className="w-3 h-3 mr-1" />
                              Not helpful
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-xs"
                              onClick={() => copyToClipboard(item.response!.answer)}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {history.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Ready to answer your questions
            </h3>
            <p className="text-gray-500 mb-4">
              Ask questions about your uploaded documents and get accurate answers with citations
            </p>
            <div className="text-sm text-gray-400">
              <p>Try asking:</p>
              <ul className="mt-2 space-y-1">
                <li>"What are the main points in the document?"</li>
                <li>"Summarize the key findings"</li>
                <li>"What does the data show about..."</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}