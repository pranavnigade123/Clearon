/**
 * Dashboard Page - Modern Design
 * Clean, attractive dashboard with improved UX
 */

'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DocumentUpload } from '@/components/dashboard/document-upload';
import { DocumentList } from '@/components/dashboard/document-list';
import { QueryInterface } from '@/components/dashboard/query-interface';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { Upload, Search, FileText, BarChart3, Brain, LogOut, User } from 'lucide-react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'upload' | 'documents' | 'query' | 'stats'>('upload');

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center animate-pulse">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div className="text-slate-600">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl">Access Required</CardTitle>
            <CardDescription>Please sign in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <a href="/auth/signin">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs = [
    { 
      id: 'upload', 
      label: 'Upload', 
      icon: Upload,
      description: 'Add new documents'
    },
    { 
      id: 'documents', 
      label: 'Library', 
      icon: FileText,
      description: 'Manage your files'
    },
    { 
      id: 'query', 
      label: 'Ask AI', 
      icon: Search,
      description: 'Query your knowledge'
    },
    { 
      id: 'stats', 
      label: 'Analytics', 
      icon: BarChart3,
      description: 'View insights'
    },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Clearon
                </h1>
                <p className="text-sm text-slate-500">
                  AI Knowledge Platform
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3 px-4 py-2 bg-slate-50 rounded-full">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-sm">
                  <div className="font-medium text-slate-900">
                    {session.user?.name || 'User'}
                  </div>
                  <div className="text-slate-500 text-xs">
                    {session.user?.email}
                  </div>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/api/auth/signout'}
                className="text-slate-600 hover:text-slate-900"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Tab Navigation */}
        <div className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative p-6 rounded-2xl border transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent shadow-xl scale-105'
                      : 'bg-white/80 backdrop-blur-sm text-slate-600 border-slate-200 hover:border-blue-300 hover:shadow-lg hover:scale-102'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className={`p-3 rounded-xl transition-colors ${
                      isActive 
                        ? 'bg-white/20' 
                        : 'bg-slate-100 group-hover:bg-blue-50'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        isActive 
                          ? 'text-white' 
                          : 'text-slate-600 group-hover:text-blue-600'
                      }`} />
                    </div>
                    <div className="text-center">
                      <div className={`font-semibold ${
                        isActive ? 'text-white' : 'text-slate-900'
                      }`}>
                        {tab.label}
                      </div>
                      <div className={`text-sm ${
                        isActive ? 'text-white/80' : 'text-slate-500'
                      }`}>
                        {tab.description}
                      </div>
                    </div>
                  </div>
                  
                  {isActive && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 opacity-20 blur-xl -z-10"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content with Animation */}
        <div className="space-y-6">
          <div className="animate-fadeIn">
            {activeTab === 'upload' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">
                    Upload Documents
                  </h2>
                  <p className="text-slate-600 max-w-2xl mx-auto">
                    Add PDFs, CSVs, or web content to your knowledge base. 
                    Our AI will process and make them searchable instantly.
                  </p>
                </div>
                <DocumentUpload />
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">
                    Document Library
                  </h2>
                  <p className="text-slate-600 max-w-2xl mx-auto">
                    Manage your uploaded documents, view processing status, 
                    and organize your knowledge base.
                  </p>
                </div>
                <DocumentList />
              </div>
            )}

            {activeTab === 'query' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">
                    Ask Your AI Assistant
                  </h2>
                  <p className="text-slate-600 max-w-2xl mx-auto">
                    Ask questions about your documents in natural language. 
                    Get instant answers with source citations.
                  </p>
                </div>
                <QueryInterface />
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">
                    Analytics & Insights
                  </h2>
                  <p className="text-slate-600 max-w-2xl mx-auto">
                    Track your usage, document processing statistics, 
                    and knowledge base growth over time.
                  </p>
                </div>
                <DashboardStats />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}