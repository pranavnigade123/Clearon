/**
 * Dashboard Page
 * Main dashboard with document management and query interface
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
import { Upload, Search, FileText, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'upload' | 'documents' | 'query' | 'stats'>('upload');

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-clearon-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please sign in to access the dashboard</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'upload', label: 'Upload Documents', icon: Upload },
    { id: 'documents', label: 'My Documents', icon: FileText },
    { id: 'query', label: 'Ask Questions', icon: Search },
    { id: 'stats', label: 'Statistics', icon: BarChart3 },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-clearon-50 to-primary-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-clearon-700">Clearon Dashboard</h1>
              <p className="text-sm text-gray-600">
                Welcome back, {session.user?.name || session.user?.email}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/api/auth/signout'}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-clearon-600 text-white'
                    : 'text-gray-600 hover:text-clearon-600 hover:bg-clearon-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'upload' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload Documents
              </h2>
              <DocumentUpload />
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                My Documents
              </h2>
              <DocumentList />
            </div>
          )}

          {activeTab === 'query' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Ask Questions
              </h2>
              <QueryInterface />
            </div>
          )}

          {activeTab === 'stats' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Statistics
              </h2>
              <DashboardStats />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}