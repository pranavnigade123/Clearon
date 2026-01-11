/**
 * Query Interface Component - Modern Design
 * Beautiful AI chat interface with enhanced UX
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
  Loader2,
  Brain,
  User,
  Sparkles,
  AlertCircle,
  Quote,
  CheckCircle
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
  const [copiedText, setCopiedText] = useState('');
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

    // Check if user is authenticated
    if (!session?.user?.id) {
      const errorQuery: QueryHistoryItem = {
        id: Math.random().toString(36).substring(7),
        query: query.trim(),
        timestamp: new Date(),
        isLoading: false,
        error: 'Please sign in to use the AI query feature.',
      };
      setHistory(prev => [...prev, errorQuery]);
      setQuery('');
      return;
    }

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
        const errorText = await response.text();
        console.error('Query failed:', response.status, errorText);
        
        let errorMessage = `Query failed: ${response.statusText}`;
        if (response.status === 401) {
          errorMessage = 'Authentication required. Please sign in again.';
        } else if (response.status === 503) {
          errorMessage = 'AI service is currently unavailable. Please try again later.';
        }
        
        throw new Error(errorMessage);
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const getSourceIcon = (sourceType: SourceType) => {
    switch (sourceType) {
      case 'PDF':
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'WEB':
        return <Globe className="w-4 h-4 text-blue-500" />;
      case 'CSV':
        return <Database className="w-4 h-4 text-emerald-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  const renderCitation = (citation: Citation, index: number) => (
    <div key={index} className="group border border-slate-200 rounded-xl p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getSourceIcon(citation.source_type)}
          <span className="font-medium text-sm text-slate-900">{citation.document_title}</span>
          <Badge variant="outline" className="text-xs border-slate-300">
            {citation.source_type}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
            {Math.round(citation.confidence * 100)}% match
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => copyToClipboard(citation.excerpt)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copiedText === citation.excerpt ? (
              <CheckCircle className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
      
      <div className="relative">
        <Quote className="absolute -left-1 -top-1 w-4 h-4 text-slate-400" />
        <p className="text-sm text-slate-700 pl-4 italic leading-relaxed">
          "{citation.excerpt}"
        </p>
      </div>
      
      <div className="mt-3 text-xs text-slate-500">
        Location: {citation.location}
      </div>
    </div>
  );

  const suggestedQuestions = [
    "What are the main points in the document?",
    "Summarize the key findings",
    "What does the data show about...",
    "Explain the methodology used",
    "What are the conclusions?"
  ];

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span>Ask Your AI Assistant</span>
          </CardTitle>
          <CardDescription>
            Ask questions about your documents and get intelligent answers with source citations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!session?.user ? (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                Please sign in to use the AI query feature.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                placeholder="What would you like to know about your documents?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isProcessing}
                className="h-14 pr-14 text-base border-slate-300 focus:border-purple-400 focus:ring-purple-400"
              />
              <Button 
                type="submit" 
                disabled={!query.trim() || isProcessing}
                className="absolute right-2 top-2 h-10 w-10 p-0 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            
            {/* Suggested Questions */}
            {history.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setQuery(suggestion)}
                      className="text-xs border-slate-300 hover:border-purple-400 hover:bg-purple-50"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </form>
          )}
        </CardContent>
      </Card>

      {/* Conversation History */}
      {history.length > 0 && (
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span>Conversation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8 max-h-[600px] overflow-y-auto pr-2">
              {history.map((item) => (
                <div key={item.id} className="space-y-4">
                  {/* User Query */}
                  <div className="flex justify-end">
                    <div className="flex items-start space-x-3 max-w-2xl">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl px-6 py-4 shadow-lg">
                        <p className="text-sm leading-relaxed">{item.query}</p>
                        <p className="text-xs text-purple-100 mt-2">
                          {item.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-3 max-w-4xl">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Brain className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-slate-50 rounded-2xl px-6 py-4 shadow-lg flex-1">
                        {item.isLoading ? (
                          <div className="flex items-center space-x-3">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                            <span className="text-sm text-slate-600">AI is thinking...</span>
                          </div>
                        ) : item.error ? (
                          <Alert variant="destructive" className="border-red-200 bg-red-50">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-red-700">{item.error}</AlertDescription>
                          </Alert>
                        ) : item.response ? (
                          <div className="space-y-4">
                            <div className="prose prose-sm max-w-none">
                              <p className="text-slate-800 leading-relaxed">{item.response.answer}</p>
                            </div>
                            
                            {/* Response Metadata */}
                            <div className="flex items-center space-x-4 text-xs text-slate-500 pb-3 border-b border-slate-200">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatProcessingTime(item.response.processing_time)}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Sparkles className="w-3 h-3" />
                                <span>Confidence: {Math.round(item.response.confidence_score * 100)}%</span>
                              </div>
                              <span>{item.response.citations.length} sources</span>
                            </div>

                            {/* Citations */}
                            {item.response.citations.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                  <Quote className="w-4 h-4" />
                                  <span>Sources & Citations</span>
                                </h4>
                                <div className="grid gap-3">
                                  {item.response.citations.map((citation, index) => 
                                    renderCitation(citation, index)
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center space-x-2 pt-3 border-t border-slate-200">
                              <Button size="sm" variant="ghost" className="text-xs h-8">
                                <ThumbsUp className="w-3 h-3 mr-1" />
                                Helpful
                              </Button>
                              <Button size="sm" variant="ghost" className="text-xs h-8">
                                <ThumbsDown className="w-3 h-3 mr-1" />
                                Not helpful
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-xs h-8"
                                onClick={() => copyToClipboard(item.response!.answer)}
                              >
                                {copiedText === item.response.answer ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
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
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">
              Ready to Answer Your Questions
            </h3>
            <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
              Ask questions about your uploaded documents and get accurate, intelligent answers with source citations. 
              The AI will search through your knowledge base to provide relevant information.
            </p>
            <div className="bg-slate-50 rounded-xl p-6 max-w-md mx-auto">
              <h4 className="font-semibold text-slate-900 mb-3">Example Questions:</h4>
              <ul className="text-sm text-slate-600 space-y-2 text-left">
                <li>• "What are the main conclusions in the research paper?"</li>
                <li>• "Summarize the financial data from Q3"</li>
                <li>• "What methodology was used in the study?"</li>
                <li>• "Compare the results between different sections"</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}