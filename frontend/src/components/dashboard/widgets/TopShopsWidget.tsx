'use client';

import { useEffect, useState } from 'react';
import { listShops } from '@/lib/api';
import { ShopSummary } from '@/types';

export default function TopShopsWidget() {
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listShops()
      .then((data) => {
        const sorted = [...data].sort((a, b) => (a.labor_rate || 100) - (b.labor_rate || 100));
        setShops(sorted.slice(0, 5));
      })
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

  if (shops.length === 0) {
    return <div className="text-sm text-gray-500 text-center">No shop data</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 text-center mb-2">By Hourly Rate</div>
      {shops.map((shop, i) => (
        <div key={shop.shop_code} className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
            i === 0 ? 'bg-yellow-400 text-yellow-900' :
            i === 1 ? 'bg-gray-300 text-gray-700' :
            i === 2 ? 'bg-orange-300 text-orange-900' :
            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
              {shop.shop_name}
            </div>
            <div className="text-[10px] text-gray-500">{shop.shop_code}</div>
          </div>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
            ${shop.labor_rate || 'N/A'}/hr
          </div>
        </div>
      ))}
    </div>
  );
}
