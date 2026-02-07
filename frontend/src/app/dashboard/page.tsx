'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RefreshCw, ChevronDown, Clock } from 'lucide-react';
import ActivityTimeline from '@/components/ActivityTimeline';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LabelList,
  LineChart, Line,
  ComposedChart,
} from 'recharts';

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

// Hex colors for Recharts (matching Tailwind palette)
const statusHexColors: Record<string, string> = {
  'Need Shopping': '#ef4444',
  'To Be Routed': '#f97316',
  'Planned Shopping': '#eab308',
  'Enroute': '#3b82f6',
  'Arrived': '#6366f1',
  'Complete': '#22c55e',
  'Released': '#9ca3af',
};

// Mock 7-day sparkline trend data for summary cards
const sparkTotalCars = [
  { v: 142 }, { v: 144 }, { v: 143 }, { v: 146 }, { v: 145 }, { v: 148 }, { v: 150 },
];
const sparkAvailability = [
  { v: 78 }, { v: 79 }, { v: 81 }, { v: 80 }, { v: 82 }, { v: 83 }, { v: 84 },
];
const sparkPipeline = [
  { v: 24 }, { v: 26 }, { v: 25 }, { v: 27 }, { v: 26 }, { v: 24 }, { v: 23 },
];
const sparkNeedShopping = [
  { v: 8 }, { v: 7 }, { v: 9 }, { v: 6 }, { v: 5 }, { v: 4 }, { v: 3 },
];

// Sparkline mini component
const Sparkline = ({ data, color, width = 80, height = 28 }: { data: { v: number }[]; color: string; width?: number; height?: number }) => (
  <ResponsiveContainer width={width} height={height}>
    <LineChart data={data}>
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

// Custom tooltip for pie chart
const PipelineTooltip = ({ active, payload, total }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusHexColors[name] || '#9ca3af' }} />
        <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mt-0.5">
        {value} cars ({pct}%)
      </p>
    </div>
  );
};

// Custom tooltip for budget burn chart
const BurnTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-600 dark:text-gray-400">{p.name}: {formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// Custom tooltip for dwell time chart
const DwellTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100">{d.status}</p>
      <p className="text-gray-600 dark:text-gray-400">Avg: {d.avg_days} days</p>
      <p className="text-gray-500 dark:text-gray-500 text-xs">Range: {d.min_days}d &ndash; {d.max_days}d ({d.car_count} cars)</p>
    </div>
  );
};

// Custom tooltip for manager variance chart
const VarianceTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100">{d.name}</p>
      <p className="text-gray-600 dark:text-gray-400">Variance: {Number(d.variance) > 0 ? '+' : ''}{d.variance}%</p>
      <p className="text-gray-500 dark:text-gray-500 text-xs">
        Est: {formatCurrency(d.estimated)} / Act: {formatCurrency(d.actual)}
      </p>
    </div>
  );
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
  const [projectPlanning, setProjectPlanning] = useState<{
    active_projects: number;
    total_cars: number;
    planned_cars: number;
    locked_cars: number;
    completed_cars: number;
    unplanned_cars: number;
    total_estimated_cost: number;
  } | null>(null);

  // Recent activity (audit logs) for dashboard widget
  const {
    entries: recentActivity,
    loading: activityLoading,
  } = useAuditLog({ limit: 15 });

  // Collapsible section state - persisted in localStorage
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('railsync_dashboard_collapsed');
      if (saved) setCollapsedSections(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('railsync_dashboard_collapsed', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

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
        fetchWithAuth('/dashboard/project-planning'),
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
      setProjectPlanning(getValue(results[10]));
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
      <div className="max-w-full mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Please sign in to view the dashboard
        </h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-full mx-auto px-4 py-6">
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
    <div className="max-w-full mx-auto px-4 py-6 space-y-6">
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
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
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
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Cars</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {formatNumber(contractsReadiness.total_cars)}
                  </p>
                </div>
                <Sparkline data={sparkTotalCars} color="#6b7280" />
              </div>
              <p className="text-xs text-gray-400 mt-1">In tracking system</p>
            </div>
          </div>

          {/* Availability */}
          <div className="card">
            <div className="card-body p-4">
              <div className="flex items-start justify-between">
                <div>
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
                </div>
                <Sparkline data={sparkAvailability} color={Number(contractsReadiness.availability_pct) >= 80 ? '#22c55e' : '#eab308'} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{formatNumber(contractsReadiness.available)} available</p>
            </div>
          </div>

          {/* In Pipeline */}
          <div className="card">
            <div className="card-body p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">In Pipeline</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {formatNumber(contractsReadiness.in_pipeline)}
                  </p>
                </div>
                <Sparkline data={sparkPipeline} color="#3b82f6" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Across all stages</p>
            </div>
          </div>

          {/* Need Shopping Alert */}
          <div className={`card ${contractsReadiness.need_shopping > 0 ? 'border-red-300 dark:border-red-700' : ''}`}>
            <div className="card-body p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Need Shopping</p>
                  <p className={`text-3xl font-bold mt-1 ${
                    contractsReadiness.need_shopping > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-400'
                  }`}>
                    {formatNumber(contractsReadiness.need_shopping)}
                  </p>
                </div>
                <Sparkline data={sparkNeedShopping} color="#ef4444" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Awaiting assignment</p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ROW 1b: Project Planning Summary */}
      {/* ================================================================== */}
      {projectPlanning && Number(projectPlanning.active_projects) > 0 && (
        <div className="card">
          <button
            type="button"
            onClick={() => toggleSection('projectPlanning')}
            className="card-header flex items-center justify-between w-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['projectPlanning'] ? '-rotate-90' : ''}`} />
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Project Planning</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {projectPlanning.active_projects} active project{Number(projectPlanning.active_projects) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <a
              href="/projects"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              View Projects
            </a>
          </button>
          {!collapsedSections['projectPlanning'] && <div className="card-body">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(Number(projectPlanning.total_cars))}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Cars</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <p className="text-2xl font-bold text-gray-400">
                  {formatNumber(Number(projectPlanning.unplanned_cars))}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unplanned</p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatNumber(Number(projectPlanning.planned_cars))}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Planned</p>
              </div>
              <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {formatNumber(Number(projectPlanning.locked_cars))}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Locked</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatNumber(Number(projectPlanning.completed_cars))}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Complete</p>
              </div>
            </div>
            {/* Progress bar */}
            {Number(projectPlanning.total_cars) > 0 && (
              <div className="mt-4">
                <div className="flex h-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                  {Number(projectPlanning.completed_cars) > 0 && (
                    <div
                      className="bg-green-500"
                      style={{ width: `${(Number(projectPlanning.completed_cars) / Number(projectPlanning.total_cars)) * 100}%` }}
                      title={`Complete: ${projectPlanning.completed_cars}`}
                    />
                  )}
                  {Number(projectPlanning.locked_cars) > 0 && (
                    <div
                      className="bg-indigo-500"
                      style={{ width: `${(Number(projectPlanning.locked_cars) / Number(projectPlanning.total_cars)) * 100}%` }}
                      title={`Locked: ${projectPlanning.locked_cars}`}
                    />
                  )}
                  {Number(projectPlanning.planned_cars) > 0 && (
                    <div
                      className="bg-blue-400"
                      style={{ width: `${(Number(projectPlanning.planned_cars) / Number(projectPlanning.total_cars)) * 100}%` }}
                      title={`Planned: ${projectPlanning.planned_cars}`}
                    />
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 inline-block rounded-sm" /> Complete</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-500 inline-block rounded-sm" /> Locked</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 inline-block rounded-sm" /> Planned</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-200 dark:bg-gray-600 inline-block rounded-sm" /> Unplanned</span>
                  {Number(projectPlanning.total_estimated_cost) > 0 && (
                    <span className="ml-auto">Est. Cost: {formatCurrency(Number(projectPlanning.total_estimated_cost))}</span>
                  )}
                </div>
              </div>
            )}
          </div>}
        </div>
      )}

      {/* ================================================================== */}
      {/* ROW 2: Pipeline Breakdown + My Contracts Health */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Status Breakdown — Donut Chart */}
        {contractsReadiness && (() => {
          const pieData = [
            { name: 'Need Shopping', value: contractsReadiness.need_shopping },
            { name: 'To Be Routed', value: contractsReadiness.to_be_routed },
            { name: 'Planned Shopping', value: contractsReadiness.planned_shopping },
            { name: 'Enroute', value: contractsReadiness.enroute },
            { name: 'Arrived', value: contractsReadiness.arrived },
            { name: 'Complete', value: contractsReadiness.complete },
            { name: 'Released', value: contractsReadiness.released },
          ].filter(s => s.value > 0);
          const total = contractsReadiness.total_cars;
          return (
            <div className="card">
              <button
                type="button"
                onClick={() => toggleSection('pipelineBreakdown')}
                className="card-header flex items-center gap-2 w-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['pipelineBreakdown'] ? '-rotate-90' : ''}`} />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Pipeline Status Breakdown</h3>
              </button>
              {!collapsedSections['pipelineBreakdown'] && <div className="card-body">
                {total > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={110}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={statusHexColors[entry.name] || '#9ca3af'} />
                          ))}
                        </Pie>
                        <Tooltip content={<PipelineTooltip total={total} />} />
                        {/* Center label */}
                        <text
                          x="50%"
                          y="46%"
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="fill-gray-900 dark:fill-gray-100"
                          style={{ fontSize: '28px', fontWeight: 700 }}
                        >
                          {formatNumber(total)}
                        </text>
                        <text
                          x="50%"
                          y="56%"
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="fill-gray-400"
                          style={{ fontSize: '11px' }}
                        >
                          total cars
                        </text>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2 w-full max-w-sm">
                      {pieData.map(s => (
                        <div key={s.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusHexColors[s.name] }} />
                            <span className="text-gray-600 dark:text-gray-400 truncate text-xs">{s.name}</span>
                          </div>
                          <span className="font-medium text-gray-900 dark:text-gray-100 ml-2 text-xs">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-4 text-center">No pipeline data</p>
                )}
              </div>}
            </div>
          );
        })()}

        {/* My Contracts Health */}
        <div className="card">
          <button
            type="button"
            onClick={() => toggleSection('contractsHealth')}
            className="card-header flex items-center gap-2 w-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['contractsHealth'] ? '-rotate-90' : ''}`} />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">My Contracts Health</h3>
              <p className="text-xs text-gray-400 mt-0.5">Your active allocations by status</p>
            </div>
          </button>
          {!collapsedSections['contractsHealth'] && <div className="card-body">
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
          </div>}
        </div>
      </div>

      {/* ================================================================== */}
      {/* ROW 3: Operational Velocity */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dwell Time by Status — Horizontal Bar Chart */}
        <div className="card">
          <button
            type="button"
            onClick={() => toggleSection('dwellTime')}
            className="card-header flex items-center gap-2 w-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['dwellTime'] ? '-rotate-90' : ''}`} />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Dwell Time by Status</h3>
              <p className="text-xs text-gray-400 mt-0.5">Avg days in each active stage</p>
            </div>
          </button>
          {!collapsedSections['dwellTime'] && <div className="card-body">
            {dwellTime.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No active cars</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(dwellTime.length * 44, 140)}>
                <BarChart
                  data={dwellTime.map(r => ({ ...r, avg_days: Number(r.avg_days), fill: Number(r.avg_days) > 30 ? '#f87171' : (statusHexColors[r.status] || '#60a5fa') }))}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="status"
                    width={100}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DwellTooltip />} cursor={{ fill: 'rgba(156,163,175,0.1)' }} />
                  <Bar dataKey="avg_days" radius={[0, 4, 4, 0]} barSize={20}>
                    {dwellTime.map((row) => (
                      <Cell
                        key={row.status}
                        fill={Number(row.avg_days) > 30 ? '#f87171' : (statusHexColors[row.status] || '#60a5fa')}
                      />
                    ))}
                    <LabelList
                      dataKey="avg_days"
                      position="right"
                      formatter={(v: number) => `${v}d`}
                      style={{ fontSize: '11px', fill: '#6b7280', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>}
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
          <button
            type="button"
            onClick={() => toggleSection('costExceptions')}
            className="card-header flex items-center justify-between w-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['costExceptions'] ? '-rotate-90' : ''}`} />
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">High-Cost Exceptions</h3>
                <p className="text-xs text-gray-400 mt-0.5">Actual cost exceeds estimate by &gt;10%</p>
              </div>
            </div>
            {costExceptions.length > 0 && (
              <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
                {costExceptions.length}
              </span>
            )}
          </button>
          {!collapsedSections['costExceptions'] && <div className="card-body">
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
          </div>}
        </div>

        {/* Budget Burn Velocity — Area Chart */}
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

                {/* Cumulative Area Chart */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart
                      data={budgetBurn.months.map(m => ({
                        month: formatMonth(m.month),
                        cumBudget: m.cumulative_budget,
                        cumActual: m.cumulative_actual,
                      }))}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="gradBudget" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                        width={52}
                      />
                      <Tooltip content={<BurnTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="cumBudget"
                        name="Cum. Budget"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        fill="url(#gradBudget)"
                        strokeDasharray="5 3"
                      />
                      <Area
                        type="monotone"
                        dataKey="cumActual"
                        name="Cum. Actual"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#gradActual)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-gray-400 inline-block" style={{ borderTop: '2px dashed #94a3b8' }} /> Cum. Budget
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-blue-500 inline-block" /> Cum. Actual
                    </span>
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
          <button
            type="button"
            onClick={() => toggleSection('needShopping')}
            className="card-header flex items-center justify-between w-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['needShopping'] ? '-rotate-90' : ''}`} />
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Need Shopping Queue</h3>
                <p className="text-xs text-gray-400 mt-0.5">Cars awaiting shop assignment</p>
              </div>
            </div>
            {needShopping.length > 0 && (
              <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
                {needShopping.length}
              </span>
            )}
          </button>
          {!collapsedSections['needShopping'] && <div className="card-body">
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
          </div>}
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
          <button
            type="button"
            onClick={() => toggleSection('managerPerf')}
            className="card-header flex items-center gap-2 w-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['managerPerf'] ? '-rotate-90' : ''}`} />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Manager Performance</h3>
              <p className="text-xs text-gray-400 mt-0.5">Allocation volume, budget adherence, and shop efficiency</p>
            </div>
          </button>
          {!collapsedSections['managerPerf'] && <div className="card-body space-y-6">
            {/* Budget Variance Bar Chart */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Budget Variance by Manager</p>
              <ResponsiveContainer width="100%" height={Math.max(managers.length * 40, 160)}>
                <BarChart
                  data={managers.map(mgr => ({
                    name: mgr.manager_name,
                    variance: Number(mgr.budget_variance_pct),
                    estimated: mgr.total_estimated,
                    actual: mgr.total_actual,
                  }))}
                  layout="vertical"
                  margin={{ top: 0, right: 50, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<VarianceTooltip />} cursor={{ fill: 'rgba(156,163,175,0.1)' }} />
                  <Bar dataKey="variance" radius={[0, 4, 4, 0]} barSize={22}>
                    {managers.map((mgr) => (
                      <Cell
                        key={mgr.manager_id}
                        fill={Number(mgr.budget_variance_pct) > 0 ? '#ef4444' : '#22c55e'}
                      />
                    ))}
                    <LabelList
                      dataKey="variance"
                      position="right"
                      formatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
                      style={{ fontSize: '10px', fill: '#6b7280', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-500 inline-block rounded-sm" /> Under budget</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500 inline-block rounded-sm" /> Over budget</span>
              </div>
            </div>

            {/* Detail Table */}
            <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-700 pt-4">
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
          </div>}
        </div>
      )}

      {/* ================================================================== */}
      {/* ROW 7: Recent Activity Feed */}
      {/* ================================================================== */}
      <div className="card">
        <button
          type="button"
          onClick={() => toggleSection('recentActivity')}
          className="card-header flex items-center gap-2 w-full cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsedSections['recentActivity'] ? '-rotate-90' : ''}`} />
          <div className="text-left flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest changes across all entities</p>
            </div>
          </div>
        </button>
        {!collapsedSections['recentActivity'] && (
          <div className="card-body">
            <ActivityTimeline
              entries={recentActivity}
              compact
              loading={activityLoading}
              maxHeight="420px"
              emptyMessage="No recent activity to display."
            />
          </div>
        )}
      </div>
    </div>
  );
}
