'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Trash2, RefreshCw, CheckCircle, XCircle, Clock,
  AlertTriangle, Calendar, DollarSign, Factory, ChevronDown
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type ScrapStatus = 'proposed' | 'under_review' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

interface Scrap {
  id: string;
  car_number: string;
  status: ScrapStatus;
  reason: string;
  estimated_salvage_value: number | null;
  actual_salvage_value: number | null;
  facility_code: string | null;
  target_date: string | null;
  completion_date: string | null;
  completion_notes: string | null;
  cancellation_reason: string | null;
  proposed_by_name?: string;
  reviewed_by_name?: string;
  approved_by_name?: string;
  facility_name?: string;
  car_type?: string;
  days_since_proposed?: number;
  created_at: string;
  version: number;
}

const STATUS_CONFIG: Record<ScrapStatus, { label: string; color: string; icon: typeof Clock }> = {
  proposed: { label: 'Proposed', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  scheduled: { label: 'Scheduled', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Calendar },
  in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: Loader2 },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
};

type TabFilter = 'active' | 'proposed' | 'under_review' | 'approved' | 'scheduled' | 'in_progress' | 'all';

export default function ScrapReviewPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabFilter>('active');
  const [actionScrap, setActionScrap] = useState<{ id: string; action: string } | null>(null);
  const [actionData, setActionData] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = useCallback((endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json()), []);

  const loadScraps = useCallback(async () => {
    try {
      let endpoint = '/scraps';
      if (tab === 'active') {
        endpoint = '/scraps/active';
      } else if (tab !== 'all') {
        endpoint = `/scraps?status=${tab}`;
      }
      const res = await fetchWithAuth(endpoint);
      setScraps(res.data || []);
    } catch {
      setScraps([]);
    }
  }, [tab, fetchWithAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      loadScraps().finally(() => setLoading(false));
    }
  }, [isAuthenticated, loadScraps]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadScraps();
    setRefreshing(false);
  };

  const handleAction = async () => {
    if (!actionScrap) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const body: Record<string, unknown> = { status: actionScrap.action };
      if (actionScrap.action === 'cancelled') {
        body.cancellation_reason = actionData.cancellation_reason || actionData.comments;
      }
      if (actionScrap.action === 'scheduled') {
        body.facility_code = actionData.facility_code;
        body.target_date = actionData.target_date;
      }
      if (actionScrap.action === 'completed') {
        body.actual_salvage_value = actionData.actual_salvage_value ? parseFloat(actionData.actual_salvage_value) : undefined;
        body.completion_notes = actionData.completion_notes;
      }
      if (actionData.comments) body.comments = actionData.comments;

      const res = await fetchWithAuth(`/scraps/${actionScrap.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!res.success) throw new Error(res.error || 'Action failed');
      setActionScrap(null);
      setActionData({});
      await loadScraps();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
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
          Please sign in to view scrap reviews
        </h2>
      </div>
    );
  }

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'proposed', label: 'Proposed' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-500" />
            Scrap Review
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review and manage car scrap proposals through their lifecycle.
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors
              ${tab === t.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scrap List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : scraps.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Trash2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Scraps Found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No scrap proposals match the current filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {scraps.map((scrap) => {
            const cfg = STATUS_CONFIG[scrap.status] || STATUS_CONFIG.proposed;
            const StatusIcon = cfg.icon;
            return (
              <div
                key={scrap.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-base font-bold text-gray-900 dark:text-gray-100">{scrap.car_number}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      {scrap.car_type && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{scrap.car_type}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{scrap.reason}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      {scrap.estimated_salvage_value != null && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Est: ${scrap.estimated_salvage_value.toLocaleString()}
                        </span>
                      )}
                      {scrap.actual_salvage_value != null && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Actual: ${scrap.actual_salvage_value.toLocaleString()}
                        </span>
                      )}
                      {scrap.facility_name && (
                        <span className="flex items-center gap-1">
                          <Factory className="w-3 h-3" />
                          {scrap.facility_name}
                        </span>
                      )}
                      {scrap.target_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Target: {scrap.target_date}
                        </span>
                      )}
                      {scrap.proposed_by_name && (
                        <span>Proposed by {scrap.proposed_by_name}</span>
                      )}
                      {scrap.days_since_proposed != null && (
                        <span>{scrap.days_since_proposed}d ago</span>
                      )}
                    </div>
                  </div>

                  {/* Actions based on status */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {scrap.status === 'proposed' && (
                      <>
                        <button
                          onClick={() => { setActionScrap({ id: scrap.id, action: 'under_review' }); setActionData({}); setActionError(null); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 transition-colors"
                        >
                          Start Review
                        </button>
                        <button
                          onClick={() => { setActionScrap({ id: scrap.id, action: 'cancelled' }); setActionData({}); setActionError(null); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 transition-colors"
                        >
                          Withdraw
                        </button>
                      </>
                    )}
                    {scrap.status === 'under_review' && (
                      <>
                        <button
                          onClick={() => { setActionScrap({ id: scrap.id, action: 'approved' }); setActionData({}); setActionError(null); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => { setActionScrap({ id: scrap.id, action: 'cancelled' }); setActionData({}); setActionError(null); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {scrap.status === 'approved' && (
                      <button
                        onClick={() => { setActionScrap({ id: scrap.id, action: 'scheduled' }); setActionData({}); setActionError(null); }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 transition-colors"
                      >
                        Schedule
                      </button>
                    )}
                    {scrap.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => { setActionScrap({ id: scrap.id, action: 'in_progress' }); setActionData({}); setActionError(null); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 transition-colors"
                        >
                          Mark In Progress
                        </button>
                        <button
                          onClick={() => { setActionScrap({ id: scrap.id, action: 'cancelled' }); setActionData({}); setActionError(null); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {scrap.status === 'in_progress' && (
                      <button
                        onClick={() => { setActionScrap({ id: scrap.id, action: 'completed' }); setActionData({}); setActionError(null); }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Dialog */}
      {actionScrap && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {actionScrap.action === 'under_review' && 'Start Review'}
              {actionScrap.action === 'approved' && 'Approve Scrap'}
              {actionScrap.action === 'scheduled' && 'Schedule Scrap'}
              {actionScrap.action === 'in_progress' && 'Mark In Progress'}
              {actionScrap.action === 'completed' && 'Complete Scrap'}
              {actionScrap.action === 'cancelled' && 'Cancel / Reject Scrap'}
            </h3>

            <div className="space-y-4">
              {actionScrap.action === 'cancelled' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={actionData.cancellation_reason || ''}
                    onChange={(e) => setActionData(prev => ({ ...prev, cancellation_reason: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Reason for cancellation / rejection"
                  />
                </div>
              )}

              {actionScrap.action === 'scheduled' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Scrap Facility <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={actionData.facility_code || ''}
                      onChange={(e) => setActionData(prev => ({ ...prev, facility_code: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Facility code (Z-prefix shop)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Target Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={actionData.target_date || ''}
                      onChange={(e) => setActionData(prev => ({ ...prev, target_date: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {actionScrap.action === 'completed' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Actual Salvage Value ($)
                    </label>
                    <input
                      type="number"
                      value={actionData.actual_salvage_value || ''}
                      onChange={(e) => setActionData(prev => ({ ...prev, actual_salvage_value: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Completion Notes
                    </label>
                    <textarea
                      value={actionData.completion_notes || ''}
                      onChange={(e) => setActionData(prev => ({ ...prev, completion_notes: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Final notes"
                    />
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                      This action is IRREVERSIBLE. The car will be permanently removed from the active fleet.
                    </p>
                  </div>
                </>
              )}

              {(actionScrap.action === 'approved' || actionScrap.action === 'under_review') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Comments
                  </label>
                  <textarea
                    value={actionData.comments || ''}
                    onChange={(e) => setActionData(prev => ({ ...prev, comments: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Optional comments"
                  />
                </div>
              )}

              {actionError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-xs text-red-700 dark:text-red-400">{actionError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setActionScrap(null); setActionData({}); }}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading || (actionScrap.action === 'cancelled' && !actionData.cancellation_reason) || (actionScrap.action === 'scheduled' && (!actionData.facility_code || !actionData.target_date))}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2
                    ${actionScrap.action === 'cancelled' ? 'bg-red-600 hover:bg-red-700' :
                      actionScrap.action === 'completed' ? 'bg-red-600 hover:bg-red-700' :
                      'bg-primary-600 hover:bg-primary-700'}`}
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
