'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface Shop {
  shop_code: string;
  shop_name: string;
  shop_designation: 'repair' | 'storage' | 'scrap';
  region: string;
  city: string;
  state: string;
  tier: number;
}

interface DesignationSummary {
  shop_designation: string;
  shop_count: number;
  active_count: number;
  regions: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const DESIGNATION_COLORS = {
  repair: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  storage: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  scrap: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const DESIGNATION_LABELS = {
  repair: 'Repair Shop',
  storage: 'Storage Location',
  scrap: 'Scrap Yard',
};

export default function ShopDesignationsPage() {
  const { user, isAuthenticated } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [summary, setSummary] = useState<DesignationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'repair' | 'storage' | 'scrap'>('all');
  const [search, setSearch] = useState('');
  const [selectedShops, setSelectedShops] = useState<Set<string>>(new Set());
  const [bulkDesignation, setBulkDesignation] = useState<'repair' | 'storage' | 'scrap'>('storage');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getToken = () => localStorage.getItem('auth_token');

  const fetchShops = async () => {
    try {
      const res = await fetch(`${API_URL}/shops`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setShops(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_URL}/shops/designation-summary`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchShops(), fetchSummary()]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchData();
    }
  }, [isAuthenticated, user]);

  const updateDesignation = async (shopCode: string, designation: 'repair' | 'storage' | 'scrap') => {
    try {
      const res = await fetch(`${API_URL}/shops/${shopCode}/designation`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ designation }),
      });
      const data = await res.json();
      if (data.success) {
        setShops(shops.map(s =>
          s.shop_code === shopCode ? { ...s, shop_designation: designation } : s
        ));
        fetchSummary();
        setMessage({ type: 'success', text: `Updated ${shopCode} to ${DESIGNATION_LABELS[designation]}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update designation' });
    }
  };

  const bulkUpdate = async () => {
    if (selectedShops.size === 0) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API_URL}/shops/bulk-designation`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          shop_codes: Array.from(selectedShops),
          designation: bulkDesignation,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Updated ${data.updated} shops to ${DESIGNATION_LABELS[bulkDesignation]}` });
        setSelectedShops(new Set());
        fetchData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to bulk update' });
    } finally {
      setUpdating(false);
    }
  };

  const toggleSelect = (shopCode: string) => {
    const newSelected = new Set(selectedShops);
    if (newSelected.has(shopCode)) {
      newSelected.delete(shopCode);
    } else {
      newSelected.add(shopCode);
    }
    setSelectedShops(newSelected);
  };

  const selectAll = () => {
    const filtered = filteredShops;
    if (selectedShops.size === filtered.length) {
      setSelectedShops(new Set());
    } else {
      setSelectedShops(new Set(filtered.map(s => s.shop_code)));
    }
  };

  const filteredShops = shops.filter(shop => {
    const matchesFilter = filter === 'all' || shop.shop_designation === filter;
    const matchesSearch = !search ||
      shop.shop_code.toLowerCase().includes(search.toLowerCase()) ||
      shop.shop_name?.toLowerCase().includes(search.toLowerCase()) ||
      shop.region?.toLowerCase().includes(search.toLowerCase()) ||
      shop.city?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shop Designations</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Designate shops as Repair, Storage, or Scrap locations
            </p>
          </div>
          <a
            href="/admin"
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Back to Admin
          </a>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="float-right font-bold">×</button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {['repair', 'storage', 'scrap'].map((designation) => {
            const data = summary.find(s => s.shop_designation === designation);
            return (
              <div
                key={designation}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border-2 transition-colors ${
                  filter === designation ? 'border-primary-500' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => setFilter(filter === designation ? 'all' : designation as any)}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${DESIGNATION_COLORS[designation as keyof typeof DESIGNATION_COLORS]}`}>
                    {DESIGNATION_LABELS[designation as keyof typeof DESIGNATION_LABELS]}
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {data?.active_count || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate">
                  {data?.regions || 'No regions'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Filters and Bulk Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="text"
              placeholder="Search shops..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Designations</option>
              <option value="repair">Repair Shops</option>
              <option value="storage">Storage Locations</option>
              <option value="scrap">Scrap Yards</option>
            </select>

            {selectedShops.size > 0 && (
              <>
                <div className="h-6 border-l border-gray-300 dark:border-gray-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedShops.size} selected
                </span>
                <select
                  value={bulkDesignation}
                  onChange={(e) => setBulkDesignation(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="repair">Set to Repair</option>
                  <option value="storage">Set to Storage</option>
                  <option value="scrap">Set to Scrap</option>
                </select>
                <button
                  onClick={bulkUpdate}
                  disabled={updating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Apply'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Shops Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading shops...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedShops.size === filteredShops.length && filteredShops.length > 0}
                        onChange={selectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Shop Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Region</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Designation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredShops.map((shop) => (
                    <tr key={shop.shop_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedShops.has(shop.shop_code)}
                          onChange={() => toggleSelect(shop.shop_code)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-100">
                        {shop.shop_code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {shop.shop_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {shop.region || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {shop.city && shop.state ? `${shop.city}, ${shop.state}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={shop.shop_designation || 'repair'}
                          onChange={(e) => updateDesignation(shop.shop_code, e.target.value as any)}
                          className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${DESIGNATION_COLORS[shop.shop_designation || 'repair']}`}
                        >
                          <option value="repair">Repair Shop</option>
                          <option value="storage">Storage Location</option>
                          <option value="scrap">Scrap Yard</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredShops.length === 0 && (
                <div className="p-8 text-center text-gray-500">No shops found</div>
              )}
            </div>
          )}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
            Showing {filteredShops.length} of {shops.length} shops
          </div>
        </div>
      </div>
    </div>
  );
}
