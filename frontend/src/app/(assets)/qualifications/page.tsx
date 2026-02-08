'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, AlertTriangle, Clock, CheckCircle, AlertCircle,
  RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Filter, Bell, XCircle
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  getQualificationStats,
  getQualificationsDueByMonth,
  listQualifications,
  listQualificationAlerts,
  listQualificationTypes,
  recalculateQualificationStatuses,
  generateQualificationAlerts,
  acknowledgeQualificationAlert,
} from '@/lib/api';
import type {
  QualificationStats,
  QualificationType,
  Qualification,
  QualificationAlert,
  DueByMonth,
} from '@/types';
import { DashboardSkeleton } from '@/components/PageSkeleton';

const PAGE_SIZE = 50;

// ============================================================================
// Status badge helper
// ============================================================================
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    overdue:  { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Overdue' },
    due:      { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'Due' },
    due_soon: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Due Soon' },
    current:  { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Current' },
    exempt:   { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: 'Exempt' },
    unknown:  { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-500', label: 'Unknown' },
  };
  const c = config[status] || config.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// ============================================================================
// KPI Card
// ============================================================================
function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{value.toLocaleString()}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Pagination Controls
// ============================================================================
function Pagination({ total, page, pageSize, onPageChange }: {
  total: number; page: number; pageSize: number; onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.min(page * pageSize + 1, total);
  const end = Math.min((page + 1) * pageSize, total);

  if (total <= pageSize) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {start}–{end} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
          Page {page + 1} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Due By Month Chart (simple bar chart using divs)
// ============================================================================
function DueByMonthChart({ data }: { data: DueByMonth[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No qualifications due in the next 12 months</p>;
  }
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.month} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-16 flex-shrink-0">{d.month}</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full flex items-center justify-end pr-2 transition-all"
              style={{ width: `${Math.max((d.count / maxCount) * 100, 8)}%` }}
            >
              <span className="text-[10px] text-white font-medium">{d.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Error Banner
// ============================================================================
function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-700 dark:text-red-400">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Main Page Content
// ============================================================================
function QualificationsContent() {
  const router = useRouter();
  const toast = useToast();

  // Data state
  const [stats, setStats] = useState<QualificationStats | null>(null);
  const [dueByMonth, setDueByMonth] = useState<DueByMonth[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [qualTotal, setQualTotal] = useState(0);
  const [alerts, setAlerts] = useState<QualificationAlert[]>([]);
  const [alertTotal, setAlertTotal] = useState(0);
  const [qualTypes, setQualTypes] = useState<QualificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [qualLoading, setQualLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Error state
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [qualError, setQualError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'alerts'>('overview');

  // Pagination state
  const [qualPage, setQualPage] = useState(0);
  const [alertPage, setAlertPage] = useState(0);

  // Actions
  const [recalculating, setRecalculating] = useState(false);
  const [generatingAlerts, setGeneratingAlerts] = useState(false);

  // Confirmation dialogs
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const [confirmGenAlerts, setConfirmGenAlerts] = useState(false);

  // Abort controller for race condition prevention
  const qualAbortRef = useRef<AbortController | null>(null);
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setOverviewError(null);
    try {
      const [statsData, dueData, typesData] = await Promise.all([
        getQualificationStats(),
        getQualificationsDueByMonth(),
        listQualificationTypes(),
      ]);
      setStats(statsData);
      setDueByMonth(dueData);
      setQualTypes(typesData);
    } catch {
      setOverviewError('Failed to load qualification overview data');
    }
  }, []);

  const fetchQualifications = useCallback(async (page = 0) => {
    // Cancel any in-flight request
    if (qualAbortRef.current) qualAbortRef.current.abort();
    const controller = new AbortController();
    qualAbortRef.current = controller;

    setQualError(null);
    setQualLoading(true);
    try {
      const filters: Record<string, string | number> = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (statusFilter) filters.status = statusFilter;
      if (typeFilter) filters.type_code = typeFilter;
      if (regionFilter) filters.current_region = regionFilter;
      const result = await listQualifications(filters as Parameters<typeof listQualifications>[0]);
      // Only set state if this request wasn't aborted
      if (!controller.signal.aborted) {
        setQualifications(result.qualifications);
        setQualTotal(result.total);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setQualError('Failed to load qualifications');
      }
    } finally {
      if (!controller.signal.aborted) setQualLoading(false);
    }
  }, [statusFilter, typeFilter, regionFilter]);

  const fetchAlerts = useCallback(async (page = 0) => {
    setAlertsError(null);
    setAlertsLoading(true);
    try {
      const result = await listQualificationAlerts({
        is_acknowledged: false,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setAlerts(result.alerts);
      setAlertTotal(result.total);
    } catch {
      setAlertsError('Failed to load alerts');
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchData(), fetchQualifications(0), fetchAlerts(0)]).finally(() => setLoading(false));
  }, [fetchData, fetchQualifications, fetchAlerts]);

  // Re-fetch qualifications when filters or page change
  useEffect(() => {
    fetchQualifications(qualPage);
  }, [statusFilter, typeFilter, qualPage, fetchQualifications]);

  // Debounce the region filter to prevent rapid API calls
  useEffect(() => {
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => {
      setQualPage(0);
      fetchQualifications(0);
    }, 300);
    return () => {
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionFilter]);

  // Re-fetch alerts when page changes
  useEffect(() => {
    if (alertPage > 0) fetchAlerts(alertPage);
  }, [alertPage, fetchAlerts]);

  // Reset page to 0 when filters change
  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setQualPage(0);
  };
  const handleTypeFilterChange = (val: string) => {
    setTypeFilter(val);
    setQualPage(0);
  };

  const handleRecalculate = async () => {
    setConfirmRecalc(false);
    setRecalculating(true);
    try {
      const result = await recalculateQualificationStatuses();
      toast.success(`Recalculated statuses: ${result.updated} updated`);
      await fetchData();
      await fetchQualifications(qualPage);
    } catch {
      toast.error('Failed to recalculate statuses');
    } finally {
      setRecalculating(false);
    }
  };

  const handleGenerateAlerts = async () => {
    setConfirmGenAlerts(false);
    setGeneratingAlerts(true);
    try {
      const result = await generateQualificationAlerts();
      toast.success(`Generated ${result.created} new alerts`);
      await fetchAlerts(alertPage);
      await fetchData();
    } catch {
      toast.error('Failed to generate alerts');
    } finally {
      setGeneratingAlerts(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    // Store the alert for rollback
    const alertToRemove = alerts.find(a => a.id === alertId);
    if (!alertToRemove) return;

    // Optimistically remove
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setAlertTotal(prev => prev - 1);

    try {
      await acknowledgeQualificationAlert(alertId);
      toast.success('Alert acknowledged');
    } catch {
      // Rollback on failure
      setAlerts(prev => [...prev, alertToRemove].sort((a, b) =>
        (a.days_until_due ?? 0) - (b.days_until_due ?? 0)
      ));
      setAlertTotal(prev => prev + 1);
      toast.error('Failed to acknowledge alert — restored');
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmRecalc}
        onConfirm={handleRecalculate}
        onCancel={() => setConfirmRecalc(false)}
        title="Recalculate All Qualification Statuses"
        description="This will recalculate statuses for every qualification record across the entire fleet. Existing manual status overrides will be replaced by computed values."
        variant="warning"
        loading={recalculating}
        confirmLabel="Recalculate Fleet"
        summaryItems={stats ? [
          { label: 'Total qualification records', value: String(stats.overdue_count + stats.due_count + stats.due_soon_count + stats.current_count + stats.exempt_count + stats.unknown_count) },
          { label: 'Currently overdue', value: String(stats.overdue_count) },
        ] : undefined}
      />
      <ConfirmDialog
        open={confirmGenAlerts}
        onConfirm={handleGenerateAlerts}
        onCancel={() => setConfirmGenAlerts(false)}
        title="Generate Qualification Alerts"
        description="This will scan all qualifications and create new alert records for any cars approaching or past their due dates (90, 60, 30-day warnings and overdue). Existing alerts within the last 7 days will not be duplicated."
        variant="warning"
        loading={generatingAlerts}
        confirmLabel="Generate Alerts"
        summaryItems={stats ? [
          { label: 'Current open alerts', value: String(stats.unacked_alerts) },
          { label: 'Cars at risk (overdue + due)', value: String(stats.overdue_cars + stats.due_cars) },
        ] : undefined}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Qualifications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fleet-wide qualification tracking and compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmRecalc(true)}
            disabled={recalculating}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
            Recalculate
          </button>
          <button
            onClick={() => setConfirmGenAlerts(true)}
            disabled={generatingAlerts}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <Bell className={`w-4 h-4 ${generatingAlerts ? 'animate-pulse' : ''}`} />
            Generate Alerts
          </button>
        </div>
      </div>

      {/* Overview Error */}
      {overviewError && <ErrorBanner message={overviewError} onRetry={fetchData} />}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            label="Overdue"
            value={stats.overdue_count}
            icon={<XCircle className="w-5 h-5 text-red-600" />}
            color="bg-red-50 dark:bg-red-900/20"
          />
          <KpiCard
            label="Due (<30d)"
            value={stats.due_count}
            icon={<AlertTriangle className="w-5 h-5 text-orange-600" />}
            color="bg-orange-50 dark:bg-orange-900/20"
          />
          <KpiCard
            label="Due Soon (90d)"
            value={stats.due_soon_count}
            icon={<Clock className="w-5 h-5 text-yellow-600" />}
            color="bg-yellow-50 dark:bg-yellow-900/20"
          />
          <KpiCard
            label="Current"
            value={stats.current_count}
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
            color="bg-green-50 dark:bg-green-900/20"
          />
          <KpiCard
            label="Exempt"
            value={stats.exempt_count}
            icon={<Shield className="w-5 h-5 text-gray-500" />}
            color="bg-gray-50 dark:bg-gray-700"
          />
          <KpiCard
            label="Open Alerts"
            value={stats.unacked_alerts}
            icon={<AlertCircle className="w-5 h-5 text-blue-600" />}
            color="bg-blue-50 dark:bg-blue-900/20"
          />
        </div>
      )}

      {/* Tab Bar */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {(['overview', 'list', 'alerts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'list' ? `All Qualifications (${qualTotal})` : `Alerts (${alertTotal})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Due By Month Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Due By Month (Next 12 Months)</h3>
            <DueByMonthChart data={dueByMonth} />
          </div>

          {/* Status Distribution */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Status Distribution</h3>
              <div className="space-y-3">
                {[
                  { label: 'Overdue', count: stats.overdue_count, color: 'bg-red-500' },
                  { label: 'Due (<30 days)', count: stats.due_count, color: 'bg-orange-500' },
                  { label: 'Due Soon (90 days)', count: stats.due_soon_count, color: 'bg-yellow-500' },
                  { label: 'Current', count: stats.current_count, color: 'bg-green-500' },
                  { label: 'Exempt', count: stats.exempt_count, color: 'bg-gray-400' },
                  { label: 'Unknown', count: stats.unknown_count, color: 'bg-gray-300' },
                ].map(item => {
                  const total = stats.overdue_count + stats.due_count + stats.due_soon_count + stats.current_count + stats.exempt_count + stats.unknown_count;
                  const pct = total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-32">{item.label}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${Math.max(pct, 1)}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-16 text-right">{item.count.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Qualification Types */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Qualification Types</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Regulatory Body</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Interval</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {qualTypes.map(qt => (
                    <tr key={qt.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{qt.name}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">{qt.regulatory_body}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">{qt.default_interval_months} months</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400 max-w-md" title={qt.description || undefined}>{qt.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* List Tab */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Filters:</span>
            </div>
            <select
              value={statusFilter}
              onChange={e => handleStatusFilterChange(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5"
            >
              <option value="">All Statuses</option>
              <option value="overdue">Overdue</option>
              <option value="due">Due (&lt;30d)</option>
              <option value="due_soon">Due Soon (90d)</option>
              <option value="current">Current</option>
              <option value="exempt">Exempt</option>
              <option value="unknown">Unknown</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => handleTypeFilterChange(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5"
            >
              <option value="">All Types</option>
              {qualTypes.map(qt => (
                <option key={qt.code} value={qt.code}>{qt.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Region..."
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 w-32"
            />
            {(statusFilter || typeFilter || regionFilter) && (
              <button
                onClick={() => { setStatusFilter(''); setTypeFilter(''); setRegionFilter(''); setQualPage(0); }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Error */}
          {qualError && <ErrorBanner message={qualError} onRetry={() => fetchQualifications(qualPage)} />}

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {qualLoading && (
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Loading...
                </p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Car</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Next Due</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Last Completed</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Region</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Regulatory</th>
                  </tr>
                </thead>
                <tbody>
                  {qualifications.length === 0 && !qualLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {statusFilter || typeFilter || regionFilter
                          ? 'No qualifications match the current filters'
                          : 'No qualifications found'}
                      </td>
                    </tr>
                  ) : (
                    qualifications.map(q => (
                      <tr key={q.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                        onClick={() => router.push(`/cars?search=${q.car_number}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{q.car_number}</div>
                          {q.car_mark && <div className="text-xs text-gray-500">{q.car_mark}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{q.type_name}</td>
                        <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{q.next_due_date || '\u2014'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{q.last_completed_date || '\u2014'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{q.lessee_name || '\u2014'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{q.current_region || '\u2014'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{q.regulatory_body}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={qualTotal} page={qualPage} pageSize={PAGE_SIZE} onPageChange={setQualPage} />
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Error */}
          {alertsError && <ErrorBanner message={alertsError} onRetry={() => fetchAlerts(alertPage)} />}

          {alerts.length === 0 && !alertsLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No unacknowledged alerts</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {alertsLoading && (
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Loading...
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Alert</th>
                      <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Car</th>
                      <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                      <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Due Date</th>
                      <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Days Until Due</th>
                      <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Customer</th>
                      <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map(alert => (
                      <tr key={alert.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            alert.alert_type === 'overdue'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : alert.alert_type === 'warning_30'
                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                                : alert.alert_type === 'warning_60'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          }`}>
                            {alert.alert_type === 'overdue' ? 'OVERDUE' :
                             alert.alert_type === 'warning_30' ? '30-Day' :
                             alert.alert_type === 'warning_60' ? '60-Day' : '90-Day'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{alert.car_number}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{alert.type_name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{alert.due_date}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${
                            (alert.days_until_due || 0) < 0 ? 'text-red-600 dark:text-red-400' :
                            (alert.days_until_due || 0) < 30 ? 'text-orange-600 dark:text-orange-400' :
                            'text-yellow-600 dark:text-yellow-400'
                          }`}>
                            {alert.days_until_due !== null ? (alert.days_until_due < 0 ? `${Math.abs(alert.days_until_due)}d overdue` : `${alert.days_until_due}d`) : '\u2014'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{alert.lessee_name || '\u2014'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Acknowledge
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination total={alertTotal} page={alertPage} pageSize={PAGE_SIZE} onPageChange={setAlertPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Page Export with Suspense
// ============================================================================
export default function QualificationsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <QualificationsContent />
    </Suspense>
  );
}
