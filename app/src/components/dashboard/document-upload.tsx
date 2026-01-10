/**
 * Document Upload Component
 * Handles file uploads and URL processing
 */

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Globe, Database, X, CheckCircle, AlertCircle } from 'lucide-react';
import { formatFileSize, isSupportedFileType } from '@/lib/utils';
import { SourceType } from '@/types/database';

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export function DocumentUpload() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [url, setUrl] = useState('');
  const [isUrlProcessing, setIsUrlProcessing] = useState(false);
  const [urlError, setUrlError] = useState('');

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => 
        `${file.name}: ${errors.map((e: any) => e.message).join(', ')}`
      ).join('\n');
      alert(`Some files were rejected:\n${errors}`);
    }

    // Add accepted files
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0,
      status: 'pending',
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: true,
  });

  const uploadFile = async (uploadFile: UploadFile) => {
    const formData = new FormData();
    formData.append('file', uploadFile.file);
    formData.append('title', uploadFile.file.name);
    formData.append('source_type', getSourceType(uploadFile.file.name));

    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Update status to processing
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'processing', progress: 50 }
          : f
      ));

      // Poll for processing completion
      await pollProcessingStatus(uploadFile.id, result.document_id);

    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
          : f
      ));
    }
  };

  const pollProcessingStatus = async (fileId: string, documentId: string) => {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/status`);
        const data = await response.json();

        if (data.processing_status === 'COMPLETED') {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'completed', progress: 100 }
              : f
          ));
          return;
        }

        if (data.processing_status === 'FAILED') {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error', error: data.error_message || 'Processing failed' }
              : f
          ));
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error', error: 'Processing timeout' }
              : f
          ));
        }
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'error', error: 'Failed to check status' }
            : f
        ));
      }
    };

    poll();
  };

  const processUrl = async () => {
    if (!url.trim()) return;

    setIsUrlProcessing(true);
    setUrlError('');

    try {
      const response = await fetch('/api/documents/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          title: new URL(url.trim()).hostname,
          source_type: 'WEB',
        }),
      });

      if (!response.ok) {
        throw new Error(`URL processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      setUrl('');
      
      // Add to files list for status tracking
      const urlFile: UploadFile = {
        file: new File([], result.title || 'Web Content'),
        id: result.document_id,
        progress: 50,
        status: 'processing',
      };
      
      setFiles(prev => [...prev, urlFile]);
      await pollProcessingStatus(urlFile.id, result.document_id);

    } catch (error) {
      setUrlError(error instanceof Error ? error.message : 'URL processing failed');
    } finally {
      setIsUrlProcessing(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const getSourceType = (filename: string): SourceType => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'PDF';
      case 'csv':
        return 'CSV';
      default:
        return 'PDF'; // Default fallback
    }
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Upload Files</span>
          </CardTitle>
          <CardDescription>
            Upload PDF documents or CSV files. Maximum file size: 50MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-clearon-400 bg-clearon-50'
                : 'border-gray-300 hover:border-clearon-400 hover:bg-clearon-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-clearon-600">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Drag & drop files here, or click to select files
                </p>
                <p className="text-sm text-gray-500">
                  Supports: PDF, CSV, TXT files
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* URL Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5" />
            <span>Process Website</span>
          </CardTitle>
          <CardDescription>
            Enter a website URL to extract and process its content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isUrlProcessing}
            />
            <Button
              onClick={processUrl}
              disabled={!url.trim() || isUrlProcessing}
            >
              {isUrlProcessing ? 'Processing...' : 'Process'}
            </Button>
          </div>
          {urlError && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{urlError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Queue</CardTitle>
            <CardDescription>
              Track the progress of your document uploads and processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="flex items-center space-x-4 p-4 border rounded-lg"
                >
                  {getStatusIcon(uploadFile.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(uploadFile.file.size)} • {uploadFile.status}
                    </p>
                    {uploadFile.status === 'uploading' || uploadFile.status === 'processing' ? (
                      <Progress value={uploadFile.progress} className="mt-2" />
                    ) : null}
                    {uploadFile.error && (
                      <p className="text-sm text-red-600 mt-1">{uploadFile.error}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {uploadFile.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => uploadFile(uploadFile)}
                      >
                        Upload
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(uploadFile.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}