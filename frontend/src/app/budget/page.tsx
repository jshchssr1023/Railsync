'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Edit2, Save, X, Plus, Trash2, RefreshCw, TrendingUp, Settings, BarChart3 } from 'lucide-react';
import BudgetOverview from '@/components/BudgetOverview';
import DemandList from '@/components/DemandList';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type TabId = 'overview' | 'configuration';

interface RunningRepairsBudget {
  id: string;
  fiscal_year: number;
  month: string;
  cars_on_lease: number;
  allocation_per_car: number;
  monthly_budget: number;
  actual_spend: number;
  remaining_budget: number;
}

interface ServiceEventBudget {
  id: string;
  fiscal_year: number;
  event_type: string;
  budgeted_car_count: number;
  avg_cost_per_car: number;
  total_budget: number;
  customer_code?: string;
  fleet_segment?: string;
  car_type?: string;
  notes?: string;
}

interface BudgetSummary {
  fiscal_year: number;
  running_repairs: { total_budget: number; actual_spend: number; remaining: number };
  service_events: { total_budget: number; planned_cost: number; actual_cost: number; remaining: number };
  total: { budget: number; planned: number; shop_committed: number; committed: number; remaining: number; consumed_pct: number };
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

// Wrapper component to handle the Suspense boundary for useSearchParams
export default function BudgetPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <BudgetContent />
    </Suspense>
  );
}

function BudgetContent() {
  const searchParams = useSearchParams();
  const { getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [editingRR, setEditingRR] = useState<string | null>(null);
  const [editingSE, setEditingSE] = useState<string | null>(null);
  const [rrAllocation, setRrAllocation] = useState(450);
  const [showAddModal, setShowAddModal] = useState(false);
  const [seSegmentFilter, setSeSegmentFilter] = useState('All');
  const [newSE, setNewSE] = useState({ event_type: 'Qualification', budgeted_car_count: 0, avg_cost_per_car: 0, fleet_segment: '', notes: '' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const authHeaders = () => {
    const token = getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Handle URL parameters for tab selection
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'configuration'].includes(tabParam)) {
      setActiveTab(tabParam as TabId);
    }
  }, [searchParams]);

  // Fetch data
  const { data: summaryData } = useSWR(`${API_URL}/budget/summary?fiscal_year=${fiscalYear}`, fetcher);
  const { data: rrData, mutate: mutateRR } = useSWR(`${API_URL}/budget/running-repairs?fiscal_year=${fiscalYear}`, fetcher);
  const { data: seData, mutate: mutateSE } = useSWR(`${API_URL}/budget/service-events?fiscal_year=${fiscalYear}`, fetcher);

  const summary: BudgetSummary | null = summaryData?.data || null;
  const runningRepairs: RunningRepairsBudget[] = rrData?.data || [];
  const serviceEvents: ServiceEventBudget[] = seData?.data || [];

  // Set initial allocation from data
  useEffect(() => {
    if (runningRepairs.length > 0) {
      setRrAllocation(runningRepairs[0].allocation_per_car || 450);
    }
  }, [runningRepairs]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Update running repairs allocation
  const handleUpdateRRAllocation = async () => {
    setSaveError(null);
    try {
      const res = await fetch(`${API_URL}/budget/running-repairs/calculate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ fiscal_year: fiscalYear, allocation_per_car: rrAllocation }),
      });
      if (res.ok) {
        mutateRR();
        mutate(`${API_URL}/budget/summary?fiscal_year=${fiscalYear}`);
      } else {
        const errData = await res.json().catch(() => null);
        setSaveError(errData?.error || `Failed to recalculate (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to update allocation:', err);
      setSaveError('Network error — could not save allocation');
    }
  };

  // Update individual RR month
  const handleUpdateRRMonth = async (month: string, data: Partial<RunningRepairsBudget>) => {
    setSaveError(null);
    try {
      const res = await fetch(`${API_URL}/budget/running-repairs/${month}?fiscal_year=${fiscalYear}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        mutateRR();
        mutate(`${API_URL}/budget/summary?fiscal_year=${fiscalYear}`);
        setEditingRR(null);
      } else {
        const errData = await res.json().catch(() => null);
        setSaveError(errData?.error || `Failed to save month (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to update month:', err);
      setSaveError('Network error — could not save month');
    }
  };

  // Add service event budget
  const handleAddServiceEvent = async () => {
    setSaveError(null);
    try {
      const { fleet_segment, notes, ...rest } = newSE;
      const res = await fetch(`${API_URL}/budget/service-events`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          fiscal_year: fiscalYear,
          ...rest,
          fleet_segment: fleet_segment || undefined,
          notes: notes || undefined,
        }),
      });
      if (res.ok) {
        mutateSE();
        mutate(`${API_URL}/budget/summary?fiscal_year=${fiscalYear}`);
        setShowAddModal(false);
        setNewSE({ event_type: 'Qualification', budgeted_car_count: 0, avg_cost_per_car: 0, fleet_segment: '', notes: '' });
      } else {
        const errData = await res.json().catch(() => null);
        setSaveError(errData?.error || `Failed to add service event (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to add service event:', err);
      setSaveError('Network error — could not add service event');
    }
  };

  // Get unique segments for filter
  const segmentOptions = ['All', ...Array.from(new Set(serviceEvents.map(se => se.fleet_segment || se.customer_code).filter(Boolean))) as string[]];
  const filteredServiceEvents = seSegmentFilter === 'All'
    ? serviceEvents
    : serviceEvents.filter(se => (se.fleet_segment || se.customer_code) === seSegmentFilter);

  // Update service event budget
  const handleUpdateServiceEvent = async (id: string, data: Partial<ServiceEventBudget>) => {
    setSaveError(null);
    try {
      const res = await fetch(`${API_URL}/budget/service-events/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        mutateSE();
        mutate(`${API_URL}/budget/summary?fiscal_year=${fiscalYear}`);
        setEditingSE(null);
      } else {
        const errData = await res.json().catch(() => null);
        setSaveError(errData?.error || `Failed to update service event (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to update service event:', err);
      setSaveError('Network error — could not update service event');
    }
  };

  // Delete service event budget
  const handleDeleteServiceEvent = async (id: string) => {
    setSaveError(null);
    try {
      const res = await fetch(`${API_URL}/budget/service-events/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        mutateSE();
        mutate(`${API_URL}/budget/summary?fiscal_year=${fiscalYear}`);
      } else {
        const errData = await res.json().catch(() => null);
        setSaveError(errData?.error || `Failed to delete (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      setSaveError('Network error — could not delete service event');
    }
  };

  const years = [fiscalYear - 1, fiscalYear, fiscalYear + 1];

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview & Forecasts',
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      id: 'configuration',
      label: 'Budget Configuration',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Maintenance Budget</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Budget tracking, demand forecasts, and configuration</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          >
            {years.map((y) => (
              <option key={y} value={y}>FY{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {saveError && (
        <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-400">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Cards (above tabs) */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Budget</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(summary.total.budget)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">FY{fiscalYear} aggregate allocation</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Planned</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(summary.total.planned || 0)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">No shop assigned yet</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Committed</p>
            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.total.shop_committed || 0)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Shop assigned + actuals</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
            <p className={`text-2xl font-bold ${summary.total.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.total.remaining)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {(100 - summary.total.consumed_pct).toFixed(0)}% available
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Consumed</p>
            <p className="text-2xl font-bold text-blue-600">{summary.total.consumed_pct.toFixed(1)}%</p>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(summary.total.consumed_pct, 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview & Forecasts Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Budget Overview Component */}
          <ErrorBoundary>
            <BudgetOverview fiscalYear={fiscalYear} />
          </ErrorBoundary>

          {/* Demand Forecasts Component */}
          <ErrorBoundary>
            <div className="card">
              <div className="card-body">
                <DemandList fiscalYear={fiscalYear} />
              </div>
            </div>
          </ErrorBoundary>
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <div className="space-y-6">
          {/* Running Repairs Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Running Repairs</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pool-based: Monthly Allocation x Cars on Lease</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400">$/Car/Month:</label>
                <input
                  type="number"
                  value={rrAllocation}
                  onChange={(e) => setRrAllocation(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-right"
                />
                <button
                  onClick={handleUpdateRRAllocation}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Recalculate
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Month</th>
                    <th className="px-4 py-2 text-right">Cars on Lease</th>
                    <th className="px-4 py-2 text-right">$/Car</th>
                    <th className="px-4 py-2 text-right">Monthly Budget</th>
                    <th className="px-4 py-2 text-right">Actual</th>
                    <th className="px-4 py-2 text-right">Remaining</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {runningRepairs.map((rr) => (
                    <RRRow
                      key={rr.id}
                      data={rr}
                      isEditing={editingRR === rr.id}
                      onEdit={() => setEditingRR(rr.id)}
                      onCancel={() => setEditingRR(null)}
                      onSave={(data) => handleUpdateRRMonth(rr.month, data)}
                      formatCurrency={formatCurrency}
                      formatMonth={formatMonth}
                    />
                  ))}
                  {runningRepairs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No running repairs budget. Click Recalculate to generate.
                      </td>
                    </tr>
                  )}
                </tbody>
                {runningRepairs.length > 0 && (
                  <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
                    <tr>
                      <td className="px-4 py-2">TOTAL</td>
                      <td className="px-4 py-2 text-right">-</td>
                      <td className="px-4 py-2 text-right">-</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(runningRepairs.reduce((s, r) => s + r.monthly_budget, 0))}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(runningRepairs.reduce((s, r) => s + r.actual_spend, 0))}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(runningRepairs.reduce((s, r) => s + r.remaining_budget, 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Service Events Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Service Events</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Event-based: Qualifications, Assignments, Returns</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={seSegmentFilter}
                  onChange={(e) => setSeSegmentFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  {segmentOptions.map((seg) => (
                    <option key={seg} value={seg}>{seg}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Event
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Event Type</th>
                    <th className="px-4 py-2 text-right">Budgeted Cars</th>
                    <th className="px-4 py-2 text-right">Avg $/Car</th>
                    <th className="px-4 py-2 text-right">Total Budget</th>
                    <th className="px-4 py-2 text-left">Segment</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredServiceEvents.map((se) => (
                    <SERow
                      key={se.id}
                      data={se}
                      isEditing={editingSE === se.id}
                      onEdit={() => setEditingSE(se.id)}
                      onCancel={() => setEditingSE(null)}
                      onSave={(data) => handleUpdateServiceEvent(se.id, data)}
                      onDelete={() => setDeleteConfirmId(se.id)}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                  {filteredServiceEvents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No service event budgets. Click Add Event to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredServiceEvents.length > 0 && (
                  <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
                    <tr>
                      <td className="px-4 py-2">TOTAL</td>
                      <td className="px-4 py-2 text-right">{filteredServiceEvents.reduce((s, e) => s + e.budgeted_car_count, 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">-</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(filteredServiceEvents.reduce((s, e) => s + e.total_budget, 0))}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Grand Total */}
          {summary && (
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow p-6 text-white">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-primary-100">Total Budget - FY{fiscalYear}</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(summary.total.budget)}</p>
                </div>
                <div className="text-right">
                  <p className="text-primary-100">Planned (No Shop)</p>
                  <p className="text-xl font-semibold mt-1">{formatCurrency(summary.total.planned || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-primary-100">Committed (Shop Assigned)</p>
                  <p className="text-xl font-semibold mt-1">{formatCurrency(summary.total.shop_committed || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-primary-100">Remaining ({(100 - summary.total.consumed_pct).toFixed(0)}%)</p>
                  <p className="text-2xl font-semibold mt-1">{formatCurrency(summary.total.remaining)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Service Event Confirmation */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete Service Event Budget"
        description="Are you sure you want to delete this service event budget? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirmId) {
            handleDeleteServiceEvent(deleteConfirmId);
          }
          setDeleteConfirmId(null);
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* Add Service Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Service Event Budget</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type</label>
                <select
                  value={newSE.event_type}
                  onChange={(e) => setNewSE({ ...newSE, event_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="Qualification">Qualification</option>
                  <option value="Assignment">Assignment</option>
                  <option value="Return">Return</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budgeted Cars</label>
                  <input
                    type="number"
                    value={newSE.budgeted_car_count || ''}
                    onChange={(e) => setNewSE({ ...newSE, budgeted_car_count: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Avg $/Car</label>
                  <input
                    type="number"
                    value={newSE.avg_cost_per_car || ''}
                    onChange={(e) => setNewSE({ ...newSE, avg_cost_per_car: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Budget</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(newSE.budgeted_car_count * newSE.avg_cost_per_car)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fleet Segment</label>
                <input
                  type="text"
                  value={newSE.fleet_segment}
                  onChange={(e) => setNewSE({ ...newSE, fleet_segment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="All (leave blank for all segments)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={newSE.notes}
                  onChange={(e) => setNewSE({ ...newSE, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewSE({ event_type: 'Qualification', budgeted_car_count: 0, avg_cost_per_car: 0, fleet_segment: '', notes: '' });
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddServiceEvent}
                  disabled={!newSE.budgeted_car_count || !newSE.avg_cost_per_car}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Running Repairs Row Component
function RRRow({
  data,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  formatCurrency,
  formatMonth,
}: {
  data: RunningRepairsBudget;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: Partial<RunningRepairsBudget>) => void;
  formatCurrency: (n: number) => string;
  formatMonth: (m: string) => string;
}) {
  const [editData, setEditData] = useState({
    cars_on_lease: data.cars_on_lease,
    actual_spend: data.actual_spend,
  });

  useEffect(() => {
    setEditData({ cars_on_lease: data.cars_on_lease, actual_spend: data.actual_spend });
  }, [data]);

  if (isEditing) {
    return (
      <tr className="bg-blue-50 dark:bg-blue-900/20">
        <td className="px-4 py-2 font-medium">{formatMonth(data.month)}</td>
        <td className="px-4 py-2">
          <input
            type="number"
            value={editData.cars_on_lease}
            onChange={(e) => setEditData({ ...editData, cars_on_lease: parseInt(e.target.value) || 0 })}
            className="w-24 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-right"
          />
        </td>
        <td className="px-4 py-2 text-right">{formatCurrency(data.allocation_per_car)}</td>
        <td className="px-4 py-2 text-right">{formatCurrency(editData.cars_on_lease * data.allocation_per_car)}</td>
        <td className="px-4 py-2">
          <input
            type="number"
            value={editData.actual_spend}
            onChange={(e) => setEditData({ ...editData, actual_spend: parseFloat(e.target.value) || 0 })}
            className="w-28 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-right"
          />
        </td>
        <td className="px-4 py-2 text-right">
          {formatCurrency((editData.cars_on_lease * data.allocation_per_car) - editData.actual_spend)}
        </td>
        <td className="px-4 py-2 text-right">
          <button onClick={() => onSave(editData)} className="p-1 text-green-600 hover:text-green-700">
            <Save className="w-4 h-4" />
          </button>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600 ml-1">
            <X className="w-4 h-4" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-2 font-medium">{formatMonth(data.month)}</td>
      <td className="px-4 py-2 text-right">{data.cars_on_lease.toLocaleString()}</td>
      <td className="px-4 py-2 text-right">{formatCurrency(data.allocation_per_car)}</td>
      <td className="px-4 py-2 text-right">{formatCurrency(data.monthly_budget)}</td>
      <td className="px-4 py-2 text-right text-green-600">{formatCurrency(data.actual_spend)}</td>
      <td className={`px-4 py-2 text-right font-medium ${data.remaining_budget >= 0 ? '' : 'text-red-600'}`}>
        {formatCurrency(data.remaining_budget)}
      </td>
      <td className="px-4 py-2 text-right">
        <button onClick={onEdit} className="p-1 text-gray-400 hover:text-primary-600">
          <Edit2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

// Service Event Row Component
function SERow({
  data,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  formatCurrency,
}: {
  data: ServiceEventBudget;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: Partial<ServiceEventBudget>) => void;
  onDelete: () => void;
  formatCurrency: (n: number) => string;
}) {
  const [editData, setEditData] = useState({
    budgeted_car_count: data.budgeted_car_count,
    avg_cost_per_car: data.avg_cost_per_car,
  });

  useEffect(() => {
    setEditData({ budgeted_car_count: data.budgeted_car_count, avg_cost_per_car: data.avg_cost_per_car });
  }, [data]);

  if (isEditing) {
    return (
      <tr className="bg-blue-50 dark:bg-blue-900/20">
        <td className="px-4 py-2 font-medium">{data.event_type}</td>
        <td className="px-4 py-2">
          <input
            type="number"
            value={editData.budgeted_car_count}
            onChange={(e) => setEditData({ ...editData, budgeted_car_count: parseInt(e.target.value) || 0 })}
            className="w-24 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-right"
          />
        </td>
        <td className="px-4 py-2">
          <input
            type="number"
            value={editData.avg_cost_per_car}
            onChange={(e) => setEditData({ ...editData, avg_cost_per_car: parseFloat(e.target.value) || 0 })}
            className="w-28 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-right"
          />
        </td>
        <td className="px-4 py-2 text-right font-medium">
          {formatCurrency(editData.budgeted_car_count * editData.avg_cost_per_car)}
        </td>
        <td className="px-4 py-2 text-gray-400">{data.customer_code || data.fleet_segment || 'All'}</td>
        <td className="px-4 py-2 text-right">
          <button onClick={() => onSave(editData)} className="p-1 text-green-600 hover:text-green-700">
            <Save className="w-4 h-4" />
          </button>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600 ml-1">
            <X className="w-4 h-4" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-2 font-medium">{data.event_type}</td>
      <td className="px-4 py-2 text-right">{data.budgeted_car_count.toLocaleString()}</td>
      <td className="px-4 py-2 text-right">{formatCurrency(data.avg_cost_per_car)}</td>
      <td className="px-4 py-2 text-right font-medium">{formatCurrency(data.total_budget)}</td>
      <td className="px-4 py-2 text-gray-400">{data.customer_code || data.fleet_segment || 'All'}</td>
      <td className="px-4 py-2 text-right">
        <button onClick={onEdit} className="p-1 text-gray-400 hover:text-primary-600">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600 ml-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
