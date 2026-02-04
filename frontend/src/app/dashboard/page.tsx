'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// =============================================================================
// TYPES
// =============================================================================

interface ContractsReadiness {
  total_cars: number;
  in_pipeline: number;
  available: number;
  availability_pct: number;
  need_shopping: number;
  to_be_routed: number;
  planned_shopping: number;
  enroute: number;
  arrived: number;
  complete: number;
  released: number;
}

interface NeedShoppingItem {
  id: string;
  car_id: string;
  car_number: string;
  shop_code: string;
  target_month: string;
  estimated_cost: number;
  created_at: string;
}

interface ContractsHealthRow {
  status: string;
  count: number;
  total_estimated: number;
  total_actual: number;
}

interface ManagerRow {
  manager_id: string;
  manager_name: string;
  organization: string;
  total_allocations: number;
  completed: number;
  active: number;
  total_estimated: number;
  total_actual: number;
  budget_variance_pct: number;
  avg_days_in_shop: number;
}

interface DwellTimeRow {
  status: string;
  car_count: number;
  avg_days: number;
  min_days: number;
  max_days: number;
}

interface Throughput {
  entered_pipeline: number;
  completed: number;
}

interface ReleaseItem {
  id: string;
  car_id: string;
  car_number: string;
  shop_code: string;
  target_month: string;
  status: string;
  actual_cost: number;
  actual_completion_date: string;
}

interface CostException {
  id: string;
  car_id: string;
  car_number: string;
  shop_code: string;
  status: string;
  target_month: string;
  estimated_cost: number;
  actual_cost: number;
  variance_pct: number;
  variance_amount: number;
}

interface ExpiryItem {
  car_number: string;
  car_mark: string;
  car_type: string;
  lessee_name: string;
  tank_qual_year: number;
  current_status: string;
  portfolio_status: string;
}

interface BurnMonth {
  month: string;
  monthly_budget: number;
  actual_spend: number;
  cumulative_budget: number;
  cumulative_actual: number;
  projected_pace: number;
  on_track: boolean;
}

interface BudgetBurn {
  fiscal_year: number;
  total_annual_budget: number;
  total_spent: number;
  avg_monthly_burn: number;
  months: BurnMonth[];
}

// =============================================================================
// HELPERS
// =============================================================================

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatNumber = (v: number) =>
  new Intl.NumberFormat('en-US').format(v);

const formatDate = (d: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatMonth = (m: string) => {
  if (!m) return '—';
  const parts = m.split('-');
  if (parts.length < 2) return m;
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const daysSince = (dateStr: string) => {
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

// Status color mapping
const statusColors: Record<string, string> = {
  'Need Shopping': 'bg-red-500',
  'To Be Routed': 'bg-orange-500',
  'Planned Shopping': 'bg-yellow-500',
  'Enroute': 'bg-blue-500',
  'Arrived': 'bg-indigo-500',
  'Complete': 'bg-green-500',
  'Released': 'bg-gray-400',
};

const statusColorsBg: Record<string, string> = {
  'Need Shopping': 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  'To Be Routed': 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  'Planned Shopping': 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  'Enroute': 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  'Arrived': 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  'Complete': 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  'Released': 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
};

// =============================================================================
// PAGE
// =============================================================================

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [contractsReadiness, setContractsReadiness] = useState<ContractsReadiness | null>(null);
  const [needShopping, setNeedShopping] = useState<NeedShoppingItem[]>([]);
  const [myContracts, setMyContracts] = useState<ContractsHealthRow[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [dwellTime, setDwellTime] = useState<DwellTimeRow[]>([]);
  const [throughput, setThroughput] = useState<Throughput | null>(null);
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [costExceptions, setCostExceptions] = useState<CostException[]>([]);
  const [expiryForecast, setExpiryForecast] = useState<ExpiryItem[]>([]);
  const [budgetBurn, setBudgetBurn] = useState<BudgetBurn | null>(null);

  const getToken = () => localStorage.getItem('railsync_access_token');

  const fetchWithAuth = useCallback(async (endpoint: string) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
    const data = await response.json();
    return data.success ? data.data : null;
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        fetchWithAuth('/dashboard/contracts-readiness'),
        fetchWithAuth('/dashboard/need-shopping'),
        fetchWithAuth('/dashboard/my-contracts'),
        fetchWithAuth('/dashboard/manager-performance'),
        fetchWithAuth('/dashboard/dwell-time'),
        fetchWithAuth('/dashboard/throughput?days=30'),
        fetchWithAuth('/dashboard/upcoming-releases?days=7'),
        fetchWithAuth('/dashboard/high-cost-exceptions?threshold=10'),
        fetchWithAuth('/dashboard/expiry-forecast'),
        fetchWithAuth(`/dashboard/budget-burn?fiscal_year=${new Date().getFullYear()}`),
      ]);

      const getValue = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? r.value : null;

      setContractsReadiness(getValue(results[0]));
      setNeedShopping(getValue(results[1]) || []);
      setMyContracts(getValue(results[2]) || []);
      setManagers(getValue(results[3]) || []);
      setDwellTime(getValue(results[4]) || []);
      setThroughput(getValue(results[5]));
      setReleases(getValue(results[6]) || []);
      setCostExceptions(getValue(results[7]) || []);
      setExpiryForecast(getValue(results[8]) || []);
      setBudgetBurn(getValue(results[9]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (isAuthenticated) loadDashboard();
  }, [isAuthenticated, loadDashboard]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Please sign in to view the dashboard
        </h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Operations Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Contracts readiness, performance, and financial health at a glance
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="btn btn-secondary text-sm flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ================================================================== */}
      {/* ROW 1: Contracts Readiness Summary Cards */}
      {/* ================================================================== */}
      {contractsReadiness && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Cars */}
          <div className="card">
            <div className="card-body p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Cars</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {formatNumber(contractsReadiness.total_cars)}
              </p>
              <p className="text-xs text-gray-400 mt-1">In tracking system</p>
            </div>
          </div>

          {/* Availability */}
          <div className="card">
            <div className="card-body p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Availability</p>
              <p className={`text-3xl font-bold mt-1 ${
                Number(contractsReadiness.availability_pct) >= 80
                  ? 'text-green-600 dark:text-green-400'
                  : Number(contractsReadiness.availability_pct) >= 60
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {contractsReadiness.availability_pct}%
              </p>
              <p className="text-xs text-gray-400 mt-1">{formatNumber(contractsReadiness.available)} available</p>
            </div>
          </div>

          {/* In Pipeline */}
          <div className="card">
            <div className="card-body p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">In Pipeline</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {formatNumber(contractsReadiness.in_pipeline)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Across all stages</p>
            </div>
          </div>

          {/* Need Shopping Alert */}
          <div className={`card ${contractsReadiness.need_shopping > 0 ? 'border-red-300 dark:border-red-700' : ''}`}>
            <div className="card-body p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Need Shopping</p>
              <p className={`text-3xl font-bold mt-1 ${
                contractsReadiness.need_shopping > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-400'
              }`}>
                {formatNumber(contractsReadiness.need_shopping)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Awaiting assignment</p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ROW 2: Pipeline Breakdown + My Contracts Health */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Status Breakdown */}
        {contractsReadiness && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Pipeline Status Breakdown</h3>
            </div>
            <div className="card-body space-y-3">
              {/* Stacked bar */}
              {contractsReadiness.total_cars > 0 && (
                <div className="flex h-6 rounded-lg overflow-hidden">
                  {[
                    { key: 'need_shopping', label: 'Need Shopping', count: contractsReadiness.need_shopping },
                    { key: 'to_be_routed', label: 'To Be Routed', count: contractsReadiness.to_be_routed },
                    { key: 'planned_shopping', label: 'Planned Shopping', count: contractsReadiness.planned_shopping },
                    { key: 'enroute', label: 'Enroute', count: contractsReadiness.enroute },
                    { key: 'arrived', label: 'Arrived', count: contractsReadiness.arrived },
                    { key: 'complete', label: 'Complete', count: contractsReadiness.complete },
                    { key: 'released', label: 'Released', count: contractsReadiness.released },
                  ].filter(s => s.count > 0).map(s => (
                    <div
                      key={s.key}
                      className={`${statusColors[s.label]} relative group`}
                      style={{ width: `${(s.count / contractsReadiness.total_cars) * 100}%` }}
                      title={`${s.label}: ${s.count}`}
                    />
                  ))}
                </div>
              )}
              {/* Legend rows */}
              <div className="space-y-2 pt-1">
                {[
                  { label: 'Need Shopping', count: contractsReadiness.need_shopping },
                  { label: 'To Be Routed', count: contractsReadiness.to_be_routed },
                  { label: 'Planned Shopping', count: contractsReadiness.planned_shopping },
                  { label: 'Enroute', count: contractsReadiness.enroute },
                  { label: 'Arrived', count: contractsReadiness.arrived },
                  { label: 'Complete', count: contractsReadiness.complete },
                  { label: 'Released', count: contractsReadiness.released },
                ].filter(s => s.count > 0).map(s => (
                  <div key={s.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${statusColors[s.label]}`} />
                      <span className="text-gray-600 dark:text-gray-400">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{s.count}</span>
                      <span className="text-xs text-gray-400 w-12 text-right">
                        {((s.count / contractsReadiness.total_cars) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* My Contracts Health */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">My Contracts Health</h3>
            <p className="text-xs text-gray-400 mt-0.5">Your active allocations by status</p>
          </div>
          <div className="card-body">
            {myContracts.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No active allocations</p>
            ) : (
              <div className="space-y-3">
                {myContracts.map(row => (
                  <div key={row.status} className={`rounded-lg border p-3 ${statusColorsBg[row.status] || 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusColors[row.status] || 'bg-gray-400'}`} />
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{row.status}</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{row.count}</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>Est: {formatCurrency(row.total_estimated)}</span>
                      <span>Act: {formatCurrency(row.total_actual)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ROW 3: Operational Velocity */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dwell Time Heatmap */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Dwell Time by Status</h3>
            <p className="text-xs text-gray-400 mt-0.5">Avg days in each active stage</p>
          </div>
          <div className="card-body">
            {dwellTime.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No active cars</p>
            ) : (
              <div className="space-y-3">
                {dwellTime.map(row => {
                  const maxDays = Math.max(...dwellTime.map(d => Number(d.avg_days)));
                  const pct = maxDays > 0 ? (Number(row.avg_days) / maxDays) * 100 : 0;
                  const isHigh = Number(row.avg_days) > 30;
                  return (
                    <div key={row.status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">{row.status}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isHigh ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {row.avg_days}d
                          </span>
                          <span className="text-xs text-gray-400">({row.car_count} cars)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isHigh ? 'bg-red-400' : 'bg-blue-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Shop Throughput */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">30-Day Throughput</h3>
          </div>
          <div className="card-body">
            {throughput ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatNumber(throughput.entered_pipeline)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Entered Pipeline</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatNumber(throughput.completed)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completed</p>
                  </div>
                </div>
                {/* Net flow indicator */}
                <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Net Flow: </span>
                  <span className={`font-bold ${
                    throughput.completed >= throughput.entered_pipeline
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {throughput.completed >= throughput.entered_pipeline ? '+' : ''}
                    {throughput.completed - throughput.entered_pipeline}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center">No data</p>
            )}
          </div>
        </div>

        {/* Upcoming Releases */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Completions</h3>
            <p className="text-xs text-gray-400 mt-0.5">Last 7 days</p>
          </div>
          <div className="card-body">
            {releases.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No recent completions</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {releases.slice(0, 8).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{r.car_number}</span>
                      <span className="text-xs text-gray-400 ml-2">{r.shop_code}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">{formatDate(r.actual_completion_date)}</span>
                      {r.actual_cost > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          {formatCurrency(r.actual_cost)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ROW 4: Financial & Risk */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High-Cost Exceptions */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">High-Cost Exceptions</h3>
              <p className="text-xs text-gray-400 mt-0.5">Actual cost exceeds estimate by &gt;10%</p>
            </div>
            {costExceptions.length > 0 && (
              <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
                {costExceptions.length}
              </span>
            )}
          </div>
          <div className="card-body">
            {costExceptions.length === 0 ? (
              <p className="text-sm text-green-600 dark:text-green-400 py-4 text-center">No cost exceptions</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2 font-medium">Car</th>
                      <th className="pb-2 font-medium">Shop</th>
                      <th className="pb-2 font-medium text-right">Estimated</th>
                      <th className="pb-2 font-medium text-right">Actual</th>
                      <th className="pb-2 font-medium text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costExceptions.slice(0, 10).map(ex => (
                      <tr key={ex.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{ex.car_number}</td>
                        <td className="py-2 text-gray-500 dark:text-gray-400">{ex.shop_code}</td>
                        <td className="py-2 text-right text-gray-500 dark:text-gray-400">{formatCurrency(ex.estimated_cost)}</td>
                        <td className="py-2 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(ex.actual_cost)}</td>
                        <td className="py-2 text-right">
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            +{ex.variance_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Budget Burn Velocity */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Budget Burn Velocity</h3>
            <p className="text-xs text-gray-400 mt-0.5">FY{budgetBurn?.fiscal_year || new Date().getFullYear()} cumulative spend vs pace</p>
          </div>
          <div className="card-body">
            {budgetBurn && budgetBurn.months.length > 0 ? (
              <div className="space-y-4">
                {/* Summary metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(budgetBurn.total_annual_budget)}
                    </p>
                    <p className="text-xs text-gray-400">Annual Budget</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${
                      budgetBurn.total_spent > budgetBurn.total_annual_budget
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {formatCurrency(budgetBurn.total_spent)}
                    </p>
                    <p className="text-xs text-gray-400">Spent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(budgetBurn.avg_monthly_burn)}
                    </p>
                    <p className="text-xs text-gray-400">Avg/Month</p>
                  </div>
                </div>

                {/* Mini burn chart */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-1 items-end h-20">
                    {budgetBurn.months.map((m) => {
                      const maxVal = Math.max(
                        ...budgetBurn.months.map(x => Math.max(x.monthly_budget, x.actual_spend))
                      );
                      const budgetH = maxVal > 0 ? (m.monthly_budget / maxVal) * 100 : 0;
                      const spendH = maxVal > 0 ? (m.actual_spend / maxVal) * 100 : 0;
                      return (
                        <div key={m.month} className="flex-1 flex gap-px items-end" title={`${formatMonth(m.month)}: Budget ${formatCurrency(m.monthly_budget)}, Actual ${formatCurrency(m.actual_spend)}`}>
                          <div
                            className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-t-sm"
                            style={{ height: `${budgetH}%`, minHeight: budgetH > 0 ? '2px' : '0' }}
                          />
                          <div
                            className={`flex-1 rounded-t-sm ${m.on_track ? 'bg-green-400' : 'bg-red-400'}`}
                            style={{ height: `${spendH}%`, minHeight: spendH > 0 ? '2px' : '0' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400">Jan</span>
                    <span className="text-[10px] text-gray-400">Dec</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-200 dark:bg-gray-600 inline-block rounded-sm" /> Budget</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 inline-block rounded-sm" /> On Track</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 inline-block rounded-sm" /> Over</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center">No budget data</p>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ROW 5: Need Shopping Alert + Expiry Forecast */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Need Shopping Alert */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Need Shopping Queue</h3>
              <p className="text-xs text-gray-400 mt-0.5">Cars awaiting shop assignment</p>
            </div>
            {needShopping.length > 0 && (
              <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
                {needShopping.length}
              </span>
            )}
          </div>
          <div className="card-body">
            {needShopping.length === 0 ? (
              <p className="text-sm text-green-600 dark:text-green-400 py-4 text-center">All cars assigned</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2 font-medium">Car</th>
                      <th className="pb-2 font-medium">Target</th>
                      <th className="pb-2 font-medium text-right">Est. Cost</th>
                      <th className="pb-2 font-medium text-right">Waiting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {needShopping.slice(0, 10).map(item => (
                      <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{item.car_number}</td>
                        <td className="py-2 text-gray-500 dark:text-gray-400">{item.target_month || '—'}</td>
                        <td className="py-2 text-right text-gray-500 dark:text-gray-400">
                          {item.estimated_cost ? formatCurrency(item.estimated_cost) : '—'}
                        </td>
                        <td className="py-2 text-right">
                          <span className={`text-xs font-medium ${
                            daysSince(item.created_at) > 14
                              ? 'text-red-600 dark:text-red-400'
                              : daysSince(item.created_at) > 7
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {daysSince(item.created_at)}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Expiry Forecast */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Qualification Expiry Forecast</h3>
            <p className="text-xs text-gray-400 mt-0.5">Cars approaching qualification deadline</p>
          </div>
          <div className="card-body">
            {expiryForecast.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No upcoming expirations</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2 font-medium">Car</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Lessee</th>
                      <th className="pb-2 font-medium text-right">Qual Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiryForecast.slice(0, 10).map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{item.car_number}</td>
                        <td className="py-2 text-gray-500 dark:text-gray-400">{item.car_type || item.car_mark}</td>
                        <td className="py-2 text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{item.lessee_name || '—'}</td>
                        <td className="py-2 text-right">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            item.tank_qual_year <= new Date().getFullYear()
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {item.tank_qual_year}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ROW 6: Manager Performance Leaderboard */}
      {/* ================================================================== */}
      {managers.length > 0 && (user?.role === 'admin' || user?.role === 'operator') && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Manager Performance</h3>
            <p className="text-xs text-gray-400 mt-0.5">Allocation volume, budget adherence, and shop efficiency</p>
          </div>
          <div className="card-body overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 font-medium">Manager</th>
                  <th className="pb-2 font-medium">Org</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Active</th>
                  <th className="pb-2 font-medium text-right">Done</th>
                  <th className="pb-2 font-medium text-right">Est. Cost</th>
                  <th className="pb-2 font-medium text-right">Actual</th>
                  <th className="pb-2 font-medium text-right">Variance</th>
                  <th className="pb-2 font-medium text-right">Avg Days</th>
                </tr>
              </thead>
              <tbody>
                {managers.map(m => (
                  <tr key={m.manager_id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{m.manager_name}</td>
                    <td className="py-2 text-gray-500 dark:text-gray-400 text-xs">{m.organization || '—'}</td>
                    <td className="py-2 text-right text-gray-900 dark:text-gray-100">{m.total_allocations}</td>
                    <td className="py-2 text-right text-blue-600 dark:text-blue-400">{m.active}</td>
                    <td className="py-2 text-right text-green-600 dark:text-green-400">{m.completed}</td>
                    <td className="py-2 text-right text-gray-500 dark:text-gray-400">{formatCurrency(m.total_estimated)}</td>
                    <td className="py-2 text-right text-gray-900 dark:text-gray-100">{formatCurrency(m.total_actual)}</td>
                    <td className="py-2 text-right">
                      <span className={`text-xs font-medium ${
                        Number(m.budget_variance_pct) > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {Number(m.budget_variance_pct) > 0 ? '+' : ''}{m.budget_variance_pct}%
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-500 dark:text-gray-400">
                      {m.avg_days_in_shop != null ? `${m.avg_days_in_shop}d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
