'use client';

import { useEffect, useState } from 'react';
import { getForecast } from '@/lib/api';
import { ForecastResult } from '@/types';

export default function ForecastWidget() {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const fiscalYear = new Date().getFullYear();

  useEffect(() => {
    getForecast(fiscalYear)
      .then(setForecast)
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

  if (!forecast) {
    return <div className="text-sm text-gray-500">No forecast data</div>;
  }

  const { summary } = forecast;
  const formatCurrency = (n: number) => `$${(n / 1000000).toFixed(1)}M`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Budget</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(summary.total_budget)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Planned</div>
          <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {formatCurrency(summary.total_planned)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Actual</div>
          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
            {formatCurrency(summary.total_actual)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Remaining</div>
          <div className={`text-sm font-semibold ${summary.remaining_budget < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
            {formatCurrency(summary.remaining_budget)}
          </div>
        </div>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full flex">
          <div
            className="bg-green-500"
            style={{ width: `${(summary.total_actual / summary.total_budget) * 100}%` }}
          />
          <div
            className="bg-blue-500"
            style={{ width: `${(summary.total_planned / summary.total_budget) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex justify-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Actual
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          Planned
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></span>
          Remaining
        </span>
      </div>
    </div>
  );
}
