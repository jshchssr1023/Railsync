'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Loader2,
  DollarSign,
  FileText,
  Clock,
  AlertTriangle,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Upload,
  Search,
  X,
  ChevronUp,
  Eye,
  Filter,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Send,
  Ban,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getBillingSummary,
  listBillingRuns,
  listOutboundInvoices,
  approveOutboundInvoice,
  voidOutboundInvoice,
  generateMonthlyInvoices,
  runBillingPreflight,
  listChargebacks as fetchChargebacks,
  createChargeback as apiCreateChargeback,
  reviewChargeback,
  listPendingAdjustments,
  createBillingAdjustment,
  approveBillingAdjustment,
  rejectBillingAdjustment,
  getMileageSummary,
  verifyMileageRecord as apiVerifyMileage,
  createMileageFile,
  queueInvoiceDelivery,
  getDeliveryHistory,
  approveBillingRun,
  completeBillingRun,
  getCostAllocationSummary,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TabKey = 'overview' | 'invoices' | 'chargebacks' | 'adjustments' | 'mileage' | 'costs';

interface BillingSummary {
  fiscal_year: number;
  fiscal_month: number;
  total_invoices: number;
  total_rental: number;
  total_mileage: number;
  total_chargebacks: number;
  total_adjustments: number;
  grand_total: number;
  draft_count: number;
  approved_count: number;
  sent_count: number;
  paid_count: number;
}

interface BillingRun {
  id: string;
  run_date: string;
  type: string;
  status: string;
  invoices_generated: number;
  total_amount: number;
}

interface BillingInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_code: string;
  type: string;
  period: string;
  total: number;
  status: string;
  created_at: string;
  due_date: string;
  line_items?: BillingLineItem[];
}

interface BillingLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  car_number?: string;
}

interface Chargeback {
  id: string;
  car_number: string;
  customer_name: string;
  customer_code: string;
  type: string;
  amount: number;
  status: string;
  submitted_date: string;
  description: string;
  notes?: string;
}

interface Adjustment {
  id: string;
  customer_name: string;
  customer_code: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  requested_by: string;
  requested_date: string;
  reviewed_by?: string;
  notes?: string;
}

interface MileageFile {
  id: string;
  filename: string;
  period: string;
  status: string;
  total_records: number;
  error_count: number;
  uploaded_at: string;
  uploaded_by: string;
}

interface MileageRecord {
  id: string;
  car_number: string;
  customer_name: string;
  period: string;
  miles: number;
  verified: boolean;
  verified_by?: string;
}

interface MileageSummary {
  customer_name: string;
  customer_code: string;
  period: string;
  total_miles: number;
  car_count: number;
  verified_count: number;
}

interface CostAllocationSummaryItem {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  allocation_count: number;
  total_cost: number;
  labor_total: number;
  material_total: number;
  freight_total: number;
  lessee_billable: number;
  owner_absorbed: number;
  pending_count: number;
  allocated_count: number;
  invoiced_count: number;
}

interface PreflightCheck {
  name: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

interface PreflightResult {
  passed: boolean;
  checks: PreflightCheck[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  pending_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  sent: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  void: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

const CHARGEBACK_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  pending_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  invoiced: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const ADJUSTMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  applied: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const MILEAGE_STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const RUN_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const capitalize = (s: string) =>
  s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  const color = colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {capitalize(status)}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
  isCurrency = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  isCurrency?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">
            {isCurrency ? formatCurrency(value) : value.toLocaleString()}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
      {icon}
      <p className="mt-3 text-sm">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function BillingPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);

  // Billing period selector
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  // Overview data
  const [summary, setSummary] = useState<BillingSummary>({
    fiscal_year: 0, fiscal_month: 0,
    total_invoices: 0, total_rental: 0, total_mileage: 0,
    total_chargebacks: 0, total_adjustments: 0, grand_total: 0,
    draft_count: 0, approved_count: 0, sent_count: 0, paid_count: 0,
  });
  const [billingRuns, setBillingRuns] = useState<BillingRun[]>([]);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [runningPreflight, setRunningPreflight] = useState(false);

  // Invoices data
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoicePage, setInvoicePage] = useState(0);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');
  const [invoiceCustomerSearch, setInvoiceCustomerSearch] = useState('');
  const [invoicePeriodFilter, setInvoicePeriodFilter] = useState('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [approvingInvoiceId, setApprovingInvoiceId] = useState<string | null>(null);
  const [voidingInvoiceId, setVoidingInvoiceId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  // Chargebacks data
  const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
  const [chargebackTotal, setChargebackTotal] = useState(0);
  const [chargebackPage, setChargebackPage] = useState(0);
  const [showChargebackModal, setShowChargebackModal] = useState(false);
  const [newChargeback, setNewChargeback] = useState({
    car_number: '',
    customer_code: '',
    type: 'damage',
    amount: 0,
    description: '',
  });
  const [chargebackReviewId, setChargebackReviewId] = useState<string | null>(null);
  const [chargebackReviewNotes, setChargebackReviewNotes] = useState('');

  // Adjustments data
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [newAdjustment, setNewAdjustment] = useState({
    customer_code: '',
    type: 'credit',
    amount: 0,
    description: '',
  });
  const [adjustmentReviewNotes, setAdjustmentReviewNotes] = useState('');

  // Mileage data
  const [mileageFiles, setMileageFiles] = useState<MileageFile[]>([]);
  const [mileageRecords, setMileageRecords] = useState<MileageRecord[]>([]);
  const [mileageSummary, setMileageSummary] = useState<MileageSummary[]>([]);
  const [uploadingMileage, setUploadingMileage] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Cost allocation data
  const [costAllocations, setCostAllocations] = useState<CostAllocationSummaryItem[]>([]);

  // Billing run detail
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [approvingRunId, setApprovingRunId] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmGenerateInvoices, setConfirmGenerateInvoices] = useState(false);

  // ---------------------------------------------------------------------------
  // Data Loaders
  // ---------------------------------------------------------------------------

  const loadOverviewData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, runsData] = await Promise.all([
        getBillingSummary(selectedYear, selectedMonth).catch(() => null),
        listBillingRuns(10, 0).catch(() => []),
      ]);
      if (summaryData) setSummary(summaryData as BillingSummary);
      setBillingRuns(Array.isArray(runsData) ? runsData as BillingRun[] : []);
    } catch (err) {
      console.error('Failed to load overview data:', err);
      setError('Failed to load billing overview. The billing API may not be configured yet.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  const loadInvoicesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Parameters<typeof listOutboundInvoices>[0] = { limit: 50, offset: invoicePage * 50 };
      if (invoiceStatusFilter) filters.status = invoiceStatusFilter;
      if (invoicePeriodFilter) {
        const [y, m] = invoicePeriodFilter.split('-');
        if (y && m) { filters.fiscalYear = parseInt(y); filters.fiscalMonth = parseInt(m); }
      }
      const data = await listOutboundInvoices(filters);
      const invoiceList = (data as any)?.invoices || (Array.isArray(data) ? data : []);
      const count = (data as any)?.total ?? invoiceList.length;
      setInvoices(invoiceList as BillingInvoice[]);
      setInvoiceTotal(count);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setError('Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [invoiceStatusFilter, invoiceCustomerSearch, invoicePeriodFilter, invoicePage]);

  const loadChargebacksData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChargebacks({ limit: 50, offset: chargebackPage * 50 });
      const list = (data as any)?.chargebacks || (Array.isArray(data) ? data : []);
      const count = (data as any)?.total ?? list.length;
      setChargebacks(list as Chargeback[]);
      setChargebackTotal(count);
    } catch (err) {
      console.error('Failed to load chargebacks:', err);
      setError('Failed to load chargebacks.');
    } finally {
      setLoading(false);
    }
  }, [chargebackPage]);

  const loadAdjustmentsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPendingAdjustments();
      setAdjustments(Array.isArray(data) ? data as Adjustment[] : []);
    } catch (err) {
      console.error('Failed to load adjustments:', err);
      setError('Failed to load adjustments.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMileageData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Mileage summary requires customerId + period; without them the tab shows empty state
      setMileageFiles([]);
      setMileageRecords([]);
      setMileageSummary([]);
    } catch (err) {
      console.error('Failed to load mileage data:', err);
      setError('Failed to load mileage data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCostAllocationData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCostAllocationSummary(selectedYear, selectedMonth);
      setCostAllocations(Array.isArray(data) ? data as CostAllocationSummaryItem[] : []);
    } catch (err) {
      console.error('Failed to load cost allocation data:', err);
      setError('Failed to load cost allocation data.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // ---------------------------------------------------------------------------
  // Tab loading
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) return;
    switch (activeTab) {
      case 'overview':
        loadOverviewData();
        break;
      case 'invoices':
        loadInvoicesData();
        break;
      case 'chargebacks':
        loadChargebacksData();
        break;
      case 'adjustments':
        loadAdjustmentsData();
        break;
      case 'mileage':
        loadMileageData();
        break;
      case 'costs':
        loadCostAllocationData();
        break;
    }
  }, [isAuthenticated, activeTab, loadOverviewData, loadInvoicesData, loadChargebacksData, loadAdjustmentsData, loadMileageData, loadCostAllocationData]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleGenerateInvoices = async () => {
    setConfirmGenerateInvoices(false);
    setGeneratingInvoices(true);
    try {
      await generateMonthlyInvoices(selectedYear, selectedMonth);
      toast.success('Invoices generated successfully');
      await loadOverviewData();
    } catch (err) {
      console.error('Failed to generate invoices:', err);
      setError('Failed to generate invoices.');
    } finally {
      setGeneratingInvoices(false);
    }
  };

  const handleRunPreflight = async () => {
    setRunningPreflight(true);
    try {
      const result = await runBillingPreflight(selectedYear, selectedMonth);
      toast.success('Preflight check completed');
      await loadOverviewData();
    } catch (err) {
      console.error('Preflight check failed:', err);
      setError('Preflight check failed.');
    } finally {
      setRunningPreflight(false);
    }
  };

  const handleApproveInvoice = async (invoiceId: string) => {
    setApprovingInvoiceId(invoiceId);
    try {
      await approveOutboundInvoice(invoiceId);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'approved' } : inv))
      );
      toast.success('Invoice approved');
    } catch (err) {
      console.error('Failed to approve invoice:', err);
      setError('Failed to approve invoice.');
    } finally {
      setApprovingInvoiceId(null);
    }
  };

  const handleVoidInvoice = async (invoiceId: string) => {
    if (!voidReason.trim()) { setError('Reason is required to void an invoice.'); return; }
    try {
      await voidOutboundInvoice(invoiceId, voidReason);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'void' } : inv))
      );
      setVoidingInvoiceId(null);
      setVoidReason('');
      toast.success('Invoice voided');
    } catch (err) {
      console.error('Failed to void invoice:', err);
      setError('Failed to void invoice.');
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    setSendingInvoiceId(invoiceId);
    try {
      await queueInvoiceDelivery(invoiceId);
      toast.success('Invoice queued for delivery');
    } catch (err) {
      console.error('Failed to queue invoice delivery:', err);
      setError('Failed to queue invoice for delivery.');
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handleCreateChargeback = async () => {
    try {
      await apiCreateChargeback({
        customerId: newChargeback.customer_code,
        carNumber: newChargeback.car_number,
        chargebackType: newChargeback.type,
        amount: newChargeback.amount,
        description: newChargeback.description,
      });
      setShowChargebackModal(false);
      setNewChargeback({ car_number: '', customer_code: '', type: 'damage', amount: 0, description: '' });
      toast.success('Chargeback created');
      await loadChargebacksData();
    } catch (err) {
      console.error('Failed to create chargeback:', err);
      setError('Failed to create chargeback.');
    }
  };

  const handleChargebackAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await reviewChargeback(id, action === 'approve', chargebackReviewNotes || undefined);
      setChargebackReviewId(null);
      setChargebackReviewNotes('');
      toast.success(`Chargeback ${action}d`);
      await loadChargebacksData();
    } catch (err) {
      console.error(`Failed to ${action} chargeback:`, err);
      setError(`Failed to ${action} chargeback.`);
    }
  };

  const handleCreateAdjustment = async () => {
    try {
      await createBillingAdjustment({
        customerId: newAdjustment.customer_code,
        adjustmentType: newAdjustment.type,
        amount: newAdjustment.amount,
        description: newAdjustment.description,
      });
      setShowAdjustmentModal(false);
      setNewAdjustment({ customer_code: '', type: 'credit', amount: 0, description: '' });
      toast.success('Adjustment created');
      await loadAdjustmentsData();
    } catch (err) {
      console.error('Failed to create adjustment:', err);
      setError('Failed to create adjustment.');
    }
  };

  const handleAdjustmentAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await approveBillingAdjustment(id);
      } else {
        await rejectBillingAdjustment(id, adjustmentReviewNotes || 'Rejected');
      }
      setAdjustmentReviewNotes('');
      toast.success(`Adjustment ${action}d`);
      await loadAdjustmentsData();
    } catch (err) {
      console.error(`Failed to ${action} adjustment:`, err);
      setError(`Failed to ${action} adjustment.`);
    }
  };

  const handleUploadMileageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMileage(true);
    try {
      // Register the mileage file metadata (actual file parsing handled separately)
      const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      await createMileageFile({
        filename: file.name,
        fileType: file.name.endsWith('.csv') ? 'csv' : 'manual',
        reportingPeriod: period,
      });
      toast.success('Mileage file registered');
      await loadMileageData();
    } catch (err) {
      console.error('Failed to register mileage file:', err);
      setError('Failed to register mileage file.');
    } finally {
      setUploadingMileage(false);
      e.target.value = '';
    }
  };

  const handleVerifyMileageRecord = async (recordId: string) => {
    try {
      await apiVerifyMileage(recordId);
      setMileageRecords((prev) => prev.filter((r) => r.id !== recordId));
      toast.success('Mileage record verified');
    } catch (err) {
      console.error('Failed to verify mileage record:', err);
      setError('Failed to verify mileage record.');
    }
  };

  const handleApproveBillingRun = async (runId: string) => {
    setApprovingRunId(runId);
    try {
      await approveBillingRun(runId);
      toast.success('Billing run approved');
      await loadOverviewData();
    } catch (err) {
      console.error('Failed to approve billing run:', err);
      toast.error('Failed to approve billing run');
    } finally {
      setApprovingRunId(null);
    }
  };

  const handleCompleteBillingRun = async (runId: string) => {
    try {
      await completeBillingRun(runId);
      toast.success('Billing run marked complete');
      await loadOverviewData();
    } catch (err) {
      console.error('Failed to complete billing run:', err);
      toast.error('Failed to complete billing run');
    }
  };

  const handleRunPreflight2 = async () => {
    setRunningPreflight(true);
    setPreflightResult(null);
    try {
      const result = await runBillingPreflight(selectedYear, selectedMonth) as any;
      setPreflightResult(result as PreflightResult);
      if (result?.passed) {
        toast.success('Preflight passed — ready to generate invoices');
      } else {
        toast.error('Preflight failed — see details below');
      }
    } catch (err) {
      console.error('Preflight check failed:', err);
      toast.error('Preflight check failed');
    } finally {
      setRunningPreflight(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const chargebackPipelineCounts = {
    draft: chargebacks.filter((c) => c.status === 'draft').length,
    pending_review: chargebacks.filter((c) => c.status === 'pending_review').length,
    approved: chargebacks.filter((c) => c.status === 'approved').length,
    invoiced: chargebacks.filter((c) => c.status === 'invoiced').length,
  };

  // Tab definitions
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'chargebacks', label: 'Chargebacks' },
    { key: 'adjustments', label: 'Adjustments' },
    { key: 'mileage', label: 'Mileage' },
    { key: 'costs' as TabKey, label: 'Cost Allocation' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  // ---------------------------------------------------------------------------
  // Auth gate
  // ---------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view billing.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Generate Invoices Confirmation */}
      <ConfirmDialog
        open={confirmGenerateInvoices}
        onConfirm={handleGenerateInvoices}
        onCancel={() => setConfirmGenerateInvoices(false)}
        title="Generate Monthly Invoices"
        description={`This will generate rental invoices for all active contracts for ${MONTHS.find(m => m.value === selectedMonth)?.label || ''} ${selectedYear}. Existing draft invoices for this period will not be duplicated.`}
        variant="warning"
        loading={generatingInvoices}
        confirmLabel="Generate Invoices"
        summaryItems={[
          { label: 'Billing Period', value: `${MONTHS.find(m => m.value === selectedMonth)?.label || ''} ${selectedYear}` },
          { label: 'Existing Invoices', value: String(summary.total_invoices) },
        ]}
      />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Invoice generation, chargebacks, adjustments, and mileage billing
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex gap-4 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-primary-600" aria-hidden="true" />
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW                                                   */}
        {/* ================================================================= */}
        {!loading && activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Billing Period Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Billing Period:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                onClick={loadOverviewData}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Grand Total (Month)"
                value={summary.grand_total}
                icon={<DollarSign className="w-5 h-5 text-green-600" />}
                color="bg-green-50 dark:bg-green-900/20"
                isCurrency
              />
              <KpiCard
                label="Total Invoices"
                value={summary.total_invoices}
                icon={<FileText className="w-5 h-5 text-yellow-600" />}
                color="bg-yellow-50 dark:bg-yellow-900/20"
              />
              <KpiCard
                label="Draft Invoices"
                value={summary.draft_count}
                icon={<Clock className="w-5 h-5 text-blue-600" />}
                color="bg-blue-50 dark:bg-blue-900/20"
              />
              <KpiCard
                label="Approved / Sent"
                value={summary.approved_count + summary.sent_count}
                icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
                color="bg-emerald-50 dark:bg-emerald-900/20"
              />
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Rental</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">{formatCurrency(summary.total_rental)}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Mileage</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">{formatCurrency(summary.total_mileage)}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Chargebacks</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">{formatCurrency(summary.total_chargebacks)}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Adjustments</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">{formatCurrency(summary.total_adjustments)}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setConfirmGenerateInvoices(true)}
                disabled={generatingInvoices}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
              >
                {generatingInvoices ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Generate Monthly Invoices
              </button>
              <button
                onClick={handleRunPreflight2}
                disabled={runningPreflight}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-sm font-medium"
              >
                {runningPreflight ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Run Preflight Check
              </button>
            </div>

            {/* Preflight Results */}
            {preflightResult && (
              <div className={`rounded-lg border p-4 ${
                preflightResult.passed
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className={`w-5 h-5 ${preflightResult.passed ? 'text-green-600' : 'text-red-600'}`} />
                  <h3 className={`text-sm font-semibold ${preflightResult.passed ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                    Preflight {preflightResult.passed ? 'Passed' : 'Failed'}
                  </h3>
                </div>
                <div className="space-y-2">
                  {preflightResult.checks.map((check, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      {check.passed ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p className={`text-sm ${check.passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {check.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Billing Runs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Recent Billing Runs
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Invoice generation history for the selected period
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Type</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Invoices</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Total Amount</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {billingRuns.map((run) => (
                      <Fragment key={run.id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{formatDate(run.run_date)}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{capitalize(run.type)}</td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={run.status} colorMap={RUN_STATUS_COLORS} />
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-medium">
                            {run.invoices_generated}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-mono">
                            {formatCurrency(run.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              {run.status === 'review' && (
                                <button
                                  onClick={() => handleApproveBillingRun(run.id)}
                                  disabled={approvingRunId === run.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                >
                                  {approvingRunId === run.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                  Approve
                                </button>
                              )}
                              {run.status === 'approved' && (
                                <button
                                  onClick={() => handleCompleteBillingRun(run.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Complete
                                </button>
                              )}
                              <button className="p-1 text-gray-400 hover:text-primary-600">
                                {expandedRunId === run.id ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedRunId === run.id && (
                          <tr key={`${run.id}-detail`}>
                            <td colSpan={6} className="px-4 py-4 bg-gray-50 dark:bg-gray-900/50">
                              <div className="space-y-3">
                                {/* Orchestration Steps */}
                                <div className="flex items-center gap-1">
                                  {['preflight', 'generating', 'review', 'approved', 'posting', 'completed'].map((step, idx) => {
                                    const runStatuses = ['pending', 'preflight', 'generating', 'review', 'approved', 'posting', 'completed', 'failed'];
                                    const currentIdx = runStatuses.indexOf(run.status);
                                    const stepIdx = runStatuses.indexOf(step);
                                    const isComplete = stepIdx < currentIdx;
                                    const isCurrent = step === run.status;
                                    const isFailed = run.status === 'failed' && step === 'preflight';
                                    return (
                                      <div key={step} className="flex items-center gap-1">
                                        {idx > 0 && <div className={`w-6 h-0.5 ${isComplete ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'}`} />}
                                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                          isFailed ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : isComplete ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : isCurrent ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                        }`}>
                                          {isComplete ? <CheckCircle className="w-3 h-3" /> : isFailed ? <XCircle className="w-3 h-3" /> : null}
                                          {capitalize(step)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* Run details */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Invoices Generated</p>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{run.invoices_generated}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Amount</p>
                                    <p className="font-medium text-gray-900 dark:text-gray-100 font-mono">{formatCurrency(run.total_amount)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{capitalize(run.status)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Run Date</p>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(run.run_date)}</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {billingRuns.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <EmptyState
                            icon={<FileText className="w-10 h-10" strokeWidth={1.5} />}
                            message="No billing runs for this period. Generate invoices to get started."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: INVOICES                                                   */}
        {/* ================================================================= */}
        {!loading && activeTab === 'invoices' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Status</label>
                  <select
                    value={invoiceStatusFilter}
                    onChange={(e) => { setInvoiceStatusFilter(e.target.value); setInvoicePage(0); }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Customer</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={invoiceCustomerSearch}
                      onChange={(e) => setInvoiceCustomerSearch(e.target.value)}
                      placeholder="Search customer..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    {invoiceCustomerSearch && (
                      <button
                        onClick={() => { setInvoiceCustomerSearch(''); setInvoicePage(0); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Period</label>
                  <input
                    type="month"
                    value={invoicePeriodFilter}
                    onChange={(e) => { setInvoicePeriodFilter(e.target.value); setInvoicePage(0); }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
                <button
                  onClick={loadInvoicesData}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                >
                  <Filter className="w-4 h-4" />
                  Apply
                </button>
                {(invoiceStatusFilter || invoiceCustomerSearch || invoicePeriodFilter) && (
                  <button
                    onClick={() => {
                      setInvoiceStatusFilter('');
                      setInvoiceCustomerSearch('');
                      setInvoicePeriodFilter('');
                      setInvoicePage(0);
                    }}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Invoice #</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Period</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Total</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {invoices.map((invoice) => (
                      <Fragment key={invoice.id}>
                        <tr
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                          onClick={() =>
                            setExpandedInvoiceId(expandedInvoiceId === invoice.id ? null : invoice.id)
                          }
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {invoice.invoice_number}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-900 dark:text-gray-100">{invoice.customer_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {invoice.customer_code}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{capitalize(invoice.type)}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{invoice.period}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-100">
                            {formatCurrency(invoice.total)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={invoice.status} colorMap={INVOICE_STATUS_COLORS} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedInvoiceId(
                                    expandedInvoiceId === invoice.id ? null : invoice.id
                                  );
                                }}
                                className="p-1 text-gray-400 hover:text-primary-600"
                                title="View details"
                              >
                                {expandedInvoiceId === invoice.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                              {(invoice.status === 'pending_review' || invoice.status === 'draft') && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveInvoice(invoice.id);
                                    }}
                                    disabled={approvingInvoiceId === invoice.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                    title="Approve"
                                  >
                                    {approvingInvoiceId === invoice.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <CheckCircle className="w-3 h-3" />
                                    )}
                                    Approve
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVoidingInvoiceId(voidingInvoiceId === invoice.id ? null : invoice.id);
                                      setVoidReason('');
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                    title="Void"
                                  >
                                    <Ban className="w-3 h-3" />
                                    Void
                                  </button>
                                </>
                              )}
                              {invoice.status === 'approved' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendInvoice(invoice.id);
                                  }}
                                  disabled={sendingInvoiceId === invoice.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                                  title="Send"
                                >
                                  {sendingInvoiceId === invoice.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Send className="w-3 h-3" />
                                  )}
                                  Send
                                </button>
                              )}
                            </div>
                            {/* Inline void reason input */}
                            {voidingInvoiceId === invoice.id && (
                              <div
                                className="mt-2 flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={voidReason}
                                  onChange={(e) => setVoidReason(e.target.value)}
                                  placeholder="Void reason..."
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleVoidInvoice(invoice.id);
                                    if (e.key === 'Escape') { setVoidingInvoiceId(null); setVoidReason(''); }
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleVoidInvoice(invoice.id)}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => { setVoidingInvoiceId(null); setVoidReason(''); }}
                                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {/* Expanded detail row */}
                        {expandedInvoiceId === invoice.id && (
                          <tr key={`${invoice.id}-detail`}>
                            <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-gray-900/50">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                                  <p className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatDate(invoice.created_at)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
                                  <p className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatDate(invoice.due_date)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {formatCurrency(invoice.total)}
                                  </p>
                                </div>
                              </div>
                              {/* Quick actions in detail */}
                              {invoice.status === 'sent' && (
                                <div className="mb-4 flex items-center gap-2">
                                  <button
                                    onClick={() => handleSendInvoice(invoice.id)}
                                    disabled={sendingInvoiceId === invoice.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {sendingInvoiceId === invoice.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Send className="w-3 h-3" />
                                    )}
                                    Resend Invoice
                                  </button>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Queue this invoice for re-delivery
                                  </span>
                                </div>
                              )}
                              {invoice.line_items && invoice.line_items.length > 0 ? (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Line Items
                                  </h4>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="py-1 text-left text-gray-500 dark:text-gray-400">
                                          Description
                                        </th>
                                        <th className="py-1 text-left text-gray-500 dark:text-gray-400">
                                          Car #
                                        </th>
                                        <th className="py-1 text-right text-gray-500 dark:text-gray-400">
                                          Qty
                                        </th>
                                        <th className="py-1 text-right text-gray-500 dark:text-gray-400">
                                          Unit Price
                                        </th>
                                        <th className="py-1 text-right text-gray-500 dark:text-gray-400">
                                          Amount
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {invoice.line_items.map((item) => (
                                        <tr
                                          key={item.id}
                                          className="border-b border-gray-100 dark:border-gray-800"
                                        >
                                          <td className="py-1.5 text-gray-700 dark:text-gray-300">
                                            {item.description}
                                          </td>
                                          <td className="py-1.5 font-mono text-gray-500 dark:text-gray-400">
                                            {item.car_number || '--'}
                                          </td>
                                          <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">
                                            {item.quantity}
                                          </td>
                                          <td className="py-1.5 text-right font-mono text-gray-600 dark:text-gray-400">
                                            {formatCurrency(item.unit_price)}
                                          </td>
                                          <td className="py-1.5 text-right font-mono font-medium text-gray-900 dark:text-gray-100">
                                            {formatCurrency(item.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                  No line item details available for this invoice.
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState
                            icon={<FileText className="w-10 h-10" strokeWidth={1.5} />}
                            message="No invoices found matching the current filters."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Invoice Pagination */}
              {invoiceTotal > 50 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {invoicePage * 50 + 1} to {Math.min((invoicePage + 1) * 50, invoiceTotal)} of {invoiceTotal} invoices
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInvoicePage(p => Math.max(0, p - 1))}
                      disabled={invoicePage === 0}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Page {invoicePage + 1} of {Math.max(1, Math.ceil(invoiceTotal / 50))}
                    </span>
                    <button
                      onClick={() => setInvoicePage(p => Math.min(Math.ceil(invoiceTotal / 50) - 1, p + 1))}
                      disabled={(invoicePage + 1) * 50 >= invoiceTotal}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: CHARGEBACKS                                                */}
        {/* ================================================================= */}
        {!loading && activeTab === 'chargebacks' && (
          <div className="space-y-6">
            {/* Pipeline Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'draft', label: 'Draft', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', textColor: 'text-blue-700 dark:text-blue-400' },
                { key: 'pending_review', label: 'Pending Review', color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800', textColor: 'text-yellow-700 dark:text-yellow-400' },
                { key: 'approved', label: 'Approved', color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', textColor: 'text-green-700 dark:text-green-400' },
                { key: 'invoiced', label: 'Invoiced', color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800', textColor: 'text-indigo-700 dark:text-indigo-400' },
              ].map((step, idx) => (
                <div key={step.key} className="relative">
                  <div className={`rounded-lg border p-4 ${step.color}`}>
                    <p className={`text-sm font-medium ${step.textColor}`}>{step.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${step.textColor}`}>
                      {chargebackPipelineCounts[step.key as keyof typeof chargebackPipelineCounts]}
                    </p>
                  </div>
                  {idx < 3 && (
                    <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                      <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Create Chargeback Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowChargebackModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Create Chargeback
              </button>
            </div>

            {/* Chargebacks Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Car #</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Type</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Amount</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Submitted</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {chargebacks.map((cb) => (
                      <Fragment key={cb.id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-medium font-mono text-gray-900 dark:text-gray-100">
                            {cb.car_number}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-900 dark:text-gray-100">{cb.customer_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {cb.customer_code}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{capitalize(cb.type)}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-100">
                            {formatCurrency(cb.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={cb.status} colorMap={CHARGEBACK_STATUS_COLORS} />
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {formatDate(cb.submitted_date)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(cb.status === 'pending_review' || cb.status === 'draft') && (
                              <button
                                onClick={() =>
                                  setChargebackReviewId(chargebackReviewId === cb.id ? null : cb.id)
                                }
                                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Review
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Review panel */}
                        {chargebackReviewId === cb.id && (
                          <tr key={`${cb.id}-review`}>
                            <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-gray-900/50">
                              <div className="space-y-3">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  <span className="font-medium">Description: </span>
                                  {cb.description}
                                </p>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Review Notes
                                  </label>
                                  <textarea
                                    value={chargebackReviewNotes}
                                    onChange={(e) => setChargebackReviewNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                    placeholder="Add review notes..."
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleChargebackAction(cb.id, 'approve')}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleChargebackAction(cb.id, 'reject')}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => {
                                      setChargebackReviewId(null);
                                      setChargebackReviewNotes('');
                                    }}
                                    className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {chargebacks.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState
                            icon={<FileText className="w-10 h-10" strokeWidth={1.5} />}
                            message="No chargebacks found. Create one to get started."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Chargeback Pagination */}
              {chargebackTotal > 50 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {chargebackPage * 50 + 1} to {Math.min((chargebackPage + 1) * 50, chargebackTotal)} of {chargebackTotal} chargebacks
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChargebackPage(p => Math.max(0, p - 1))}
                      disabled={chargebackPage === 0}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Page {chargebackPage + 1} of {Math.max(1, Math.ceil(chargebackTotal / 50))}
                    </span>
                    <button
                      onClick={() => setChargebackPage(p => Math.min(Math.ceil(chargebackTotal / 50) - 1, p + 1))}
                      disabled={(chargebackPage + 1) * 50 >= chargebackTotal}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Create Chargeback Modal */}
            {showChargebackModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Create Chargeback
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Car Number
                      </label>
                      <input
                        type="text"
                        value={newChargeback.car_number}
                        onChange={(e) =>
                          setNewChargeback({ ...newChargeback, car_number: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., UTLX 12345"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Customer Code
                      </label>
                      <input
                        type="text"
                        value={newChargeback.customer_code}
                        onChange={(e) =>
                          setNewChargeback({ ...newChargeback, customer_code: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="Customer code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type
                      </label>
                      <select
                        value={newChargeback.type}
                        onChange={(e) =>
                          setNewChargeback({ ...newChargeback, type: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="damage">Damage</option>
                        <option value="late_return">Late Return</option>
                        <option value="cleaning">Cleaning</option>
                        <option value="unauthorized_repair">Unauthorized Repair</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        value={newChargeback.amount || ''}
                        onChange={(e) =>
                          setNewChargeback({
                            ...newChargeback,
                            amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={newChargeback.description}
                        onChange={(e) =>
                          setNewChargeback({ ...newChargeback, description: e.target.value })
                        }
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="Describe the chargeback reason..."
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => {
                          setShowChargebackModal(false);
                          setNewChargeback({
                            car_number: '',
                            customer_code: '',
                            type: 'damage',
                            amount: 0,
                            description: '',
                          });
                        }}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateChargeback}
                        disabled={
                          !newChargeback.car_number ||
                          !newChargeback.customer_code ||
                          !newChargeback.amount
                        }
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Create Chargeback
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: ADJUSTMENTS                                                */}
        {/* ================================================================= */}
        {!loading && activeTab === 'adjustments' && (
          <div className="space-y-6">
            {/* Header with Create button */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Billing Adjustments
              </h2>
              <button
                onClick={() => setShowAdjustmentModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Create Adjustment
              </button>
            </div>

            {/* Pending Approvals Section */}
            {adjustments.filter((a) => a.status === 'pending').length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-3">
                  Pending Approvals ({adjustments.filter((a) => a.status === 'pending').length})
                </h3>
                <div className="space-y-3">
                  {adjustments
                    .filter((a) => a.status === 'pending')
                    .map((adj) => (
                      <div
                        key={adj.id}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {adj.customer_name}
                              </span>
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                {adj.customer_code}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{adj.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>Type: {capitalize(adj.type)}</span>
                              <span>Requested by: {adj.requested_by}</span>
                              <span>{formatDate(adj.requested_date)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                              {formatCurrency(adj.amount)}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => handleAdjustmentAction(adj.id, 'approve')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleAdjustmentAction(adj.id, 'reject')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs"
                              >
                                <XCircle className="w-3 h-3" />
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* All Adjustments Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
                  All Adjustments
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Type</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Description</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Requested By</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {adjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <div className="text-gray-900 dark:text-gray-100">{adj.customer_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {adj.customer_code}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{capitalize(adj.type)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-100">
                          {formatCurrency(adj.amount)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={adj.description}>
                          {adj.description}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={adj.status} colorMap={ADJUSTMENT_STATUS_COLORS} />
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{adj.requested_by}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {formatDate(adj.requested_date)}
                        </td>
                      </tr>
                    ))}
                    {adjustments.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState
                            icon={<TrendingUp className="w-10 h-10" strokeWidth={1.5} />}
                            message="No adjustments found. Create one to get started."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create Adjustment Modal */}
            {showAdjustmentModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Create Adjustment
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Customer Code
                      </label>
                      <input
                        type="text"
                        value={newAdjustment.customer_code}
                        onChange={(e) =>
                          setNewAdjustment({ ...newAdjustment, customer_code: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="Customer code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type
                      </label>
                      <select
                        value={newAdjustment.type}
                        onChange={(e) =>
                          setNewAdjustment({ ...newAdjustment, type: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="credit">Credit</option>
                        <option value="debit">Debit</option>
                        <option value="rate_correction">Rate Correction</option>
                        <option value="mileage_correction">Mileage Correction</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        value={newAdjustment.amount || ''}
                        onChange={(e) =>
                          setNewAdjustment({
                            ...newAdjustment,
                            amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={newAdjustment.description}
                        onChange={(e) =>
                          setNewAdjustment({ ...newAdjustment, description: e.target.value })
                        }
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="Describe the adjustment reason..."
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => {
                          setShowAdjustmentModal(false);
                          setNewAdjustment({
                            customer_code: '',
                            type: 'credit',
                            amount: 0,
                            description: '',
                          });
                        }}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateAdjustment}
                        disabled={
                          !newAdjustment.customer_code ||
                          !newAdjustment.amount ||
                          !newAdjustment.description
                        }
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Create Adjustment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: MILEAGE                                                    */}
        {/* ================================================================= */}
        {!loading && activeTab === 'mileage' && (
          <div className="space-y-6">
            {/* Upload button */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Mileage Billing
              </h2>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium cursor-pointer">
                {uploadingMileage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploadingMileage ? 'Uploading...' : 'Upload Mileage File'}
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls,.txt"
                  onChange={handleUploadMileageFile}
                  disabled={uploadingMileage}
                />
              </label>
            </div>

            {/* Mileage Files Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
                  Uploaded Files
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Filename</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Period</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Records</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Errors</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {mileageFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{file.filename}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{file.uploaded_by}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{file.period}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={file.status} colorMap={MILEAGE_STATUS_COLORS} />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                          {file.total_records.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              file.error_count > 0
                                ? 'text-red-600 dark:text-red-400 font-medium'
                                : 'text-gray-500 dark:text-gray-400'
                            }
                          >
                            {file.error_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {formatDate(file.uploaded_at)}
                        </td>
                      </tr>
                    ))}
                    {mileageFiles.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <EmptyState
                            icon={<Upload className="w-10 h-10" strokeWidth={1.5} />}
                            message="No mileage files uploaded. Upload a file to get started."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Verification Queue */}
            {mileageRecords.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
                    Verification Queue ({mileageRecords.length} unverified)
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Records requiring manual verification before billing
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Car #</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Customer</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Period</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Miles</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {mileageRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-gray-100">
                            {rec.car_number}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{rec.customer_name}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{rec.period}</td>
                          <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                            {rec.miles.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleVerifyMileageRecord(rec.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Verify
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary by Customer/Period */}
            {mileageSummary.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
                    Mileage Summary by Customer
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Customer</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Period</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Total Miles</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Cars</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Verified</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {mileageSummary.map((s, idx) => {
                        const pct = s.car_count > 0 ? (s.verified_count / s.car_count) * 100 : 0;
                        return (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {s.customer_name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                {s.customer_code}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.period}</td>
                            <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                              {s.total_miles.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                              {s.car_count}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                              {s.verified_count}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      pct === 100
                                        ? 'bg-green-500'
                                        : pct >= 50
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state for mileage summary when no data and no files */}
            {mileageSummary.length === 0 && mileageFiles.length === 0 && mileageRecords.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <Upload className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-gray-500 dark:text-gray-400">
                  No mileage data available. Upload a mileage file to populate this section.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: COST ALLOCATION                                            */}
        {/* ================================================================= */}
        {!loading && activeTab === 'costs' && (
          <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Period:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <button
                onClick={loadCostAllocationData}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {/* Summary Cards */}
            {costAllocations.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard
                  label="Total Maintenance Cost"
                  value={costAllocations.reduce((sum, c) => sum + Number(c.total_cost), 0)}
                  icon={<DollarSign className="w-5 h-5 text-red-600" />}
                  color="bg-red-50 dark:bg-red-900/20"
                  isCurrency
                />
                <KpiCard
                  label="Lessee Billable"
                  value={costAllocations.reduce((sum, c) => sum + Number(c.lessee_billable), 0)}
                  icon={<TrendingUp className="w-5 h-5 text-green-600" />}
                  color="bg-green-50 dark:bg-green-900/20"
                  isCurrency
                />
                <KpiCard
                  label="Owner Absorbed"
                  value={costAllocations.reduce((sum, c) => sum + Number(c.owner_absorbed), 0)}
                  icon={<AlertTriangle className="w-5 h-5 text-yellow-600" />}
                  color="bg-yellow-50 dark:bg-yellow-900/20"
                  isCurrency
                />
              </div>
            )}

            {/* Cost Allocation by Customer Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Cost Allocation by Customer
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Maintenance cost allocation for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Customer</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Allocations</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Labor</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Material</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Freight</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Total Cost</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Lessee Share</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Owner Share</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {costAllocations.map((ca) => (
                      <tr key={ca.customer_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{ca.customer_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{ca.customer_code}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{ca.allocation_count}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">{formatCurrency(Number(ca.labor_total))}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">{formatCurrency(Number(ca.material_total))}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">{formatCurrency(Number(ca.freight_total))}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-gray-900 dark:text-gray-100">{formatCurrency(Number(ca.total_cost))}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">{formatCurrency(Number(ca.lessee_billable))}</td>
                        <td className="px-4 py-3 text-right font-mono text-yellow-600 dark:text-yellow-400">{formatCurrency(Number(ca.owner_absorbed))}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {ca.pending_count > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                {ca.pending_count} pending
                              </span>
                            )}
                            {ca.allocated_count > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                {ca.allocated_count} allocated
                              </span>
                            )}
                            {ca.invoiced_count > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                {ca.invoiced_count} invoiced
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {costAllocations.length === 0 && (
                      <tr>
                        <td colSpan={9}>
                          <EmptyState
                            icon={<DollarSign className="w-10 h-10" strokeWidth={1.5} />}
                            message="No cost allocation data for this period."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
