'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Shield, RefreshCw, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface CheckResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  value?: string | number;
  threshold?: string | number;
}

interface ReadinessReport {
  overall_ready: boolean;
  overall_score: number;
  timestamp: string;
  checks: CheckResult[];
  summary: { total: number; passed: number; warned: number; failed: number };
}

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  category: string | null;
  assigned_name: string | null;
  reporter_name: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface IncidentStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  p1_open: number;
  p2_open: number;
  p3_open: number;
  avg_resolution_hours: number | null;
}

interface SystemModeInfo {
  mode: string;
  cutover_started_at: string | null;
  go_live_date: string | null;
}

export default function GoLivePage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<'readiness' | 'incidents' | 'mode'>('readiness');
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentStats, setIncidentStats] = useState<IncidentStats | null>(null);
  const [systemMode, setSystemMode] = useState<SystemModeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewIncident, setShowNewIncident] = useState(false);
  const [newIncident, setNewIncident] = useState({ title: '', description: '', severity: 'P2', category: 'other' });
  const [saving, setSaving] = useState(false);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  async function loadAll() {
    await Promise.all([
      fetchWithAuth('/go-live/readiness').then(r => setReport(r.data || null)),
      fetchWithAuth('/go-live/incidents').then(r => setIncidents(r.data || [])),
      fetchWithAuth('/go-live/incidents/stats').then(r => setIncidentStats(r.data || null)),
      fetchWithAuth('/system/mode').then(r => setSystemMode(r.data || null)),
    ]);
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    loadAll().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function handleCreateIncident() {
    if (!newIncident.title.trim()) return;
    setSaving(true);
    await fetchWithAuth('/go-live/incidents', { method: 'POST', body: JSON.stringify(newIncident) });
    setNewIncident({ title: '', description: '', severity: 'P2', category: 'other' });
    setShowNewIncident(false);
    await Promise.all([
      fetchWithAuth('/go-live/incidents').then(r => setIncidents(r.data || [])),
      fetchWithAuth('/go-live/incidents/stats').then(r => setIncidentStats(r.data || null)),
    ]);
    setSaving(false);
  }

  async function handleUpdateIncidentStatus(id: string, status: string) {
    await fetchWithAuth(`/go-live/incidents/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    await Promise.all([
      fetchWithAuth('/go-live/incidents').then(r => setIncidents(r.data || [])),
      fetchWithAuth('/go-live/incidents/stats').then(r => setIncidentStats(r.data || null)),
    ]);
  }

  async function handleModeChange(mode: string) {
    if (!confirm(`Are you sure you want to change system mode to "${mode}"? This action affects the entire system.`)) return;
    const res = await fetchWithAuth('/system/mode', { method: 'PUT', body: JSON.stringify({ mode }) });
    if (res.success) setSystemMode(res.data);
    else alert(res.error || 'Failed to change mode');
  }

  const categories = report ? [...new Set(report.checks.map(c => c.category))] : [];

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'pass') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'fail') return <XCircle className="w-4 h-4 text-red-500" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  const severityBadge = (sev: string) => {
    const cls = sev === 'P1' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
      : sev === 'P2' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cls}`}>{sev}</span>;
  };

  const statusBadge = (st: string) => {
    const cls = st === 'open' ? 'bg-red-100 text-red-700' : st === 'investigating' ? 'bg-yellow-100 text-yellow-700' : st === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';
    return <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${cls}`}>{st}</span>;
  };

  const tabs = [
    { key: 'readiness', label: 'Readiness Check' },
    { key: 'incidents', label: `Incidents ${incidentStats ? `(${incidentStats.open + incidentStats.investigating})` : ''}` },
    { key: 'mode', label: 'System Mode' },
  ] as const;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Go-Live Command Center</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">System readiness, incident tracking, and cutover control</p>
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

      {/* ============ READINESS TAB ============ */}
      {tab === 'readiness' && report && (
        <>
          <div className={`rounded-lg border-2 p-6 ${
            report.overall_ready
              ? 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800'
              : 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-4">
              <Shield className={`w-10 h-10 ${report.overall_ready ? 'text-green-500' : 'text-red-500'}`} />
              <div>
                <h2 className={`text-xl font-bold ${report.overall_ready ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                  {report.overall_ready ? 'READY FOR GO-LIVE' : 'NOT READY — Issues Found'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Score: {report.overall_score}% | {report.summary.passed} passed, {report.summary.warned} warnings, {report.summary.failed} failed
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.summary.total}</div>
              <div className="text-xs text-gray-500">Total Checks</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{report.summary.passed}</div>
              <div className="text-xs text-gray-500">Passed</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{report.summary.warned}</div>
              <div className="text-xs text-gray-500">Warnings</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{report.summary.failed}</div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
          </div>

          <div className="space-y-4">
            {categories.map(cat => {
              const checks = report.checks.filter(c => c.category === cat);
              const catFailed = checks.some(c => c.status === 'fail');
              const catWarned = checks.some(c => c.status === 'warn');
              return (
                <div key={cat} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between ${
                    catFailed ? 'bg-red-50 dark:bg-red-950/10' : catWarned ? 'bg-yellow-50 dark:bg-yellow-950/10' : 'bg-green-50 dark:bg-green-950/10'
                  }`}>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{cat}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      catFailed ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : catWarned ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    }`}>
                      {checks.filter(c => c.status === 'pass').length}/{checks.length} passed
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {checks.map((c, i) => (
                      <div key={i} className="px-4 py-3 flex items-center gap-3">
                        <StatusIcon status={c.status} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{c.name}</div>
                          <div className="text-xs text-gray-500 truncate">{c.message}</div>
                        </div>
                        {c.threshold !== undefined && (
                          <div className="text-xs text-gray-400 whitespace-nowrap">
                            {String(c.value)} / {String(c.threshold)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ============ INCIDENTS TAB ============ */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          {/* Incident Stats */}
          {incidentStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-red-600">{incidentStats.p1_open}</div>
                <div className="text-xs text-gray-500">P1 Open</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-yellow-600">{incidentStats.p2_open}</div>
                <div className="text-xs text-gray-500">P2 Open</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-gray-600">{incidentStats.open + incidentStats.investigating}</div>
                <div className="text-xs text-gray-500">Active</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-green-600">{incidentStats.resolved + incidentStats.closed}</div>
                <div className="text-xs text-gray-500">Resolved</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{incidentStats.avg_resolution_hours ? `${incidentStats.avg_resolution_hours}h` : '-'}</div>
                <div className="text-xs text-gray-500">Avg Resolution</div>
              </div>
            </div>
          )}

          {/* New Incident Button/Form */}
          {!showNewIncident ? (
            <button onClick={() => setShowNewIncident(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">
              <Plus className="w-4 h-4" /> Report Incident
            </button>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">New Incident</h3>
              <input value={newIncident.title} onChange={e => setNewIncident(p => ({ ...p, title: e.target.value }))}
                placeholder="Incident title" className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
              <textarea value={newIncident.description} onChange={e => setNewIncident(p => ({ ...p, description: e.target.value }))}
                placeholder="Description" rows={3} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
              <div className="flex gap-3">
                <select value={newIncident.severity} onChange={e => setNewIncident(p => ({ ...p, severity: e.target.value }))}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                  <option value="P1">P1 - Critical</option>
                  <option value="P2">P2 - Major</option>
                  <option value="P3">P3 - Minor</option>
                </select>
                <select value={newIncident.category} onChange={e => setNewIncident(p => ({ ...p, category: e.target.value }))}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                  <option value="data">Data</option>
                  <option value="billing">Billing</option>
                  <option value="integration">Integration</option>
                  <option value="performance">Performance</option>
                  <option value="ui">UI</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateIncident} disabled={saving || !newIncident.title.trim()}
                  className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create'}
                </button>
                <button onClick={() => setShowNewIncident(false)} className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md">Cancel</button>
              </div>
            </div>
          )}

          {/* Incident List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {incidents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No incidents reported</p>
            ) : incidents.map(inc => (
              <div key={inc.id} className="px-4 py-3 flex items-start gap-3">
                <div className="pt-0.5">{severityBadge(inc.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{inc.title}</div>
                  {inc.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{inc.description}</div>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {statusBadge(inc.status)}
                    {inc.category && <span className="capitalize">{inc.category}</span>}
                    {inc.assigned_name && <span>Assigned: {inc.assigned_name}</span>}
                    <span>{new Date(inc.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {inc.status === 'open' && (
                    <button onClick={() => handleUpdateIncidentStatus(inc.id, 'investigating')}
                      className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400">
                      Investigate
                    </button>
                  )}
                  {(inc.status === 'open' || inc.status === 'investigating') && (
                    <button onClick={() => handleUpdateIncidentStatus(inc.id, 'resolved')}
                      className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400">
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ MODE TAB ============ */}
      {tab === 'mode' && systemMode && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Current System Mode</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-4 h-4 rounded-full ${
                systemMode.mode === 'live' ? 'bg-green-500' : systemMode.mode === 'cutover' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 uppercase">{systemMode.mode}</div>
            </div>

            {systemMode.cutover_started_at && (
              <p className="text-xs text-gray-400 mb-2">Cutover started: {new Date(systemMode.cutover_started_at).toLocaleString()}</p>
            )}
            {systemMode.go_live_date && (
              <p className="text-xs text-gray-400 mb-2">Go-live date: {new Date(systemMode.go_live_date).toLocaleString()}</p>
            )}

            {/* Mode progression */}
            <div className="flex items-center gap-2 mt-6 mb-4">
              {['parallel', 'cutover', 'live'].map((m, i) => (
                <div key={m} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    m === systemMode.mode ? 'bg-primary-600 text-white' :
                    ['parallel', 'cutover', 'live'].indexOf(m) < ['parallel', 'cutover', 'live'].indexOf(systemMode.mode) ? 'bg-green-500 text-white' :
                    'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}>{i + 1}</div>
                  <span className={`text-sm capitalize ${m === systemMode.mode ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>{m}</span>
                  {i < 2 && <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700" />}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-6">
              {systemMode.mode === 'parallel' && (
                <button onClick={() => handleModeChange('cutover')}
                  className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700">
                  Begin Cutover
                </button>
              )}
              {systemMode.mode === 'cutover' && (
                <>
                  <button onClick={() => handleModeChange('live')}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">
                    Go Live
                  </button>
                  <button onClick={() => handleModeChange('parallel')}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
                    Rollback to Parallel
                  </button>
                </>
              )}
              {systemMode.mode === 'live' && (
                <p className="text-sm text-green-600 font-medium">System is live. CIPROTS has been retired.</p>
              )}
            </div>
          </div>

          {/* Mode descriptions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`rounded-lg border p-4 ${systemMode.mode === 'parallel' ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Parallel</h4>
              <p className="text-xs text-gray-500">Both CIPROTS and RailSync active. Comparisons running. Data validated daily.</p>
            </div>
            <div className={`rounded-lg border p-4 ${systemMode.mode === 'cutover' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Cutover</h4>
              <p className="text-xs text-gray-500">RailSync is primary. CIPROTS is read-only. Final delta sync running. War room active.</p>
            </div>
            <div className={`rounded-lg border p-4 ${systemMode.mode === 'live' ? 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Live</h4>
              <p className="text-xs text-gray-500">RailSync is the system of record. CIPROTS retired. Stabilization monitoring active.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
