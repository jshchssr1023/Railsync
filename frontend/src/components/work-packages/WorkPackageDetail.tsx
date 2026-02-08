'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  Package,
  FileText,
  BookOpen,
  FolderOpen,
  History,
  Clock,
  User,
  Building2,
  Train,
  Calendar,
  CheckCircle,
  Send,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import CCMSection from './CCMSection';
import DocumentsSection from './DocumentsSection';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  assembled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  issued: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  superseded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  assembled: 'Assembled',
  issued: 'Issued',
  superseded: 'Superseded',
};

type TabId = 'overview' | 'sow' | 'ccm' | 'documents' | 'history';

const TABS: { id: TabId; label: string; icon: typeof Package }[] = [
  { id: 'overview', label: 'Overview', icon: Package },
  { id: 'sow', label: 'Scope of Work', icon: FileText },
  { id: 'ccm', label: 'Care Manual', icon: BookOpen },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'history', label: 'History', icon: History },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SOWSnapshotItem {
  line_number: number;
  instruction_text: string;
  job_codes?: Array<{ code: string; description?: string }>;
}

interface AuditEvent {
  id: string;
  action: string;
  actor_email?: string;
  actor_name?: string;
  details?: string;
  timestamp: string;
  before_state?: string;
  after_state?: string;
}

interface CCMOverride {
  field_name: string;
  original_value: string;
  override_value: string;
  override_reason: string;
}

interface WPDocument {
  id: string;
  document_type: string;
  document_name: string;
  mfiles_id?: string;
  mfiles_url?: string;
  file_path?: string;
}

interface WorkPackageData {
  id: string;
  package_number: string;
  version: number;
  status: string;
  car_number: string;
  shop_code: string;
  shop_name?: string;
  lessee_code?: string;
  lessee_name?: string;
  special_instructions?: string;
  project_context?: {
    project_name?: string;
    project_type?: string;
    due_date?: string;
  };
  project_name?: string;
  project_type?: string;
  scope_of_work_id?: string;
  sow_snapshot?: {
    items: SOWSnapshotItem[];
  };
  ccm_snapshot?: Record<string, unknown>;
  billable_items_snapshot?: unknown;
  documents_snapshot?: unknown;
  documents: WPDocument[];
  ccm_overrides: CCMOverride[];
  audit_events: AuditEvent[];
  issued_at?: string;
  issued_by_email?: string;
  assembled_by_email?: string;
  created_by_email?: string;
  document_count: number;
  override_count: number;
}

interface WorkPackageDetailProps {
  id: string;
  onClose: () => void;
  onUpdate?: () => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkPackageDetail({
  id,
  onClose,
  onUpdate,
  readOnly = false,
}: WorkPackageDetailProps) {
  const { getAccessToken } = useAuth();
  const toast = useToast();

  const [wp, setWP] = useState<WorkPackageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [actionLoading, setActionLoading] = useState(false);

  // Issue confirmation dialog state
  const [showIssueConfirm, setShowIssueConfirm] = useState(false);

  // Reissue dialog state
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [reissueReason, setReissueReason] = useState('');

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchWorkPackage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/work-packages/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load work package (${res.status})`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to load work package');
      }

      setWP(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work package');
    } finally {
      setLoading(false);
    }
  }, [id, getAccessToken]);

  useEffect(() => {
    fetchWorkPackage();
  }, [fetchWorkPackage]);

  // -----------------------------------------------------------------------
  // Keyboard: Escape to close
  // -----------------------------------------------------------------------

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showIssueConfirm && !showReissueDialog) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, showIssueConfirm, showReissueDialog]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const performAction = async (
    endpoint: string,
    method: string = 'POST',
    body?: Record<string, unknown>
  ) => {
    setActionLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/work-packages/${id}/${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Action failed (${res.status})`);
      }

      const json = await res.json();
      if (json.data) {
        setWP(json.data);
      } else {
        await fetchWorkPackage();
      }

      onUpdate?.();
      return json;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      toast.error(msg);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssemble = async () => {
    try {
      await performAction('assemble');
      toast.success('Work package assembled successfully');
    } catch {
      // Error already handled in performAction
    }
  };

  const handleIssue = async () => {
    try {
      await performAction('issue');
      toast.success('Work package issued successfully');
      setShowIssueConfirm(false);
    } catch {
      // Error already handled in performAction
    }
  };

  const handleReissue = async () => {
    if (!reissueReason.trim()) {
      toast.warning('Please provide a reason for reissuance');
      return;
    }
    try {
      await performAction('reissue', 'POST', { reason: reissueReason.trim() });
      toast.success('Work package reissued successfully');
      setShowReissueDialog(false);
      setReissueReason('');
    } catch {
      // Error already handled in performAction
    }
  };

  // -----------------------------------------------------------------------
  // Tab renderers
  // -----------------------------------------------------------------------

  const renderOverview = () => {
    if (!wp) return null;
    const ctx = wp.project_context;

    return (
      <div className="space-y-6">
        {/* Project Info */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Project Information
          </h4>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
            <InfoRow label="Project Name" value={ctx?.project_name || wp.project_name || '--'} />
            <InfoRow label="Project Type" value={ctx?.project_type || wp.project_type || '--'} />
            <InfoRow label="Due Date" value={formatDate(ctx?.due_date)} />
          </div>
        </section>

        {/* Special Instructions */}
        {wp.special_instructions && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Special Instructions
            </h4>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                {wp.special_instructions}
              </p>
            </div>
          </section>
        )}

        {/* Contacts / Actors */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Contacts
          </h4>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
            <InfoRow
              label="Created By"
              value={wp.created_by_email || '--'}
              icon={<User className="w-3.5 h-3.5 text-gray-400" />}
            />
            <InfoRow
              label="Assembled By"
              value={wp.assembled_by_email || '--'}
              icon={<User className="w-3.5 h-3.5 text-gray-400" />}
            />
            <InfoRow
              label="Issued By"
              value={wp.issued_by_email || '--'}
              icon={<User className="w-3.5 h-3.5 text-gray-400" />}
            />
          </div>
        </section>

        {/* Key Dates */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Key Dates
          </h4>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
            <InfoRow
              label="Issued At"
              value={formatDateTime(wp.issued_at)}
              icon={<Calendar className="w-3.5 h-3.5 text-gray-400" />}
            />
          </div>
        </section>

        {/* Summary Counts */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Composition
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="Documents" value={wp.document_count} icon={<FolderOpen className="w-4 h-4" />} />
            <SummaryCard label="CCM Overrides" value={wp.override_count} icon={<BookOpen className="w-4 h-4" />} />
          </div>
        </section>
      </div>
    );
  };

  const renderScopeOfWork = () => {
    if (!wp) return null;

    if (wp.status === 'draft') {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Scope of Work will be captured at issuance.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Assemble and issue this work package to snapshot the SOW.
          </p>
        </div>
      );
    }

    const items = wp.sow_snapshot?.items || [];

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No scope of work items in snapshot.
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-16">
                Line
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Instruction
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-48">
                Job Codes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                  {item.line_number}
                </td>
                <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100">
                  {item.instruction_text}
                </td>
                <td className="py-2.5 px-3">
                  {item.job_codes && item.job_codes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {item.job_codes.map((jc, jIdx) => (
                        <span
                          key={jIdx}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          title={jc.description}
                        >
                          {jc.code}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCCMTab = () => {
    if (!wp) return null;

    if (wp.status === 'draft' && !wp.ccm_snapshot) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Care & Cleaning Manual data will be captured at issuance.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            CCM overrides can be added after creation.
          </p>
        </div>
      );
    }

    return (
      <CCMSection
        workPackageId={wp.id}
        ccmSnapshot={wp.ccm_snapshot}
        ccmOverrides={wp.ccm_overrides}
        isIssued={wp.status === 'issued' || wp.status === 'superseded'}
        readOnly={readOnly}
        onOverrideAdded={fetchWorkPackage}
      />
    );
  };

  const renderDocuments = () => {
    if (!wp) return null;

    return (
      <DocumentsSection
        workPackageId={wp.id}
        documents={wp.documents || []}
        readOnly={readOnly}
        onDocumentChanged={fetchWorkPackage}
      />
    );
  };

  const renderHistory = () => {
    if (!wp) return null;
    const events = wp.audit_events || [];

    if (events.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No history events recorded yet.
          </p>
        </div>
      );
    }

    return (
      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[9px] top-3 bottom-3 w-0.5 bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-4">
          {events.map((event, idx) => (
            <div key={event.id || idx} className="relative flex items-start gap-3 pl-0">
              {/* Dot */}
              <div
                className={`relative z-10 w-5 h-5 rounded-full flex-shrink-0 mt-0.5 ring-2 ring-white dark:ring-gray-800 flex items-center justify-center ${
                  idx === 0
                    ? 'bg-primary-500 dark:bg-primary-400'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-white dark:bg-gray-800" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatFieldLabel(event.action)}
                  </span>
                  {event.after_state && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[event.after_state] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {STATUS_LABELS[event.after_state] || event.after_state}
                    </span>
                  )}
                </div>

                {event.details && (
                  <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                    {event.details}
                  </p>
                )}

                <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                  {event.actor_email && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {event.actor_name || event.actor_email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(event.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Action buttons
  // -----------------------------------------------------------------------

  const renderActions = () => {
    if (readOnly || !wp) return null;

    return (
      <div className="flex items-center gap-2">
        {wp.status === 'draft' && (
          <button
            onClick={handleAssemble}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            Assemble
          </button>
        )}

        {wp.status === 'assembled' && (
          <button
            onClick={() => setShowIssueConfirm(true)}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Issue
          </button>
        )}

        {wp.status === 'issued' && (
          <button
            onClick={() => setShowReissueDialog(true)}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Reissue
          </button>
        )}
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Work Package Detail">
      {/* Dark overlay */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white dark:bg-gray-800 shadow-xl overflow-y-auto flex flex-col">
        {/* ---------- Header ---------- */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="min-w-0 flex-1">
              {loading ? (
                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : wp ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {wp.package_number}
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                    v{wp.version}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[wp.status] || STATUS_COLORS.draft}`}>
                    {STATUS_LABELS[wp.status] || wp.status}
                  </span>
                </div>
              ) : (
                <h2 className="text-lg font-bold text-gray-500 dark:text-gray-400">Work Package</h2>
              )}
            </div>

            <div className="flex items-center gap-2 ml-4">
              {renderActions()}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                aria-label="Close panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader: car, shop, lessee */}
          {wp && !loading && (
            <div className="grid grid-cols-3 gap-0 border-t border-gray-200 dark:border-gray-700">
              <div className="px-4 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Car</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-center gap-1">
                  <Train className="w-3.5 h-3.5 text-gray-400" />
                  {wp.car_number}
                </div>
              </div>
              <div className="px-4 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shop</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {wp.shop_name || wp.shop_code}
                </div>
              </div>
              <div className="px-4 py-2 text-center">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lessee</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {wp.lessee_name || wp.lessee_code || '--'}
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          {wp && !loading && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-4">
              <nav className="flex gap-1 -mb-px overflow-x-auto" role="tablist">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                        isActive
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {tab.id === 'documents' && wp.document_count > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                          {wp.document_count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* ---------- Content ---------- */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading work package...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>
              <button
                onClick={fetchWorkPackage}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : wp ? (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'sow' && renderScopeOfWork()}
              {activeTab === 'ccm' && renderCCMTab()}
              {activeTab === 'documents' && renderDocuments()}
              {activeTab === 'history' && renderHistory()}
            </>
          ) : null}
        </div>
      </div>

      {/* ---------- Issue Confirmation Dialog ---------- */}
      {showIssueConfirm && wp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowIssueConfirm(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Issue Work Package
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    This will finalize and issue the work package. All snapshots (SOW, CCM, documents) will be captured at this point.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Package</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{wp.package_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Car</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{wp.car_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Shop</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{wp.shop_name || wp.shop_code}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Documents</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{wp.document_count}</span>
                </div>
              </div>

              <div className="mt-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>Issuing will lock the current version and send to the shop.</span>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setShowIssueConfirm(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleIssue}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Issuing...
                    </span>
                  ) : (
                    'Confirm Issue'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Reissue Dialog ---------- */}
      {showReissueDialog && wp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowReissueDialog(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Reissue Work Package
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    This will supersede the current version and create a new issued version. Please provide a reason for reissuance.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason for Reissuance <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reissueReason}
                  onChange={(e) => setReissueReason(e.target.value)}
                  placeholder="Describe why this work package needs to be reissued..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowReissueDialog(false);
                    setReissueReason('');
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReissue}
                  disabled={actionLoading || !reissueReason.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Reissuing...
                    </span>
                  ) : (
                    'Confirm Reissue'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right truncate max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 flex items-center gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}
