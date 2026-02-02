'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, List, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Allocation {
  id: string;
  car_number: string;
  car_id: string;
  shop_code: string;
  target_month: string;
  status: string;
  shopping_type_id?: string;
}

interface ShoppingType {
  id: string;
  code: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Need Shopping': 'bg-amber-500 text-white',
  'To Be Routed': 'bg-amber-400 text-gray-900',
  'Planned Shopping': 'bg-blue-500 text-white',
  'Enroute': 'bg-yellow-500 text-gray-900',
  'Arrived': 'bg-green-500 text-white',
  'Complete': 'bg-green-600 text-white',
  'Released': 'bg-gray-500 text-white',
};

export default function AllocationTimeline() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [shoppingTypes, setShoppingTypes] = useState<ShoppingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [startMonth, setStartMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Generate 6 months from start
  const months = useMemo(() => {
    const result: string[] = [];
    const [year, month] = startMonth.split('-').map(Number);
    for (let i = 0; i < 6; i++) {
      const d = new Date(year, month - 1 + i, 1);
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return result;
  }, [startMonth]);

  // Fetch data
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/allocations?limit=500`).then(r => r.json()),
      fetch(`${API_URL}/shopping-types`).then(r => r.json()),
    ])
      .then(([allocData, typesData]) => {
        if (allocData.success) setAllocations(allocData.data);
        if (typesData.success) setShoppingTypes(typesData.data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Group allocations by shop and month
  const timelineData = useMemo(() => {
    const byShop = new Map<string, Map<string, Allocation[]>>();

    for (const alloc of allocations) {
      if (!months.includes(alloc.target_month)) continue;

      if (!byShop.has(alloc.shop_code)) {
        byShop.set(alloc.shop_code, new Map());
      }
      const shopMonths = byShop.get(alloc.shop_code)!;
      if (!shopMonths.has(alloc.target_month)) {
        shopMonths.set(alloc.target_month, []);
      }
      shopMonths.get(alloc.target_month)!.push(alloc);
    }

    return Array.from(byShop.entries())
      .map(([shop, monthMap]) => ({ shop, months: monthMap }))
      .sort((a, b) => a.shop.localeCompare(b.shop));
  }, [allocations, months]);

  const shiftMonths = (delta: number) => {
    const [year, month] = startMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    setStartMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonth = (m: string) => {
    const [year, month] = m.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const getTypeName = (typeId?: string) => {
    if (!typeId) return null;
    const t = shoppingTypes.find(st => st.id === typeId);
    return t?.name?.split('/')[0]?.trim();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shopping Timeline</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{allocations.length} allocations across {timelineData.length} shops</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonths(-3)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium px-2">{formatMonth(months[0])} - {formatMonth(months[5])}</span>
          <button
            onClick={() => shiftMonths(3)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="ml-4 flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded ${viewMode === 'timeline' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
              title="Timeline view"
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      {viewMode === 'timeline' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-medium border-r border-gray-200 dark:border-gray-700 min-w-[100px]">
                  Shop
                </th>
                {months.map(m => (
                  <th key={m} className="px-2 py-2 text-center font-medium min-w-[120px] border-r border-gray-200 dark:border-gray-700">
                    {formatMonth(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timelineData.slice(0, 20).map(({ shop, months: shopMonths }) => (
                <tr key={shop} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-2 font-medium border-r border-gray-200 dark:border-gray-700">
                    {shop}
                  </td>
                  {months.map(m => {
                    const cellAllocs = shopMonths.get(m) || [];
                    return (
                      <td key={m} className="px-1 py-1 border-r border-gray-200 dark:border-gray-700">
                        <div className="flex flex-wrap gap-0.5">
                          {cellAllocs.slice(0, 8).map(a => (
                            <div
                              key={a.id}
                              className={`w-6 h-5 rounded text-[9px] flex items-center justify-center font-medium ${STATUS_COLORS[a.status] || 'bg-gray-500 text-white'}`}
                              title={`${a.car_number || a.car_id.slice(0,6)} - ${a.status}${getTypeName(a.shopping_type_id) ? ` (${getTypeName(a.shopping_type_id)})` : ''}`}
                            >
                              {(a.car_number || a.car_id).slice(-3)}
                            </div>
                          ))}
                          {cellAllocs.length > 8 && (
                            <div className="w-6 h-5 rounded bg-gray-200 dark:bg-gray-700 text-[9px] flex items-center justify-center text-gray-600 dark:text-gray-300">
                              +{cellAllocs.length - 8}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {timelineData.length > 20 && (
                <tr>
                  <td colSpan={7} className="px-3 py-2 text-center text-gray-500">
                    Showing 20 of {timelineData.length} shops
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left">Car</th>
                <th className="px-3 py-2 text-left">Shop</th>
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {allocations.filter(a => months.includes(a.target_month)).slice(0, 100).map(a => (
                <tr key={a.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2 font-mono">{a.car_number || a.car_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{a.shop_code}</td>
                  <td className="px-3 py-2">{formatMonth(a.target_month)}</td>
                  <td className="px-3 py-2 text-xs">{getTypeName(a.shopping_type_id) || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[a.status] || 'bg-gray-500 text-white'}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 p-3 border-t border-gray-200 dark:border-gray-700 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${color}`} />
            <span className="text-gray-600 dark:text-gray-400">{status}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
