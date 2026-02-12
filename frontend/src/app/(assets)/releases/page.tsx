'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, Plus, Clock, ArrowRight, Ban } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { RIDER_CAR_STATUS_CONFIG } from '@/lib/statusConfig';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type ReleaseStatus = 'initiated' | 'approved' | 'executed' | 'completed' | 'cancelled';
type ReleaseType = 'standard' | 'expedited' | 'emergency';

interface Release {
  id: string;
  shopping_event_id: string;
  car_id: string;
  car_number: string;
  shop_code: string;
  release_type: ReleaseType;
  status: ReleaseStatus;
  notes: string | null;
  initiated_at: string;
  approved_at: string | null;
  executed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  initiated_by: string | null;
  approved_by: string | null;
  rider_car_status?: string;
}

interface ReleaseStats {
  initiated: number;
  awaiting_approval: number;
  in_progress: number;
  completed_this_month: number;
}

type StatusFilter = 'all' | 'initiated' | 'approved' | 'executed' | 'completed' | 'cancelled';

export default function ReleasesPage() {
  const { isAuthenticated } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [stats, setStats] = useState<ReleaseStats>({ initiated: 0, awaiting_approval: 0, in_progress: 0, completed_this_month: 0 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewRelease, setShowNewRelease] = useState(false);
  const [newRelease, setNewRelease] = useState({ shopping_event_id: '', car_id: '', shop_code: '', release_type: 'standard', notes: '' });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  async function loadReleases() {
    const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    const res = await fetchWithAuth(`/releases${params}`);
    setReleases(res.data || []);
  }

  async function loadStats() {
    const res = await fetchWithAuth('/releases/active');
    if (res.data) {
      setStats({
        initiated: res.data.initiated ?? 0,
        awaiting_approval: res.data.awaiting_approval ?? 0,
        in_progress: res.data.in_progress ?? 0,
        completed_this_month: res.data.completed_this_month ?? 0,
      });
    }
  }

  async function loadAll() {
    await Promise.all([loadReleases(), loadStats()]);
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    loadAll().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    loadReleases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function handleInitiateRelease() {
    if (!newRelease.shopping_event_id.trim() || !newRelease.car_id.trim() || !newRelease.shop_code.trim()) return;
    setSaving(true);
    const res = await fetchWithAuth('/releases', { method: 'POST', body: JSON.stringify(newRelease) });
    if (res.success) {
      setNewRelease({ shopping_event_id: '', car_id: '', shop_code: '', release_type: 'standard', notes: '' });
      setShowNewRelease(false);
      await loadAll();
    } else {
      alert(res.error || 'Failed to initiate release');
    }
    setSaving(false);
  }

  async function handleAction(id: string, action: 'approve' | 'execute' | 'complete' | 'cancel') {
    const labels: Record<string, string> = { approve: 'approve', execute: 'execute', complete: 'complete', cancel: 'cancel' };
    if (!confirm(`Are you sure you want to ${labels[action]} this release?`)) return;
    setActionLoading(`${id}-${action}`);
    const res = await fetchWithAuth(`/releases/${id}/${action}`, { method: 'POST' });
    if (res.success) {
      await loadAll();
    } else {
      alert(res.error || `Failed to ${labels[action]} release`);
    }
    setActionLoading(null);
  }

  const statusBadge = (status: ReleaseStatus) => {
    const cls: Record<ReleaseStatus, string> = {
      initiated: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      approved: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      executed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      completed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${cls[status]}`}>{status}</span>;
  };

  const releaseTypeBadge = (type: ReleaseType) => {
    const cls: Record<ReleaseType, string> = {
      standard: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      expedited: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      emergency: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${cls[type]}`}>{type}</span>;
  };

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'initiated', label: 'Initiated' },
    { key: 'approved', label: 'Approved' },
    { key: 'executed', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Release Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track and manage car releases from maintenance shops</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.initiated}</div>
          <div className="text-xs text-gray-500">Initiated</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.awaiting_approval}</div>
          <div className="text-xs text-gray-500">Awaiting Approval</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.in_progress}</div>
          <div className="text-xs text-gray-500">In Progress</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.completed_this_month}</div>
          <div className="text-xs text-gray-500">Completed (This Month)</div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {filterTabs.map(t => (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                statusFilter === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>{t.label}</button>
          ))}
        </nav>
      </div>

      {/* Initiate Release Button / Form */}
      {!showNewRelease ? (
        <button onClick={() => setShowNewRelease(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Initiate Release
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Initiate New Release</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Shopping Event ID</label>
              <input value={newRelease.shopping_event_id} onChange={e => setNewRelease(p => ({ ...p, shopping_event_id: e.target.value }))}
                placeholder="Shopping Event ID" className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Car Number</label>
              <input value={newRelease.car_id} onChange={e => setNewRelease(p => ({ ...p, car_id: e.target.value }))}
                placeholder="Car Number" className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Shop Code</label>
              <input value={newRelease.shop_code} onChange={e => setNewRelease(p => ({ ...p, shop_code: e.target.value }))}
                placeholder="Shop Code" className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Release Type</label>
              <select value={newRelease.release_type} onChange={e => setNewRelease(p => ({ ...p, release_type: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                <option value="standard">Standard</option>
                <option value="expedited">Expedited</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={newRelease.notes} onChange={e => setNewRelease(p => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes" rows={2} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleInitiateRelease} disabled={saving || !newRelease.shopping_event_id.trim() || !newRelease.car_id.trim() || !newRelease.shop_code.trim()}
              className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Initiating...' : 'Initiate'}
            </button>
            <button onClick={() => setShowNewRelease(false)} className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
          </div>
        </div>
      )}

      {/* Release List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Car Number</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Release Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Initiated</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {releases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm text-gray-400">No releases found</td>
                </tr>
              ) : releases.map(rel => (
                <tr key={rel.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{rel.car_number || rel.car_id}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{rel.shop_code}</td>
                  <td className="px-4 py-3">{releaseTypeBadge(rel.release_type)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusBadge(rel.status)}
                      {rel.rider_car_status && RIDER_CAR_STATUS_CONFIG[rel.rider_car_status] && (
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${RIDER_CAR_STATUS_CONFIG[rel.rider_car_status].color}`}>
                          {RIDER_CAR_STATUS_CONFIG[rel.rider_car_status].label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(rel.initiated_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {rel.status === 'initiated' && (
                        <>
                          <button onClick={() => handleAction(rel.id, 'approve')}
                            disabled={actionLoading === `${rel.id}-approve`}
                            className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 disabled:opacity-50">
                            {actionLoading === `${rel.id}-approve` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <CheckCircle className="w-3 h-3 inline mr-1" />}
                            Approve
                          </button>
                          <button onClick={() => handleAction(rel.id, 'cancel')}
                            disabled={actionLoading === `${rel.id}-cancel`}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 disabled:opacity-50">
                            {actionLoading === `${rel.id}-cancel` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <Ban className="w-3 h-3 inline mr-1" />}
                            Cancel
                          </button>
                        </>
                      )}
                      {rel.status === 'approved' && (
                        <>
                          <button onClick={() => handleAction(rel.id, 'execute')}
                            disabled={actionLoading === `${rel.id}-execute`}
                            className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 disabled:opacity-50">
                            {actionLoading === `${rel.id}-execute` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <ArrowRight className="w-3 h-3 inline mr-1" />}
                            Execute
                          </button>
                          <button onClick={() => handleAction(rel.id, 'cancel')}
                            disabled={actionLoading === `${rel.id}-cancel`}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 disabled:opacity-50">
                            {actionLoading === `${rel.id}-cancel` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <Ban className="w-3 h-3 inline mr-1" />}
                            Cancel
                          </button>
                        </>
                      )}
                      {rel.status === 'executed' && (
                        <>
                          <button onClick={() => handleAction(rel.id, 'complete')}
                            disabled={actionLoading === `${rel.id}-complete`}
                            className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 disabled:opacity-50">
                            {actionLoading === `${rel.id}-complete` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <CheckCircle className="w-3 h-3 inline mr-1" />}
                            Complete
                          </button>
                          <button onClick={() => handleAction(rel.id, 'cancel')}
                            disabled={actionLoading === `${rel.id}-cancel`}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 disabled:opacity-50">
                            {actionLoading === `${rel.id}-cancel` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <Ban className="w-3 h-3 inline mr-1" />}
                            Cancel
                          </button>
                        </>
                      )}
                      {(rel.status === 'completed' || rel.status === 'cancelled') && (
                        <span className="text-xs text-gray-400">No actions</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
