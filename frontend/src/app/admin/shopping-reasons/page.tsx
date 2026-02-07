'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { Loader2, Search, Filter, Tag } from 'lucide-react';

interface ShoppingType {
  id: string;
  code: string;
  name: string;
}

interface ShoppingReason {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type_id: string;
  type_code: string;
  type_name: string;
  sort_order: number;
  is_active: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function ShoppingReasonsPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [types, setTypes] = useState<ShoppingType[]>([]);
  const [reasons, setReasons] = useState<ShoppingReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  const getToken = () => localStorage.getItem('railsync_access_token');

  useEffect(() => {
    if (isAuthenticated) {
      loadTypes();
      loadReasons();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadReasons();
  }, [filterType]);

  const loadTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/shopping-types`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setTypes(data.data);
    } catch {
      // Types list is optional for filtering
    }
  };

  const loadReasons = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type_id', filterType);
      const url = `${API_URL}/shopping-reasons${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setReasons(data.data);
    } catch {
      toast.error('Failed to load shopping reasons');
    } finally {
      setLoading(false);
    }
  };

  const filtered = reasons.filter(
    (r) =>
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.type_name && r.type_name.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by type for summary
  const byType = reasons.reduce<Record<string, number>>((acc, r) => {
    const key = r.type_name || r.type_code || 'Unassigned';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shopping Reasons</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Reason codes used to classify why a car is being shopped, grouped by shopping type
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Reasons</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reasons.length}</div>
        </div>
        {Object.entries(byType).slice(0, 3).map(([typeName, count]) => (
          <div key={typeName} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{typeName}</div>
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search reasons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
              ))}
            </select>
          </div>
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
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{search || filterType ? 'No reasons match your filters' : 'No shopping reasons configured'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reason Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Shopping Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400">{r.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {r.type_code}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{r.type_name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {r.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{r.sort_order}</td>
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
