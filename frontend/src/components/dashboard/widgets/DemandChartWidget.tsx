'use client';

import { useEffect, useState } from 'react';
import { listDemands } from '@/lib/api';
import { Demand } from '@/types';

export default function DemandChartWidget() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const fiscalYear = new Date().getFullYear();

  useEffect(() => {
    listDemands({ fiscal_year: fiscalYear })
      .then(setDemands)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fiscalYear]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (demands.length === 0) {
    return <div className="text-sm text-gray-500 text-center">No demand data</div>;
  }

  const byMonth = demands.reduce((acc, d) => {
    acc[d.target_month] = (acc[d.target_month] || 0) + d.car_count;
    return acc;
  }, {} as Record<string, number>);

  const months = Object.keys(byMonth).sort().slice(0, 6);
  const maxCount = Math.max(...Object.values(byMonth), 1);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-end gap-1 px-2">
        {months.map((month) => {
          const count = byMonth[month] || 0;
          const height = (count / maxCount) * 100;
          return (
            <div key={month} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col items-center justify-end" style={{ height: '80px' }}>
                <span className="text-[10px] text-gray-600 dark:text-gray-400 mb-1">{count}</span>
                <div
                  className="w-full bg-primary-500 rounded-t"
                  style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                />
              </div>
              <span className="text-[10px] text-gray-500 mt-1">{month.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <div className="text-center text-xs text-gray-500 mt-2">Cars by Month</div>
    </div>
  );
}
