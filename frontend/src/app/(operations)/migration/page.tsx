'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Upload, Database, CheckCircle, XCircle, AlertTriangle, FileText, Play, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface MigrationRun {
  id: string;
  entity_type: string;
  status: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  created_at: string;
}

interface ReconciliationRow {
  entity: string;
  railsync_count: number;
  last_migration_count: number;
  last_migration_date: string | null;
}

interface RowError {
  row_number: number;
  field_name: string;
  error_type: string;
  error_message: string;
  raw_value?: string;
}

interface DeltaSummary {
  entity: string;
  new_count: number;
  updated_count: number;
  last_delta_date: string | null;
}

interface OrchestrationResult {
  entity_type: string;
  status: string;
  imported: number;
  skipped: number;
  errors: number;
}

const ENTITY_TYPES = [
  { key: 'customers', label: 'Customers', endpoint: '/migration/import/customers', icon: Database, order: 1 },
  { key: 'contracts', label: 'Contracts', endpoint: '/migration/import/contracts', icon: FileText, order: 2 },
  { key: 'cars', label: 'Cars', endpoint: '/migration/import/cars', icon: Database, order: 3 },
  { key: 'allocations', label: 'Allocations', endpoint: '/migration/import/allocations', icon: FileText, order: 4 },
  { key: 'shopping', label: 'Shopping Events', endpoint: '/migration/import/shopping', icon: FileText, order: 5 },
  { key: 'qualifications', label: 'Qualifications', endpoint: '/migration/import/qualifications', icon: FileText, order: 6 },
  { key: 'invoices', label: 'Invoices', endpoint: '/migration/import/invoices', icon: FileText, order: 7 },
  { key: 'mileage', label: 'Mileage Records', endpoint: '/migration/import/mileage', icon: FileText, order: 8 },
];

export default function MigrationPage() {
  const { isAuthenticated } = useAuth();
  const [runs, setRuns] = useState<MigrationRun[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedRunErrors, setSelectedRunErrors] = useState<RowError[]>([]);
  const [showErrors, setShowErrors] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [orchestrating, setOrchestrating] = useState(false);
  const [orchestrationResults, setOrchestrationResults] = useState<OrchestrationResult[] | null>(null);
  const [deltaSummary, setDeltaSummary] = useState<DeltaSummary[]>([]);
  const [deltaImporting, setDeltaImporting] = useState(false);
  const [deltaResult, setDeltaResult] = useState<any>(null);
  const deltaFileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'manual' | 'orchestrate' | 'delta'>('manual');

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([
      fetchWithAuth('/migration/runs'),
      fetchWithAuth('/migration/reconciliation'),
      fetchWithAuth('/migration/delta/summary'),
    ]).then(([runsRes, reconRes, deltaRes]) => {
      setRuns(runsRes.data || []);
      setReconciliation(reconRes.data || []);
      setDeltaSummary(deltaRes.data || []);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  function handleUpload(entityKey: string) {
    setSelectedEntity(entityKey);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedEntity) return;
    const entity = ENTITY_TYPES.find(et => et.key === selectedEntity);
    if (!entity) return;

    setImporting(selectedEntity);
    setImportResult(null);
    try {
      const content = await file.text();
      if (dryRun) {
        const res = await fetchWithAuth('/migration/validate', {
          method: 'POST',
          body: JSON.stringify({ entity_type: selectedEntity, content }),
        });
        setImportResult({ ...(res.data || res), dry_run: true });
      } else {
        const res = await fetchWithAuth(entity.endpoint, {
          method: 'POST',
          body: JSON.stringify({ content }),
        });
        setImportResult(res.data || res);
      }
      // Refresh runs
      const runsRes = await fetchWithAuth('/migration/runs');
      setRuns(runsRes.data || []);
      const reconRes = await fetchWithAuth('/migration/reconciliation');
      setReconciliation(reconRes.data || []);
    } catch (err) {
      setImportResult({ error: (err as Error).message });
    } finally {
      setImporting(null);
      e.target.value = '';
    }
  }

  async function handleRollback(runId: string) {
    if (!confirm('This will delete all records imported by this run. Continue?')) return;
    setRollingBack(runId);
    try {
      await fetchWithAuth(`/migration/runs/${runId}/rollback`, { method: 'POST' });
      const [runsRes, reconRes] = await Promise.all([
        fetchWithAuth('/migration/runs'),
        fetchWithAuth('/migration/reconciliation'),
      ]);
      setRuns(runsRes.data || []);
      setReconciliation(reconRes.data || []);
    } catch { /* silent */ }
    finally { setRollingBack(null); }
  }

  async function loadErrors(runId: string) {
    if (showErrors === runId) { setShowErrors(null); return; }
    setShowErrors(runId);
    const res = await fetchWithAuth(`/migration/runs/${runId}/errors`);
    setSelectedRunErrors(res.data || []);
  }

  async function handleOrchestrate() {
    if (!confirm('This will run a full ordered migration across all entity types. Continue?')) return;
    setOrchestrating(true);
    setOrchestrationResults(null);
    try {
      const res = await fetchWithAuth('/migration/orchestrate', { method: 'POST', body: JSON.stringify({ files: {} }) });
      setOrchestrationResults(res.data || []);
      const [runsRes, reconRes] = await Promise.all([
        fetchWithAuth('/migration/runs'),
        fetchWithAuth('/migration/reconciliation'),
      ]);
      setRuns(runsRes.data || []);
      setReconciliation(reconRes.data || []);
    } catch (err) {
      setOrchestrationResults([{ entity_type: 'error', status: 'failed', imported: 0, skipped: 0, errors: 0 }]);
    } finally {
      setOrchestrating(false);
    }
  }

  async function handleDeltaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDeltaImporting(true);
    setDeltaResult(null);
    try {
      const content = await file.text();
      const res = await fetchWithAuth('/migration/delta/cars', { method: 'POST', body: JSON.stringify({ content }) });
      setDeltaResult(res.data || res);
      const [runsRes, deltaRes] = await Promise.all([
        fetchWithAuth('/migration/runs'),
        fetchWithAuth('/migration/delta/summary'),
      ]);
      setRuns(runsRes.data || []);
      setDeltaSummary(deltaRes.data || []);
    } catch (err) {
      setDeltaResult({ error: (err as Error).message });
    } finally {
      setDeltaImporting(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CIPROTS Data Migration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Import CSV exports from CIPROTS into RailSync</p>
      </div>

      <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileSelected} />
      <input type="file" ref={deltaFileRef} accept=".csv" className="hidden" onChange={handleDeltaUpload} />

      {/* Mode Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {([
            { key: 'manual' as const, label: 'Manual Import' },
            { key: 'orchestrate' as const, label: 'Full Orchestration' },
            { key: 'delta' as const, label: 'Delta Sync' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Manual Import Tab */}
      {tab === 'manual' && (
        <>
          {/* Dry Run Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={e => setDryRun(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Dry Run (validate only, no data written)
            </label>
            {dryRun && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                Validation mode
              </span>
            )}
          </div>

          {/* Upload Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ENTITY_TYPES.map(et => (
              <div key={et.key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <et.icon className="w-5 h-5 text-primary-500" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{et.label}</h3>
                </div>
                <button
                  onClick={() => handleUpload(et.key)}
                  disabled={importing !== null}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {importing === et.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing === et.key ? 'Importing...' : 'Upload CSV'}
                </button>
              </div>
            ))}
          </div>

          {/* Import Result */}
          {importResult && (
            <div className={`rounded-lg border p-4 ${importResult.error ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-green-300 bg-green-50 dark:bg-green-900/20'}`}>
              {importResult.error ? (
                <p className="text-sm text-red-700 dark:text-red-400">{importResult.error}</p>
              ) : (
                <div className="text-sm">
                  <p className="font-medium text-green-700 dark:text-green-400 mb-1">
                    {importResult.dry_run ? 'Validation Complete (Dry Run)' : 'Import Complete'}
                  </p>
                  <div className="flex gap-6 text-gray-600 dark:text-gray-300">
                    <span>Total: {importResult.total_rows}</span>
                    <span className="text-green-600">Imported: {importResult.imported}</span>
                    <span className="text-yellow-600">Skipped: {importResult.skipped}</span>
                    <span className="text-red-600">Errors: {importResult.errors}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Full Orchestration Tab */}
      {tab === 'orchestrate' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <Play className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Full Orchestrated Migration</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Runs all entity imports in dependency order: Customers → Contracts → Cars → Allocations → Shopping Events → Qualifications → Invoices → Mileage.
                  Failed entities are skipped and downstream dependents are held.
                </p>
                <button
                  onClick={handleOrchestrate}
                  disabled={orchestrating}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {orchestrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {orchestrating ? 'Running Orchestration...' : 'Start Orchestration'}
                </button>
              </div>
            </div>
          </div>

          {orchestrationResults && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Orchestration Results</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Entity</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Imported</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Skipped</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {orchestrationResults.map(r => (
                    <tr key={r.entity_type}>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100 capitalize">{r.entity_type}</td>
                      <td className="px-4 py-2 text-center">
                        {r.status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}
                        {r.status === 'failed' && <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                        {r.status === 'skipped' && <AlertTriangle className="w-4 h-4 text-yellow-500 mx-auto" />}
                      </td>
                      <td className="text-right px-4 py-2 text-green-600">{r.imported}</td>
                      <td className="text-right px-4 py-2 text-yellow-600">{r.skipped}</td>
                      <td className="text-right px-4 py-2 text-red-600">{r.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delta Sync Tab */}
      {tab === 'delta' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <RefreshCw className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Delta Sync — Cars</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Upload a CIPROTS car extract to sync only new or changed records. Existing cars are updated in place; new cars are inserted.
                  This is faster than a full migration and safe to run repeatedly.
                </p>
                <button
                  onClick={() => deltaFileRef.current?.click()}
                  disabled={deltaImporting}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  {deltaImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {deltaImporting ? 'Syncing...' : 'Upload Delta CSV'}
                </button>
              </div>
            </div>
          </div>

          {deltaResult && (
            <div className={`rounded-lg border p-4 ${deltaResult.error ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-green-300 bg-green-50 dark:bg-green-900/20'}`}>
              {deltaResult.error ? (
                <p className="text-sm text-red-700 dark:text-red-400">{deltaResult.error}</p>
              ) : (
                <div className="text-sm">
                  <p className="font-medium text-green-700 dark:text-green-400 mb-1">Delta Sync Complete</p>
                  <div className="flex gap-6 text-gray-600 dark:text-gray-300">
                    <span>New: <strong className="text-green-600">{deltaResult.inserted ?? 0}</strong></span>
                    <span>Updated: <strong className="text-blue-600">{deltaResult.updated ?? 0}</strong></span>
                    <span>Unchanged: <strong className="text-gray-500">{deltaResult.unchanged ?? 0}</strong></span>
                    <span>Errors: <strong className="text-red-600">{deltaResult.errors ?? 0}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delta Summary */}
          {deltaSummary.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Delta Status by Entity</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Entity</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Pending New</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Pending Updates</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Last Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {deltaSummary.map(d => (
                    <tr key={d.entity}>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100 capitalize">{d.entity}</td>
                      <td className="text-right px-4 py-2 text-green-600">{d.new_count}</td>
                      <td className="text-right px-4 py-2 text-blue-600">{d.updated_count}</td>
                      <td className="text-right px-4 py-2 text-gray-400 text-xs">{d.last_delta_date ? new Date(d.last_delta_date).toLocaleString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reconciliation Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Reconciliation Summary</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Entity</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">RailSync Count</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Last Import</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Last Import Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {reconciliation.map(r => (
              <tr key={r.entity}>
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100 capitalize">{r.entity}</td>
                <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{r.railsync_count.toLocaleString()}</td>
                <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{r.last_migration_count.toLocaleString()}</td>
                <td className="text-right px-4 py-2 text-gray-400">{r.last_migration_date ? new Date(r.last_migration_date).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Migration History */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Import History</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Entity</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Total</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Imported</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Errors</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {runs.map(run => (
                <>
                  <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100 capitalize">{run.entity_type}</td>
                    <td className="px-4 py-2 text-center">
                      {run.status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}
                      {run.status === 'failed' && <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                      {run.status === 'importing' && <Loader2 className="w-4 h-4 animate-spin text-blue-500 mx-auto" />}
                    </td>
                    <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{run.total_rows}</td>
                    <td className="text-right px-4 py-2 text-green-600">{run.imported_rows}</td>
                    <td className="text-right px-4 py-2 text-red-600">{run.error_rows}</td>
                    <td className="text-right px-4 py-2 text-gray-400 text-xs">{new Date(run.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2 flex items-center gap-2">
                      {run.error_rows > 0 && (
                        <button
                          onClick={() => loadErrors(run.id)}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          {showErrors === run.id ? 'Hide' : 'Errors'}
                        </button>
                      )}
                      {run.status === 'complete' && (
                        <button
                          onClick={() => handleRollback(run.id)}
                          disabled={rollingBack !== null}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {rollingBack === run.id ? 'Rolling back...' : 'Rollback'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {showErrors === run.id && selectedRunErrors.length > 0 && (
                    <tr key={`${run.id}-errors`}>
                      <td colSpan={7} className="bg-red-50 dark:bg-red-900/10 px-6 py-3">
                        <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                          {selectedRunErrors.map((err, idx) => (
                            <div key={idx} className="flex gap-3 text-red-700 dark:text-red-400">
                              <span className="text-gray-400 w-12">Row {err.row_number}</span>
                              <span className="w-24 text-red-500">{err.field_name}</span>
                              <span>{err.error_message}</span>
                              {err.raw_value && <span className="text-gray-400">({err.raw_value})</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {runs.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No migration runs yet</p>}
        </div>
      )}
    </div>
  );
}
