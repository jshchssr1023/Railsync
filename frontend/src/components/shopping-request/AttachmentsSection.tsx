'use client';

import { useRef, useState, useCallback } from 'react';
import { Upload, X, FileText } from 'lucide-react';

interface AttachmentsSectionProps {
  files: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
}

export default function AttachmentsSection({ files, onAddFiles, onRemoveFile }: AttachmentsSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) onAddFiles(dropped);
    },
    [onAddFiles]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) onAddFiles(selected);
    if (inputRef.current) inputRef.current.value = '';
  };

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <section className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Attachments</h2>
      <p className="text-sm text-[var(--color-text-tertiary)]">
        Please attach any related SDS or Cleaning Certificates.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${dragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-[var(--color-border)] hover:border-blue-400'
          }`}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-tertiary)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          Drag and drop files here, or <span className="text-blue-600 dark:text-blue-400 font-medium">browse</span>
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Max 25 MB per file</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.csv,.xls,.xlsx"
      />

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                <span className="text-sm text-[var(--color-text-primary)] truncate">{file.name}</span>
                <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0">{formatSize(file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="text-[var(--color-text-tertiary)] hover:text-red-500 flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
