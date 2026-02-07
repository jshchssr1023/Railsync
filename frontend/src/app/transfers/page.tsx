'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Plus, ArrowRightLeft, CheckCircle, XCircle, Clock, AlertTriangle, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type TransferStatus = 'INITIATED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
type TransferType = 'permanent' | 'temporary' | 'emergency';

interface Transfer {
  id: string;
  car_id: string;
  car_number: string;
  from_rider_id: string;
  from_rider_name: string;
  to_rider_id: string;
  to_rider_name: string;
  transfer_type: TransferType;
  effective_date: string;
  status: TransferStatus;
  reason: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TransferOverview {
  pending: number;
  confirmed: number;
  completed_this_month: number;
  cancelled: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const emptyForm = {
  car_id: '',
  from_rider_id: '',
  to_rider_id: '',
  transfer_type: 'permanent' as TransferType,
  effective_date: '',
  reason: '',
  notes: '',
};

export default function ContractTransfersPage() {
  const { isAuthenticated } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransferStatus>('ALL');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [overview, setOverview] = useState<TransferOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  async function loadTransfers() {
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    const query = params.toString();
    const endpoint = `/transfers${query ? `?${query}` : ''}`;
    const res = await fetchWithAuth(endpoint);
    setTransfers(res.data || []);
  }

  async function loadOverview() {
    const res = await fetchWithAuth('/transfers/overview');
    setOverview(res.data || null);
  }

  async function loadAll() {
    await Promise.all([loadTransfers(), loadOverview()]);
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    loadTransfers();
  }, [statusFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function handleValidate() {
    if (!form.car_id || !form.from_rider_id || !form.to_rider_id) return;
    setValidating(true);
    setValidation(null);
    const params = new URLSearchParams({
      car_id: form.car_id,
      from_rider_id: form.from_rider_id,
      to_rider_id: form.to_rider_id,
    });
    const res = await fetchWithAuth(`/transfers/validate-prerequisites?${params.toString()}`);
    setValidation(res.data || { valid: false, errors: ['Validation request failed'], warnings: [] });
    setValidating(false);
  }

  async function handleSubmitTransfer() {
    if (!form.car_id || !form.from_rider_id || !form.to_rider_id || !form.effective_date || !form.reason) return;
    setSaving(true);
    await fetchWithAuth('/transfers', { method: 'POST', body: JSON.stringify(form) });
    setForm({ ...emptyForm });
    setValidation(null);
    setShowForm(false);
    await loadAll();
    setSaving(false);
  }

  async function handleConfirm(id: string) {
    if (!confirm('Are you sure you want to confirm this transfer? This moves the transfer to CONFIRMED status.')) return;
    setActionLoading(id);
    await fetchWithAuth(`/transfers/${id}/confirm`, { method: 'POST' });
    await loadAll();
    setActionLoading(null);
  }

  async function handleComplete(id: string) {
    if (!confirm('Are you sure you want to complete this transfer? This action is irreversible.')) return;
    setActionLoading(id);
    await fetchWithAuth(`/transfers/${id}/complete`, { method: 'POST' });
    await loadAll();
    setActionLoading(null);
  }

  async function handleCancel(id: string) {
    if (!confirm('Are you sure you want to cancel this transfer?')) return;
    setActionLoading(id);
    await fetchWithAuth(`/transfers/${id}/cancel`, { method: 'POST' });
    await loadAll();
    setActionLoading(null);
  }

  const statusBadge = (status: TransferStatus) => {
    const cls = status === 'INITIATED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      : status === 'CONFIRMED' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
      : status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cls}`}>{status}</span>;
  };

  const transferTypeBadge = (type: TransferType) => {
    const cls = type === 'emergency' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
      : type === 'temporary' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize ${cls}`}>{type}</span>;
  };

  const filterTabs: { key: 'ALL' | TransferStatus; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'INITIATED', label: 'Initiated' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Contract Transfers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage car transfers between contract riders</p>
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
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{overview.pending}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{overview.confirmed}</div>
            <div className="text-xs text-gray-500">Confirmed</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{overview.completed_this_month}</div>
            <div className="text-xs text-gray-500">Completed (This Month)</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{overview.cancelled}</div>
            <div className="text-xs text-gray-500">Cancelled</div>
          </div>
        </div>
      )}

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

      {/* Initiate Transfer Button / Form */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Initiate Transfer
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" /> New Transfer
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Car ID *</label>
              <input value={form.car_id} onChange={e => setForm(p => ({ ...p, car_id: e.target.value }))}
                placeholder="Enter car ID" className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Rider ID *</label>
              <input value={form.from_rider_id} onChange={e => setForm(p => ({ ...p, from_rider_id: e.target.value }))}
                placeholder="Source rider ID" className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To Rider ID *</label>
              <input value={form.to_rider_id} onChange={e => setForm(p => ({ ...p, to_rider_id: e.target.value }))}
                placeholder="Destination rider ID" className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Transfer Type *</label>
              <select value={form.transfer_type} onChange={e => setForm(p => ({ ...p, transfer_type: e.target.value as TransferType }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                <option value="permanent">Permanent</option>
                <option value="temporary">Temporary</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Effective Date *</label>
              <input type="date" value={form.effective_date} onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reason *</label>
              <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Transfer reason" className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Additional notes" rows={2} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          </div>

          {/* Validation Results */}
          {validation && (
            <div className={`rounded-md border p-3 ${validation.valid ? 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800' : 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800'}`}>
              <div className="flex items-center gap-2 mb-1">
                {validation.valid ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                <span className={`text-sm font-medium ${validation.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {validation.valid ? 'Prerequisites passed' : 'Prerequisites failed'}
                </span>
              </div>
              {validation.errors.length > 0 && (
                <ul className="text-xs text-red-600 dark:text-red-400 ml-6 list-disc">
                  {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {validation.warnings.length > 0 && (
                <ul className="text-xs text-yellow-600 dark:text-yellow-400 ml-6 list-disc mt-1">
                  {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleValidate} disabled={validating || !form.car_id || !form.from_rider_id || !form.to_rider_id}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
              <Search className="w-3.5 h-3.5" />
              {validating ? 'Validating...' : 'Validate'}
            </button>
            <button onClick={handleSubmitTransfer} disabled={saving || !form.car_id || !form.from_rider_id || !form.to_rider_id || !form.effective_date || !form.reason}
              className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Submitting...' : 'Submit Transfer'}
            </button>
            <button onClick={() => { setShowForm(false); setValidation(null); setForm({ ...emptyForm }); }}
              className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transfer List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Car Number</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">From Rider</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">To Rider</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Effective Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-sm text-gray-400">No transfers found</td>
                </tr>
              ) : transfers.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{t.car_number}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.from_rider_name}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.to_rider_name}</td>
                  <td className="px-4 py-3">{transferTypeBadge(t.transfer_type)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{new Date(t.effective_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{statusBadge(t.status)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {actionLoading === t.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      ) : (
                        <>
                          {t.status === 'INITIATED' && (
                            <>
                              <button onClick={() => handleConfirm(t.id)}
                                className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400">
                                Confirm
                              </button>
                              <button onClick={() => handleCancel(t.id)}
                                className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">
                                Cancel
                              </button>
                            </>
                          )}
                          {t.status === 'CONFIRMED' && (
                            <>
                              <button onClick={() => handleComplete(t.id)}
                                className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400">
                                Complete
                              </button>
                              <button onClick={() => handleCancel(t.id)}
                                className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">
                                Cancel
                              </button>
                            </>
                          )}
                        </>
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
