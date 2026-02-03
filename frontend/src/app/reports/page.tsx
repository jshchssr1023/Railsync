'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface MetricCard {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  color: 'green' | 'amber' | 'red' | 'blue' | 'gray';
}

interface ShopMetrics {
  shop_code: string;
  total_allocations: number;
  completed: number;
  in_progress: number;
  avg_days_in_shop: number;
  utilization_pct: number;
}

interface MonthlyTrend {
  month: string;
  allocations: number;
  completed: number;
  total_cost: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function ReportsPage() {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6m');
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [shopMetrics, setShopMetrics] = useState<ShopMetrics[]>([]);
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);

  const getToken = () => localStorage.getItem('auth_token');

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch pipeline summary
        const pipelineRes = await fetch(`${API_URL}/pipeline/summary`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const pipelineData = await pipelineRes.json();

        // Fetch budget summary
        const budgetRes = await fetch(`${API_URL}/budget/summary?fiscal_year=2026`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const budgetData = await budgetRes.json();

        // Fetch capacity
        const capacityRes = await fetch(`${API_URL}/capacity?start_month=2026-01&end_month=2026-06`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const capacityData = await capacityRes.json();

        // Build metrics
        const pipeline = pipelineData.data || {};
        const budget = budgetData.data || {};

        setMetrics([
          {
            label: 'Active Allocations',
            value: (pipeline.active || 0) + (pipeline.in_transit || 0),
            change: 12,
            changeLabel: 'vs last month',
            color: 'blue',
          },
          {
            label: 'Completed YTD',
            value: pipeline.completed || 0,
            change: 8,
            changeLabel: 'vs target',
            color: 'green',
          },
          {
            label: 'Bad Orders',
            value: pipeline.bad_order || 0,
            change: -3,
            changeLabel: 'vs last month',
            color: pipeline.bad_order > 10 ? 'red' : 'amber',
          },
          {
            label: 'Budget Utilization',
            value: `${Math.round((budget.total_spent || 0) / (budget.total_budget || 1) * 100)}%`,
            color: 'gray',
          },
        ]);

        // Mock shop metrics for now
        setShopMetrics([
          { shop_code: 'AITX-BRK', total_allocations: 45, completed: 32, in_progress: 13, avg_days_in_shop: 18, utilization_pct: 85 },
          { shop_code: 'AITX-MIL', total_allocations: 38, completed: 28, in_progress: 10, avg_days_in_shop: 21, utilization_pct: 72 },
          { shop_code: 'GATX-CHI', total_allocations: 52, completed: 41, in_progress: 11, avg_days_in_shop: 15, utilization_pct: 91 },
          { shop_code: 'UTLX-HOU', total_allocations: 29, completed: 22, in_progress: 7, avg_days_in_shop: 24, utilization_pct: 68 },
          { shop_code: 'NATX-ATL', total_allocations: 33, completed: 25, in_progress: 8, avg_days_in_shop: 19, utilization_pct: 78 },
        ]);

        // Mock trends
        setTrends([
          { month: '2026-01', allocations: 142, completed: 128, total_cost: 4200000 },
          { month: '2026-02', allocations: 156, completed: 145, total_cost: 4800000 },
          { month: '2026-03', allocations: 168, completed: 152, total_cost: 5100000 },
          { month: '2026-04', allocations: 145, completed: 138, total_cost: 4500000 },
          { month: '2026-05', allocations: 172, completed: 160, total_cost: 5400000 },
          { month: '2026-06', allocations: 158, completed: 148, total_cost: 4900000 },
        ]);

      } catch (err) {
        console.error('Failed to fetch report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, timeRange]);

  const formatCurrency = (val: number) => `$${(val / 1000000).toFixed(1)}M`;

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short' });
  };

  const getColorClass = (color: string) => {
    const colors: Record<string, string> = {
      green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return colors[color] || colors.gray;
  };

  const getUtilizationColor = (pct: number) => {
    if (pct >= 90) return 'text-red-600 dark:text-red-400';
    if (pct >= 75) return 'text-amber-600 dark:text-amber-400';
    return 'text-green-600 dark:text-green-400';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">Please sign in to view reports.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Performance metrics and trends
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="1m">Last Month</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="ytd">Year to Date</option>
            </select>
            <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              Export PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {metrics.map((metric, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</span>
                    <span className={`px-2 py-0.5 text-xs rounded ${getColorClass(metric.color)}`}>
                      {metric.color === 'green' ? '↑' : metric.color === 'red' ? '↓' : '●'}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {metric.value}
                  </div>
                  {metric.change !== undefined && (
                    <div className={`text-xs mt-1 ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.change >= 0 ? '+' : ''}{metric.change}% {metric.changeLabel}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Monthly Trend Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Monthly Trend
                </h2>
                <div className="h-64 flex items-end gap-2">
                  {trends.map((t) => {
                    const maxAlloc = Math.max(...trends.map(tr => tr.allocations));
                    const height = (t.allocations / maxAlloc) * 100;
                    const completedHeight = (t.completed / maxAlloc) * 100;
                    return (
                      <div key={t.month} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex gap-1 justify-center" style={{ height: '200px' }}>
                          <div
                            className="w-4 bg-blue-200 dark:bg-blue-900/50 rounded-t"
                            style={{ height: `${height}%`, marginTop: 'auto' }}
                            title={`${t.allocations} allocations`}
                          />
                          <div
                            className="w-4 bg-green-400 dark:bg-green-600 rounded-t"
                            style={{ height: `${completedHeight}%`, marginTop: 'auto' }}
                            title={`${t.completed} completed`}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {formatMonth(t.month)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-center gap-4 mt-4 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-200 dark:bg-blue-900/50 rounded"></span>
                    Allocations
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-green-400 dark:bg-green-600 rounded"></span>
                    Completed
                  </span>
                </div>
              </div>

              {/* Cost Trend */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Cost Trend
                </h2>
                <div className="h-64 flex items-end gap-2">
                  {trends.map((t) => {
                    const maxCost = Math.max(...trends.map(tr => tr.total_cost));
                    const height = (t.total_cost / maxCost) * 100;
                    return (
                      <div key={t.month} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex justify-center" style={{ height: '200px' }}>
                          <div
                            className="w-8 bg-primary-400 dark:bg-primary-600 rounded-t"
                            style={{ height: `${height}%`, marginTop: 'auto' }}
                            title={formatCurrency(t.total_cost)}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {formatMonth(t.month)}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatCurrency(t.total_cost)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Shop Performance Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Shop Performance
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Shop</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Total</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Completed</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">In Progress</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Avg Days</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {shopMetrics.map((shop) => (
                      <tr key={shop.shop_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {shop.shop_code}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {shop.total_allocations}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                          {shop.completed}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
                          {shop.in_progress}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {shop.avg_days_in_shop}d
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${getUtilizationColor(shop.utilization_pct)}`}>
                          {shop.utilization_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
