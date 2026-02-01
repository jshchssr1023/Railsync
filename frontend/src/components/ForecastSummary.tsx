'use client';

import { useState, useEffect, useCallback } from 'react';
import { ForecastResult } from '@/types';
import { getForecast } from '@/lib/api';

interface ForecastSummaryProps {
  fiscalYear?: number;
  compact?: boolean;
}

export default function ForecastSummary({
  fiscalYear = new Date().getFullYear(),
  compact = false
}: ForecastSummaryProps) {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getForecast(fiscalYear);
      setForecast(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast');
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-danger-600 dark:text-danger-400">{error}</div>
        </div>
      </div>
    );
  }

  if (!forecast) return null;

  const { summary } = forecast;
  const actualPct = summary.total_budget > 0
    ? (summary.total_actual / summary.total_budget) * 100
    : 0;
  const plannedPct = summary.total_budget > 0
    ? (summary.total_planned / summary.total_budget) * 100
    : 0;

  if (compact) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              FY{fiscalYear} Forecast
            </h3>
            <span className={`badge ${
              summary.remaining_budget >= 0 ? 'badge-success' : 'badge-danger'
            }`}>
              {summary.budget_consumed_pct.toFixed(0)}% Used
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Remaining</span>
              <span className={`font-medium ${
                summary.remaining_budget >= 0
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-danger-600 dark:text-danger-400'
              }`}>
                {formatCurrency(summary.remaining_budget)}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div
                  className="bg-success-500 transition-all"
                  style={{ width: `${Math.min(actualPct, 100)}%` }}
                />
                <div
                  className="bg-warning-400 transition-all"
                  style={{ width: `${Math.min(plannedPct, 100 - actualPct)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Maintenance Forecast - FY{fiscalYear}
        </h3>
      </div>
      <div className="card-body space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Annual Budget</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(summary.total_budget)}
            </p>
          </div>
          <div className="bg-warning-50 dark:bg-warning-900/30 rounded-lg p-4">
            <p className="text-sm text-warning-700 dark:text-warning-300">Planned</p>
            <p className="text-xl font-bold text-warning-800 dark:text-warning-200">
              {formatCurrency(summary.total_planned)}
            </p>
            <p className="text-xs text-warning-600 dark:text-warning-400">In Progress</p>
          </div>
          <div className="bg-success-50 dark:bg-success-900/30 rounded-lg p-4">
            <p className="text-sm text-success-700 dark:text-success-300">Actual</p>
            <p className="text-xl font-bold text-success-800 dark:text-success-200">
              {formatCurrency(summary.total_actual)}
            </p>
            <p className="text-xs text-success-600 dark:text-success-400">Complete</p>
          </div>
          <div className={`rounded-lg p-4 ${
            summary.remaining_budget >= 0
              ? 'bg-primary-50 dark:bg-primary-900/30'
              : 'bg-danger-50 dark:bg-danger-900/30'
          }`}>
            <p className={`text-sm ${
              summary.remaining_budget >= 0
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-danger-700 dark:text-danger-300'
            }`}>Remaining</p>
            <p className={`text-xl font-bold ${
              summary.remaining_budget >= 0
                ? 'text-primary-800 dark:text-primary-200'
                : 'text-danger-800 dark:text-danger-200'
            }`}>
              {formatCurrency(summary.remaining_budget)}
            </p>
          </div>
        </div>

        {/* Budget Consumption Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Budget Consumption</span>
            <span>{summary.budget_consumed_pct.toFixed(1)}%</span>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-success-500 transition-all duration-500"
                style={{ width: `${Math.min(actualPct, 100)}%` }}
                title={`Actual: ${actualPct.toFixed(1)}%`}
              />
              <div
                className="bg-warning-400 transition-all duration-500"
                style={{ width: `${Math.min(plannedPct, Math.max(0, 100 - actualPct))}%` }}
                title={`Planned: ${plannedPct.toFixed(1)}%`}
              />
            </div>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-success-500"></span>
              <span className="text-gray-600 dark:text-gray-400">Actual (Complete)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-warning-400"></span>
              <span className="text-gray-600 dark:text-gray-400">Planned (In Progress)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-700"></span>
              <span className="text-gray-600 dark:text-gray-400">Remaining</span>
            </span>
          </div>
        </div>

        {/* By Type Breakdown */}
        {forecast.by_type.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">By Type</h4>
            <div className="overflow-x-auto">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="text-right">Budget</th>
                    <th className="text-right">Planned</th>
                    <th className="text-right">Actual</th>
                    <th className="text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.by_type.map((line, idx) => (
                    <tr key={idx}>
                      <td className="font-medium">
                        {line.event_type || line.budget_type}
                      </td>
                      <td className="text-right">{formatCurrency(line.total_budget)}</td>
                      <td className="text-right text-warning-600 dark:text-warning-400">
                        {formatCurrency(line.planned_cost)}
                      </td>
                      <td className="text-right text-success-600 dark:text-success-400">
                        {formatCurrency(line.actual_cost)}
                      </td>
                      <td className={`text-right font-medium ${
                        line.remaining_budget >= 0
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-danger-600 dark:text-danger-400'
                      }`}>
                        {formatCurrency(line.remaining_budget)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
