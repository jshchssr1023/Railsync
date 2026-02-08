'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, X, Pencil, Save, Trash2, DollarSign } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface BillableItem {
  id: string;
  lessee_code: string;
  lessee_name?: string;
  rider_id: string | null;
  commodity: string | null;
  car_type: string | null;
  item_code: string;
  item_description: string;
  is_customer_responsible: boolean;
  billing_notes: string | null;
  created_at: string;
}

interface LesseeSummary {
  lessee_code: string;
  lessee_name: string;
  total_items: number;
  customer_responsible_count: number;
}

export default function BillableItemsPage() {
  const { user, isAuthenticated } = useAuth();
  const isOperator = isAuthenticated && (user?.role === 'admin' || user?.role === 'operator');
  const [items, setItems] = useState<BillableItem[]>([]);
  const [summary, setSummary] = useState<LesseeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'items' | 'summary'>('items');
  const [filterLessee, setFilterLessee] = useState('');
  const [filterResp, setFilterResp] = useState<'' | 'true' | 'false'>('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    lessee_code: '',
    rider_id: '',
    commodity: '',
    car_type: '',
    item_code: '',
    item_description: '',
    is_customer_responsible: false,
    billing_notes: '',
  });

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...opts?.headers } }).then(r => r.json());

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterLessee) params.set('lessee_code', filterLessee);
    if (filterResp) params.set('customer_responsible', filterResp);
    Promise.all([
      fetchWithAuth(`/billable-items?${params.toString()}`),
      fetchWithAuth('/billable-items/summary'),
    ]).then(([itemsRes, summRes]) => {
      setItems(itemsRes.data || []);
      setSummary(summRes.data || []);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, filterLessee, filterResp]);

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetchWithAuth('/billable-items', { method: 'POST', body: JSON.stringify(form) });
      if (res.data) setItems(prev => [res.data, ...prev]);
      setShowCreate(false);
      setForm({ lessee_code: '', rider_id: '', commodity: '', car_type: '', item_code: '', item_description: '', is_customer_responsible: false, billing_notes: '' });
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/billable-items/${id}`, { method: 'PUT', body: JSON.stringify({ item_description: form.item_description, is_customer_responsible: form.is_customer_responsible, billing_notes: form.billing_notes }) });
      if (res.data) setItems(items.map(i => i.id === id ? res.data : i));
      setEditingId(null);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this billable item? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await fetchWithAuth(`/billable-items/${id}`, { method: 'DELETE' });
      setItems(items.filter(i => i.id !== id));
    } catch { /* silent */ }
    finally { setDeleting(null); }
  }

  function startEdit(item: BillableItem) {
    setEditingId(item.id);
    setForm({
      lessee_code: item.lessee_code,
      rider_id: item.rider_id || '',
      commodity: item.commodity || '',
      car_type: item.car_type || '',
      item_code: item.item_code,
      item_description: item.item_description,
      is_customer_responsible: item.is_customer_responsible,
      billing_notes: item.billing_notes || '',
    });
  }

  const lessees = [...new Set(items.map(i => i.lessee_code))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billable Items</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage billable item catalog and customer charge responsibility</p>
        </div>
        {isOperator && (
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">
            <Plus className="w-4 h-4" /> New Item
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {([{ key: 'items' as const, label: 'All Items' }, { key: 'summary' as const, label: 'By Customer' }]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'items' && (
        <>
          {/* Filters */}
          <div className="flex gap-4">
            <select value={filterLessee} onChange={e => setFilterLessee(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <option value="">All Customers</option>
              {lessees.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={filterResp} onChange={e => setFilterResp(e.target.value as '' | 'true' | 'false')} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <option value="">All Responsibility</option>
              <option value="true">Customer Responsible</option>
              <option value="false">Lessor Responsible</option>
            </select>
            <span className="flex items-center text-sm text-gray-500 dark:text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Create form */}
          {showCreate && isOperator && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">New Billable Item</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Code</label>
                  <input value={form.lessee_code} onChange={e => setForm({ ...form, lessee_code: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Code</label>
                  <input value={form.item_code} onChange={e => setForm({ ...form, item_code: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Commodity (optional)</label>
                  <input value={form.commodity} onChange={e => setForm({ ...form, commodity: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <input value={form.item_description} onChange={e => setForm({ ...form, item_description: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={form.is_customer_responsible} onChange={e => setForm({ ...form, is_customer_responsible: e.target.checked })} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    Customer Responsible
                  </label>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Billing Notes</label>
                  <textarea value={form.billing_notes} onChange={e => setForm({ ...form, billing_notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={handleCreate} disabled={saving || !form.lessee_code || !form.item_code || !form.item_description} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Customer</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Item Code</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Description</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Commodity</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Responsibility</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Notes</th>
                    {isOperator && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{item.lessee_name || item.lessee_code}</div>
                        <div className="text-xs text-gray-400">{item.lessee_code}</div>
                      </td>
                      <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300">{item.item_code}</td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-[250px]">
                        {editingId === item.id ? (
                          <input value={form.item_description} onChange={e => setForm({ ...form, item_description: e.target.value })} className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                        ) : <span className="truncate block">{item.item_description}</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{item.commodity || '-'}</td>
                      <td className="text-center px-4 py-2">
                        {editingId === item.id ? (
                          <label className="flex items-center justify-center gap-1 text-xs">
                            <input type="checkbox" checked={form.is_customer_responsible} onChange={e => setForm({ ...form, is_customer_responsible: e.target.checked })} className="h-3 w-3" />
                            Cust
                          </label>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${item.is_customer_responsible ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                            {item.is_customer_responsible ? 'Customer' : 'Lessor'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400 max-w-[150px] truncate">{item.billing_notes || '-'}</td>
                      {isOperator && (
                        <td className="px-4 py-2">
                          {editingId === item.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleUpdate(item.id)} disabled={saving} className="p-1 text-green-600 hover:text-green-700"><Save className="w-4 h-4" /></button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <button onClick={() => startEdit(item)} className="p-1 text-gray-400 hover:text-primary-600"><Pencil className="w-4 h-4" /></button>
                              {user?.role === 'admin' && (
                                <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id} className="p-1 text-gray-400 hover:text-red-600">
                                  {deleting === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No billable items found</p>}
            </div>
          )}
        </>
      )}

      {/* Summary tab */}
      {tab === 'summary' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Customer</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Total Items</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Customer Responsible</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Lessor Responsible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {summary.map(s => (
                <tr key={s.lessee_code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => { setFilterLessee(s.lessee_code); setTab('items'); }}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{s.lessee_name || s.lessee_code}</div>
                    <div className="text-xs text-gray-400">{s.lessee_code}</div>
                  </td>
                  <td className="text-right px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{s.total_items}</td>
                  <td className="text-right px-4 py-2 text-amber-600">{s.customer_responsible_count}</td>
                  <td className="text-right px-4 py-2 text-blue-600">{s.total_items - s.customer_responsible_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No billable item data</p>}
        </div>
      )}
    </div>
  );
}
