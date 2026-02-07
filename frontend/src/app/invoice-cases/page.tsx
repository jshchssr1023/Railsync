'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import {
  Loader2, Search, X, FileText, ChevronRight, Plus,
  AlertOctagon, Inbox, UserCheck, AlertTriangle,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface InvoiceCase {
  id: string;
  case_number: string;
  invoice_type: 'SHOP' | 'MRU';
  workflow_state: string;
  vendor_name?: string;
  shop_code?: string;
  invoice_number?: string;
  invoice_date?: string;
  total_amount?: number;
  currency?: string;
  assigned_admin_id?: string;
  assigned_admin_name?: string;
  assigned_admin_email?: string;
  received_at: string;
}

interface StateBucket {
  state: string;
  count: number;
  total_amount: number;
}

interface CreateCaseForm {
  invoice_type: 'SHOP' | 'MRU';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const SPECIAL_LESSEES = ['EXXON', 'IMPOIL', 'MARATHON'];

const WORKFLOW_STATES = [
  'RECEIVED', 'ASSIGNED', 'WAITING_ON_SHOPPING', 'WAITING_ON_CUSTOMER_APPROVAL',
  'READY_FOR_IMPORT', 'IMPORTED', 'ADMIN_REVIEW', 'SUBMITTED',
  'APPROVER_REVIEW', 'APPROVED', 'BILLING_REVIEW', 'BILLING_APPROVED',
  'SAP_STAGED', 'SAP_POSTED', 'PAID', 'CLOSED', 'BLOCKED',
];

const CLOSED_STATES = ['PAID', 'CLOSED'];

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
  RECEIVED:                       'Received',
  ASSIGNED:                       'Assigned',
  WAITING_ON_SHOPPING:            'Waiting on Shopping',
  WAITING_ON_CUSTOMER_APPROVAL:   'Customer Approval',
  READY_FOR_IMPORT:               'Ready for Import',
  IMPORTED:                       'Imported',
  ADMIN_REVIEW:                   'Admin Review',
  SUBMITTED:                      'Submitted',
  APPROVER_REVIEW:                'Approver Review',
  APPROVED:                       'Approved',
  BILLING_REVIEW:                 'Billing Review',
  BILLING_APPROVED:               'Billing Approved',
  SAP_STAGED:                     'SAP Staged',
  SAP_POSTED:                     'SAP Posted',
  PAID:                           'Paid',
  CLOSED:                         'Closed',
  BLOCKED:                        'Blocked',
};

const EMPTY_FORM: CreateCaseForm = {
  invoice_type: 'SHOP', vendor_name: '', shop_code: '', invoice_number: '',
  invoice_date: '', total_amount: '', currency: 'USD', lessee: '',
  car_marks: '', fms_shopping_id: '', fms_workflow_id: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1mo ago' : `${months}mo ago`;
}

// ---------------------------------------------------------------------------
// Page wrapper with Suspense
// ---------------------------------------------------------------------------
export default function InvoiceCasesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    }>
      <InvoiceCasesContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------
function InvoiceCasesContent() {
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // State
  const [cases, setCases] = useState<InvoiceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCaseForm>({ ...EMPTY_FORM });
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    workflow_state: searchParams.get('state') || '',
    invoice_type: '',
    from_date: '',
    to_date: '',
    my_cases: false,
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stateStats, setStateStats] = useState<StateBucket[]>([]);
  const pageSize = 25;

  const debouncedSearch = useDebounce(searchTerm, 300);

  const getToken = () => getAccessToken() || localStorage.getItem('railsync_access_token');

  // ---------- Data fetching ----------

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (filters.workflow_state) params.append('workflow_state', filters.workflow_state);
      if (filters.invoice_type) params.append('invoice_type', filters.invoice_type);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filters.my_cases && user?.id) params.append('assigned_admin_id', user.id);

      const res = await fetch(`${API_URL}/invoice-cases?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.success) {
        setCases(data.data || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch invoice cases:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters, debouncedSearch, user?.id]);

  const fetchStateStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/invoice-cases/by-state`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setStateStats(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch state stats:', err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCases();
      fetchStateStats();
    }
  }, [isAuthenticated, fetchCases, fetchStateStats]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  // ---------- Actions ----------

  const openCreateModal = () => {
    setCreateForm({ ...EMPTY_FORM });
    setShowCreateModal(true);
  };

  const handleCreateCase = async () => {
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        invoice_type: createForm.invoice_type,
      };
      if (createForm.vendor_name) body.vendor_name = createForm.vendor_name;
      if (createForm.shop_code) body.shop_code = createForm.shop_code;
      if (createForm.invoice_number) body.invoice_number = createForm.invoice_number;
      if (createForm.invoice_date) body.invoice_date = createForm.invoice_date;
      if (createForm.total_amount) body.total_amount = parseFloat(createForm.total_amount);
      if (createForm.currency !== 'USD') body.currency = createForm.currency;
      if (createForm.lessee) body.lessee = createForm.lessee;
      if (createForm.car_marks) {
        body.car_marks = createForm.car_marks.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (createForm.fms_shopping_id) body.fms_shopping_id = createForm.fms_shopping_id;
      if (createForm.fms_workflow_id) body.fms_workflow_id = createForm.fms_workflow_id;

      const res = await fetch(`${API_URL}/invoice-cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success && data.data?.id) {
        toast.success(`Case ${data.data.case_number} created`);
        setShowCreateModal(false);
        router.push(`/invoice-cases/${data.data.id}`);
      } else {
        toast.error(data.error || 'Failed to create case');
      }
    } catch (err) {
      console.error('Create case failed:', err);
      toast.error('Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ workflow_state: '', invoice_type: '', from_date: '', to_date: '', my_cases: false });
  };

  // ---------- Computed ----------

  const totalOpen = stateStats
    .filter(s => !CLOSED_STATES.includes(s.state))
    .reduce((sum, s) => sum + s.count, 0);
  const unassignedCount = stateStats.find(s => s.state === 'RECEIVED')?.count || 0;
  const blockedCount = stateStats.find(s => s.state === 'BLOCKED')?.count || 0;
  const totalAmount = stateStats
    .filter(s => !CLOSED_STATES.includes(s.state))
    .reduce((sum, s) => sum + s.total_amount, 0);

  const hasFilters = searchTerm || filters.workflow_state || filters.invoice_type || filters.from_date || filters.to_date || filters.my_cases;
  const isSpecialLessee = createForm.lessee && SPECIAL_LESSEES.includes(createForm.lessee.toUpperCase());

  // ---------- Render ----------

  if (!isAuthenticated) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Please log in to view the case queue.
      </div>
    );
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Case Queue
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Invoice case workflow management
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Case
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => { setFilters(f => ({ ...f, workflow_state: '', my_cases: false })); }}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-1">
              <Inbox className="w-4 h-4 text-blue-500" aria-hidden="true" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Open</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalOpen}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatCurrency(totalAmount)}</div>
          </button>

          <button
            onClick={() => setFilters(f => ({ ...f, workflow_state: 'RECEIVED', my_cases: false }))}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-gray-500" aria-hidden="true" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{unassignedCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Awaiting assignment</div>
          </button>

          <button
            onClick={() => setFilters(f => ({ ...f, workflow_state: 'BLOCKED', my_cases: false }))}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertOctagon className="w-4 h-4 text-red-500" aria-hidden="true" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Blocked</span>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{blockedCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Requires attention</div>
          </button>

          <button
            onClick={() => setFilters(f => ({ ...f, workflow_state: '', my_cases: true }))}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-green-500" aria-hidden="true" />
              <span className="text-sm text-gray-500 dark:text-gray-400">My Cases</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">&mdash;</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Assigned to me</div>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search case #, invoice #, vendor..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Workflow State</label>
              <select
                value={filters.workflow_state}
                onChange={e => setFilters(f => ({ ...f, workflow_state: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All States</option>
                {WORKFLOW_STATES.map(state => (
                  <option key={state} value={state}>{STATE_LABELS[state] || state}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Invoice Type</label>
              <select
                value={filters.invoice_type}
                onChange={e => setFilters(f => ({ ...f, invoice_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Types</option>
                <option value="SHOP">SHOP</option>
                <option value="MRU">MRU</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">From Date</label>
              <input
                type="date"
                value={filters.from_date}
                onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">To Date</label>
              <input
                type="date"
                value={filters.to_date}
                onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilters(f => ({ ...f, my_cases: !f.my_cases }))}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  filters.my_cases
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <UserCheck className="w-4 h-4 inline mr-1" aria-hidden="true" />
                My Cases
              </button>
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Case Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4" aria-hidden="true" />
              Loading cases...
            </div>
          ) : cases.length === 0 ? (
            <EmptyState
              variant={hasFilters ? 'search' : 'neutral'}
              title={hasFilters ? 'No cases match your filters' : 'No invoice cases yet'}
              description={hasFilters
                ? 'Try adjusting your search or filter criteria.'
                : 'Create one to get started.'}
              actionLabel={hasFilters ? undefined : 'Create Case'}
              onAction={hasFilters ? undefined : openCreateModal}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Case #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">State</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoice #</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assigned To</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Age</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {cases.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/invoice-cases/${c.id}`)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900 dark:text-white">
                          {c.case_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${STATE_COLORS[c.workflow_state] || 'bg-gray-100'}`}>
                          {STATE_LABELS[c.workflow_state] || c.workflow_state}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                          c.invoice_type === 'SHOP'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400'
                        }`}>
                          {c.invoice_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {c.vendor_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {c.invoice_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                        {c.total_amount != null ? formatCurrency(c.total_amount) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {c.assigned_admin_name && c.assigned_admin_name.trim() ? (
                          <span className="text-gray-700 dark:text-gray-300">{c.assigned_admin_name}</span>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                        {timeAgo(c.received_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="w-5 h-5 text-gray-400" aria-hidden="true" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= total}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* CREATE CASE MODAL                                                 */}
      {/* ================================================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => !creating && setShowCreateModal(false)} />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Invoice Case</h2>
              <button
                onClick={() => !creating && setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Invoice Type */}
              <div>
                <label className={labelClass}>Invoice Type *</label>
                <div className="flex gap-4">
                  {(['SHOP', 'MRU'] as const).map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="invoice_type"
                        value={type}
                        checked={createForm.invoice_type === type}
                        onChange={() => setCreateForm(f => ({ ...f, invoice_type: type }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        type === 'SHOP'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400'
                      }`}>
                        {type}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {type === 'SHOP' ? 'Shop Invoice' : 'Mobile Repair Unit'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Vendor Name</label>
                  <input type="text" value={createForm.vendor_name} onChange={e => setCreateForm(f => ({ ...f, vendor_name: e.target.value }))} className={inputClass} placeholder="e.g. ABC Railcar Services" />
                </div>
                <div>
                  <label className={labelClass}>Shop Code</label>
                  <input type="text" value={createForm.shop_code} onChange={e => setCreateForm(f => ({ ...f, shop_code: e.target.value }))} className={inputClass} placeholder="e.g. SHOP-001" />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Invoice Number</label>
                  <input type="text" value={createForm.invoice_number} onChange={e => setCreateForm(f => ({ ...f, invoice_number: e.target.value }))} className={inputClass} placeholder="e.g. INV-2025-001" />
                </div>
                <div>
                  <label className={labelClass}>Invoice Date</label>
                  <input type="date" value={createForm.invoice_date} onChange={e => setCreateForm(f => ({ ...f, invoice_date: e.target.value }))} className={inputClass} />
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Total Amount</label>
                  <input type="number" step="0.01" value={createForm.total_amount} onChange={e => setCreateForm(f => ({ ...f, total_amount: e.target.value }))} className={inputClass} placeholder="0.00" />
                  {createForm.invoice_type === 'MRU' && createForm.total_amount && parseFloat(createForm.total_amount) > 1500 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> &gt; $1,500 &mdash; Maintenance review will be required
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Currency</label>
                  <select value={createForm.currency} onChange={e => setCreateForm(f => ({ ...f, currency: e.target.value }))} className={inputClass}>
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* Lessee */}
              <div>
                <label className={labelClass}>Lessee</label>
                <input type="text" value={createForm.lessee} onChange={e => setCreateForm(f => ({ ...f, lessee: e.target.value }))} className={inputClass} placeholder="e.g. GATX" />
                {isSpecialLessee && (
                  <div className="mt-1 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    Special lessee detected. Maintenance approval will be required before this case can advance past import.
                  </div>
                )}
              </div>

              {/* Car Marks */}
              <div>
                <label className={labelClass}>Car Marks (comma-separated)</label>
                <input type="text" value={createForm.car_marks} onChange={e => setCreateForm(f => ({ ...f, car_marks: e.target.value }))} className={inputClass} placeholder="e.g. GATX 12345, UTLX 67890" />
              </div>

              {/* FMS IDs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>FMS Shopping ID</label>
                  <input type="text" value={createForm.fms_shopping_id} onChange={e => setCreateForm(f => ({ ...f, fms_shopping_id: e.target.value }))} className={inputClass} placeholder="Optional" />
                  {createForm.invoice_type === 'MRU' && createForm.fms_shopping_id && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> MRU with FMS Shopping will be treated as SHOP
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>FMS Workflow ID</label>
                  <input type="text" value={createForm.fms_workflow_id} onChange={e => setCreateForm(f => ({ ...f, fms_workflow_id: e.target.value }))} className={inputClass} placeholder="Optional" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCase}
                disabled={creating}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Case
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
