'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Plus, X, Pencil, Save, ChevronDown, ChevronRight, Droplets } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Commodity {
  id: string;
  commodity_code: string;
  commodity_name: string;
  hazmat_class: string | null;
  requires_interior_cleaning: boolean;
  requires_exterior_cleaning: boolean;
  requires_kosher_cleaning: boolean;
  special_handling_notes: string | null;
  is_active: boolean;
}

interface CleaningReq {
  cleaning_type: string;
  required_before: string;
  procedure_notes: string | null;
}

export default function CommoditiesPage() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [cleaningReqs, setCleaningReqs] = useState<CleaningReq[]>([]);
  const [loadingCleaning, setLoadingCleaning] = useState(false);

  const [form, setForm] = useState({
    commodity_code: '',
    commodity_name: '',
    hazmat_class: '',
    requires_interior_cleaning: false,
    requires_exterior_cleaning: false,
    requires_kosher_cleaning: false,
    special_handling_notes: '',
  });

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...opts?.headers } }).then(r => r.json());

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    fetchWithAuth('/commodities').then(res => setCommodities(res.data || [])).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetchWithAuth('/commodities', { method: 'POST', body: JSON.stringify(form) });
      if (res.data) setCommodities(prev => [...prev, res.data]);
      setShowCreate(false);
      setForm({ commodity_code: '', commodity_name: '', hazmat_class: '', requires_interior_cleaning: false, requires_exterior_cleaning: false, requires_kosher_cleaning: false, special_handling_notes: '' });
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/commodities/${id}`, { method: 'PUT', body: JSON.stringify(form) });
      if (res.data) setCommodities(commodities.map(c => c.id === id ? res.data : c));
      setEditingId(null);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  function startEdit(c: Commodity) {
    setEditingId(c.id);
    setForm({
      commodity_code: c.commodity_code,
      commodity_name: c.commodity_name,
      hazmat_class: c.hazmat_class || '',
      requires_interior_cleaning: c.requires_interior_cleaning,
      requires_exterior_cleaning: c.requires_exterior_cleaning,
      requires_kosher_cleaning: c.requires_kosher_cleaning,
      special_handling_notes: c.special_handling_notes || '',
    });
  }

  async function toggleExpand(code: string) {
    if (expandedCode === code) { setExpandedCode(null); return; }
    setExpandedCode(code);
    setLoadingCleaning(true);
    try {
      const res = await fetchWithAuth(`/commodities/${encodeURIComponent(code)}/cleaning`);
      setCleaningReqs(res.data || []);
    } catch { setCleaningReqs([]); }
    finally { setLoadingCleaning(false); }
  }

  const filtered = commodities.filter(c =>
    !search || c.commodity_code.toLowerCase().includes(search.toLowerCase()) || c.commodity_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Commodity Codes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage commodity classifications and cleaning requirements</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setShowCreate(!showCreate); setEditingId(null); }} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">
            <Plus className="w-4 h-4" /> New Commodity
          </button>
        )}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code or name..." className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-64" />

      {/* Create form */}
      {showCreate && isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">New Commodity</h3>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
              <input value={form.commodity_code} onChange={e => setForm({ ...form, commodity_code: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input value={form.commodity_name} onChange={e => setForm({ ...form, commodity_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hazmat Class</label>
              <input value={form.hazmat_class} onChange={e => setForm({ ...form, hazmat_class: e.target.value })} placeholder="Optional" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div className="md:col-span-3 flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.requires_interior_cleaning} onChange={e => setForm({ ...form, requires_interior_cleaning: e.target.checked })} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                Interior Cleaning
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.requires_exterior_cleaning} onChange={e => setForm({ ...form, requires_exterior_cleaning: e.target.checked })} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                Exterior Cleaning
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.requires_kosher_cleaning} onChange={e => setForm({ ...form, requires_kosher_cleaning: e.target.checked })} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                Kosher Cleaning
              </label>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Special Handling Notes</label>
              <textarea value={form.special_handling_notes} onChange={e => setForm({ ...form, special_handling_notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleCreate} disabled={saving || !form.commodity_code || !form.commodity_name} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
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
                <th className="w-8 px-3 py-2" />
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Code</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Hazmat</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Interior</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Exterior</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Kosher</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Notes</th>
                {isAdmin && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(c => (
                <React.Fragment key={c.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleExpand(c.commodity_code)}>
                    <td className="px-3 py-2 text-gray-400">
                      {expandedCode === c.commodity_code ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-gray-100">{c.commodity_code}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {editingId === c.id ? (
                        <input value={form.commodity_name} onChange={e => setForm({ ...form, commodity_name: e.target.value })} className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" onClick={e => e.stopPropagation()} />
                      ) : c.commodity_name}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.hazmat_class || '-'}</td>
                    <td className="text-center px-4 py-2"><Badge yes={c.requires_interior_cleaning} /></td>
                    <td className="text-center px-4 py-2"><Badge yes={c.requires_exterior_cleaning} /></td>
                    <td className="text-center px-4 py-2"><Badge yes={c.requires_kosher_cleaning} /></td>
                    <td className="px-4 py-2 text-xs text-gray-400 max-w-[200px] truncate">{c.special_handling_notes || '-'}</td>
                    {isAdmin && (
                      <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                        {editingId === c.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleUpdate(c.id)} disabled={saving} className="p-1 text-green-600 hover:text-green-700"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(c)} className="p-1 text-gray-400 hover:text-primary-600"><Pencil className="w-4 h-4" /></button>
                        )}
                      </td>
                    )}
                  </tr>
                  {expandedCode === c.commodity_code && (
                    <tr key={`${c.id}-cleaning`}>
                      <td colSpan={isAdmin ? 9 : 8} className="bg-gray-50 dark:bg-gray-900/30 px-8 py-4">
                        {loadingCleaning ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary-500 mx-auto" />
                        ) : cleaningReqs.length > 0 ? (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                              <Droplets className="w-3.5 h-3.5" /> Cleaning Requirements
                            </h4>
                            <div className="space-y-2">
                              {cleaningReqs.map((cr, i) => (
                                <div key={i} className="flex items-start gap-3 text-xs">
                                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium">{cr.cleaning_type}</span>
                                  <span className="text-gray-500">Before: {cr.required_before}</span>
                                  {cr.procedure_notes && <span className="text-gray-400">{cr.procedure_notes}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No specific cleaning requirements defined</p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No commodities found</p>}
        </div>
      )}
    </div>
  );
}

function Badge({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Yes</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-400">No</span>
  );
}
