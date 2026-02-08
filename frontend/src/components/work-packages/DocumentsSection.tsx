'use client';

import { useState } from 'react';
import {
  Loader2,
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  Download,
  ExternalLink,
  Link2,
  X,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'sow', label: 'Scope of Work' },
  { value: 'ccm', label: 'Care & Cleaning Manual' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'inspection', label: 'Inspection Report' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'photo', label: 'Photo' },
  { value: 'sds', label: 'Safety Data Sheet' },
  { value: 'other', label: 'Other' },
];

const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  sow: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  ccm: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  estimate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  inspection: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  certificate: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  photo: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  sds: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WPDocument {
  id: string;
  document_type: string;
  document_name: string;
  mfiles_id?: string;
  mfiles_url?: string;
  file_path?: string;
}

interface DocumentsSectionProps {
  workPackageId: string;
  documents: WPDocument[];
  readOnly?: boolean;
  onDocumentChanged?: () => void;
}

type AddMode = 'none' | 'file' | 'mfiles';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentsSection({
  workPackageId,
  documents,
  readOnly = false,
  onDocumentChanged,
}: DocumentsSectionProps) {
  const { getAccessToken } = useAuth();
  const toast = useToast();

  // Add document form state
  const [addMode, setAddMode] = useState<AddMode>('none');
  const [docType, setDocType] = useState<string>('other');
  const [docName, setDocName] = useState<string>('');
  const [filePath, setFilePath] = useState<string>('');
  const [mfilesId, setMfilesId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Remove confirm state
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // -----------------------------------------------------------------------
  // Add document
  // -----------------------------------------------------------------------

  const resetAddForm = () => {
    setAddMode('none');
    setDocType('other');
    setDocName('');
    setFilePath('');
    setMfilesId('');
  };

  const handleAddDocument = async () => {
    if (!docName.trim()) {
      toast.warning('Document name is required');
      return;
    }

    if (addMode === 'file' && !filePath.trim()) {
      toast.warning('File path is required');
      return;
    }

    if (addMode === 'mfiles' && !mfilesId.trim()) {
      toast.warning('M-Files ID is required');
      return;
    }

    setSubmitting(true);
    try {
      const token = getAccessToken();
      const endpoint =
        addMode === 'mfiles'
          ? `${API_BASE}/work-packages/${workPackageId}/documents/mfiles`
          : `${API_BASE}/work-packages/${workPackageId}/documents`;

      const body: Record<string, string> = {
        document_type: docType,
        document_name: docName.trim(),
      };

      if (addMode === 'mfiles') {
        body.mfiles_id = mfilesId.trim();
      } else {
        body.file_path = filePath.trim();
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to add document (${res.status})`);
      }

      toast.success('Document added successfully');
      resetAddForm();
      onDocumentChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add document');
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Remove document
  // -----------------------------------------------------------------------

  const handleRemoveDocument = async (docId: string) => {
    setRemoving(true);
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${API_BASE}/work-packages/${workPackageId}/documents/${docId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to remove document (${res.status})`);
      }

      toast.success('Document removed');
      setConfirmRemoveId(null);
      onDocumentChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove document');
    } finally {
      setRemoving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      {!readOnly && addMode === 'none' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddMode('file')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 border border-primary-200 dark:border-primary-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Document
          </button>
          <button
            type="button"
            onClick={() => setAddMode('mfiles')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            Link from M-Files
          </button>
        </div>
      )}

      {/* Add Document Form */}
      {addMode !== 'none' && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {addMode === 'mfiles' ? 'Link M-Files Document' : 'Add Document'}
            </h4>
            <button
              type="button"
              onClick={resetAddForm}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Document Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <div className="relative">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full appearance-none px-3 py-1.5 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Document Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Document name"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Conditional field based on mode */}
          {addMode === 'file' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                File Path <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="/path/to/document.pdf"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}

          {addMode === 'mfiles' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                M-Files ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={mfilesId}
                onChange={(e) => setMfilesId(e.target.value)}
                placeholder="e.g., MF-2024-00123"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={resetAddForm}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddDocument}
              disabled={submitting || !docName.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {addMode === 'mfiles' ? 'Link Document' : 'Add Document'}
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No documents attached yet.
          </p>
          {!readOnly && addMode === 'none' && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Use the buttons above to add documents or link from M-Files.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const typeColor =
              DOCUMENT_TYPE_COLORS[doc.document_type] || DOCUMENT_TYPE_COLORS.other;
            const isMFiles = !!doc.mfiles_id;
            const isConfirmingRemove = confirmRemoveId === doc.id;

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors group"
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <FileText className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {doc.document_name}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor}`}
                    >
                      {DOCUMENT_TYPE_OPTIONS.find((o) => o.value === doc.document_type)?.label ||
                        doc.document_type}
                    </span>
                    {isMFiles && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        M-Files
                      </span>
                    )}
                  </div>
                  {doc.mfiles_id && (
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                      ID: {doc.mfiles_id}
                    </div>
                  )}
                  {doc.file_path && !doc.mfiles_id && (
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[300px]">
                      {doc.file_path}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {/* Download / link */}
                  {doc.mfiles_url ? (
                    <a
                      href={doc.mfiles_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Open in M-Files"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : doc.file_path ? (
                    <a
                      href={doc.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  ) : null}

                  {/* Remove button */}
                  {!readOnly && (
                    <>
                      {isConfirmingRemove ? (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(doc.id)}
                            disabled={removing}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                          >
                            {removing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Confirm'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(null)}
                            disabled={removing}
                            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(doc.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
