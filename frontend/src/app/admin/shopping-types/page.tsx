'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { Loader2, Search, Tag, DollarSign } from 'lucide-react';

interface ShoppingType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_planned: boolean;
  default_cost_owner: string | null;
  tier_preference: string | null;
  sort_order: number;
  estimated_cost: number | null;
  customer_billable: boolean;
  project_required: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function ShoppingTypesPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [types, setTypes] = useState<ShoppingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const getToken = () => localStorage.getItem('railsync_access_token');

  useEffect(() => {
    if (isAuthenticated) loadTypes();
  }, [isAuthenticated]);

  const loadTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/shopping-types`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setTypes(data.data);
    } catch {
      toast.error('Failed to load shopping types');
    } finally {
      setLoading(false);
    }
  };

  const filtered = types.filter(
    (t) =>
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
  );

  const plannedCount = types.filter((t) => t.is_planned).length;
  const billableCount = types.filter((t) => t.customer_billable).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shopping Types</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {types.length} canonical types defining how shopping events are classified and costed
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Types</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{types.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Planned</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{plannedCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Customer Billable</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{billableCount}</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code or name..."
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
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{search ? 'No types match your search' : 'No shopping types configured'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Planned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cost Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier Pref.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Est. Cost</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Billable</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Project Req.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400">{t.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.is_planned ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Yes</span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {t.default_cost_owner || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {t.tier_preference || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.estimated_cost != null ? (
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          ${t.estimated_cost.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.customer_billable ? (
                        <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto" />
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.project_required ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Req</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
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
