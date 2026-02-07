'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getReconciliationDashboard,
  listReconciliationDiscrepancies,
  resolveReconciliationDiscrepancy,
  bulkResolveDiscrepancies,
  detectDuplicates,
} from '@/lib/api';
import {
  AlertTriangle,
  Lock,
  CheckCircle2,
  Info,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  XCircle,
  GitMerge,
  Loader2,
} from 'lucide-react';

type ReconciliationTab = 'discrepancies' | 'duplicates' | 'history';

interface DashboardSummary {
  total_open: number;
  critical: number;
  warnings: number;
  resolved_today: number;
}

interface Discrepancy {
  id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  source_value: string;
  target_value: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  status: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_action?: string;
  resolution_notes?: string;
}

interface DuplicateMatch {
  id: string;
  entity_a_id: string;
  entity_a_label: string;
  entity_b_id: string;
  entity_b_label: string;
  confidence: number;
  fields_matched: string[];
  entity_type: string;
}

const ENTITY_TYPES = ['customers', 'cars', 'contracts', 'invoices', 'allocations'];
const SEVERITY_OPTIONS = ['critical', 'warning', 'info'];
const ITEMS_PER_PAGE = 50;

export default function DataReconciliationPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ReconciliationTab>('discrepancies');

  // Dashboard summary
  const [summary, setSummary] = useState<DashboardSummary>({
    total_open: 0,
    critical: 0,
    warnings: 0,
    resolved_today: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Discrepancies state
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [discrepanciesTotal, setDiscrepanciesTotal] = useState(0);
  const [discrepanciesLoading, setDiscrepanciesLoading] = useState(false);
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState<'open' | 'resolved'>('open');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // Duplicates state
  const [duplicateEntityType, setDuplicateEntityType] = useState('customers');
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesSearched, setDuplicatesSearched] = useState(false);

  // History state
  const [history, setHistory] = useState<Discrepancy[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadDashboard = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await getReconciliationDashboard();
      if (data) {
        setSummary({
          total_open: data.total_open ?? 0,
          critical: data.critical ?? 0,
          warnings: data.warnings ?? 0,
          resolved_today: data.resolved_today ?? 0,
        });
      }
    } catch (err) {
      console.error('Failed to load reconciliation dashboard:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadDiscrepancies = useCallback(async () => {
    setDiscrepanciesLoading(true);
    setError(null);
    try {
      const result = await listReconciliationDiscrepancies({
        entity_type: filterEntityType || undefined,
        severity: filterSeverity || undefined,
        status: filterStatus,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
      setDiscrepancies(result.items || []);
      setDiscrepanciesTotal(result.total || 0);
    } catch (err: any) {
      console.error('Failed to load discrepancies:', err);
      setError(err.message || 'Failed to load discrepancies');
      setDiscrepancies([]);
      setDiscrepanciesTotal(0);
    } finally {
      setDiscrepanciesLoading(false);
    }
  }, [filterEntityType, filterSeverity, filterStatus, currentPage]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await listReconciliationDiscrepancies({
        status: 'resolved',
        limit: 100,
        page: 1,
      });
      setHistory(result.items || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      loadDashboard();
    }
  }, [isAuthenticated, user, loadDashboard]);

  // Load data when tab or filters change
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    if (activeTab === 'discrepancies') {
      loadDiscrepancies();
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, isAuthenticated, user, loadDiscrepancies, loadHistory]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [filterEntityType, filterSeverity, filterStatus]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleResolve = async (id: string, action: string) => {
    setResolvingIds((prev) => new Set(prev).add(id));
    try {
      await resolveReconciliationDiscrepancy(id, { action });
      // Refresh both the list and dashboard
      await Promise.all([loadDiscrepancies(), loadDashboard()]);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      console.error('Failed to resolve discrepancy:', err);
      setError(err.message || 'Failed to resolve discrepancy');
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkResolve = async (action: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setResolvingIds(new Set(ids));
    setShowBulkMenu(false);
    try {
      await bulkResolveDiscrepancies(ids, { action });
      await Promise.all([loadDiscrepancies(), loadDashboard()]);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Failed to bulk resolve:', err);
      setError(err.message || 'Failed to bulk resolve discrepancies');
    } finally {
      setResolvingIds(new Set());
    }
  };

  const handleDetectDuplicates = async () => {
    setDuplicatesLoading(true);
    setDuplicatesSearched(true);
    try {
      const result = await detectDuplicates(duplicateEntityType);
      setDuplicates(result || []);
    } catch (err: any) {
      console.error('Failed to detect duplicates:', err);
      setError(err.message || 'Failed to detect duplicates');
      setDuplicates([]);
    } finally {
      setDuplicatesLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === discrepancies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(discrepancies.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Pagination
  const totalPages = Math.ceil(discrepanciesTotal / ITEMS_PER_PAGE);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const severityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'info':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const typeBadge = (type: string) => {
    switch (type) {
      case 'missing':
        return 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      case 'mismatch':
        return 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
      case 'extra':
        return 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'format':
        return 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400';
      default:
        return 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const confidenceColor = (pct: number) => {
    if (pct >= 90) return 'text-red-600 dark:text-red-400';
    if (pct >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  // ---------------------------------------------------------------------------
  // Auth guards
  // ---------------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-md mx-auto">
          <Lock className="w-12 h-12 mx-auto text-yellow-500 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">Authentication Required</h3>
          <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            Please sign in to access the data reconciliation dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            You do not have permission to access data reconciliation.
            <br />
            Your role: <strong>{user?.role}</strong>
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Reconciliation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review and resolve discrepancies from data migration
          </p>
        </div>
        <button
          onClick={() => {
            loadDashboard();
            if (activeTab === 'discrepancies') loadDiscrepancies();
            if (activeTab === 'history') loadHistory();
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
            aria-label="Dismiss error"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Open */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Open</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {summaryLoading ? (
                  <span className="inline-block w-12 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : (
                  summary.total_open.toLocaleString()
                )}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Critical */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-800/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">Critical</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
                {summaryLoading ? (
                  <span className="inline-block w-12 h-7 bg-red-100 dark:bg-red-900/30 rounded animate-pulse" />
                ) : (
                  summary.critical.toLocaleString()
                )}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Warnings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-yellow-200 dark:border-yellow-800/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Warnings</p>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mt-1">
                {summaryLoading ? (
                  <span className="inline-block w-12 h-7 bg-yellow-100 dark:bg-yellow-900/30 rounded animate-pulse" />
                ) : (
                  summary.warnings.toLocaleString()
                )}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Resolved Today */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-green-200 dark:border-green-800/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Resolved Today</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                {summaryLoading ? (
                  <span className="inline-block w-12 h-7 bg-green-100 dark:bg-green-900/30 rounded animate-pulse" />
                ) : (
                  summary.resolved_today.toLocaleString()
                )}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {([
            { key: 'discrepancies', label: 'Discrepancies' },
            { key: 'duplicates', label: 'Duplicates' },
            { key: 'history', label: 'History' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'discrepancies' && (
        <DiscrepanciesTab
          discrepancies={discrepancies}
          total={discrepanciesTotal}
          loading={discrepanciesLoading}
          filterEntityType={filterEntityType}
          filterSeverity={filterSeverity}
          filterStatus={filterStatus}
          currentPage={currentPage}
          totalPages={totalPages}
          selectedIds={selectedIds}
          resolvingIds={resolvingIds}
          showBulkMenu={showBulkMenu}
          onFilterEntityType={setFilterEntityType}
          onFilterSeverity={setFilterSeverity}
          onFilterStatus={setFilterStatus}
          onPageChange={setCurrentPage}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onResolve={handleResolve}
          onBulkResolve={handleBulkResolve}
          onShowBulkMenu={setShowBulkMenu}
          severityBadge={severityBadge}
          typeBadge={typeBadge}
        />
      )}

      {activeTab === 'duplicates' && (
        <DuplicatesTab
          entityType={duplicateEntityType}
          duplicates={duplicates}
          loading={duplicatesLoading}
          searched={duplicatesSearched}
          onEntityTypeChange={setDuplicateEntityType}
          onDetect={handleDetectDuplicates}
          confidenceColor={confidenceColor}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          history={history}
          loading={historyLoading}
          severityBadge={severityBadge}
        />
      )}
    </div>
  );
}

// =============================================================================
// Discrepancies Tab
// =============================================================================

function DiscrepanciesTab({
  discrepancies,
  total,
  loading,
  filterEntityType,
  filterSeverity,
  filterStatus,
  currentPage,
  totalPages,
  selectedIds,
  resolvingIds,
  showBulkMenu,
  onFilterEntityType,
  onFilterSeverity,
  onFilterStatus,
  onPageChange,
  onToggleSelect,
  onToggleSelectAll,
  onResolve,
  onBulkResolve,
  onShowBulkMenu,
  severityBadge,
  typeBadge,
}: {
  discrepancies: Discrepancy[];
  total: number;
  loading: boolean;
  filterEntityType: string;
  filterSeverity: string;
  filterStatus: 'open' | 'resolved';
  currentPage: number;
  totalPages: number;
  selectedIds: Set<string>;
  resolvingIds: Set<string>;
  showBulkMenu: boolean;
  onFilterEntityType: (v: string) => void;
  onFilterSeverity: (v: string) => void;
  onFilterStatus: (v: 'open' | 'resolved') => void;
  onPageChange: (v: number) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onResolve: (id: string, action: string) => void;
  onBulkResolve: (action: string) => void;
  onShowBulkMenu: (v: boolean) => void;
  severityBadge: (s: string) => string;
  typeBadge: (t: string) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Entity Type</label>
          <select
            value={filterEntityType}
            onChange={(e) => onFilterEntityType(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Severity</label>
          <select
            value={filterSeverity}
            onChange={(e) => onFilterSeverity(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">All</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
          <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => onFilterStatus('open')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filterStatus === 'open'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => onFilterStatus('resolved')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filterStatus === 'resolved'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Resolved
            </button>
          </div>
        </div>
        <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {total.toLocaleString()} result{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {selectedIds.size} selected
          </span>
          <div className="relative">
            <button
              onClick={() => onShowBulkMenu(!showBulkMenu)}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
            >
              Bulk Resolve
            </button>
            {showBulkMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[160px]">
                <button
                  onClick={() => onBulkResolve('accept_source')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Accept Source
                </button>
                <button
                  onClick={() => onBulkResolve('accept_target')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Accept Target
                </button>
                <button
                  onClick={() => onBulkResolve('ignore')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Ignore
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => onShowBulkMenu(false)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin h-8 w-8 text-primary-600" aria-hidden="true" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={discrepancies.length > 0 && selectedIds.size === discrepancies.length}
                      onChange={onToggleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      aria-label="Select all discrepancies"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Field</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {discrepancies.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => onToggleSelect(d.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                        aria-label={`Select discrepancy ${d.id}`}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {d.entity_type}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {d.entity_id?.length > 12 ? `${d.entity_id.substring(0, 12)}...` : d.entity_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {d.field}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[160px] truncate" title={d.source_value}>
                      {d.source_value || <span className="italic text-gray-400 dark:text-gray-500">(empty)</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[160px] truncate" title={d.target_value}>
                      {d.target_value || <span className="italic text-gray-400 dark:text-gray-500">(empty)</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityBadge(d.severity)}`}>
                        {d.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeBadge(d.type)}`}>
                        {d.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {resolvingIds.has(d.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary-600 ml-auto" aria-label="Resolving" />
                      ) : d.status === 'resolved' ? (
                        <span className="text-xs text-green-600 dark:text-green-400">Resolved</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onResolve(d.id, 'accept_source')}
                            className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Accept Source"
                          >
                            Source
                          </button>
                          <button
                            onClick={() => onResolve(d.id, 'accept_target')}
                            className="px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Accept Target"
                          >
                            Target
                          </button>
                          <button
                            onClick={() => onResolve(d.id, 'ignore')}
                            className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Ignore"
                          >
                            Ignore
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {discrepancies.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                      {filterEntityType || filterSeverity
                        ? 'No discrepancies match your filters'
                        : filterStatus === 'open'
                        ? 'No open discrepancies found'
                        : 'No resolved discrepancies found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Duplicates Tab
// =============================================================================

function DuplicatesTab({
  entityType,
  duplicates,
  loading,
  searched,
  onEntityTypeChange,
  onDetect,
  confidenceColor,
}: {
  entityType: string;
  duplicates: DuplicateMatch[];
  loading: boolean;
  searched: boolean;
  onEntityTypeChange: (v: string) => void;
  onDetect: () => void;
  confidenceColor: (pct: number) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Entity type selector + action */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">Entity type:</span>
        {['customers', 'cars'].map((t) => (
          <button
            key={t}
            onClick={() => onEntityTypeChange(t)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              entityType === t
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={onDetect}
          disabled={loading}
          className="ml-4 flex items-center gap-2 px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="w-4 h-4" aria-hidden="true" />
          )}
          Detect Duplicates
        </button>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin h-8 w-8 text-primary-600" aria-hidden="true" />
          </div>
        ) : duplicates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity A</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity B</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Match Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fields Matched</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {duplicates.map((dup) => (
                  <tr key={dup.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{dup.entity_a_label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{dup.entity_a_id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{dup.entity_b_label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{dup.entity_b_id}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${confidenceColor(dup.confidence)}`}>
                        {dup.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {dup.fields_matched.map((f) => (
                          <span
                            key={f}
                            className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors flex items-center gap-1">
                          <GitMerge className="w-3 h-3" aria-hidden="true" />
                          Merge
                        </button>
                        <button className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                          Ignore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            {searched ? (
              <div>
                <CheckCircle2 className="w-10 h-10 mx-auto text-green-400 mb-3" aria-hidden="true" />
                <p className="text-sm">No duplicates found for <strong>{entityType}</strong>.</p>
              </div>
            ) : (
              <div>
                <Search className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" aria-hidden="true" />
                <p className="text-sm">Select an entity type and click &quot;Detect Duplicates&quot; to scan for potential duplicates.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// History Tab
// =============================================================================

function HistoryTab({
  history,
  loading,
  severityBadge,
}: {
  history: Discrepancy[];
  loading: boolean;
  severityBadge: (s: string) => string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin h-8 w-8 text-primary-600" aria-hidden="true" />
        </div>
      ) : history.length > 0 ? (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {history.map((item) => (
            <li key={item.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityBadge(item.severity)}`}>
                      {item.severity}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.entity_type}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {item.entity_id}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      &mdash; {item.field}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="line-through mr-2">{item.source_value || '(empty)'}</span>
                    <span className="text-gray-400 dark:text-gray-500 mr-2">&rarr;</span>
                    <span>{item.target_value || '(empty)'}</span>
                  </div>
                  {item.resolution_notes && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 italic">
                      {item.resolution_notes}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {item.resolved_at ? new Date(item.resolved_at).toLocaleString() : '-'}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {item.resolved_by || 'System'}
                    {item.resolution_action && (
                      <span className="ml-1 text-gray-400 dark:text-gray-500">
                        ({item.resolution_action.replace('_', ' ')})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Info className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" aria-hidden="true" />
          <p className="text-sm">No resolution history found.</p>
        </div>
      )}
    </div>
  );
}
