'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Users, Calendar, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface CostVarianceMonth {
  month: string;
  budgeted: number;
  actual: number;
  variance: number;
  variance_pct: number;
  cumulative_budget: number;
  cumulative_actual: number;
  cumulative_variance: number;
}

interface CustomerCostBreakdown {
  customer_name: string;
  customer_code: string;
  car_count: number;
  total_estimated: number;
  total_actual: number;
  avg_cost_per_car: number;
  variance_pct: number;
}

interface CostTrend {
  month: string;
  total_cost: number;
  avg_cost_per_car: number;
  car_count: number;
}

interface ShopCostComparison {
  shop_code: string;
  shop_name: string;
  total_cost: number;
  car_count: number;
  avg_cost_per_car: number;
  labor_rate: number;
}

function fmt(n: number): string {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

export default function CostAnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [variance, setVariance] = useState<CostVarianceMonth[]>([]);
  const [customers, setCustomers] = useState<CustomerCostBreakdown[]>([]);
  const [trends, setTrends] = useState<CostTrend[]>([]);
  const [shopCosts, setShopCosts] = useState<ShopCostComparison[]>([]);
  const [tab, setTab] = useState<'variance' | 'customers' | 'shops' | 'trends'>('variance');

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;

  const fetchWithAuth = (endpoint: string) =>
    fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  async function fetchData() {
    setLoading(true);
    try {
      const [varRes, custRes, trendRes, shopRes] = await Promise.all([
        fetchWithAuth(`/analytics/cost/variance?fiscal_year=${fiscalYear}`),
        fetchWithAuth(`/analytics/cost/by-customer?fiscal_year=${fiscalYear}`),
        fetchWithAuth(`/analytics/cost/trends?months=12`),
        fetchWithAuth(`/analytics/cost/by-shop?limit=30`),
      ]);
      setVariance(varRes.data || []);
      setCustomers(custRes.data || []);
      setTrends(trendRes.data || []);
      setShopCosts(shopRes.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [fiscalYear, isAuthenticated]);

  // Summary stats
  const totalBudget = variance.length > 0 ? variance[variance.length - 1].cumulative_budget : 0;
  const totalActual = variance.length > 0 ? variance[variance.length - 1].cumulative_actual : 0;
  const totalVariance = totalActual - totalBudget;
  const totalVariancePct = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;
  const totalCars = customers.reduce((sum, c) => sum + c.car_count, 0);

  // Bar chart max for scaling
  const maxMonthly = Math.max(...variance.map(v => Math.max(v.budgeted, v.actual)), 1);

  // Trend chart scaling
  const maxTrendCost = Math.max(...trends.map(t => t.total_cost), 1);
  const maxTrendAvg = Math.max(...trends.map(t => t.avg_cost_per_car), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cost Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Budget variance, customer costs, and shop comparison</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-500 dark:text-gray-400">Fiscal Year</label>
          <select
            value={fiscalYear}
            onChange={e => setFiscalYear(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => router.push('/budget')}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
        >
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> YTD Budget</div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{fmt(totalBudget)}</div>
        </div>
        <div
          onClick={() => router.push('/invoices')}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
        >
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <div className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> YTD Actual</div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{fmt(totalActual)}</div>
        </div>
        <div
          onClick={() => setTab('variance')}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
        >
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <div className="flex items-center gap-2">
              {totalVariance >= 0 ? <TrendingUp className="w-4 h-4 text-red-500" /> : <TrendingDown className="w-4 h-4 text-green-500" />}
              Variance
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors" />
          </div>
          <div className={`text-xl font-bold ${totalVariance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {fmt(Math.abs(totalVariance))} ({pct(totalVariancePct)})
          </div>
        </div>
        <div
          onClick={() => router.push('/shopping')}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
        >
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Cars Serviced</div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalCars.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {(['variance', 'customers', 'shops', 'trends'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t === 'variance' ? 'Budget vs Actual' : t === 'customers' ? 'By Customer' : t === 'shops' ? 'By Shop' : 'Cost Trends'}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {/* Variance Tab */}
          {tab === 'variance' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Monthly Budget vs Actual</h3>
              </div>
              {/* Simple bar chart */}
              <div className="p-4 space-y-2">
                {variance.map(v => (
                  <div key={v.month} className="grid grid-cols-[80px_1fr_100px_100px_80px] gap-2 items-center text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">{v.month}</span>
                    <div className="relative h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                      <div
                        className="absolute h-3 top-0 bg-blue-400 dark:bg-blue-600 rounded-t"
                        style={{ width: `${(v.budgeted / maxMonthly) * 100}%` }}
                      />
                      <div
                        className={`absolute h-3 bottom-0 rounded-b ${v.actual > v.budgeted ? 'bg-red-400 dark:bg-red-600' : 'bg-green-400 dark:bg-green-600'}`}
                        style={{ width: `${(v.actual / maxMonthly) * 100}%` }}
                      />
                    </div>
                    <span className="text-right text-gray-500">{fmt(v.budgeted)}</span>
                    <span className="text-right font-medium text-gray-900 dark:text-gray-100">{fmt(v.actual)}</span>
                    <span className={`text-right font-medium ${v.variance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {pct(v.variance_pct)}
                    </span>
                  </div>
                ))}
                {variance.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No variance data for {fiscalYear}</p>
                )}
              </div>
              <div className="px-4 pb-3 flex gap-4 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-400 rounded" /> Budget</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-400 rounded" /> Under Budget</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-400 rounded" /> Over Budget</span>
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {tab === 'customers' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Customer</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Cars</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Estimated</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Actual</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Avg/Car</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {customers.map(c => (
                    <tr key={c.customer_code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{c.customer_name}</div>
                        <div className="text-xs text-gray-400">{c.customer_code}</div>
                      </td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{c.car_count}</td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{fmt(c.total_estimated)}</td>
                      <td className="text-right px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{fmt(c.total_actual)}</td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{fmt(c.avg_cost_per_car)}</td>
                      <td className={`text-right px-4 py-2 font-medium ${c.variance_pct > 5 ? 'text-red-600 dark:text-red-400' : c.variance_pct < -5 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                        {pct(c.variance_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No customer cost data for {fiscalYear}</p>
              )}
            </div>
          )}

          {/* Shops Tab */}
          {tab === 'shops' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Shop</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Cars</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Total Cost</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Avg/Car</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Labor Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {shopCosts.map(s => (
                    <tr key={s.shop_code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{s.shop_name}</div>
                        <div className="text-xs text-gray-400">{s.shop_code}</div>
                      </td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{s.car_count}</td>
                      <td className="text-right px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{fmt(s.total_cost)}</td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{fmt(s.avg_cost_per_car)}</td>
                      <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{s.labor_rate ? fmt(s.labor_rate) + '/hr' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shopCosts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No shop cost data available</p>
              )}
            </div>
          )}

          {/* Cost Trends Tab */}
          {tab === 'trends' && (
            <div className="space-y-6">
              {/* Total Cost Trend */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Monthly Total Cost (12-Month Trend)</h3>
                </div>
                <div className="p-4">
                  {trends.length > 0 ? (
                    <div className="space-y-1.5">
                      {trends.map((t, i) => {
                        const prevCost = i > 0 ? trends[i - 1].total_cost : t.total_cost;
                        const changePct = prevCost > 0 ? ((t.total_cost - prevCost) / prevCost) * 100 : 0;
                        return (
                          <div key={t.month} className="grid grid-cols-[80px_1fr_100px_80px] gap-2 items-center text-xs">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">{t.month}</span>
                            <div className="relative h-5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 bg-primary-400 dark:bg-primary-600 rounded"
                                style={{ width: `${(t.total_cost / maxTrendCost) * 100}%` }}
                              />
                            </div>
                            <span className="text-right font-medium text-gray-900 dark:text-gray-100">{fmt(t.total_cost)}</span>
                            <span className={`text-right ${changePct > 0 ? 'text-red-500' : changePct < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                              {i > 0 ? pct(changePct) : '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-8">No trend data available</p>
                  )}
                </div>
              </div>

              {/* Avg Cost Per Car + Volume */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Avg Cost Per Car</h3>
                  </div>
                  <div className="p-4 space-y-1.5">
                    {trends.map(t => (
                      <div key={t.month} className="grid grid-cols-[80px_1fr_80px] gap-2 items-center text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{t.month}</span>
                        <div className="relative h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-amber-400 dark:bg-amber-600 rounded"
                            style={{ width: `${(t.avg_cost_per_car / maxTrendAvg) * 100}%` }}
                          />
                        </div>
                        <span className="text-right text-gray-700 dark:text-gray-300">{fmt(t.avg_cost_per_car)}</span>
                      </div>
                    ))}
                    {trends.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Cars Serviced Per Month</h3>
                  </div>
                  <div className="p-4 space-y-1.5">
                    {trends.map(t => {
                      const maxCars = Math.max(...trends.map(tr => tr.car_count), 1);
                      return (
                        <div key={t.month} className="grid grid-cols-[80px_1fr_50px] gap-2 items-center text-xs">
                          <span className="text-gray-500 dark:text-gray-400">{t.month}</span>
                          <div className="relative h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-emerald-400 dark:bg-emerald-600 rounded"
                              style={{ width: `${(t.car_count / maxCars) * 100}%` }}
                            />
                          </div>
                          <span className="text-right text-gray-700 dark:text-gray-300">{t.car_count}</span>
                        </div>
                      );
                    })}
                    {trends.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
