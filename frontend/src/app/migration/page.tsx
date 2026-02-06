'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Upload, Database, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';
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

const ENTITY_TYPES = [
  { key: 'cars', label: 'Cars', endpoint: '/migration/import/cars', icon: Database },
  { key: 'contracts', label: 'Contracts', endpoint: '/migration/import/contracts', icon: FileText },
  { key: 'shopping', label: 'Shopping Events', endpoint: '/migration/import/shopping', icon: FileText },
  { key: 'qualifications', label: 'Qualifications', endpoint: '/migration/import/qualifications', icon: FileText },
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

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([
      fetchWithAuth('/migration/runs'),
      fetchWithAuth('/migration/reconciliation'),
    ]).then(([runsRes, reconRes]) => {
      setRuns(runsRes.data || []);
      setReconciliation(reconRes.data || []);
    }).finally(() => setLoading(false));
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
      const res = await fetchWithAuth(entity.endpoint, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setImportResult(res.data || res);
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

  async function loadErrors(runId: string) {
    if (showErrors === runId) { setShowErrors(null); return; }
    setShowErrors(runId);
    const res = await fetchWithAuth(`/migration/runs/${runId}/errors`);
    setSelectedRunErrors(res.data || []);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CIPROTS Data Migration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Import CSV exports from CIPROTS into RailSync</p>
      </div>

      <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileSelected} />

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
              <p className="font-medium text-green-700 dark:text-green-400 mb-1">Import Complete</p>
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
                    <td className="px-4 py-2">
                      {run.error_rows > 0 && (
                        <button
                          onClick={() => loadErrors(run.id)}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          {showErrors === run.id ? 'Hide' : 'Errors'}
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
