'use client';

import { useState, useCallback } from 'react';
import { X, CloudUpload, FileSpreadsheet, Loader2 } from 'lucide-react';

interface CSVImportModalProps {
  title: string;
  description: string;
  acceptedFileTypes?: string;
  onClose: () => void;
  onImport: (file: File) => Promise<any>;
  onSuccess: () => void;
  renderResult?: (result: any) => React.ReactNode;
}

export default function CSVImportModal({
  title,
  description,
  acceptedFileTypes = '.csv,.txt,.tsv',
  onClose,
  onImport,
  onSuccess,
  renderResult,
}: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);

    try {
      const importResult = await onImport(file);
      setResult(importResult);
      const hasErrors = importResult?.errors?.length > 0;
      if (!hasErrors) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* File Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <CloudUpload className="w-12 h-12 mx-auto text-gray-400 mb-4" aria-hidden="true" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {description}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">or</p>
            <label className="btn btn-secondary cursor-pointer">
              Choose File
              <input
                type="file"
                accept={acceptedFileTypes}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Selected File Info */}
          {file && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <FileSpreadsheet className="w-8 h-8 text-primary-500" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Import Result */}
          {result && renderResult && renderResult(result)}

          {result && !renderResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {result.imported !== undefined && (
                  <div className="p-3 bg-success-50 dark:bg-success-900/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-success-600 dark:text-success-400">{result.imported}</p>
                    <p className="text-xs text-gray-500">Imported</p>
                  </div>
                )}
                {result.updated !== undefined && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.updated}</p>
                    <p className="text-xs text-gray-500">Updated</p>
                  </div>
                )}
                {result.skipped !== undefined && (
                  <div className="p-3 bg-warning-50 dark:bg-warning-900/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">{result.skipped}</p>
                    <p className="text-xs text-gray-500">Skipped</p>
                  </div>
                )}
              </div>
              {result.errors?.length > 0 && (
                <div className="bg-danger-50 dark:bg-danger-900/30 p-3 rounded-lg">
                  <p className="text-sm font-medium text-danger-700 dark:text-danger-300 mb-2">
                    {result.errors.length} Error{result.errors.length > 1 ? 's' : ''}
                  </p>
                  <ul className="text-xs text-danger-600 dark:text-danger-400 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 10).map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-gray-500">...and {result.errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="btn btn-secondary">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="btn btn-primary"
            >
              {importing ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
