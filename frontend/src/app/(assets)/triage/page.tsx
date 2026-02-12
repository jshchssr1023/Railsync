'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertTriangle, ClipboardList, Package, Trash2,
  RefreshCw, Calendar, ChevronDown, Check, Clock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCarDrawer } from '@/context/CarDrawerContext';
import Link from 'next/link';
import { listTriageQueue, resolveTriageEntry } from '@/lib/api';
import type { TriageQueueEntry, TriageResolution } from '@/types';

const REASON_BADGE: Record<string, { label: string; color: string }> = {
  lease_expiring: { label: 'Lease Expiring', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  lease_expired: { label: 'Lease Expired', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  scrap_cancelled: { label: 'Scrap Cancelled', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  customer_return: { label: 'Customer Return', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  bad_order: { label: 'Bad Order', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  qualification_due: { label: 'Qualification Due', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  market_conditions: { label: 'Market Conditions', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

const RESOLUTION_OPTIONS: { value: TriageResolution; label: string }[] = [
  { value: 'assigned_to_shop', label: 'Assign to Shop' },
  { value: 'assigned_to_customer', label: 'Assign to Customer' },
  { value: 'released_to_idle', label: 'Release to Idle' },
  { value: 'scrap_proposed', label: 'Propose Scrap' },
  { value: 'dismissed', label: 'Dismiss' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function TriagePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [entries, setEntries] = useState<TriageQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Scrap dialog state (kept from original)
  const [showScrapDialog, setShowScrapDialog] = useState<string | null>(null);
  const [scrapForm, setScrapForm] = useState({ reason: '', estimated_salvage_value: '' });
  const [scrapSubmitting, setScrapSubmitting] = useState(false);
  const [scrapError, setScrapError] = useState<string | null>(null);

  const { openCarDrawer } = useCarDrawer();
  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = useCallback((endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json()), []);

  const loadEntries = useCallback(async () => {
    try {
      const data = await listTriageQueue({ resolved: false });
      setEntries(data);
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadEntries().finally(() => setLoading(false));
    }
  }, [isAuthenticated, loadEntries]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  };

  const handleResolve = async (id: string, resolution: TriageResolution) => {
    setResolveError(null);
    try {
      await resolveTriageEntry(id, resolution);
      setResolvingId(null);
      await loadEntries();
    } catch (err: any) {
      setResolveError(err.message);
    }
  };

  const handleScrapSubmit = async () => {
    if (!showScrapDialog || !scrapForm.reason) return;
    setScrapSubmitting(true);
    setScrapError(null);
    try {
      const res = await fetchWithAuth('/scraps', {
        method: 'POST',
        body: JSON.stringify({
          car_number: showScrapDialog,
          reason: scrapForm.reason,
          estimated_salvage_value: scrapForm.estimated_salvage_value ? parseFloat(scrapForm.estimated_salvage_value) : undefined,
        }),
      });
      if (!res.success) throw new Error(res.error || 'Failed to create scrap proposal');
      setShowScrapDialog(null);
      setScrapForm({ reason: '', estimated_salvage_value: '' });
      await loadEntries();
    } catch (err: any) {
      setScrapError(err.message);
    } finally {
      setScrapSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Please sign in to view the triage queue
        </h2>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Pending Triage
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {entries.length} car{entries.length !== 1 ? 's' : ''} awaiting disposition decision. Each requires individual review per R13.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Queue */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Pending Cars</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All cars have been triaged. Check back when new cars enter the pending queue.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const reasonCfg = REASON_BADGE[entry.reason] || { label: entry.reason, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
            return (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openCarDrawer(entry.car_number)}
                          className="text-base font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline cursor-pointer"
                        >
                          {entry.car_number}
                        </button>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${reasonCfg.color}`}>
                          {reasonCfg.label}
                        </span>
                        {entry.priority && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            P{entry.priority}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {relativeTime(entry.created_at)}
                        </span>
                        {entry.notes && (
                          <span className="truncate max-w-[200px]">{entry.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Resolve dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setResolvingId(resolvingId === entry.id ? null : entry.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Resolve
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {resolvingId === entry.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                          {RESOLUTION_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => handleResolve(entry.id, opt.value)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 first:rounded-t-lg last:rounded-b-lg"
                            >
                              {opt.label}
                            </button>
                          ))}
                          {resolveError && (
                            <div className="px-3 py-1.5 text-[10px] text-red-600 dark:text-red-400 border-t border-gray-100 dark:border-gray-700">
                              {resolveError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Link
                      href={`/assignments?car_number=${entry.car_number}&source=triage`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      Assign
                    </Link>
                    <Link
                      href={`/releases?car_number=${entry.car_number}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Release
                    </Link>
                    <button
                      onClick={() => { setShowScrapDialog(entry.car_number); setScrapError(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Scrap
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Scrap Proposal Dialog */}
      {showScrapDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
              Propose Scrap: {showScrapDialog}
            </h3>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Scrap is irreversible once in progress. This car will be permanently decommissioned.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={scrapForm.reason}
                  onChange={(e) => setScrapForm(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Why should this car be scrapped?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estimated Salvage Value ($)
                </label>
                <input
                  type="number"
                  value={scrapForm.estimated_salvage_value}
                  onChange={(e) => setScrapForm(prev => ({ ...prev, estimated_salvage_value: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>

              {scrapError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-xs text-red-700 dark:text-red-400">{scrapError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowScrapDialog(null); setScrapForm({ reason: '', estimated_salvage_value: '' }); }}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScrapSubmit}
                  disabled={!scrapForm.reason || scrapSubmitting}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {scrapSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Propose Scrap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
