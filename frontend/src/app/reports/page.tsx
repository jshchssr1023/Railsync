'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Download, Play, Save, BookOpen, Trash2, Table2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ============================================================================
// Types
// ============================================================================

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  available_columns: { key: string; label: string; type: string }[];
  available_filters: { key: string; label: string; type: string; options?: string[] }[];
  default_columns: string[];
}

interface ReportResult {
  columns: { key: string; label: string; type: string }[];
  rows: Record<string, unknown>[];
  total: number;
  generated_at: string;
}

interface SavedReport {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  columns: string[];
  filters: Record<string, unknown>;
  sort_by: string | null;
  sort_dir: string;
  is_scheduled: boolean;
  created_at: string;
}

// ============================================================================
// Page
// ============================================================================

export default function ReportsPage() {
  const { isAuthenticated } = useAuth();

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchApi = useCallback((endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    }).then(r => r.json()), []);

  // State
  const [tab, setTab] = useState<'builder' | 'saved'>('builder');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  // Load templates and saved reports
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([
      fetchApi('/report-builder/templates').then(r => setTemplates(r.data || [])),
      fetchApi('/report-builder/saved').then(r => setSavedReports(r.data || [])),
    ]).finally(() => setLoading(false));
  }, [isAuthenticated, fetchApi]);

  // Select template
  function selectTemplate(t: ReportTemplate) {
    setSelectedTemplate(t);
    setSelectedColumns([...t.default_columns]);
    setFilters({});
    setSortBy('');
    setResult(null);
  }

  // Toggle column
  function toggleColumn(key: string) {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  // Run report
  async function runReport() {
    if (!selectedTemplate) return;
    setRunning(true);
    try {
      const r = await fetchApi('/report-builder/run', {
        method: 'POST',
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          columns: selectedColumns,
          filters,
          sort_by: sortBy || undefined,
          sort_dir: sortDir,
          limit: 500,
        }),
      });
      setResult(r.data || null);
    } catch (err) {
      console.error('Report run failed:', err);
    } finally {
      setRunning(false);
    }
  }

  // Export CSV
  async function exportCSV() {
    if (!selectedTemplate) return;
    try {
      const resp = await fetch(`${API_URL}/report-builder/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          columns: selectedColumns,
          filters,
          sort_by: sortBy || undefined,
          sort_dir: sortDir,
        }),
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate.name.replace(/\s+/g, '_')}_report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  // Save report
  async function handleSave() {
    if (!selectedTemplate || !saveName.trim()) return;
    await fetchApi('/report-builder/saved', {
      method: 'POST',
      body: JSON.stringify({
        template_id: selectedTemplate.id,
        name: saveName,
        columns: selectedColumns,
        filters,
        sort_by: sortBy || undefined,
        sort_dir: sortDir,
      }),
    });
    const r = await fetchApi('/report-builder/saved');
    setSavedReports(r.data || []);
    setSaveName('');
    setShowSave(false);
  }

  // Load saved report
  async function loadSaved(saved: SavedReport) {
    const t = templates.find(tt => tt.id === saved.template_id);
    if (!t) return;
    setSelectedTemplate(t);
    setSelectedColumns(saved.columns || t.default_columns);
    setFilters((saved.filters || {}) as Record<string, string>);
    setSortBy(saved.sort_by || '');
    setSortDir((saved.sort_dir as 'ASC' | 'DESC') || 'ASC');
    setResult(null);
    setTab('builder');
  }

  // Delete saved report
  async function deleteSaved(id: string) {
    await fetchApi(`/report-builder/saved/${id}`, { method: 'DELETE' });
    setSavedReports(prev => prev.filter(s => s.id !== id));
  }

  // Format cell value
  function formatCell(val: unknown, type: string): string {
    if (val === null || val === undefined) return '-';
    if (type === 'currency') return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (type === 'date' && typeof val === 'string') return new Date(val).toLocaleDateString();
    return String(val);
  }

  const categoryColors: Record<string, string> = {
    fleet: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    operations: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    billing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    compliance: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    finance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Report Builder</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Build, run, and export custom reports from your data</p>
        </div>
        <div className="flex gap-2">
          {['builder', 'saved'].map(t => (
            <button key={t} onClick={() => setTab(t as 'builder' | 'saved')}
              className={`px-4 py-2 text-sm rounded-md ${tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
              {t === 'builder' ? 'Build Report' : `Saved (${savedReports.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Saved reports tab */}
      {tab === 'saved' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {savedReports.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No saved reports yet</p>
          ) : savedReports.map(s => (
            <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <div className="cursor-pointer flex-1" onClick={() => loadSaved(s)}>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                <div className="text-xs text-gray-500">
                  Template: {templates.find(t => t.id === s.template_id)?.name || s.template_id}
                  {' '}| {s.columns?.length || 0} columns
                  {s.is_scheduled && ' | Scheduled'}
                  {' '}| {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => deleteSaved(s.id)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Builder tab */}
      {tab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Template picker + config */}
          <div className="lg:col-span-1 space-y-4">
            {/* Template picker */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Templates
              </h3>
              <div className="space-y-2">
                {templates.map(t => (
                  <button key={t.id} onClick={() => selectTemplate(t)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedTemplate?.id === t.id
                      ? 'bg-primary-50 border border-primary-300 dark:bg-primary-900/20 dark:border-primary-700'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 border border-transparent'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${categoryColors[t.category] || 'bg-gray-100 text-gray-600'}`}>{t.category}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Column selector */}
            {selectedTemplate && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Table2 className="w-4 h-4" /> Columns
                </h3>
                <div className="space-y-1">
                  {selectedTemplate.available_columns.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                      <input type="checkbox" checked={selectedColumns.includes(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <span className="text-gray-700 dark:text-gray-300">{col.label}</span>
                      <span className="text-xs text-gray-400 ml-auto">{col.type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            {selectedTemplate && selectedTemplate.available_filters.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Filters</h3>
                <div className="space-y-3">
                  {selectedTemplate.available_filters.map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                      {f.type === 'select' && f.options ? (
                        <select value={filters[f.key] || ''} onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
                          <option value="">All</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input value={filters[f.key] || ''} onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={`Filter by ${f.label.toLowerCase()}`}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sort */}
            {selectedTemplate && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Sort</h3>
                <div className="flex gap-2">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
                    <option value="">Default</option>
                    {selectedTemplate.available_columns.filter(c => selectedColumns.includes(c.key)).map(c =>
                      <option key={c.key} value={c.key}>{c.label}</option>
                    )}
                  </select>
                  <select value={sortDir} onChange={e => setSortDir(e.target.value as 'ASC' | 'DESC')}
                    className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
                    <option value="ASC">Asc</option>
                    <option value="DESC">Desc</option>
                  </select>
                </div>
              </div>
            )}

            {/* Actions */}
            {selectedTemplate && (
              <div className="flex flex-col gap-2">
                <button onClick={runReport} disabled={running || selectedColumns.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {running ? 'Running...' : 'Run Report'}
                </button>
                {result && (
                  <>
                    <button onClick={exportCSV}
                      className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                      <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button onClick={() => setShowSave(!showSave)}
                      className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                      <Save className="w-4 h-4" /> Save Report
                    </button>
                    {showSave && (
                      <div className="flex gap-2">
                        <input value={saveName} onChange={e => setSaveName(e.target.value)}
                          placeholder="Report name" className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                        <button onClick={handleSave} disabled={!saveName.trim()}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Save</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-3">
            {!selectedTemplate && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Select a template to start building a report</p>
              </div>
            )}

            {selectedTemplate && !result && !running && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <Play className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  Configure columns and filters, then click Run Report
                </p>
                <p className="text-xs text-gray-400 mt-1">{selectedColumns.length} columns selected</p>
              </div>
            )}

            {running && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Generating report...</p>
              </div>
            )}

            {result && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedTemplate?.name}
                    </span>
                    <span className="text-xs text-gray-500 ml-3">
                      {result.total.toLocaleString()} rows | Generated {new Date(result.generated_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        {result.columns.map(col => (
                          <th key={col.key}
                            className={`px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap ${col.type === 'number' || col.type === 'currency' ? 'text-right' : 'text-left'}`}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {result.rows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          {result.columns.map(col => (
                            <td key={col.key}
                              className={`px-4 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400 ${col.type === 'number' || col.type === 'currency' ? 'text-right' : ''}`}>
                              {formatCell(row[col.key], col.type)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {result.rows.length === 0 && (
                        <tr>
                          <td colSpan={result.columns.length} className="px-4 py-8 text-center text-gray-400">No data matches the selected filters</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {result.total > result.rows.length && (
                  <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 text-center">
                    Showing {result.rows.length} of {result.total.toLocaleString()} total rows. Export CSV for full data.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
