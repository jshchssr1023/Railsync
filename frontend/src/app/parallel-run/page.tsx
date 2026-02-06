'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Upload, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Activity, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RunResult {
  id: string;
  run_date: string;
  comparison_type: string;
  ciprots_count: number;
  railsync_count: number;
  match_count: number;
  mismatch_count: number;
  ciprots_only_count: number;
  railsync_only_count: number;
  match_pct: number;
}

interface Discrepancy {
  id: string;
  entity_ref: string;
  field_name: string;
  ciprots_value: string | null;
  railsync_value: string | null;
  severity: string;
  resolved: boolean;
}

interface HealthScore {
  overall_score: number;
  invoice_score: number;
  status_score: number;
  resolution_rate: number;
  trend_direction: 'improving' | 'stable' | 'declining';
  open_critical: number;
  open_warning: number;
  total_runs: number;
  days_in_parallel: number;
  go_live_ready: boolean;
}

interface DailyReport {
  run_date: string;
  invoice_match_pct: number | null;
  status_match_pct: number | null;
  total_discrepancies: number;
  resolved_discrepancies: number;
  critical_count: number;
}

export default function ParallelRunPage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<'dashboard' | 'compare' | 'history'>('dashboard');
  const [results, setResults] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [discLoading, setDiscLoading] = useState(false);
  const [comparisonType, setComparisonType] = useState<'invoices' | 'statuses'>('invoices');
  const [billingPeriod, setBillingPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([
      fetchWithAuth('/parallel-run/results').then(res => setResults(res.data || [])),
      fetchWithAuth('/parallel-run/health-score').then(res => setHealthScore(res.data || null)),
      fetchWithAuth('/parallel-run/daily-report?days=30').then(res => setDailyReport(res.data || [])),
    ]).finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setComparing(true);
    try {
      const content = await file.text();
      const endpoint = comparisonType === 'invoices' ? '/parallel-run/compare-invoices' : '/parallel-run/compare-statuses';
      const body = comparisonType === 'invoices' ? { content, billing_period: billingPeriod } : { content };
      await fetchWithAuth(endpoint, { method: 'POST', body: JSON.stringify(body) });
      const [resResults, resHealth, resDaily] = await Promise.all([
        fetchWithAuth('/parallel-run/results'),
        fetchWithAuth('/parallel-run/health-score'),
        fetchWithAuth('/parallel-run/daily-report?days=30'),
      ]);
      setResults(resResults.data || []);
      setHealthScore(resHealth.data || null);
      setDailyReport(resDaily.data || []);
    } catch { /* silent */ }
    finally { setComparing(false); e.target.value = ''; }
  }

  async function toggleRun(runId: string) {
    if (expandedRun === runId) { setExpandedRun(null); return; }
    setExpandedRun(runId);
    setDiscLoading(true);
    const res = await fetchWithAuth(`/parallel-run/results/${runId}/discrepancies`);
    setDiscrepancies(res.data || []);
    setDiscLoading(false);
  }

  const TrendIcon = healthScore?.trend_direction === 'improving' ? TrendingUp : healthScore?.trend_direction === 'declining' ? TrendingDown : Minus;
  const trendColor = healthScore?.trend_direction === 'improving' ? 'text-green-600' : healthScore?.trend_direction === 'declining' ? 'text-red-600' : 'text-gray-500';

  const tabs = [
    { key: 'dashboard', label: 'Health Dashboard' },
    { key: 'compare', label: 'New Comparison' },
    { key: 'history', label: 'Run History' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Parallel Run</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Compare CIPROTS outputs against RailSync for validation</p>
      </div>

      <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileUpload} />

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

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : (
        <>
          {/* ============ DASHBOARD TAB ============ */}
          {tab === 'dashboard' && (
            <div className="space-y-6">
              {/* Health Score Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">Overall Score</span>
                    <Activity className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className={`text-2xl font-bold ${(healthScore?.overall_score || 0) >= 80 ? 'text-green-600' : (healthScore?.overall_score || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {healthScore?.overall_score || 0}
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                    <TrendIcon className="w-3 h-3" />
                    {healthScore?.trend_direction || 'stable'}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-xs font-medium text-gray-500 mb-1">Invoice Match</div>
                  <div className={`text-2xl font-bold ${(healthScore?.invoice_score || 0) >= 99 ? 'text-green-600' : (healthScore?.invoice_score || 0) >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {healthScore?.invoice_score || 0}%
                  </div>
                  <div className="text-xs text-gray-400">Target: 99%</div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-xs font-medium text-gray-500 mb-1">Status Match</div>
                  <div className={`text-2xl font-bold ${(healthScore?.status_score || 0) >= 98 ? 'text-green-600' : (healthScore?.status_score || 0) >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {healthScore?.status_score || 0}%
                  </div>
                  <div className="text-xs text-gray-400">Target: 98%</div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">Go-Live Ready</span>
                    <Shield className={`w-4 h-4 ${healthScore?.go_live_ready ? 'text-green-500' : 'text-gray-400'}`} />
                  </div>
                  <div className={`text-lg font-bold ${healthScore?.go_live_ready ? 'text-green-600' : 'text-red-600'}`}>
                    {healthScore?.go_live_ready ? 'YES' : 'NOT YET'}
                  </div>
                  <div className="text-xs text-gray-400">{healthScore?.days_in_parallel || 0} days running</div>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-500">Resolution Rate</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{healthScore?.resolution_rate || 0}%</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-500">Open Critical</div>
                  <div className={`text-lg font-semibold ${(healthScore?.open_critical || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{healthScore?.open_critical || 0}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-500">Open Warnings</div>
                  <div className="text-lg font-semibold text-yellow-600">{healthScore?.open_warning || 0}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-500">Total Runs</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{healthScore?.total_runs || 0}</div>
                </div>
              </div>

              {/* Daily Trend Table */}
              {dailyReport.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Daily Trend (Last 30 Days)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Date</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Invoice %</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Status %</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Discrepancies</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Resolved</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Critical</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {dailyReport.map(d => (
                          <tr key={d.run_date} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{d.run_date}</td>
                            <td className="text-right px-4 py-2">
                              {d.invoice_match_pct !== null ? (
                                <span className={`font-medium ${d.invoice_match_pct >= 99 ? 'text-green-600' : d.invoice_match_pct >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {d.invoice_match_pct}%
                                </span>
                              ) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="text-right px-4 py-2">
                              {d.status_match_pct !== null ? (
                                <span className={`font-medium ${d.status_match_pct >= 98 ? 'text-green-600' : d.status_match_pct >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {d.status_match_pct}%
                                </span>
                              ) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{d.total_discrepancies}</td>
                            <td className="text-right px-4 py-2 text-green-600">{d.resolved_discrepancies}</td>
                            <td className="text-right px-4 py-2">
                              <span className={d.critical_count > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{d.critical_count}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ COMPARE TAB ============ */}
          {tab === 'compare' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">New Comparison</h3>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={comparisonType} onChange={e => setComparisonType(e.target.value as 'invoices' | 'statuses')}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                    <option value="invoices">Invoice Comparison</option>
                    <option value="statuses">Car Status Comparison</option>
                  </select>
                </div>
                {comparisonType === 'invoices' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Billing Period</label>
                    <input type="month" value={billingPeriod} onChange={e => setBillingPeriod(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={comparing}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload CIPROTS CSV
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Upload a CIPROTS export CSV file. For invoices, columns should include: invoice_number, customer_code, total_amount, line_count.
                For car statuses: car_number, status.
              </p>
            </div>
          )}

          {/* ============ HISTORY TAB ============ */}
          {tab === 'history' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="w-8 px-4 py-2" />
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Type</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">CIPROTS</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">RailSync</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Matched</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Mismatched</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Match %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {results.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleRun(r.id)}>
                      <td className="px-4 py-2">
                        {expandedRun === r.id ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{r.run_date}</td>
                      <td className="px-4 py-2 capitalize text-gray-900 dark:text-gray-100">{r.comparison_type.replace('_', ' ')}</td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{r.ciprots_count}</td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{r.railsync_count}</td>
                      <td className="text-right px-4 py-2 text-green-600">{r.match_count}</td>
                      <td className="text-right px-4 py-2 text-red-600">{r.mismatch_count}</td>
                      <td className="text-right px-4 py-2">
                        <span className={`font-bold ${r.match_pct >= 95 ? 'text-green-600' : r.match_pct >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {r.match_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Expanded discrepancy rows rendered separately */}
                  {results.map(r => expandedRun === r.id ? (
                    <tr key={`${r.id}-disc`}>
                      <td colSpan={8} className="bg-gray-50 dark:bg-gray-800/30 px-6 py-3">
                        {discLoading ? (
                          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
                        ) : discrepancies.length > 0 ? (
                          <div className="max-h-64 overflow-y-auto space-y-1">
                            {discrepancies.map(d => (
                              <div key={d.id} className="grid grid-cols-[1fr_80px_120px_120px_60px] gap-2 text-xs items-center">
                                <span className="font-medium text-gray-900 dark:text-gray-100">{d.entity_ref}</span>
                                <span className="text-gray-500">{d.field_name}</span>
                                <span className="text-red-600 dark:text-red-400">{d.ciprots_value || '-'}</span>
                                <span className="text-blue-600 dark:text-blue-400">{d.railsync_value || '-'}</span>
                                <span className={`text-center px-1 py-0.5 rounded text-[10px] ${
                                  d.severity === 'critical' ? 'bg-red-100 text-red-700' : d.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                }`}>{d.severity}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 text-center">No discrepancies found</p>
                        )}
                      </td>
                    </tr>
                  ) : null)}
                </tbody>
              </table>
              {results.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No comparison runs yet</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
