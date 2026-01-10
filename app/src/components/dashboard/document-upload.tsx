/**
 * Document Upload Component - Modern Design
 * Beautiful, intuitive file upload with enhanced UX
 */

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  Globe, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Sparkles,
  CloudUpload,
  Link as LinkIcon
} from 'lucide-react';
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

    // Filter out duplicate files (same name and size)
    const newFiles: UploadFile[] = [];
    const duplicates: string[] = [];

    acceptedFiles.forEach(file => {
      const isDuplicate = files.some(existingFile => 
        existingFile.file.name === file.name && 
        existingFile.file.size === file.size
      );

      if (isDuplicate) {
        duplicates.push(file.name);
      } else {
        newFiles.push({
          file,
          id: Math.random().toString(36).substring(7),
          progress: 0,
          status: 'pending',
        });
      }
    });

    if (duplicates.length > 0) {
      alert(`These files are already in the upload queue:\n${duplicates.join('\n')}`);
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, [files]);

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
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
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
    const maxAttempts = 120; // 10 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/status`);
        const data = await response.json();

        console.log(`Polling status for ${documentId}:`, data.status);

        if (data.status === 'COMPLETED') {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'completed', progress: 100 }
              : f
          ));
          return;
        }

        if (data.status === 'FAILED') {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error', error: data.error || 'Processing failed' }
              : f
          ));
          return;
        }

        if (data.status === 'PROCESSING') {
          // Update progress based on time elapsed
          const progress = Math.min(90, 50 + (attempts * 2));
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'processing', progress }
              : f
          ));
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error', error: 'Processing timeout - please try again' }
              : f
          ));
        }
      } catch (error) {
        console.error('Status polling error:', error);
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'error', error: 'Failed to check processing status' }
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
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'uploading':
        return <CloudUpload className="w-5 h-5 text-blue-500 animate-pulse" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusText = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return 'Ready to query';
      case 'error':
        return 'Failed';
      case 'processing':
        return 'Processing with AI...';
      case 'uploading':
        return 'Uploading...';
      default:
        return 'Ready to upload';
    }
  };

  return (
    <div className="space-y-8">
      {/* File Upload Section */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-3 text-2xl">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <span>Upload Files</span>
          </CardTitle>
          <CardDescription className="text-base">
            Drag & drop your documents or click to browse. Supports PDF, CSV, and TXT files up to 50MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
              isDragActive
                ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-purple-50 scale-102'
                : 'border-slate-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:scale-101'
            }`}
          >
            <input {...getInputProps()} />
            
            <div className="space-y-6">
              <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isDragActive 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 scale-110' 
                  : 'bg-gradient-to-r from-slate-400 to-slate-500'
              }`}>
                <CloudUpload className="w-10 h-10 text-white" />
              </div>
              
              {isDragActive ? (
                <div>
                  <h3 className="text-xl font-semibold text-blue-600 mb-2">
                    Drop your files here
                  </h3>
                  <p className="text-slate-600">
                    Release to start uploading
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    Choose files or drag them here
                  </h3>
                  <p className="text-slate-600 mb-4">
                    Upload PDFs, CSVs, or text files to add to your knowledge base
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 text-sm text-slate-500">
                    <span className="px-3 py-1 bg-slate-100 rounded-full">PDF</span>
                    <span className="px-3 py-1 bg-slate-100 rounded-full">CSV</span>
                    <span className="px-3 py-1 bg-slate-100 rounded-full">TXT</span>
                    <span className="px-3 py-1 bg-slate-100 rounded-full">Max 50MB</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* URL Processing Section */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-3 text-2xl">
            <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <span>Process Website</span>
          </CardTitle>
          <CardDescription className="text-base">
            Extract and process content from any website URL. Perfect for articles, documentation, and web resources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="url"
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isUrlProcessing}
                  className="pl-10 h-12 text-base border-slate-300 focus:border-blue-400 focus:ring-blue-400"
                />
              </div>
              <Button
                onClick={processUrl}
                disabled={!url.trim() || isUrlProcessing}
                size="lg"
                className="px-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              >
                {isUrlProcessing ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    Process URL
                  </>
                )}
              </Button>
            </div>
            
            {urlError && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{urlError}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Queue */}
      {files.length > 0 && (
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-3 text-2xl">
              <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span>Processing Queue</span>
            </CardTitle>
            <CardDescription className="text-base">
              Track the progress of your uploads and AI processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="group relative p-6 border border-slate-200 rounded-2xl bg-white hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getStatusIcon(fileItem.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-semibold text-slate-900 truncate">
                          {fileItem.file.name}
                        </h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFile(fileItem.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-slate-500 mb-3">
                        <span>{formatFileSize(fileItem.file.size)}</span>
                        <span>•</span>
                        <span className={`font-medium ${
                          fileItem.status === 'completed' ? 'text-emerald-600' :
                          fileItem.status === 'error' ? 'text-red-600' :
                          'text-blue-600'
                        }`}>
                          {getStatusText(fileItem.status)}
                        </span>
                      </div>
                      
                      {(fileItem.status === 'uploading' || fileItem.status === 'processing') && (
                        <div className="space-y-2">
                          <Progress 
                            value={fileItem.progress} 
                            className="h-2"
                          />
                          <div className="text-xs text-slate-500">
                            {fileItem.progress}% complete
                          </div>
                        </div>
                      )}
                      
                      {fileItem.error && (
                        <Alert variant="destructive" className="mt-3 border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            {fileItem.error}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                    
                    <div className="flex-shrink-0">
                      {fileItem.status === 'pending' && (
                        <Button
                          onClick={() => uploadFile(fileItem)}
                          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload
                        </Button>
                      )}
                      
                      {fileItem.status === 'completed' && (
                        <div className="flex items-center space-x-2 text-emerald-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">Ready</span>
                        </div>
                      )}
                    </div>
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