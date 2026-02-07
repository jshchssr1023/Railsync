'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { Loader2, Search, Package, AlertTriangle, Droplets } from 'lucide-react';

interface StorageCommodity {
  id: string;
  cin: string;
  name: string;
  hazmat_class: string | null;
  requires_cleaning: boolean;
  requires_nitrogen: boolean;
  sort_order: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function StorageCommoditiesPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [commodities, setCommodities] = useState<StorageCommodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const getToken = () => localStorage.getItem('railsync_access_token');

  useEffect(() => {
    if (isAuthenticated) loadCommodities();
  }, [isAuthenticated]);

  const loadCommodities = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/storage-commodities`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setCommodities(data.data);
    } catch {
      toast.error('Failed to load storage commodities');
    } finally {
      setLoading(false);
    }
  };

  const filtered = commodities.filter(
    (c) =>
      c.cin.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  const hazmatCount = commodities.filter((c) => c.hazmat_class).length;
  const cleaningCount = commodities.filter((c) => c.requires_cleaning).length;
  const nitrogenCount = commodities.filter((c) => c.requires_nitrogen).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Storage Commodities</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Reference data for commodity storage preparation requirements
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{commodities.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Hazmat
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{hazmatCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <Droplets className="w-3.5 h-3.5 text-blue-500" /> Cleaning Req.
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{cleaningCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Nitrogen Req.</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{nitrogenCount}</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by CIN or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{search ? 'No commodities match your search' : 'No storage commodities configured'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CIN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hazmat Class</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cleaning</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nitrogen</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400">{c.cin}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{c.name}</td>
                    <td className="px-4 py-3 text-center">
                      {c.hazmat_class ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          <AlertTriangle className="w-3 h-3" />
                          {c.hazmat_class}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.requires_cleaning ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Required</span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.requires_nitrogen ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Required</span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{c.sort_order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
