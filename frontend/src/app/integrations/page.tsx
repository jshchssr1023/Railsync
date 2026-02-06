'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  Play,
  RotateCcw,
  ChevronUp,
  Eye,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import {
  getIntegrationStatuses,
  getIntegrationSyncLog,
  getIntegrationSyncStats,
  retryIntegrationSync,
  sapBatchPush,
  sfFullSync,
  checkSAPConnection,
  checkSFConnection,
} from '@/lib/api';
import {
  IntegrationConnectionStatus,
  IntegrationSyncLogEntry,
  IntegrationSyncStats,
} from '@/types';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  retrying: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

const MODE_COLORS: Record<string, string> = {
  mock: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  live: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  disabled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const SYSTEM_LABELS: Record<string, string> = {
  sap: 'SAP',
  salesforce: 'Salesforce',
  clm: 'CLM / Telegraph',
  railinc: 'Railinc EDI',
};

const formatDate = (d: string | null) => {
  if (!d) return '--';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
function IntegrationsPageInner() {
  const toast = useToast();

  const [connections, setConnections] = useState<IntegrationConnectionStatus[]>([]);
  const [stats, setStats] = useState<IntegrationSyncStats | null>(null);
  const [logEntries, setLogEntries] = useState<IntegrationSyncLogEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [systemFilter, setSystemFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Actions in progress
  const [checkingSAP, setCheckingSAP] = useState(false);
  const [checkingSF, setCheckingSF] = useState(false);
  const [batchPushing, setBatchPushing] = useState(false);
  const [sfSyncing, setSfSyncing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [connData, statsData, logData] = await Promise.all([
        getIntegrationStatuses().catch(() => []),
        getIntegrationSyncStats().catch(() => null),
        getIntegrationSyncLog({
          system: systemFilter || undefined,
          status: statusFilter || undefined,
          limit: 50,
        }).catch(() => ({ entries: [], total: 0 })),
      ]);
      setConnections(Array.isArray(connData) ? connData : []);
      setStats(statsData as IntegrationSyncStats | null);
      setLogEntries(Array.isArray(logData.entries) ? logData.entries : []);
      setLogTotal(logData.total || 0);
    } catch (err) {
      setError('Failed to load integration data.');
    } finally {
      setLoading(false);
    }
  }, [systemFilter, statusFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCheckSAP = async () => {
    setCheckingSAP(true);
    try {
      await checkSAPConnection();
      toast.success('SAP connection verified');
      loadAll();
    } catch { toast.error('SAP connection check failed'); }
    finally { setCheckingSAP(false); }
  };

  const handleCheckSF = async () => {
    setCheckingSF(true);
    try {
      await checkSFConnection();
      toast.success('Salesforce connection verified');
      loadAll();
    } catch { toast.error('Salesforce connection check failed'); }
    finally { setCheckingSF(false); }
  };

  const handleBatchPush = async () => {
    setBatchPushing(true);
    try {
      const result = await sapBatchPush() as any;
      toast.success(`Batch push: ${result?.successful || 0} successful, ${result?.failed || 0} failed`);
      loadAll();
    } catch { toast.error('Batch push failed'); }
    finally { setBatchPushing(false); }
  };

  const handleSFSync = async () => {
    setSfSyncing(true);
    try {
      await sfFullSync();
      toast.success('Salesforce full sync completed');
      loadAll();
    } catch { toast.error('Salesforce sync failed'); }
    finally { setSfSyncing(false); }
  };

  const handleRetry = async (entryId: string) => {
    setRetryingId(entryId);
    try {
      await retryIntegrationSync(entryId);
      toast.success('Retry successful');
      loadAll();
    } catch { toast.error('Retry failed'); }
    finally { setRetryingId(null); }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Integrations</h1>
        <button
          onClick={loadAll}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Connection Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {connections.map((conn) => (
          <div
            key={conn.system_name}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {SYSTEM_LABELS[conn.system_name] || conn.system_name}
              </h3>
              {conn.is_connected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Mode</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${MODE_COLORS[conn.mode] || MODE_COLORS.disabled}`}>
                  {conn.mode.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Last Check</span>
                <span className="text-gray-700 dark:text-gray-300">{formatDate(conn.last_check_at)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Last Success</span>
                <span className="text-gray-700 dark:text-gray-300">{formatDate(conn.last_success_at)}</span>
              </div>
              {conn.last_error && (
                <p className="text-xs text-red-600 dark:text-red-400 truncate" title={conn.last_error}>
                  {conn.last_error}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCheckSAP}
          disabled={checkingSAP}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {checkingSAP ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
          Check SAP
        </button>
        <button
          onClick={handleCheckSF}
          disabled={checkingSF}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {checkingSF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
          Check Salesforce
        </button>
        <button
          onClick={handleBatchPush}
          disabled={batchPushing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          {batchPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          SAP Batch Push
        </button>
        <button
          onClick={handleSFSync}
          disabled={sfSyncing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          {sfSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          SF Full Sync
        </button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Syncs</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Successful</p>
            <p className="text-2xl font-bold text-green-600">{stats.success}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
        </div>
      )}

      {/* Sync Log Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">System</label>
              <select
                value={systemFilter}
                onChange={(e) => setSystemFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="">All Systems</option>
                <option value="sap">SAP</option>
                <option value="salesforce">Salesforce</option>
                <option value="clm">CLM</option>
                <option value="railinc">Railinc</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
                <option value="retrying">Retrying</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">System</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Operation</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Entity</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">External ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Time</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {logEntries.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                    onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {SYSTEM_LABELS[entry.system_name] || entry.system_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                      {entry.operation}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900 dark:text-gray-100">{entry.entity_ref || '--'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{entry.entity_type || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[entry.status] || STATUS_COLORS.pending}`}>
                        {entry.status === 'success' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {entry.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                        {entry.status === 'in_progress' && <Clock className="w-3 h-3 mr-1" />}
                        {entry.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                      {entry.external_id || '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id);
                          }}
                          className="p-1 text-gray-400 hover:text-primary-600"
                        >
                          {expandedEntryId === entry.id ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {entry.status === 'failed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(entry.id);
                            }}
                            disabled={retryingId === entry.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                          >
                            {retryingId === entry.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedEntryId === entry.id && (
                    <tr key={`${entry.id}-detail`}>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-gray-900/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400 mb-1 font-medium">Payload</p>
                            <pre className="bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto max-h-40 text-gray-700 dark:text-gray-300">
                              {JSON.stringify(entry.payload, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400 mb-1 font-medium">Response</p>
                            <pre className="bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto max-h-40 text-gray-700 dark:text-gray-300">
                              {entry.response ? JSON.stringify(entry.response, null, 2) : '--'}
                            </pre>
                          </div>
                        </div>
                        {entry.error_message && (
                          <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 rounded p-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700 dark:text-red-400">{entry.error_message}</p>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>Retries: {entry.retry_count}</span>
                          {entry.completed_at && <span>Completed: {formatDate(entry.completed_at)}</span>}
                          <span>Direction: {entry.direction}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {logEntries.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                    No sync log entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {logTotal > 50 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
            Showing {logEntries.length} of {logTotal} entries
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-6"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <IntegrationsPageInner />
    </Suspense>
  );
}
