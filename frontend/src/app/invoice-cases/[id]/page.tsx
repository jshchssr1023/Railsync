'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { revertInvoiceCase } from '@/lib/api';
import {
  AlertTriangle, CheckCircle, Clock, FileText, Upload, Download,
  Trash2, ChevronRight, ChevronDown, User, Loader2, ShieldCheck, XOctagon,
  RefreshCw, UserPlus, UserMinus, Info, Pencil, X, Save,
  DollarSign, Wrench, ExternalLink, Filter,
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
  details?: Record<string, unknown>;
}

interface ValidationResult {
  caseId: string;
  targetState: string;
  canTransition: boolean;
  blockingErrors: ValidationError[];
  warnings: ValidationError[];
  passedChecks: string[];
  validatedAt: string;
  context?: Record<string, unknown>;
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

interface AttachmentValidation {
  hasRequiredFiles: boolean;
  hasPDF: boolean;
  hasTXT: boolean;
  missingTypes: string[];
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
  validation_result?: string | ValidationResult | null;
  event_data?: string | Record<string, unknown> | null;
}

interface EditFormData {
  vendor_name: string;
  shop_code: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: string;
  currency: string;
  lessee: string;
  car_marks: string;
  fms_shopping_id: string;
  fms_workflow_id: string;
}

// ==============================================================================
// Constants
// ==============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const SPECIAL_LESSEES = ['EXXON', 'IMPOIL', 'MARATHON'];

const TERMINAL_STATES = ['PAID', 'CLOSED'];

// States that cannot be reverted once transitioned TO
const IRREVERSIBLE_TARGET_STATES = new Set(['SAP_POSTED', 'PAID', 'CLOSED']);
// Transitions that require typed confirmation (case number)
const TYPED_CONFIRM_STATES = new Set(['SAP_POSTED']);
// Reversible transitions get toast undo
const REVERSIBLE_TRANSITIONS = new Set([
  'RECEIVED->ASSIGNED', 'ASSIGNED->WAITING_ON_SHOPPING', 'ASSIGNED->WAITING_ON_CUSTOMER_APPROVAL',
  'ASSIGNED->READY_FOR_IMPORT', 'READY_FOR_IMPORT->IMPORTED', 'IMPORTED->ADMIN_REVIEW',
  'ADMIN_REVIEW->SUBMITTED', 'SUBMITTED->APPROVER_REVIEW', 'APPROVED->BILLING_REVIEW',
  'BILLING_REVIEW->BILLING_APPROVED', 'BILLING_APPROVED->SAP_STAGED',
  // Backward (already reversible)
  'WAITING_ON_SHOPPING->ASSIGNED', 'WAITING_ON_CUSTOMER_APPROVAL->ASSIGNED',
  'APPROVER_REVIEW->ADMIN_REVIEW', 'BILLING_REVIEW->APPROVER_REVIEW', 'BLOCKED->ASSIGNED',
  'ASSIGNED->RECEIVED', 'READY_FOR_IMPORT->ASSIGNED', 'IMPORTED->READY_FOR_IMPORT',
  'ADMIN_REVIEW->IMPORTED', 'SUBMITTED->ADMIN_REVIEW', 'APPROVED->APPROVER_REVIEW',
  'BILLING_APPROVED->BILLING_REVIEW', 'SAP_STAGED->BILLING_APPROVED',
]);

// Full 16-state main path (includes WAITING_ON_SHOPPING and WAITING_ON_CUSTOMER_APPROVAL)
const WORKFLOW_STATES = [
  'RECEIVED', 'ASSIGNED', 'WAITING_ON_SHOPPING', 'WAITING_ON_CUSTOMER_APPROVAL',
  'READY_FOR_IMPORT', 'IMPORTED', 'ADMIN_REVIEW',
  'SUBMITTED', 'APPROVER_REVIEW', 'APPROVED', 'BILLING_REVIEW',
  'BILLING_APPROVED', 'SAP_STAGED', 'SAP_POSTED', 'PAID', 'CLOSED',
];

// Valid next states from each state (derived from invoice_state_transitions seed data + migration 049 backward transitions)
const NEXT_STATES: Record<string, string[]> = {
  RECEIVED:                       ['ASSIGNED', 'BLOCKED'],
  ASSIGNED:                       ['WAITING_ON_SHOPPING', 'WAITING_ON_CUSTOMER_APPROVAL', 'READY_FOR_IMPORT', 'RECEIVED', 'BLOCKED'],
  WAITING_ON_SHOPPING:            ['ASSIGNED', 'READY_FOR_IMPORT', 'BLOCKED'],
  WAITING_ON_CUSTOMER_APPROVAL:   ['ASSIGNED', 'READY_FOR_IMPORT', 'BLOCKED'],
  READY_FOR_IMPORT:               ['IMPORTED', 'ASSIGNED', 'BLOCKED'],
  IMPORTED:                       ['ADMIN_REVIEW', 'READY_FOR_IMPORT', 'BLOCKED'],
  ADMIN_REVIEW:                   ['SUBMITTED', 'IMPORTED', 'ASSIGNED', 'BLOCKED'],
  SUBMITTED:                      ['APPROVER_REVIEW', 'ADMIN_REVIEW', 'BLOCKED'],
  APPROVER_REVIEW:                ['APPROVED', 'ADMIN_REVIEW', 'BLOCKED'],
  APPROVED:                       ['BILLING_REVIEW', 'APPROVER_REVIEW', 'BLOCKED'],
  BILLING_REVIEW:                 ['BILLING_APPROVED', 'APPROVER_REVIEW', 'BLOCKED'],
  BILLING_APPROVED:               ['SAP_STAGED', 'BILLING_REVIEW', 'BLOCKED'],
  SAP_STAGED:                     ['SAP_POSTED', 'BILLING_APPROVED', 'BLOCKED'],
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

const ROLE_COLORS: Record<string, string> = {
  admin:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  billing:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  approver:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  system:      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const AUDIT_ACTIONS = [
  'ALL',
  'CASE_CREATED',
  'CASE_UPDATED',
  'STATE_TRANSITIONED',
  'STATE_TRANSITION_BLOCKED',
  'CASE_ASSIGNED',
  'CASE_UNASSIGNED',
  'ATTACHMENT_UPLOADED',
  'ATTACHMENT_DELETED',
  'ATTACHMENT_VERIFIED',
  'SPECIAL_LESSEE_APPROVED',
];

const MRU_AUTO_APPROVE_THRESHOLD = 1500;
const ESTIMATE_VARIANCE_TOLERANCE = 100;

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

function parseValidationData(raw: string | ValidationResult | null | undefined): ValidationResult | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw as ValidationResult;
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
  const [attachmentValidation, setAttachmentValidation] = useState<AttachmentValidation | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [autoValidating, setAutoValidating] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    vendor_name: '', shop_code: '', invoice_number: '', invoice_date: '',
    total_amount: '', currency: 'USD', lessee: '', car_marks: '',
    fms_shopping_id: '', fms_workflow_id: '',
  });

  // Audit trail filter
  const [auditFilter, setAuditFilter] = useState('ALL');
  const [expandedAuditIds, setExpandedAuditIds] = useState<Set<string>>(new Set());

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'default' | 'danger' | 'warning';
    summaryItems?: { label: string; value: string }[];
    irreversibleWarning?: boolean;
    requireTypedConfirmation?: string;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceCase?.id]);

  const fetchAttachmentValidation = useCallback(async () => {
    if (!invoiceCase) return;
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/attachments/validate`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setAttachmentValidation(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch attachment validation:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceCase?.id]);

  // Auto-validate on load for non-terminal states
  const runAutoValidation = useCallback(async () => {
    if (!invoiceCase) return;
    if (TERMINAL_STATES.includes(invoiceCase.workflow_state)) return;

    const nextStates = NEXT_STATES[invoiceCase.workflow_state] || [];
    const forwardTarget = nextStates.find(s => s !== 'BLOCKED');
    if (!forwardTarget) return;

    setAutoValidating(true);
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ target_state: forwardTarget }),
      });
      const data = await res.json();
      if (data.success) {
        setValidation(data.data);
      }
    } catch (err) {
      console.error('Auto-validation failed:', err);
    } finally {
      setAutoValidating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceCase?.id, invoiceCase?.workflow_state]);

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
      runAutoValidation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceCase?.id]);

  // Fetch server-side attachment validation when switching to attachments tab
  useEffect(() => {
    if (activeTab === 'attachments' && invoiceCase) {
      fetchAttachmentValidation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, invoiceCase?.id]);

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
        toast.error(data.error || 'Validation failed');
      }
    } catch (err) {
      console.error('Validation failed:', err);
      toast.error('Failed to validate');
    }
  };

  const confirmTransition = (targetState: string) => {
    if (!invoiceCase) return;
    const isBlock = targetState === 'BLOCKED';
    const isIrreversible = IRREVERSIBLE_TARGET_STATES.has(targetState);
    const needsTypedConfirm = TYPED_CONFIRM_STATES.has(targetState);
    setConfirmDialog({
      open: true,
      title: isBlock ? 'Block Case' : `Transition to ${STATE_LABELS[targetState] || targetState}`,
      description: isBlock
        ? 'This will block the case and halt all processing until resolved.'
        : `Advance case ${invoiceCase.case_number} to the next workflow state.`,
      variant: isBlock || isIrreversible ? 'danger' : 'warning',
      irreversibleWarning: isIrreversible,
      requireTypedConfirmation: needsTypedConfirm ? invoiceCase.case_number : undefined,
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
    const fromState = invoiceCase.workflow_state;
    const transitionKey = `${fromState}->${targetState}`;
    const isReversible = REVERSIBLE_TRANSITIONS.has(transitionKey);
    const caseId = invoiceCase.id;

    setConfirmDialog(d => ({ ...d, open: false }));
    setTransitioning(true);
    try {
      const res = await fetch(`${API_URL}/invoice-cases/${caseId}/transition`, {
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
        if (isReversible) {
          toast.successWithUndo(
            `Transitioned to ${STATE_LABELS[targetState] || targetState}`,
            async () => {
              await revertInvoiceCase(caseId);
              // Refresh case data after revert
              const refreshRes = await fetch(`${API_URL}/invoice-cases/${caseId}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
              });
              const refreshData = await refreshRes.json();
              if (refreshData.success) {
                setInvoiceCase(refreshData.data);
                fetchAuditEvents();
              }
            }
          );
        } else {
          toast.success(`Transitioned to ${STATE_LABELS[targetState] || targetState}`);
        }
      } else {
        setValidation(data.validation || null);
        toast.error(data.error || 'Transition blocked');
      }
    } catch (err) {
      console.error('Transition failed:', err);
      toast.error('Failed to transition state');
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
        toast.success('Case assigned to you');
      } else {
        toast.error(data.error || 'Failed to assign case');
      }
    } catch (err) {
      console.error('Assign failed:', err);
      toast.error('Failed to assign case');
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
        toast.success('Case unassigned');
      }
    } catch (err) {
      console.error('Unassign failed:', err);
      toast.error('Failed to unassign case');
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
        toast.success('Special lessee approval confirmed');
      } else {
        toast.error(data.error || 'Failed to confirm approval');
      }
    } catch (err) {
      console.error('Special lessee approval failed:', err);
      toast.error('Failed to confirm approval');
    }
  };

  // ---------- Edit Mode ----------

  const startEditing = () => {
    if (!invoiceCase) return;
    setEditForm({
      vendor_name: invoiceCase.vendor_name || '',
      shop_code: invoiceCase.shop_code || '',
      invoice_number: invoiceCase.invoice_number || '',
      invoice_date: invoiceCase.invoice_date ? invoiceCase.invoice_date.slice(0, 10) : '',
      total_amount: invoiceCase.total_amount != null ? String(invoiceCase.total_amount) : '',
      currency: invoiceCase.currency || 'USD',
      lessee: invoiceCase.lessee || '',
      car_marks: invoiceCase.car_marks?.join(', ') || '',
      fms_shopping_id: invoiceCase.fms_shopping_id || '',
      fms_workflow_id: invoiceCase.fms_workflow_id || '',
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const handleSaveEdit = () => {
    if (!invoiceCase) return;
    const changes: { label: string; value: string }[] = [];
    if (editForm.vendor_name !== (invoiceCase.vendor_name || '')) changes.push({ label: 'Vendor', value: editForm.vendor_name || '(cleared)' });
    if (editForm.shop_code !== (invoiceCase.shop_code || '')) changes.push({ label: 'Shop Code', value: editForm.shop_code || '(cleared)' });
    if (editForm.invoice_number !== (invoiceCase.invoice_number || '')) changes.push({ label: 'Invoice #', value: editForm.invoice_number || '(cleared)' });
    if (editForm.total_amount !== (invoiceCase.total_amount != null ? String(invoiceCase.total_amount) : '')) changes.push({ label: 'Amount', value: editForm.total_amount ? `$${editForm.total_amount}` : '(cleared)' });
    if (editForm.lessee !== (invoiceCase.lessee || '')) changes.push({ label: 'Lessee', value: editForm.lessee || '(cleared)' });

    if (changes.length === 0) {
      setEditing(false);
      return;
    }

    setConfirmDialog({
      open: true,
      title: 'Save Case Changes',
      description: `Update case ${invoiceCase.case_number} with the following changes:`,
      variant: 'warning',
      summaryItems: changes,
      onConfirm: executeSaveEdit,
    });
  };

  const executeSaveEdit = async () => {
    if (!invoiceCase) return;
    setConfirmDialog(d => ({ ...d, open: false }));
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editForm.vendor_name !== (invoiceCase.vendor_name || '')) body.vendor_name = editForm.vendor_name || null;
      if (editForm.shop_code !== (invoiceCase.shop_code || '')) body.shop_code = editForm.shop_code || null;
      if (editForm.invoice_number !== (invoiceCase.invoice_number || '')) body.invoice_number = editForm.invoice_number || null;
      if (editForm.invoice_date !== (invoiceCase.invoice_date ? invoiceCase.invoice_date.slice(0, 10) : '')) body.invoice_date = editForm.invoice_date || null;
      if (editForm.total_amount !== (invoiceCase.total_amount != null ? String(invoiceCase.total_amount) : '')) body.total_amount = editForm.total_amount ? parseFloat(editForm.total_amount) : null;
      if (editForm.currency !== (invoiceCase.currency || 'USD')) body.currency = editForm.currency;
      if (editForm.lessee !== (invoiceCase.lessee || '')) body.lessee = editForm.lessee || null;
      if (editForm.fms_shopping_id !== (invoiceCase.fms_shopping_id || '')) body.fms_shopping_id = editForm.fms_shopping_id || null;
      if (editForm.fms_workflow_id !== (invoiceCase.fms_workflow_id || '')) body.fms_workflow_id = editForm.fms_workflow_id || null;

      const carMarksArr = editForm.car_marks ? editForm.car_marks.split(',').map(s => s.trim()).filter(Boolean) : [];
      const currentMarks = invoiceCase.car_marks || [];
      if (JSON.stringify(carMarksArr) !== JSON.stringify(currentMarks)) body.car_marks = carMarksArr;

      const res = await fetch(`${API_URL}/invoice-cases/${invoiceCase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setInvoiceCase(data.data);
        setEditing(false);
        fetchAuditEvents();
        toast.success('Case updated');
      } else {
        toast.error(data.error || 'Failed to update case');
      }
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to update case');
    } finally {
      setSaving(false);
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
        fetchAttachmentValidation();
        toast.success(`Uploaded ${file.name}`);
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Failed to upload file');
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
        fetchAttachmentValidation();
        toast.success('Attachment deleted');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete attachment');
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
        toast.success('Attachment verified');
      }
    } catch (err) {
      console.error('Verify failed:', err);
      toast.error('Failed to verify attachment');
    }
  };

  // ---------- Audit Trail ----------

  const toggleAuditExpand = (eventId: string) => {
    setExpandedAuditIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  // ==============================================================================
  // Computed
  // ==============================================================================

  const getStateIndex = (state: string) => WORKFLOW_STATES.indexOf(state);
  const currentNextStates = invoiceCase ? (NEXT_STATES[invoiceCase.workflow_state] || []) : [];
  const isSpecialLessee = invoiceCase?.lessee && SPECIAL_LESSEES.includes(invoiceCase.lessee.toUpperCase());
  const needsSpecialApproval = isSpecialLessee && !invoiceCase?.special_lessee_approval_confirmed;
  const isTerminal = invoiceCase ? TERMINAL_STATES.includes(invoiceCase.workflow_state) : false;

  // Validation context
  const ctx = validation?.context || {} as Record<string, unknown>;
  const estimateTotal = ctx.estimateTotal as number | undefined;
  const invoiceTotal = ctx.invoiceTotal as number | undefined;
  const variance = ctx.variance as number | undefined;
  const autoApproveEligible = ctx.autoApproveEligible as boolean | undefined;
  const treatAsShop = ctx.treatAsShop as boolean | undefined;
  const carCount = ctx.carCount as number | undefined;
  const finalDocsApproved = ctx.finalDocsApproved as boolean | undefined;

  // Filtered audit events
  const filteredAuditEvents = auditFilter === 'ALL'
    ? auditEvents
    : auditEvents.filter(e => e.action === auditFilter);

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
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Case Details</h3>
              {!isTerminal && !editing && (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              )}
              {editing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-4">
              {!editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
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
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Vendor Name</label>
                    <input type="text" value={editForm.vendor_name} onChange={e => setEditForm(f => ({ ...f, vendor_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Shop Code</label>
                    <input type="text" value={editForm.shop_code} onChange={e => setEditForm(f => ({ ...f, shop_code: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Invoice Number</label>
                    <input type="text" value={editForm.invoice_number} onChange={e => setEditForm(f => ({ ...f, invoice_number: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Invoice Date</label>
                    <input type="date" value={editForm.invoice_date} onChange={e => setEditForm(f => ({ ...f, invoice_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Total Amount</label>
                    <input type="number" step="0.01" value={editForm.total_amount} onChange={e => setEditForm(f => ({ ...f, total_amount: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Currency</label>
                    <select value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                      <option value="USD">USD</option>
                      <option value="CAD">CAD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Lessee
                      {editForm.lessee && SPECIAL_LESSEES.includes(editForm.lessee.toUpperCase()) && (
                        <span className="ml-2 text-amber-600 text-xs">(Special Lessee)</span>
                      )}
                    </label>
                    <input type="text" value={editForm.lessee} onChange={e => setEditForm(f => ({ ...f, lessee: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Car Marks (comma-separated)</label>
                    <input type="text" value={editForm.car_marks} onChange={e => setEditForm(f => ({ ...f, car_marks: e.target.value }))} placeholder="GATX 12345, UTLX 67890" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">FMS Shopping ID</label>
                    <input type="text" value={editForm.fms_shopping_id} onChange={e => setEditForm(f => ({ ...f, fms_shopping_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">FMS Workflow ID</label>
                    <input type="text" value={editForm.fms_workflow_id} onChange={e => setEditForm(f => ({ ...f, fms_workflow_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Type-Specific Info Card */}
          {invoiceCase.invoice_type === 'SHOP' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-500" /> SHOP Invoice Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">FMS Shopping</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                    {invoiceCase.fms_shopping_id ? (
                      <Link href={`/shopping/${invoiceCase.fms_shopping_id}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        {invoiceCase.fms_shopping_id.slice(0, 8)}... <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="text-gray-400 italic">Not linked</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Final Docs</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {finalDocsApproved === true && <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>}
                    {finalDocsApproved === false && <span className="text-red-600 dark:text-red-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Not Approved</span>}
                    {finalDocsApproved === undefined && <span className="text-gray-400 italic">Run validation to check</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Estimate Variance</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {estimateTotal != null && invoiceTotal != null ? (
                      <span className={
                        (variance ?? 0) <= 0 ? 'text-green-600 dark:text-green-400' :
                        (variance ?? 0) <= ESTIMATE_VARIANCE_TOLERANCE ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }>
                        {formatCurrency(variance ?? 0)} ({(variance ?? 0) <= 0 ? 'under' : 'over'} estimate)
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Run validation to check</span>
                    )}
                  </dd>
                </div>
              </div>

              {/* Estimate variance visual bar */}
              {estimateTotal != null && invoiceTotal != null && estimateTotal > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <span>Estimate: {formatCurrency(estimateTotal)}</span>
                    <span>Invoice: {formatCurrency(invoiceTotal)}</span>
                  </div>
                  <div className="relative h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (variance ?? 0) <= 0 ? 'bg-green-500' :
                        (variance ?? 0) <= ESTIMATE_VARIANCE_TOLERANCE ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min((invoiceTotal / (estimateTotal * 1.3)) * 100, 100)}%` }}
                    />
                    {/* Tolerance marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                      style={{ left: `${Math.min(((estimateTotal + ESTIMATE_VARIANCE_TOLERANCE) / (estimateTotal * 1.3)) * 100, 100)}%` }}
                      title={`$${ESTIMATE_VARIANCE_TOLERANCE} tolerance`}
                    />
                    {/* Estimate baseline */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-500"
                      style={{ left: `${Math.min((estimateTotal / (estimateTotal * 1.3)) * 100, 100)}%` }}
                      title="Estimate baseline"
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Estimate</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> +${ESTIMATE_VARIANCE_TOLERANCE} tolerance</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {invoiceCase.invoice_type === 'MRU' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-violet-500" /> MRU Invoice Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Amount Threshold</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {invoiceCase.total_amount != null ? (
                      invoiceCase.total_amount <= MRU_AUTO_APPROVE_THRESHOLD ? (
                        <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> &le; ${MRU_AUTO_APPROVE_THRESHOLD.toLocaleString()} &mdash; Auto-approve eligible
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> &gt; ${MRU_AUTO_APPROVE_THRESHOLD.toLocaleString()} &mdash; Maintenance review required
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400 italic">No amount set</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Car Marks</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                    {invoiceCase.car_marks && invoiceCase.car_marks.length > 1 ? (
                      <span className="flex items-center gap-1">
                        {invoiceCase.car_marks.join(', ')}
                        <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs rounded">
                          Multi-car ({invoiceCase.car_marks.length})
                        </span>
                      </span>
                    ) : (
                      invoiceCase.car_marks?.[0] || '-'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">FMS Shopping</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                    {invoiceCase.fms_shopping_id ? (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Has FMS Shopping &mdash; treated as SHOP
                      </span>
                    ) : (
                      <span className="text-gray-400">None (standard MRU)</span>
                    )}
                  </dd>
                </div>
              </div>
            </div>
          )}

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
          {(validation || autoValidating) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                Validation Result
                {autoValidating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                {validation && (
                  <span className={`text-sm font-normal ${validation.canTransition ? 'text-green-600' : 'text-red-600'}`}>
                    {validation.canTransition ? 'Can proceed' : 'Blocked'}
                  </span>
                )}
                {validation && (
                  <span className="text-xs text-gray-400 font-normal ml-auto">
                    Target: {STATE_LABELS[validation.targetState] || validation.targetState}
                  </span>
                )}
              </h3>

              {validation && (
                <>
                  {validation.blockingErrors.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h4 className="text-sm font-medium text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Blocking Errors ({validation.blockingErrors.length})
                      </h4>
                      {validation.blockingErrors.map((error, i) => (
                        <div key={i} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <div className="font-medium text-red-800 dark:text-red-300">{error.message}</div>
                          <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                            Owner: <span className={`px-1.5 py-0.5 rounded text-xs ${ROLE_COLORS[error.owningRole] || 'bg-gray-100'}`}>{error.owningRole}</span>
                            {error.fixPath && <> | Fix: {error.fixPath}</>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {validation.warnings.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h4 className="text-sm font-medium text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Warnings ({validation.warnings.length})
                      </h4>
                      {validation.warnings.map((warning, i) => (
                        <div key={i} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <div className="text-amber-800 dark:text-amber-300">{warning.message}</div>
                          {warning.owningRole && (
                            <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                              Owner: <span className={`px-1.5 py-0.5 rounded text-xs ${ROLE_COLORS[warning.owningRole] || 'bg-gray-100'}`}>{warning.owningRole}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Validation Context Details */}
                  {validation.context && Object.keys(validation.context).length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
                        <Info className="w-4 h-4" /> Validation Context
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {estimateTotal != null && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Estimate:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-white">{formatCurrency(estimateTotal)}</span>
                          </div>
                        )}
                        {invoiceTotal != null && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Invoice:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-white">{formatCurrency(invoiceTotal)}</span>
                          </div>
                        )}
                        {variance != null && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Variance:</span>
                            <span className={`ml-1 font-medium ${variance <= 0 ? 'text-green-600' : variance <= ESTIMATE_VARIANCE_TOLERANCE ? 'text-amber-600' : 'text-red-600'}`}>
                              {formatCurrency(variance)}
                            </span>
                          </div>
                        )}
                        {autoApproveEligible !== undefined && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Auto-approve:</span>
                            <span className={`ml-1 font-medium ${autoApproveEligible ? 'text-green-600' : 'text-amber-600'}`}>
                              {autoApproveEligible ? 'Eligible' : 'Requires review'}
                            </span>
                          </div>
                        )}
                        {treatAsShop && (
                          <div className="col-span-2">
                            <span className="text-amber-600 font-medium">MRU treated as SHOP (has FMS shopping)</span>
                          </div>
                        )}
                        {carCount != null && carCount > 1 && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Cars:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-white">{carCount} (multi-car)</span>
                          </div>
                        )}
                        {finalDocsApproved !== undefined && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Final Docs:</span>
                            <span className={`ml-1 font-medium ${finalDocsApproved ? 'text-green-600' : 'text-red-600'}`}>
                              {finalDocsApproved ? 'Approved' : 'Not Approved'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {validation.passedChecks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-green-600 flex items-center gap-1 mb-2">
                        <CheckCircle className="w-4 h-4" /> Passed Checks ({validation.passedChecks.length})
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
                </>
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

          {/* Server-side attachment validation summary */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Required files:</span>
              {attachmentValidation ? (
                <>
                  <span className={`flex items-center gap-1 ${attachmentValidation.hasPDF ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {attachmentValidation.hasPDF ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    PDF
                  </span>
                  <span className={`flex items-center gap-1 ${attachmentValidation.hasTXT ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {attachmentValidation.hasTXT ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    TXT
                  </span>
                  {attachmentValidation.hasRequiredFiles && (
                    <span className="text-green-600 dark:text-green-400 text-xs ml-2">All required files present</span>
                  )}
                </>
              ) : (
                // Fallback to client-side check
                (['PDF', 'TXT'] as const).map(type => {
                  const found = attachments.some(a => a.attachment_type === type);
                  return (
                    <span key={type} className={`flex items-center gap-1 ${found ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {found ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {type}
                    </span>
                  );
                })
              )}
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
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Audit Trail</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={auditFilter}
                onChange={e => setAuditFilter(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {AUDIT_ACTIONS.map(action => (
                  <option key={action} value={action}>
                    {action === 'ALL' ? 'All Actions' : action.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredAuditEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {auditFilter === 'ALL' ? 'No audit events yet' : `No "${auditFilter.replace(/_/g, ' ')}" events`}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAuditEvents.map((event) => {
                const hasValidation = event.action === 'STATE_TRANSITIONED' || event.action === 'STATE_TRANSITION_BLOCKED';
                const isExpanded = expandedAuditIds.has(event.id);
                const parsedValidation = isExpanded ? parseValidationData(event.validation_result) : null;

                return (
                  <div key={event.id} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          {event.action.replace(/_/g, ' ')}
                          {event.actor_role && (
                            <span className={`px-1.5 py-0.5 text-xs rounded ${ROLE_COLORS[event.actor_role] || 'bg-gray-100 text-gray-600'}`}>
                              {event.actor_role}
                            </span>
                          )}
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

                        {/* Expandable validation context */}
                        {hasValidation && (
                          <button
                            onClick={() => toggleAuditExpand(event.id)}
                            className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            {isExpanded ? 'Hide' : 'Show'} validation details
                          </button>
                        )}
                        {isExpanded && parsedValidation && (
                          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs space-y-2">
                            {parsedValidation.blockingErrors?.length > 0 && (
                              <div>
                                <span className="font-medium text-red-600">Blocking:</span>
                                {parsedValidation.blockingErrors.map((e, i) => (
                                  <span key={i} className="ml-2 text-red-700 dark:text-red-400">{e.message}</span>
                                ))}
                              </div>
                            )}
                            {parsedValidation.warnings?.length > 0 && (
                              <div>
                                <span className="font-medium text-amber-600">Warnings:</span>
                                {parsedValidation.warnings.map((w, i) => (
                                  <span key={i} className="ml-2 text-amber-700 dark:text-amber-400">{w.message}</span>
                                ))}
                              </div>
                            )}
                            <div className="text-gray-500">
                              Result: {parsedValidation.canTransition ? 'Allowed' : 'Blocked'}
                              {parsedValidation.targetState && <> | Target: {STATE_LABELS[parsedValidation.targetState] || parsedValidation.targetState}</>}
                            </div>
                          </div>
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
                );
              })}
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
        irreversibleWarning={confirmDialog.irreversibleWarning}
        requireTypedConfirmation={confirmDialog.requireTypedConfirmation}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
