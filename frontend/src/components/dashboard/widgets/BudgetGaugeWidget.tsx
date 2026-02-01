'use client';

import { useEffect, useState } from 'react';
import { getBudgetSummary } from '@/lib/api';
import { BudgetSummary } from '@/types';

export default function BudgetGaugeWidget() {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const fiscalYear = new Date().getFullYear();

  useEffect(() => {
    getBudgetSummary(fiscalYear)
      .then(setSummary)
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

  if (!summary) {
    return <div className="text-sm text-gray-500">No budget data</div>;
  }

  const pct = summary.total.consumed_pct;
  const color = pct >= 90 ? 'text-red-500' : pct >= 75 ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-700"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            className={color}
            strokeWidth="3"
            strokeDasharray={`${pct} 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${color}`}>{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Budget Used</div>
    </div>
  );
}
