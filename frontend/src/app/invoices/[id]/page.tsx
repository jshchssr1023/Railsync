'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  ChevronRight,
  User,
  X,
  Loader2,
} from 'lucide-react';

// ==============================================================================
// Types
// ==============================================================================

interface InvoiceLineItem {
  id: string;
  line_number: number;
  car_number?: string;
  brc_number?: string;
  job_code?: string;
  why_made_code?: string;
  labor_amount: number;
  material_amount: number;
  total_amount: number;
  description?: string;
  match_status: string;
  matched_allocation_id?: string;
  match_confidence?: number;
  match_notes?: string;
  manually_verified: boolean;
  verified_by?: string;
  verified_at?: string;
}

interface BrcMatch {
  id: string;
  allocation_id: string;
  brc_number?: string;
  brc_total?: number;
  invoice_amount?: number;
  match_type: string;
  allocation_car_number?: string;
  allocation_shop_code?: string;
  allocation_actual_cost?: number;
  allocation_job_codes?: { code: string; amount: number }[];
}

interface InvoiceComparison {
  invoice: {
    id: string;
    invoice_number: string;
    vendor_code?: string;
    shop_code?: string;
    shop_name?: string;
    invoice_date: string;
    received_date: string;
    invoice_total: number;
    brc_total?: number;
    variance_amount?: number;
    variance_pct?: number;
    status: string;
    approval_notes?: string;
    reviewed_by_name?: string;
    reviewed_at?: string;
    original_filename?: string;
    file_format?: string;
  };
  line_items: InvoiceLineItem[];
  brc_matches: BrcMatch[];
  summary: {
    invoice_total: number;
    brc_total: number;
    variance_amount: number;
    variance_pct: number;
    within_tolerance: boolean;
    exact_matches: number;
    close_matches: number;
    unmatched: number;
  };
}

// Invoice Case Workflow Types (new)
interface InvoiceCase {
  id: string;
  case_number: string;
  invoice_type: 'SHOP' | 'MRU';
  workflow_state: string;
  previous_state?: string;
  state_changed_at: string;
  assigned_admin_id?: string;
  assigned_admin_name?: string;
  vendor_name?: string;
  shop_code?: string;
  invoice_number?: string;
  invoice_date?: string;
  total_amount?: number;
  car_marks?: string[];
  lessee?: string;
  special_lessee_approval_confirmed: boolean;
  fms_shopping_id?: string;
}

interface ValidationError {
  code: string;
  message: string;
  decision: 'BLOCK' | 'WARN' | 'PASS';
  owningRole: string;
  fixPath?: string;
}

interface ValidationResult {
  caseId: string;
  targetState: string;
  canTransition: boolean;
  blockingErrors: ValidationError[];
  warnings: ValidationError[];
  passedChecks: string[];
  validatedAt: string;
}

interface Attachment {
  id: string;
  attachment_type: 'PDF' | 'TXT' | 'SUPPORT' | 'BRC';
  filename_original: string;
  filename_canonical: string;
  file_size_bytes?: number;
  uploaded_at: string;
  is_verified: boolean;
}

interface AuditEvent {
  id: string;
  event_timestamp: string;
  actor_email?: string;
  actor_role?: string;
  action: string;
  before_state?: string;
  after_state?: string;
  notes?: string;
}

// ==============================================================================
// Constants
// ==============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  auto_approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  manual_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  sent_to_sap: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const MATCH_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  exact_match: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  close_match: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  no_match: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  manually_matched: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const WORKFLOW_STATES = [
  'RECEIVED',
  'ASSIGNED',
  'READY_FOR_IMPORT',
  'IMPORTED',
  'ADMIN_REVIEW',
  'SUBMITTED',
  'APPROVER_REVIEW',
  'APPROVED',
  'BILLING_REVIEW',
  'BILLING_APPROVED',
  'SAP_STAGED',
  'SAP_POSTED',
  'PAID',
  'CLOSED',
];

// ==============================================================================
// Component
// ==============================================================================

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getAccessToken, isAuthenticated } = useAuth();
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<'comparison' | 'workflow' | 'attachments' | 'audit'>('comparison');
  const [comparison, setComparison] = useState<InvoiceComparison | null>(null);
  const [invoiceCase, setInvoiceCase] = useState<InvoiceCase | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const getToken = () => getAccessToken() || localStorage.getItem('railsync_access_token');

  // ==============================================================================
  // Data Fetching
  // ==============================================================================

  const fetchComparison = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/invoices/${id}/comparison`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.invoice) {
        setComparison(data);
      }
    } catch (err) {
      console.error('Failed to fetch invoice comparison:', err);
    }
  }, [id]);

  const fetchInvoiceCase = useCallback(async () => {
    try {
      // Try to fetch by case ID or linked invoice ID
      const res = await fetch(`${API_URL}/invoice-cases/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setInvoiceCase(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch invoice case:', err);
    }
  }, [id]);

  const fetchAttachments = useCallback(async () => {
    if (!invoiceCase) return;
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/attachments`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setAttachments(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
    }
  }, [invoiceCase]);

  const fetchAuditEvents = useCallback(async () => {
    if (!invoiceCase) return;
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/audit-events`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setAuditEvents(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit events:', err);
    }
  }, [invoiceCase]);

  const fetchValidation = useCallback(async (targetState: string) => {
    if (!invoiceCase) return;
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ target_state: targetState }),
      });
      const data = await res.json();
      if (data.success) {
        setValidation(data.data);
      }
    } catch (err) {
      console.error('Failed to validate:', err);
    }
  }, [invoiceCase]);

  useEffect(() => {
    if (isAuthenticated && id) {
      setLoading(true);
      Promise.all([fetchComparison(), fetchInvoiceCase()]).finally(() => setLoading(false));
    }
  }, [isAuthenticated, id, fetchComparison, fetchInvoiceCase]);

  useEffect(() => {
    if (invoiceCase) {
      fetchAttachments();
      fetchAuditEvents();
    }
  }, [invoiceCase, fetchAttachments, fetchAuditEvents]);

  // ==============================================================================
  // Actions
  // ==============================================================================

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this invoice?')) return;

    setApproving(true);
    try {
      const res = await fetch(`${API_URL}/invoices/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.id) {
        fetchComparison();
        alert('Invoice approved successfully');
      } else {
        alert(data.error || 'Failed to approve invoice');
      }
    } catch (err) {
      console.error('Approval failed:', err);
      alert('Failed to approve invoice');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setRejecting(true);
    try {
      const res = await fetch(`${API_URL}/invoices/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ notes: rejectReason }),
      });
      const data = await res.json();

      if (data.id) {
        setShowRejectModal(false);
        setRejectReason('');
        fetchComparison();
        alert('Invoice rejected');
      } else {
        alert(data.error || 'Failed to reject invoice');
      }
    } catch (err) {
      console.error('Rejection failed:', err);
      alert('Failed to reject invoice');
    } finally {
      setRejecting(false);
    }
  };

  const handleRematch = async () => {
    if (!confirm('Re-run matching against BRC data?')) return;

    setRematching(true);
    try {
      const res = await fetch(`${API_URL}/invoices/${id}/rematch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await res.json();

      if (data.invoice) {
        fetchComparison();
        alert('Matching complete');
      } else {
        alert(data.error || 'Matching failed');
      }
    } catch (err) {
      console.error('Rematch failed:', err);
      alert('Failed to rematch');
    } finally {
      setRematching(false);
    }
  };

  const handleTransition = async (targetState: string) => {
    if (!invoiceCase) return;

    setTransitioning(true);
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ target_state: targetState }),
      });
      const data = await res.json();

      if (data.success) {
        setInvoiceCase(data.data);
        fetchAuditEvents();
        setValidation(null);
      } else {
        setValidation(data.validation);
        alert(data.error || 'Transition blocked');
      }
    } catch (err) {
      console.error('Transition failed:', err);
      alert('Failed to transition state');
    } finally {
      setTransitioning(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !invoiceCase) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        fetchAttachments();
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload file');
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!invoiceCase || !confirm('Delete this attachment?')) return;

    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.success) {
        fetchAttachments();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // ==============================================================================
  // Helpers
  // ==============================================================================

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const getStateIndex = (state: string) => WORKFLOW_STATES.indexOf(state);

  // ==============================================================================
  // Render
  // ==============================================================================

  if (!isAuthenticated) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Please log in to view invoice details.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 mx-auto text-blue-600" aria-hidden="true" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Invoice not found</p>
          <button onClick={() => router.push('/invoices')} className="mt-4 text-blue-600 hover:underline">
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  const { invoice, line_items, brc_matches, summary } = comparison;
  const canApprove = ['pending', 'manual_review', 'auto_approved'].includes(invoice.status);
  const canReject = ['pending', 'manual_review'].includes(invoice.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/invoices')}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 mb-2"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Invoices
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Invoice {invoice.invoice_number}
            {invoiceCase && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                Case #{invoiceCase.case_number}
              </span>
            )}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {invoice.shop_name || invoice.shop_code || 'Unknown Shop'} &bull; {formatDate(invoice.invoice_date)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 text-sm rounded-full ${STATUS_COLORS[invoice.status]}`}>
            {invoice.status.replace(/_/g, ' ').toUpperCase()}
          </span>

          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {approving ? 'Approving...' : 'Approve'}
            </button>
          )}

          {canReject && (
            <button
              onClick={() => setShowRejectModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reject
            </button>
          )}

          <button
            onClick={handleRematch}
            disabled={rematching}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {rematching ? 'Matching...' : 'Re-Match'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4">
          {[
            { id: 'comparison', label: 'Line Items', icon: FileText },
            { id: 'workflow', label: 'Workflow', icon: RefreshCw },
            { id: 'attachments', label: 'Attachments', icon: Upload },
            { id: 'audit', label: 'Audit Trail', icon: Clock },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'attachments' && attachments.length > 0 && (
                <span className="bg-gray-100 dark:bg-gray-700 text-xs px-1.5 py-0.5 rounded">
                  {attachments.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'comparison' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Invoice Total</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(summary.invoice_total)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">BRC Total</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(summary.brc_total)}
              </div>
            </div>

            <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border ${summary.within_tolerance ? 'border-green-300 dark:border-green-700' : 'border-red-300 dark:border-red-700'}`}>
              <div className="text-sm text-gray-500 dark:text-gray-400">Variance</div>
              <div className={`text-2xl font-bold mt-1 ${summary.within_tolerance ? 'text-green-600' : 'text-red-600'}`}>
                {summary.variance_pct >= 0 ? '+' : ''}{summary.variance_pct.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">{formatCurrency(summary.variance_amount)}</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Matching</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-green-600 font-semibold">{summary.exact_matches} exact</span>
                <span className="text-amber-600 font-semibold">{summary.close_matches} close</span>
                <span className="text-red-600 font-semibold">{summary.unmatched} unmatched</span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Line Items Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Car</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Why Made</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoice Amt</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">BRC Amt</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Match</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {line_items.map((item) => {
                    const match = brc_matches.find(m => m.allocation_id === item.matched_allocation_id);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-gray-500">{item.line_number}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.car_number || '-'}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.job_code || '-'}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.why_made_code || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                          {formatCurrency(item.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                          {match ? formatCurrency(match.brc_total || match.allocation_actual_cost || 0) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${MATCH_STATUS_COLORS[item.match_status]}`}>
                            {item.match_status.replace(/_/g, ' ')}
                          </span>
                          {item.match_confidence && (
                            <div className="text-xs text-gray-500 mt-1">{item.match_confidence}%</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                          {item.match_notes || item.description || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'workflow' && invoiceCase && (
        <div className="space-y-6">
          {/* State Machine Progress */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Workflow Progress</h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-4">
              {WORKFLOW_STATES.map((state, index) => {
                const currentIndex = getStateIndex(invoiceCase.workflow_state);
                const isPast = index < currentIndex;
                const isCurrent = index === currentIndex;
                return (
                  <div key={state} className="flex items-center">
                    <div
                      className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : isPast
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {state.replace(/_/g, ' ')}
                    </div>
                    {index < WORKFLOW_STATES.length - 1 && (
                      <ChevronRight className={`w-4 h-4 mx-1 ${isPast ? 'text-green-500' : 'text-gray-300'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Panel */}
          {validation && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Validation Result
                <span className={`ml-2 text-sm font-normal ${validation.canTransition ? 'text-green-600' : 'text-red-600'}`}>
                  {validation.canTransition ? 'Can proceed' : 'Blocked'}
                </span>
              </h3>

              {validation.blockingErrors.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-medium text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Blocking Errors
                  </h4>
                  {validation.blockingErrors.map((error, i) => (
                    <div key={i} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <div className="font-medium text-red-800 dark:text-red-300">{error.message}</div>
                      <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                        Owner: {error.owningRole} | Fix: {error.fixPath || 'Contact administrator'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Warnings
                  </h4>
                  {validation.warnings.map((warning, i) => (
                    <div key={i} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <div className="text-amber-800 dark:text-amber-300">{warning.message}</div>
                    </div>
                  ))}
                </div>
              )}

              {validation.passedChecks.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-green-600 flex items-center gap-1 mb-2">
                    <CheckCircle className="w-4 h-4" /> Passed Checks
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {validation.passedChecks.map((check, i) => (
                      <span key={i} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded">
                        {check}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transition Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">State Transitions</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fetchValidation('ASSIGNED')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Validate → ASSIGNED
              </button>
              <button
                onClick={() => handleTransition('ASSIGNED')}
                disabled={transitioning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {transitioning ? 'Processing...' : 'Transition → ASSIGNED'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'attachments' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Attachments</h3>
            <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {uploadingFile ? 'Uploading...' : 'Upload File'}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
            </label>
          </div>

          {attachments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No attachments yet</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {attachments.map((att) => (
                <div key={att.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{att.filename_original}</div>
                      <div className="text-xs text-gray-500">
                        {att.attachment_type} &bull; {att.file_size_bytes ? `${(att.file_size_bytes / 1024).toFixed(1)}KB` : ''} &bull; {formatDateTime(att.uploaded_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {att.is_verified && (
                      <span className="text-green-600 text-xs flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    )}
                    <a
                      href={`${API_URL}/invoice-cases/${invoiceCase?.id}/attachments/${att.id}/download`}
                      className="p-2 text-gray-400 hover:text-blue-600"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Audit Trail</h3>
          </div>

          {auditEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No audit events yet</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {auditEvents.map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{event.action.replace(/_/g, ' ')}</div>
                      {event.before_state && event.after_state && (
                        <div className="text-sm text-gray-500 mt-1">
                          {event.before_state} → {event.after_state}
                        </div>
                      )}
                      {event.notes && <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.notes}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">{formatDateTime(event.event_timestamp)}</div>
                      {event.actor_email && (
                        <div className="text-xs text-gray-400 flex items-center justify-end gap-1 mt-1">
                          <User className="w-3 h-3" /> {event.actor_email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reject Invoice</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for rejecting this invoice.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? 'Rejecting...' : 'Reject Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
