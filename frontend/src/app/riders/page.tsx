'use client';

import { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronRight, Train, FileText, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { listRiders, getRider, updateRider } from '@/lib/api';

interface RiderSummary {
  id: string;
  contract_base: string;
  rider_number: string;
  lessee_code: string;
  lessee_name: string;
  car_count: number;
  effective_date: string | null;
  expiration_date: string | null;
  terms_summary: string | null;
  created_at: string;
}

interface RiderCar {
  car_number: string;
  car_type: string;
  commodity: string | null;
  tank_qual_year: number | null;
  current_status: string;
}

export default function RidersPage() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && (user?.role === 'admin' || user?.role === 'operator');
  const [riders, setRiders] = useState<RiderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<{ rider: RiderSummary; cars: RiderCar[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterLessee, setFilterLessee] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ terms_summary: '', effective_date: '', expiration_date: '' });
  const [saving, setSaving] = useState(false);
  const [populating, setPopulating] = useState(false);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}${endpoint}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...opts?.headers },
    }).then(r => r.json());

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    listRiders().then(data => setRiders(data)).finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function toggleExpand(riderId: string) {
    if (expandedId === riderId) { setExpandedId(null); return; }
    setExpandedId(riderId);
    setLoadingDetail(true);
    try {
      const data = await getRider(riderId);
      setExpandedData({ rider: data, cars: data.cars || [] });
    } catch { setExpandedData(null); }
    finally { setLoadingDetail(false); }
  }

  async function handlePopulate() {
    if (!confirm('This will scan the cars table and create rider entries for any contract_number patterns not yet in the riders table. Continue?')) return;
    setPopulating(true);
    try {
      const res = await fetchWithAuth('/riders/populate', { method: 'POST' });
      alert(`Populated ${res.data?.inserted || 0} new riders.`);
      const data = await listRiders();
      setRiders(data);
    } catch { /* silent */ }
    finally { setPopulating(false); }
  }

  function startEdit(rider: RiderSummary) {
    setEditingId(rider.id);
    setEditForm({
      terms_summary: rider.terms_summary || '',
      effective_date: rider.effective_date?.slice(0, 10) || '',
      expiration_date: rider.expiration_date?.slice(0, 10) || '',
    });
  }

  async function saveEdit(riderId: string) {
    setSaving(true);
    try {
      await updateRider(riderId, editForm);
      setRiders(riders.map(r => r.id === riderId ? { ...r, ...editForm } : r));
      setEditingId(null);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  const filtered = riders.filter(r => {
    if (filterLessee && !r.lessee_code.toLowerCase().includes(filterLessee.toLowerCase()) && !(r.lessee_name || '').toLowerCase().includes(filterLessee.toLowerCase())) return false;
    if (filterContract && !r.contract_base.toLowerCase().includes(filterContract.toLowerCase())) return false;
    return true;
  });

  const lessees = [...new Set(riders.map(r => r.lessee_code))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Contract Riders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">View and manage riders, car assignments, and amendments</p>
        </div>
        {isAdmin && (
          <button onClick={handlePopulate} disabled={populating} className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
            {populating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Populate from Cars
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <input value={filterLessee} onChange={e => setFilterLessee(e.target.value)} placeholder="Filter by lessee..." className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-48" />
        <input value={filterContract} onChange={e => setFilterContract(e.target.value)} placeholder="Filter by contract..." className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-48" />
        <span className="flex items-center text-sm text-gray-500 dark:text-gray-400">{filtered.length} rider{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="w-8 px-3 py-2" />
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Contract / Rider</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Customer</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Cars</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Effective</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Expiration</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Terms</th>
                {isAdmin && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(rider => (
                <>
                  <tr key={rider.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleExpand(rider.id)}>
                    <td className="px-3 py-2 text-gray-400">
                      {expandedId === rider.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{rider.contract_base}</div>
                      <div className="text-xs text-gray-400">Rider {rider.rider_number}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-gray-900 dark:text-gray-100">{rider.lessee_name || rider.lessee_code}</div>
                      <div className="text-xs text-gray-400">{rider.lessee_code}</div>
                    </td>
                    <td className="text-right px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{rider.car_count}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-xs">
                      {editingId === rider.id ? (
                        <input type="date" value={editForm.effective_date} onChange={e => setEditForm({ ...editForm, effective_date: e.target.value })} className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800" onClick={e => e.stopPropagation()} />
                      ) : rider.effective_date ? new Date(rider.effective_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-xs">
                      {editingId === rider.id ? (
                        <input type="date" value={editForm.expiration_date} onChange={e => setEditForm({ ...editForm, expiration_date: e.target.value })} className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800" onClick={e => e.stopPropagation()} />
                      ) : rider.expiration_date ? new Date(rider.expiration_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate">
                      {editingId === rider.id ? (
                        <input value={editForm.terms_summary} onChange={e => setEditForm({ ...editForm, terms_summary: e.target.value })} className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800" onClick={e => e.stopPropagation()} />
                      ) : rider.terms_summary || '-'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                        {editingId === rider.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(rider.id)} disabled={saving} className="text-xs text-green-600 hover:underline">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(rider)} className="text-xs text-primary-600 hover:underline">Edit</button>
                        )}
                      </td>
                    )}
                  </tr>
                  {expandedId === rider.id && (
                    <tr key={`${rider.id}-detail`}>
                      <td colSpan={isAdmin ? 8 : 7} className="bg-gray-50 dark:bg-gray-900/30 px-8 py-4">
                        {loadingDetail ? (
                          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
                        ) : expandedData?.cars && expandedData.cars.length > 0 ? (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                              <Train className="w-3.5 h-3.5" /> {expandedData.cars.length} Car{expandedData.cars.length !== 1 ? 's' : ''} Assigned
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {expandedData.cars.map(car => (
                                <div key={car.car_number} className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs">
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{car.car_number}</div>
                                  <div className="text-gray-400">{car.car_type}</div>
                                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${car.current_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {car.current_status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No cars assigned to this rider</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No riders found</p>}
        </div>
      )}
    </div>
  );
}
