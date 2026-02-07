'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle, Database, Activity, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HealthDashboard {
  database: {
    connected: boolean;
    response_time_ms: number;
    active_connections: number;
    cache_hit_ratio: number;
    database_size: string;
  };
  system_mode: string;
  active_users_24h: number;
  recent_errors: { last_hour: number; last_24h: number };
  data_counts: {
    cars: number;
    contracts: number;
    shopping_events: number;
    invoices: number;
    allocations: number;
  };
  integrations: { system: string; status: string; last_sync: string | null }[];
  incidents: { open: number; p1_open: number };
  feedback: { new_count: number; total: number };
}

interface PerfStats {
  total_connections: number;
  active_connections: number;
  cache_hit_ratio: number;
  index_hit_ratio: number;
  transactions: number;
  deadlocks: number;
  uptime: string;
}

interface TableSize {
  table_name: string;
  row_count: number;
  total_size: string;
  index_size: string;
}

interface IndexUsage {
  table_name: string;
  index_name: string;
  index_scans: number;
  rows_read: number;
  index_size: string;
  is_unused: boolean;
}

interface SlowQuery {
  query_text: string;
  calls: number;
  total_time_ms: number;
  mean_time_ms: number;
  max_time_ms: number;
  rows_returned: number;
}

interface FeedbackItem {
  id: string;
  title: string;
  description: string | null;
  page: string | null;
  category: string;
  severity: string;
  status: string;
  user_name: string | null;
  admin_notes: string | null;
  created_at: string;
}

interface FeedbackStats {
  total: number;
  new_count: number;
  reviewed: number;
  planned: number;
  resolved: number;
  wontfix: number;
  bugs: number;
  features: number;
  usability: number;
}

type TabKey = 'health' | 'performance' | 'feedback';
type TableSortField = 'table_name' | 'row_count' | 'total_size' | 'index_size';
type SortDir = 'asc' | 'desc';

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminMonitoringPage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<TabKey>('health');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab 1: System Health
  const [health, setHealth] = useState<HealthDashboard | null>(null);

  // Tab 2: Performance
  const [perfStats, setPerfStats] = useState<PerfStats | null>(null);
  const [tableSizes, setTableSizes] = useState<TableSize[]>([]);
  const [indexes, setIndexes] = useState<IndexUsage[]>([]);
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [tableSortField, setTableSortField] = useState<TableSortField>('row_count');
  const [tableSortDir, setTableSortDir] = useState<SortDir>('desc');

  // Tab 3: Feedback
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ─── Auth helpers (matching go-live pattern) ───────────────────────────────

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  // ─── Data loaders ──────────────────────────────────────────────────────────

  async function loadHealth() {
    const r = await fetchWithAuth('/system/health-dashboard');
    setHealth(r.data || null);
  }

  async function loadPerformance() {
    await Promise.all([
      fetchWithAuth('/system/performance/stats').then(r => setPerfStats(r.data || null)),
      fetchWithAuth('/system/performance/tables').then(r => setTableSizes(r.data || [])),
      fetchWithAuth('/system/performance/indexes').then(r => setIndexes(r.data || [])),
      fetchWithAuth('/system/performance/slow-queries').then(r => setSlowQueries(r.data || [])),
    ]);
  }

  async function loadFeedback() {
    await Promise.all([
      fetchWithAuth('/feedback').then(r => setFeedbackItems(r.data || [])),
      fetchWithAuth('/feedback/stats').then(r => setFeedbackStats(r.data || null)),
    ]);
  }

  async function loadAll() {
    await Promise.all([loadHealth(), loadPerformance(), loadFeedback()]);
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  // ─── Feedback actions ──────────────────────────────────────────────────────

  async function handleFeedbackStatusUpdate(id: string, status: string) {
    setUpdatingId(id);
    const adminNotes = notesDraft[id] ?? feedbackItems.find(f => f.id === id)?.admin_notes ?? '';
    await fetchWithAuth(`/feedback/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_notes: adminNotes, reviewed_by: 'admin' }),
    });
    await loadFeedback();
    setUpdatingId(null);
  }

  // ─── Table sort helpers ────────────────────────────────────────────────────

  function handleTableSort(field: TableSortField) {
    if (tableSortField === field) {
      setTableSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortField(field);
      setTableSortDir('desc');
    }
  }

  const sortedTableSizes = [...tableSizes].sort((a, b) => {
    const valA = a[tableSortField];
    const valB = b[tableSortField];
    if (typeof valA === 'number' && typeof valB === 'number') {
      return tableSortDir === 'asc' ? valA - valB : valB - valA;
    }
    const strA = String(valA);
    const strB = String(valB);
    return tableSortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });

  const unusedIndexes = indexes.filter(idx => idx.is_unused);

  // ─── Badge helpers ─────────────────────────────────────────────────────────

  const categoryBadge = (cat: string) => {
    const cls = cat === 'bug' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
      : cat === 'feature' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      : cat === 'usability' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize ${cls}`}>{cat}</span>;
  };

  const severityBadge = (sev: string) => {
    const cls = sev === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
      : sev === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
      : sev === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize ${cls}`}>{sev}</span>;
  };

  const statusBadge = (st: string) => {
    const cls = st === 'new' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      : st === 'reviewed' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
      : st === 'planned' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
      : st === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      : st === 'wontfix' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize ${cls}`}>{st === 'wontfix' ? "Won't Fix" : st}</span>;
  };

  const SortIcon = ({ field }: { field: TableSortField }) => {
    if (tableSortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return tableSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // ─── Tabs ──────────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'health' as const, label: 'System Health' },
    { key: 'performance' as const, label: 'Performance' },
    { key: 'feedback' as const, label: `User Feedback ${feedbackStats ? `(${feedbackStats.new_count} new)` : ''}` },
  ];

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Monitoring</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">System health, performance metrics, and user feedback</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>{t.label}</button>
          ))}
        </nav>
      </div>

      {/* ============ SYSTEM HEALTH TAB ============ */}
      {tab === 'health' && health && (
        <div className="space-y-6">
          {/* Database Status & System Mode */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Database Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-gray-500" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Database Status</h3>
                <span className="ml-auto">
                  {health.database.connected
                    ? <CheckCircle className="w-5 h-5 text-green-500" />
                    : <XCircle className="w-5 h-5 text-red-500" />}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Response Time</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{health.database.response_time_ms}ms</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Active Connections</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{health.database.active_connections}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Cache Hit Ratio</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{(health.database.cache_hit_ratio * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Database Size</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{health.database.database_size}</div>
                </div>
              </div>
            </div>

            {/* System Mode Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-gray-500" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">System Overview</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">System Mode</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      health.system_mode === 'live' ? 'bg-green-500' : health.system_mode === 'cutover' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 uppercase">{health.system_mode}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Active Users (24h)</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{health.active_users_24h}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Errors (Last Hour)</div>
                  <div className={`text-sm font-medium ${health.recent_errors.last_hour > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {health.recent_errors.last_hour}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Errors (24h)</div>
                  <div className={`text-sm font-medium ${health.recent_errors.last_24h > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {health.recent_errors.last_24h}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data Counts */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Data Counts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {Object.entries(health.data_counts).map(([key, val]) => (
                <div key={key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{val.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Integrations */}
          {health.integrations && health.integrations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Integration Status</h3>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">System</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {health.integrations.map((intg, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{intg.system}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded ${
                            intg.status === 'connected' || intg.status === 'active'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : intg.status === 'degraded'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {intg.status === 'connected' || intg.status === 'active'
                              ? <CheckCircle className="w-3 h-3" />
                              : intg.status === 'degraded'
                              ? <AlertTriangle className="w-3 h-3" />
                              : <XCircle className="w-3 h-3" />}
                            {intg.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {intg.last_sync ? new Date(intg.last_sync).toLocaleString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Incidents & Feedback Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Incidents</h3>
              <div className="flex items-center gap-6">
                <div>
                  <div className={`text-2xl font-bold ${health.incidents.open > 0 ? 'text-red-600' : 'text-green-600'}`}>{health.incidents.open}</div>
                  <div className="text-xs text-gray-500">Open</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${health.incidents.p1_open > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>{health.incidents.p1_open}</div>
                  <div className="text-xs text-gray-500">P1 Open</div>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Feedback</h3>
              <div className="flex items-center gap-6">
                <div>
                  <div className={`text-2xl font-bold ${health.feedback.new_count > 0 ? 'text-blue-600' : 'text-gray-900 dark:text-gray-100'}`}>{health.feedback.new_count}</div>
                  <div className="text-xs text-gray-500">New</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{health.feedback.total}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ PERFORMANCE TAB ============ */}
      {tab === 'performance' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          {perfStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{perfStats.total_connections}</div>
                <div className="text-xs text-gray-500">Total Conn</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{perfStats.active_connections}</div>
                <div className="text-xs text-gray-500">Active Conn</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className={`text-lg font-bold ${perfStats.cache_hit_ratio >= 0.99 ? 'text-green-600' : perfStats.cache_hit_ratio >= 0.95 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {(perfStats.cache_hit_ratio * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500">Cache Hit</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className={`text-lg font-bold ${perfStats.index_hit_ratio >= 0.99 ? 'text-green-600' : perfStats.index_hit_ratio >= 0.95 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {(perfStats.index_hit_ratio * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500">Index Hit</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{perfStats.transactions.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Transactions</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className={`text-lg font-bold ${perfStats.deadlocks > 0 ? 'text-red-600' : 'text-green-600'}`}>{perfStats.deadlocks}</div>
                <div className="text-xs text-gray-500">Deadlocks</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 text-xs mt-1">{perfStats.uptime}</div>
                <div className="text-xs text-gray-500">Uptime</div>
              </div>
            </div>
          )}

          {/* Table Sizes */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Table Sizes</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => handleTableSort('table_name')}>
                        <span className="flex items-center gap-1">Table <SortIcon field="table_name" /></span>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => handleTableSort('row_count')}>
                        <span className="flex items-center justify-end gap-1">Rows <SortIcon field="row_count" /></span>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => handleTableSort('total_size')}>
                        <span className="flex items-center justify-end gap-1">Total Size <SortIcon field="total_size" /></span>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => handleTableSort('index_size')}>
                        <span className="flex items-center justify-end gap-1">Index Size <SortIcon field="index_size" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedTableSizes.map((t, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{t.table_name}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-gray-700 dark:text-gray-300">{t.row_count.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-gray-500 dark:text-gray-400">{t.total_size}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-gray-500 dark:text-gray-400">{t.index_size}</td>
                      </tr>
                    ))}
                    {sortedTableSizes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No table data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Unused Indexes Warning */}
          {unusedIndexes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Unused Indexes ({unusedIndexes.length})</h3>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-yellow-200 dark:divide-yellow-800">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">Table</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">Index Name</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">Scans</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-yellow-100 dark:divide-yellow-900">
                      {unusedIndexes.map((idx, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{idx.table_name}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 font-mono text-xs">{idx.index_name}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-gray-500 dark:text-gray-400">{idx.index_scans.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-gray-500 dark:text-gray-400">{idx.index_size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Slow Queries */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Slow Queries</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Query</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Calls</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mean (ms)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Max (ms)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {slowQueries.map((q, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-xs font-mono text-gray-700 dark:text-gray-300 max-w-md truncate" title={q.query_text}>
                          {q.query_text.length > 120 ? q.query_text.slice(0, 120) + '...' : q.query_text}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right text-gray-700 dark:text-gray-300">{q.calls.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-gray-700 dark:text-gray-300">{q.mean_time_ms.toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-gray-700 dark:text-gray-300">{q.max_time_ms.toFixed(1)}</td>
                      </tr>
                    ))}
                    {slowQueries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No slow queries recorded</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ USER FEEDBACK TAB ============ */}
      {tab === 'feedback' && (
        <div className="space-y-6">
          {/* Feedback Stats */}
          {feedbackStats && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{feedbackStats.new_count}</div>
                  <div className="text-xs text-gray-500">New</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <div className="text-lg font-bold text-yellow-600">{feedbackStats.reviewed}</div>
                  <div className="text-xs text-gray-500">Reviewed</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <div className="text-lg font-bold text-purple-600">{feedbackStats.planned}</div>
                  <div className="text-xs text-gray-500">Planned</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <div className="text-lg font-bold text-green-600">{feedbackStats.resolved}</div>
                  <div className="text-xs text-gray-500">Resolved</div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">By Category</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                    <div className="text-lg font-bold text-red-600">{feedbackStats.bugs}</div>
                    <div className="text-xs text-gray-500">Bugs</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                    <div className="text-lg font-bold text-blue-600">{feedbackStats.features}</div>
                    <div className="text-xs text-gray-500">Features</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                    <div className="text-lg font-bold text-purple-600">{feedbackStats.usability}</div>
                    <div className="text-xs text-gray-500">Usability</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Feedback List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {feedbackItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-400">No feedback submitted yet</p>
              </div>
            ) : feedbackItems.map(item => {
              const isExpanded = expandedNotes[item.id] || false;
              const currentNotes = notesDraft[item.id] ?? item.admin_notes ?? '';
              return (
                <div key={item.id} className="px-4 py-4 space-y-2">
                  {/* Title row */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</div>
                      {item.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{item.description}</div>}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {categoryBadge(item.category)}
                        {severityBadge(item.severity)}
                        {statusBadge(item.status)}
                        {item.page && <span className="text-xs text-gray-400 font-mono">{item.page}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {item.user_name && <span>{item.user_name}</span>}
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-1 shrink-0">
                      {item.status === 'new' && (
                        <button onClick={() => handleFeedbackStatusUpdate(item.id, 'reviewed')} disabled={updatingId === item.id}
                          className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 disabled:opacity-50">
                          Review
                        </button>
                      )}
                      {(item.status === 'new' || item.status === 'reviewed') && (
                        <button onClick={() => handleFeedbackStatusUpdate(item.id, 'planned')} disabled={updatingId === item.id}
                          className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 disabled:opacity-50">
                          Plan
                        </button>
                      )}
                      {(item.status === 'new' || item.status === 'reviewed' || item.status === 'planned') && (
                        <button onClick={() => handleFeedbackStatusUpdate(item.id, 'resolved')} disabled={updatingId === item.id}
                          className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 disabled:opacity-50">
                          Resolve
                        </button>
                      )}
                      {(item.status === 'new' || item.status === 'reviewed') && (
                        <button onClick={() => handleFeedbackStatusUpdate(item.id, 'wontfix')} disabled={updatingId === item.id}
                          className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-400 disabled:opacity-50">
                          Won&apos;t Fix
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Admin Notes (expandable) */}
                  <div>
                    <button
                      onClick={() => setExpandedNotes(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Admin Notes {item.admin_notes ? '(has notes)' : ''}
                    </button>
                    {isExpanded && (
                      <div className="mt-2">
                        <textarea
                          value={currentNotes}
                          onChange={e => setNotesDraft(prev => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Add admin notes..."
                          rows={3}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          onClick={() => handleFeedbackStatusUpdate(item.id, item.status)}
                          disabled={updatingId === item.id}
                          className="mt-1 text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          {updatingId === item.id ? 'Saving...' : 'Save Notes'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
