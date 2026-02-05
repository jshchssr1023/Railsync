'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  AlertTriangle, CheckCircle, Clock, FileText, Upload, Download,
  Trash2, ChevronRight, User, Loader2, ShieldCheck, XOctagon,
  RefreshCw, UserPlus, UserMinus, Info,
} from 'lucide-react';

// ==============================================================================
// Types
// ==============================================================================

interface InvoiceCase {
  id: string;
  case_number: string;
  invoice_type: 'SHOP' | 'MRU';
  workflow_state: string;
  previous_state?: string;
  state_changed_at?: string;
  assigned_admin_id?: string;
  assigned_admin_name?: string;
  assigned_admin_email?: string;
  vendor_name?: string;
  shop_code?: string;
  invoice_number?: string;
  invoice_date?: string;
  total_amount?: number;
  currency?: string;
  car_marks?: string[];
  lessee?: string;
  special_lessee_approval_confirmed: boolean;
  special_lessee_approved_by?: string;
  special_lessee_approved_at?: string;
  fms_shopping_id?: string;
  fms_workflow_id?: string;
  received_at: string;
  created_at: string;
  updated_at: string;
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
  verified_by?: string;
  verified_at?: string;
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

const SPECIAL_LESSEES = ['EXXON', 'IMPOIL', 'MARATHON'];

const WORKFLOW_STATES = [
  'RECEIVED', 'ASSIGNED', 'READY_FOR_IMPORT', 'IMPORTED', 'ADMIN_REVIEW',
  'SUBMITTED', 'APPROVER_REVIEW', 'APPROVED', 'BILLING_REVIEW',
  'BILLING_APPROVED', 'SAP_STAGED', 'SAP_POSTED', 'PAID', 'CLOSED',
];

// Valid next states from each state (derived from invoice_state_transitions seed data)
const NEXT_STATES: Record<string, string[]> = {
  RECEIVED:                       ['ASSIGNED', 'BLOCKED'],
  ASSIGNED:                       ['WAITING_ON_SHOPPING', 'WAITING_ON_CUSTOMER_APPROVAL', 'READY_FOR_IMPORT', 'BLOCKED'],
  WAITING_ON_SHOPPING:            ['ASSIGNED', 'READY_FOR_IMPORT', 'BLOCKED'],
  WAITING_ON_CUSTOMER_APPROVAL:   ['ASSIGNED', 'READY_FOR_IMPORT', 'BLOCKED'],
  READY_FOR_IMPORT:               ['IMPORTED', 'ASSIGNED', 'BLOCKED'],
  IMPORTED:                       ['ADMIN_REVIEW', 'BLOCKED'],
  ADMIN_REVIEW:                   ['SUBMITTED', 'ASSIGNED', 'BLOCKED'],
  SUBMITTED:                      ['APPROVER_REVIEW', 'BLOCKED'],
  APPROVER_REVIEW:                ['APPROVED', 'ADMIN_REVIEW', 'BLOCKED'],
  APPROVED:                       ['BILLING_REVIEW', 'BLOCKED'],
  BILLING_REVIEW:                 ['BILLING_APPROVED', 'APPROVED', 'BLOCKED'],
  BILLING_APPROVED:               ['SAP_STAGED', 'BLOCKED'],
  SAP_STAGED:                     ['SAP_POSTED', 'BLOCKED'],
  SAP_POSTED:                     ['PAID', 'BLOCKED'],
  PAID:                           ['CLOSED'],
  BLOCKED:                        ['ASSIGNED'],
  CLOSED:                         [],
};

const STATE_COLORS: Record<string, string> = {
  RECEIVED:                       'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  ASSIGNED:                       'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  WAITING_ON_SHOPPING:            'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  WAITING_ON_CUSTOMER_APPROVAL:   'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  READY_FOR_IMPORT:               'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  IMPORTED:                       'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  ADMIN_REVIEW:                   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  SUBMITTED:                      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  APPROVER_REVIEW:                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED:                       'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  BILLING_REVIEW:                 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
  BILLING_APPROVED:               'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  SAP_STAGED:                     'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  SAP_POSTED:                     'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  PAID:                           'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  CLOSED:                         'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  BLOCKED:                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const STATE_LABELS: Record<string, string> = {
  RECEIVED: 'Received', ASSIGNED: 'Assigned',
  WAITING_ON_SHOPPING: 'Waiting on Shopping', WAITING_ON_CUSTOMER_APPROVAL: 'Customer Approval',
  READY_FOR_IMPORT: 'Ready for Import', IMPORTED: 'Imported',
  ADMIN_REVIEW: 'Admin Review', SUBMITTED: 'Submitted',
  APPROVER_REVIEW: 'Approver Review', APPROVED: 'Approved',
  BILLING_REVIEW: 'Billing Review', BILLING_APPROVED: 'Billing Approved',
  SAP_STAGED: 'SAP Staged', SAP_POSTED: 'SAP Posted',
  PAID: 'Paid', CLOSED: 'Closed', BLOCKED: 'Blocked',
};

// ==============================================================================
// Helpers
// ==============================================================================

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ==============================================================================
// Component
// ==============================================================================

export default function InvoiceCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, getAccessToken, isAuthenticated } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- State ----------
  const [activeTab, setActiveTab] = useState<'overview' | 'attachments' | 'audit'>('overview');
  const [invoiceCase, setInvoiceCase] = useState<InvoiceCase | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [transitionNotes, setTransitionNotes] = useState('');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'default' | 'danger' | 'warning';
    summaryItems?: { label: string; value: string }[];
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', variant: 'default', onConfirm: () => {} });

  const getToken = () => getAccessToken() || localStorage.getItem('railsync_access_token');

  // ==============================================================================
  // Data Fetching
  // ==============================================================================

  const fetchCase = useCallback(async () => {
    try {
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
  }, [invoiceCase?.id]);

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
  }, [invoiceCase?.id]);

  useEffect(() => {
    if (isAuthenticated && id) {
      setLoading(true);
      fetchCase().finally(() => setLoading(false));
    }
  }, [isAuthenticated, id, fetchCase]);

  useEffect(() => {
    if (invoiceCase) {
      fetchAttachments();
      fetchAuditEvents();
    }
  }, [invoiceCase?.id, fetchAttachments, fetchAuditEvents]);

  // ==============================================================================
  // Actions
  // ==============================================================================

  const handleValidate = async (targetState: string) => {
    if (!invoiceCase) return;
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ target_state: targetState }),
      });
      const data = await res.json();
      if (data.success) {
        setValidation(data.data);
      } else {
        toast.error( data.error || 'Validation failed');
      }
    } catch (err) {
      console.error('Validation failed:', err);
      toast.error( 'Failed to validate');
    }
  };

  const confirmTransition = (targetState: string) => {
    if (!invoiceCase) return;
    const isBlock = targetState === 'BLOCKED';
    setConfirmDialog({
      open: true,
      title: isBlock ? 'Block Case' : `Transition to ${STATE_LABELS[targetState] || targetState}`,
      description: isBlock
        ? 'This will block the case and halt all processing until resolved.'
        : `Advance case ${invoiceCase.case_number} to the next workflow state.`,
      variant: isBlock ? 'danger' : 'warning',
      summaryItems: [
        { label: 'Case', value: invoiceCase.case_number },
        { label: 'Current State', value: STATE_LABELS[invoiceCase.workflow_state] || invoiceCase.workflow_state },
        { label: 'Target State', value: STATE_LABELS[targetState] || targetState },
        ...(transitionNotes ? [{ label: 'Notes', value: transitionNotes }] : []),
      ],
      onConfirm: () => executeTransition(targetState),
    });
  };

  const executeTransition = async (targetState: string) => {
    if (!invoiceCase) return;
    setConfirmDialog(d => ({ ...d, open: false }));
    setTransitioning(true);
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ target_state: targetState, notes: transitionNotes || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setInvoiceCase(data.data);
        setValidation(data.validation || null);
        setTransitionNotes('');
        fetchAuditEvents();
        toast.success( `Transitioned to ${STATE_LABELS[targetState] || targetState}`);
      } else {
        setValidation(data.validation || null);
        toast.error( data.error || 'Transition blocked');
      }
    } catch (err) {
      console.error('Transition failed:', err);
      toast.error( 'Failed to transition state');
    } finally {
      setTransitioning(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!invoiceCase || !user?.id) return;
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ admin_id: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        setInvoiceCase(data.data);
        fetchAuditEvents();
        toast.success( 'Case assigned to you');
      } else {
        toast.error( data.error || 'Failed to assign case');
      }
    } catch (err) {
      console.error('Assign failed:', err);
      toast.error( 'Failed to assign case');
    }
  };

  const handleUnassign = () => {
    if (!invoiceCase) return;
    setConfirmDialog({
      open: true,
      title: 'Unassign Case',
      description: `Remove the current assignment from case ${invoiceCase.case_number}?`,
      variant: 'warning',
      summaryItems: [
        { label: 'Case', value: invoiceCase.case_number },
        { label: 'Current Assignee', value: invoiceCase.assigned_admin_name || invoiceCase.assigned_admin_email || 'Unknown' },
      ],
      onConfirm: executeUnassign,
    });
  };

  const executeUnassign = async () => {
    if (!invoiceCase) return;
    setConfirmDialog(d => ({ ...d, open: false }));
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/assign`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setInvoiceCase(data.data);
        fetchAuditEvents();
        toast.success( 'Case unassigned');
      }
    } catch (err) {
      console.error('Unassign failed:', err);
      toast.error( 'Failed to unassign case');
    }
  };

  const handleSpecialLesseeApproval = async () => {
    if (!invoiceCase) return;
    setConfirmDialog({
      open: true,
      title: 'Confirm Special Lessee Approval',
      description: 'Confirm that Maintenance has approved processing for this special lessee. This action is recorded in the audit trail.',
      variant: 'warning',
      summaryItems: [
        { label: 'Case', value: invoiceCase.case_number },
        { label: 'Lessee', value: invoiceCase.lessee || 'Unknown' },
      ],
      onConfirm: executeSpecialLesseeApproval,
    });
  };

  const executeSpecialLesseeApproval = async () => {
    if (!invoiceCase) return;
    setConfirmDialog(d => ({ ...d, open: false }));
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/special-lessee-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ notes: 'Maintenance confirmation received' }),
      });
      const data = await res.json();
      if (data.success) {
        setInvoiceCase(data.data);
        fetchAuditEvents();
        toast.success( 'Special lessee approval confirmed');
      } else {
        toast.error( data.error || 'Failed to confirm approval');
      }
    } catch (err) {
      console.error('Special lessee approval failed:', err);
      toast.error( 'Failed to confirm approval');
    }
  };

  // ---------- Attachments ----------

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
        toast.success( `Uploaded ${file.name}`);
      } else {
        toast.error( data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error( 'Failed to upload file');
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  const handleDeleteAttachment = (att: Attachment) => {
    if (!invoiceCase) return;
    setConfirmDialog({
      open: true,
      title: 'Delete Attachment',
      description: 'This will permanently remove the file. This action cannot be undone.',
      variant: 'danger',
      summaryItems: [
        { label: 'File', value: att.filename_original },
        { label: 'Type', value: att.attachment_type },
      ],
      onConfirm: () => executeDeleteAttachment(att.id),
    });
  };

  const executeDeleteAttachment = async (attachmentId: string) => {
    if (!invoiceCase) return;
    setConfirmDialog(d => ({ ...d, open: false }));
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchAttachments();
        toast.success( 'Attachment deleted');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error( 'Failed to delete attachment');
    }
  };

  const handleVerifyAttachment = async (attachmentId: string) => {
    if (!invoiceCase) return;
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/attachments/${attachmentId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchAttachments();
        toast.success( 'Attachment verified');
      }
    } catch (err) {
      console.error('Verify failed:', err);
      toast.error( 'Failed to verify attachment');
    }
  };

  // ==============================================================================
  // Computed
  // ==============================================================================

  const getStateIndex = (state: string) => WORKFLOW_STATES.indexOf(state);
  const currentNextStates = invoiceCase ? (NEXT_STATES[invoiceCase.workflow_state] || []) : [];
  const isSpecialLessee = invoiceCase?.lessee && SPECIAL_LESSEES.includes(invoiceCase.lessee.toUpperCase());
  const needsSpecialApproval = isSpecialLessee && !invoiceCase?.special_lessee_approval_confirmed;

  // ==============================================================================
  // Render
  // ==============================================================================

  if (!isAuthenticated) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Please log in to view case details.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 mx-auto text-blue-600" aria-hidden="true" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading case...</p>
        </div>
      </div>
    );
  }

  if (!invoiceCase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Invoice case not found</p>
          <button onClick={() => router.push('/invoice-cases')} className="mt-4 text-blue-600 hover:underline">
            Back to Case Queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/invoice-cases')}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 mb-2"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Case Queue
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            Case {invoiceCase.case_number}
            <span className={`px-3 py-1 text-sm rounded-full ${STATE_COLORS[invoiceCase.workflow_state] || 'bg-gray-100'}`}>
              {STATE_LABELS[invoiceCase.workflow_state] || invoiceCase.workflow_state}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded font-medium ${
              invoiceCase.invoice_type === 'SHOP'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400'
            }`}>
              {invoiceCase.invoice_type}
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {invoiceCase.vendor_name || 'No vendor'}
            {invoiceCase.shop_code && <> &bull; {invoiceCase.shop_code}</>}
            {invoiceCase.invoice_date && <> &bull; {formatDate(invoiceCase.invoice_date)}</>}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4">
          {[
            { id: 'overview', label: 'Overview', icon: Info },
            { id: 'attachments', label: 'Attachments', icon: Upload },
            { id: 'audit', label: 'Audit Trail', icon: Clock },
          ].map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId as typeof activeTab)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tabId
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {tabId === 'attachments' && attachments.length > 0 && (
                <span className="bg-gray-100 dark:bg-gray-700 text-xs px-1.5 py-0.5 rounded">
                  {attachments.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ================================================================ */}
      {/* OVERVIEW TAB                                                      */}
      {/* ================================================================ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Special Lessee Warning */}
          {needsSpecialApproval && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-amber-800 dark:text-amber-300">Special Lessee Requires Maintenance Approval</h4>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  Lessee <strong>{invoiceCase.lessee}</strong> is flagged as a special lessee. Maintenance must confirm approval before this case can advance past the import stage.
                </p>
              </div>
              <button
                onClick={handleSpecialLesseeApproval}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium flex-shrink-0"
              >
                <ShieldCheck className="w-4 h-4 inline mr-1" />
                Confirm Approval
              </button>
            </div>
          )}

          {/* Case Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white">Case Details</h3>
            </div>
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
              {[
                { label: 'Case Number', value: invoiceCase.case_number },
                { label: 'Invoice Type', value: invoiceCase.invoice_type },
                { label: 'Vendor', value: invoiceCase.vendor_name || '-' },
                { label: 'Shop Code', value: invoiceCase.shop_code || '-' },
                { label: 'Invoice Number', value: invoiceCase.invoice_number || '-' },
                { label: 'Invoice Date', value: invoiceCase.invoice_date ? formatDate(invoiceCase.invoice_date) : '-' },
                { label: 'Total Amount', value: invoiceCase.total_amount != null ? formatCurrency(invoiceCase.total_amount) : '-' },
                { label: 'Currency', value: invoiceCase.currency || 'USD' },
                { label: 'Lessee', value: invoiceCase.lessee || '-' },
                { label: 'Car Marks', value: invoiceCase.car_marks?.length ? invoiceCase.car_marks.join(', ') : '-' },
                { label: 'FMS Shopping ID', value: invoiceCase.fms_shopping_id || '-' },
                { label: 'Received At', value: formatDateTime(invoiceCase.received_at) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{value}</dd>
                </div>
              ))}
            </div>
          </div>

          {/* Assignment Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Assignment</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  {invoiceCase.assigned_admin_id ? (
                    <>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {invoiceCase.assigned_admin_name || invoiceCase.assigned_admin_email || 'Admin'}
                      </div>
                      {invoiceCase.assigned_admin_email && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{invoiceCase.assigned_admin_email}</div>
                      )}
                    </>
                  ) : (
                    <div className="text-gray-400 italic">Unassigned</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!invoiceCase.assigned_admin_id && (
                  <button
                    onClick={handleAssignToMe}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" /> Assign to Me
                  </button>
                )}
                {invoiceCase.assigned_admin_id && invoiceCase.assigned_admin_id !== user?.id && (
                  <button
                    onClick={handleAssignToMe}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" /> Reassign to Me
                  </button>
                )}
                {invoiceCase.assigned_admin_id && (
                  <button
                    onClick={handleUnassign}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center gap-1"
                  >
                    <UserMinus className="w-4 h-4" /> Unassign
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Workflow Progress */}
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
                      {STATE_LABELS[state] || state.replace(/_/g, ' ')}
                    </div>
                    {index < WORKFLOW_STATES.length - 1 && (
                      <ChevronRight className={`w-4 h-4 mx-1 flex-shrink-0 ${isPast ? 'text-green-500' : 'text-gray-300'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {invoiceCase.workflow_state === 'BLOCKED' && (
              <div className="mt-2 flex items-center gap-2 text-red-600 dark:text-red-400">
                <XOctagon className="w-5 h-5" />
                <span className="text-sm font-medium">Case is currently BLOCKED</span>
                {invoiceCase.previous_state && (
                  <span className="text-xs text-gray-500">
                    (was {STATE_LABELS[invoiceCase.previous_state] || invoiceCase.previous_state})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* State Transition Panel */}
          {currentNextStates.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">State Transitions</h3>

              {/* Notes input */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Transition Notes (optional)</label>
                <input
                  type="text"
                  value={transitionNotes}
                  onChange={e => setTransitionNotes(e.target.value)}
                  placeholder="Reason for transition..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Transition buttons */}
              <div className="flex flex-wrap gap-3">
                {currentNextStates.filter(s => s !== 'BLOCKED').map(targetState => (
                  <div key={targetState} className="flex items-center gap-1">
                    <button
                      onClick={() => handleValidate(targetState)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                    >
                      Validate &rarr; {STATE_LABELS[targetState] || targetState}
                    </button>
                    <button
                      onClick={() => confirmTransition(targetState)}
                      disabled={transitioning}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      {transitioning ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  </div>
                ))}

                {currentNextStates.includes('BLOCKED') && (
                  <button
                    onClick={() => confirmTransition('BLOCKED')}
                    disabled={transitioning}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm flex items-center gap-1"
                  >
                    <XOctagon className="w-4 h-4" /> Block Case
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Validation Results */}
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
                <div className="space-y-2 mb-4">
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
                <div>
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
        </div>
      )}

      {/* ================================================================ */}
      {/* ATTACHMENTS TAB                                                   */}
      {/* ================================================================ */}
      {activeTab === 'attachments' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Attachments</h3>
            <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm">
              <Upload className="w-4 h-4" />
              {uploadingFile ? 'Uploading...' : 'Upload File'}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                accept=".pdf,.edi,.txt,.500,.doc,.docx,.jpg,.jpeg,.png"
              />
            </label>
          </div>

          {/* Attachment validation summary */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Required files:</span>
              {(['PDF', 'TXT'] as const).map(type => {
                const found = attachments.some(a => a.attachment_type === type);
                return (
                  <span key={type} className={`flex items-center gap-1 ${found ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {found ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {type}
                  </span>
                );
              })}
            </div>
          </div>

          {attachments.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No attachments yet. Upload a PDF or TXT file to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {attachments.map((att) => (
                <div key={att.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{att.filename_original}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {att.attachment_type}
                        {att.file_size_bytes ? <> &bull; {formatFileSize(att.file_size_bytes)}</> : null}
                        {' '}&bull; {formatDateTime(att.uploaded_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {att.is_verified ? (
                      <span className="text-green-600 dark:text-green-400 text-xs flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <button
                        onClick={() => handleVerifyAttachment(att.id)}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        Verify
                      </button>
                    )}
                    <a
                      href={`${API_URL}/invoice-cases/${invoiceCase.id}/attachments/${att.id}/download`}
                      className="p-2 text-gray-400 hover:text-blue-600"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteAttachment(att)}
                      className="p-2 text-gray-400 hover:text-red-600"
                      title="Delete"
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

      {/* ================================================================ */}
      {/* AUDIT TRAIL TAB                                                   */}
      {/* ================================================================ */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Audit Trail</h3>
          </div>

          {auditEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">No audit events yet</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {auditEvents.map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {event.action.replace(/_/g, ' ')}
                      </div>
                      {event.before_state && event.after_state && (
                        <div className="text-sm mt-1 flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${STATE_COLORS[event.before_state] || 'bg-gray-100'}`}>
                            {STATE_LABELS[event.before_state] || event.before_state}
                          </span>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                          <span className={`px-2 py-0.5 text-xs rounded-full ${STATE_COLORS[event.after_state] || 'bg-gray-100'}`}>
                            {STATE_LABELS[event.after_state] || event.after_state}
                          </span>
                        </div>
                      )}
                      {event.notes && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.notes}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(event.event_timestamp)}
                      </div>
                      {event.actor_email && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-end gap-1 mt-1">
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

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        summaryItems={confirmDialog.summaryItems}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
