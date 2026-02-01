'use client';

import { useEffect, useState } from 'react';
import { getCapacity } from '@/lib/api';
import { ShopMonthlyCapacity } from '@/types';

function getUtilColor(pct: number): string {
  if (pct >= 95) return 'bg-red-500';
  if (pct >= 85) return 'bg-orange-500';
  if (pct >= 70) return 'bg-yellow-500';
  if (pct >= 50) return 'bg-green-400';
  return 'bg-green-300';
}

export default function CapacityHeatmapWidget() {
  const [capacity, setCapacity] = useState<ShopMonthlyCapacity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endDate = new Date(now.getFullYear(), now.getMonth() + 6, 1);
    const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

    getCapacity(startMonth, endMonth)
      .then((data) => setCapacity(data.slice(0, 15)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (capacity.length === 0) {
    return <div className="text-sm text-gray-500 text-center">No capacity data</div>;
  }

  const shopGroups = capacity.reduce((acc, c) => {
    if (!acc[c.shop_code]) acc[c.shop_code] = [];
    acc[c.shop_code].push(c);
    return acc;
  }, {} as Record<string, ShopMonthlyCapacity[]>);

  const months = [...new Set(capacity.map((c) => c.month))].sort().slice(0, 6);

  return (
    <div className="overflow-x-auto text-xs">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left py-1 px-1 text-gray-500">Shop</th>
            {months.map((m) => (
              <th key={m} className="text-center py-1 px-1 text-gray-500">
                {m.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(shopGroups).slice(0, 8).map(([shop, data]) => (
            <tr key={shop}>
              <td className="py-1 px-1 font-medium text-gray-700 dark:text-gray-300 truncate max-w-[60px]">
                {shop}
              </td>
              {months.map((m) => {
                const cell = data.find((d) => d.month === m);
                const pct = cell ? (cell.allocated_count / cell.total_capacity) * 100 : 0;
                return (
                  <td key={m} className="py-1 px-1 text-center">
                    <div
                      className={`w-6 h-4 rounded ${cell ? getUtilColor(pct) : 'bg-gray-200'} mx-auto`}
                      title={cell ? `${cell.allocated_count}/${cell.total_capacity}` : 'N/A'}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-center gap-2 mt-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-300 rounded"></span>&lt;50%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded"></span>70%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded"></span>&gt;95%</span>
      </div>
    </div>
  );
}
