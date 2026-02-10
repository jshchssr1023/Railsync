'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type TabKey = 'capacity' | 'cost' | 'operations' | 'demand';

interface CapacityForecast {
  month: string;
  shop_code: string;
  shop_name: string;
  projected_demand: number;
  current_capacity: number;
  utilization_pct: number;
  gap: number;
  status: 'under' | 'optimal' | 'at-risk' | 'over';
}

interface CostTrend {
  month: string;
  total_cost: number;
  labor_cost: number;
  material_cost: number;
  freight_cost: number;
  avg_cost_per_car: number;
  car_count: number;
}

interface BudgetComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variance_pct: number;
}

interface OperationsKPI {
  metric: string;
  value: number;
  unit: string;
  target: number;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'flat';
}

interface DemandForecast {
  month: string;
  predicted_demand: number;
  confidence_low: number;
  confidence_high: number;
  historical_avg: number;
}

interface ThroughputTrend {
  month: string;
  cars_in: number;
  cars_out: number;
  net_change: number;
}

interface DwellTimeByShop {
  shop_code: string;
  shop_name: string;
  avg_dwell_days: number;
  min_dwell_days: number;
  max_dwell_days: number;
  car_count: number;
}

interface DemandByRegion {
  region: string;
  current_demand: number;
  projected_demand: number;
  growth_pct: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function AnalyticsPage() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('capacity');
  const [loading, setLoading] = useState(true);

  // Capacity data
  const [capacityForecast, setCapacityForecast] = useState<CapacityForecast[]>([]);
  const [bottleneckShops, setBottleneckShops] = useState<any[]>([]);

  // Cost data
  const [costTrends, setCostTrends] = useState<CostTrend[]>([]);
  const [budgetComparison, setBudgetComparison] = useState<BudgetComparison[]>([]);
  const [shopCostComparison, setShopCostComparison] = useState<any[]>([]);

  // Operations data
  const [operationsKPIs, setOperationsKPIs] = useState<OperationsKPI[]>([]);
  const [dwellTimeByShop, setDwellTimeByShop] = useState<DwellTimeByShop[]>([]);
  const [throughputTrends, setThroughputTrends] = useState<ThroughputTrend[]>([]);

  // Demand data
  const [demandForecast, setDemandForecast] = useState<DemandForecast[]>([]);
  const [demandByRegion, setDemandByRegion] = useState<DemandByRegion[]>([]);
  const [demandByCustomer, setDemandByCustomer] = useState<any[]>([]);

  const getToken = () => localStorage.getItem('railsync_access_token');

  const fetchWithAuth = async (endpoint: string) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await response.json();
    return data.success ? data.data : [];
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadTabData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeTab]);

  const loadTabData = async (tab: TabKey) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'capacity':
          const [forecast, bottlenecks] = await Promise.all([
            fetchWithAuth('/analytics/capacity/forecast?months=6'),
            fetchWithAuth('/analytics/capacity/bottlenecks?limit=10'),
          ]);
          setCapacityForecast(forecast);
          setBottleneckShops(bottlenecks);
          break;
        case 'cost':
          const [costs, budget, shopCosts] = await Promise.all([
            fetchWithAuth('/analytics/cost/trends?months=12'),
            fetchWithAuth('/analytics/cost/budget-comparison'),
            fetchWithAuth('/analytics/cost/by-shop?limit=15'),
          ]);
          setCostTrends(costs);
          setBudgetComparison(budget);
          setShopCostComparison(shopCosts);
          break;
        case 'operations':
          const [kpis, dwell, throughput] = await Promise.all([
            fetchWithAuth('/analytics/operations/kpis'),
            fetchWithAuth('/analytics/operations/dwell-time?limit=15'),
            fetchWithAuth('/analytics/operations/throughput?months=6'),
          ]);
          setOperationsKPIs(kpis);
          setDwellTimeByShop(dwell);
          setThroughputTrends(throughput);
          break;
        case 'demand':
          const [demForecast, demRegion, demCustomer] = await Promise.all([
            fetchWithAuth('/analytics/demand/forecast?months=6'),
            fetchWithAuth('/analytics/demand/by-region'),
            fetchWithAuth('/analytics/demand/by-customer?limit=10'),
          ]);
          setDemandForecast(demForecast);
          setDemandByRegion(demRegion);
          setDemandByCustomer(demCustomer);
          break;
      }
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  const formatMonth = (month: string) => {
    if (!month) return '';
    const [year, m] = month.split('-');
    return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
      case 'optimal':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'warning':
      case 'at-risk':
        return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'critical':
      case 'over':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'under':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'capacity', label: 'Capacity Forecasting', icon: '📊' },
    { key: 'cost', label: 'Cost Analytics', icon: '💰' },
    { key: 'operations', label: 'Operations KPIs', icon: '⚙️' },
    { key: 'demand', label: 'Demand Forecasting', icon: '📈' },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">Please sign in to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics & BI</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Advanced analytics, forecasting, and performance insights
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex gap-4 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-primary-600" aria-hidden="true" />
          </div>
        )}

        {/* Capacity Tab */}
        {!loading && activeTab === 'capacity' && (
          <div className="space-y-6">
            {/* Bottleneck Shops */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Capacity Bottlenecks
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Shops with highest utilization</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Shop</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Region</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Capacity</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Current Load</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Utilization</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Backlog (hrs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {bottleneckShops.map((shop) => (
                      <tr key={shop.shop_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{shop.shop_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{shop.shop_code}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{shop.region}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{shop.capacity}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{shop.current_load}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            shop.utilization_pct >= 90 ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30' :
                            shop.utilization_pct >= 75 ? 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30' :
                            'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                          }`}>
                            {shop.utilization_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{shop.hours_backlog}</td>
                      </tr>
                    ))}
                    {bottleneckShops.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No bottleneck data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Capacity Forecast by Shop/Month */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  6-Month Capacity Forecast
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Projected utilization by shop</p>
              </div>
              <div className="p-4">
                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {['under', 'optimal', 'at-risk', 'over'].map((status) => {
                    const count = capacityForecast.filter(f => f.status === status).length;
                    const labels: Record<string, string> = {
                      under: 'Under Utilized',
                      optimal: 'Optimal',
                      'at-risk': 'At Risk',
                      over: 'Over Capacity',
                    };
                    return (
                      <div key={status} className={`p-4 rounded-lg cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${getStatusColor(status)}`}>
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-sm">{labels[status]}</div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {capacityForecast.length} forecast records across {new Set(capacityForecast.map(f => f.shop_code)).size} shops
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cost Tab */}
        {!loading && activeTab === 'cost' && (
          <div className="space-y-6">
            {/* Budget vs Actual */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Budget vs Actual</h2>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  {budgetComparison.map((item) => (
                    <div key={item.category} className="flex items-center gap-4">
                      <div className="w-40 text-sm font-medium text-gray-700 dark:text-gray-300">{item.category}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full"
                              style={{ width: `${Math.min((item.actual / item.budgeted) * 100, 100)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-medium ${
                            item.variance_pct > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {item.variance_pct > 0 ? '+' : ''}{item.variance_pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>Budget: {formatCurrency(item.budgeted)}</span>
                          <span>Actual: {formatCurrency(item.actual)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cost Trends */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cost Trends (12 Months)</h2>
              </div>
              <div className="p-4">
                <div className="h-64 flex items-end gap-1">
                  {costTrends.map((t) => {
                    const maxCost = Math.max(...costTrends.map(c => c.total_cost), 1);
                    const height = (t.total_cost / maxCost) * 100;
                    return (
                      <div key={t.month} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex justify-center" style={{ height: '200px' }}>
                          <div
                            className="w-full max-w-8 bg-primary-400 dark:bg-primary-600 rounded-t hover:bg-primary-500 transition-colors"
                            style={{ height: `${height}%`, marginTop: 'auto' }}
                            title={`${formatCurrency(t.total_cost)} (${t.car_count} cars)`}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 rotate-45 origin-left">
                          {formatMonth(t.month)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Shop Cost Comparison */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cost by Shop</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Shop</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Total Cost</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Cars</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Avg/Car</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Labor Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {shopCostComparison.map((shop) => (
                      <tr key={shop.shop_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{shop.shop_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{shop.shop_code}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(shop.total_cost)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{shop.car_count}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {formatCurrency(shop.avg_cost_per_car)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          ${shop.labor_rate?.toFixed(2) || '-'}/hr
                        </td>
                      </tr>
                    ))}
                    {shopCostComparison.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No cost data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Operations Tab */}
        {!loading && activeTab === 'operations' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {operationsKPIs.map((kpi) => (
                <div key={kpi.metric} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{kpi.metric}</span>
                    <span className={`text-xs ${
                      kpi.trend === 'up' ? 'text-green-500' :
                      kpi.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→'}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {kpi.value}{kpi.unit === '%' ? '%' : ''}
                    <span className="text-sm font-normal text-gray-500 ml-1">
                      {kpi.unit !== '%' ? kpi.unit : ''}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(kpi.status)}`}>
                      Target: {kpi.target}{kpi.unit === '%' ? '%' : ` ${kpi.unit}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Throughput Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Throughput Trends</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Cars in vs out by month</p>
              </div>
              <div className="p-4">
                <div className="h-48 flex items-end gap-2">
                  {throughputTrends.map((t) => {
                    const maxVal = Math.max(...throughputTrends.flatMap(x => [x.cars_in, x.cars_out]), 1);
                    const inHeight = (t.cars_in / maxVal) * 100;
                    const outHeight = (t.cars_out / maxVal) * 100;
                    return (
                      <div key={t.month} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex gap-1 justify-center" style={{ height: '150px' }}>
                          <div
                            className="w-3 bg-blue-400 dark:bg-blue-600 rounded-t"
                            style={{ height: `${inHeight}%`, marginTop: 'auto' }}
                            title={`In: ${t.cars_in}`}
                          />
                          <div
                            className="w-3 bg-green-400 dark:bg-green-600 rounded-t"
                            style={{ height: `${outHeight}%`, marginTop: 'auto' }}
                            title={`Out: ${t.cars_out}`}
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
                    <span className="w-3 h-3 bg-blue-400 dark:bg-blue-600 rounded"></span>
                    Cars In
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-green-400 dark:bg-green-600 rounded"></span>
                    Cars Out
                  </span>
                </div>
              </div>
            </div>

            {/* Dwell Time by Shop */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dwell Time by Shop</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Average days in shop (last 90 days)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Shop</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Avg Days</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Min</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Max</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Cars</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {dwellTimeByShop.map((shop) => (
                      <tr key={shop.shop_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{shop.shop_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{shop.shop_code}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${
                            shop.avg_dwell_days > 21 ? 'text-red-600' :
                            shop.avg_dwell_days > 14 ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {shop.avg_dwell_days}d
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{shop.min_dwell_days}d</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{shop.max_dwell_days}d</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{shop.car_count}</td>
                      </tr>
                    ))}
                    {dwellTimeByShop.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No dwell time data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Demand Tab */}
        {!loading && activeTab === 'demand' && (
          <div className="space-y-6">
            {/* Demand Forecast Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">6-Month Demand Forecast</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Predicted work volume with confidence interval</p>
              </div>
              <div className="p-4">
                <div className="h-64">
                  <div className="flex items-end h-48 gap-4">
                    {demandForecast.map((f, idx) => {
                      const maxDemand = Math.max(...demandForecast.map(d => d.confidence_high), 1);
                      const predHeight = (f.predicted_demand / maxDemand) * 100;
                      const lowHeight = (f.confidence_low / maxDemand) * 100;
                      const highHeight = (f.confidence_high / maxDemand) * 100;
                      return (
                        <div key={f.month} className="flex-1 flex flex-col items-center relative">
                          {/* Confidence interval */}
                          <div
                            className="absolute w-1 bg-blue-200 dark:bg-blue-900/50"
                            style={{
                              height: `${highHeight - lowHeight}%`,
                              bottom: `${lowHeight}%`,
                            }}
                          />
                          {/* Predicted value */}
                          <div className="w-full flex justify-center" style={{ height: '100%' }}>
                            <div
                              className="w-8 bg-primary-500 dark:bg-primary-600 rounded-t z-10"
                              style={{ height: `${predHeight}%`, marginTop: 'auto' }}
                            />
                          </div>
                          <div className="text-center mt-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 block">
                              {formatMonth(f.month)}
                            </span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {f.predicted_demand}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-center gap-4 text-xs mt-4">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-primary-500 rounded"></span>
                    Predicted
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-200 dark:bg-blue-900/50 rounded"></span>
                    95% Confidence
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Demand by Region */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Demand by Region</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Region</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Current</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Projected</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Growth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {demandByRegion.map((r) => (
                        <tr key={r.region} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.region}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{r.current_demand}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{r.projected_demand}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${
                              r.growth_pct > 0 ? 'text-green-600' : r.growth_pct < 0 ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              {r.growth_pct > 0 ? '+' : ''}{r.growth_pct}%
                            </span>
                          </td>
                        </tr>
                      ))}
                      {demandByRegion.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No region data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Demand by Customer */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Demand by Customer</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Customer</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Current</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Avg</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {demandByCustomer.map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 truncate max-w-[150px]" title={c.customer_name}>
                            {c.customer_name}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{c.current_demand}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{c.historical_avg}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              c.trend === 'increasing' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              c.trend === 'decreasing' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {c.trend === 'increasing' ? '↑' : c.trend === 'decreasing' ? '↓' : '→'} {c.trend}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {demandByCustomer.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No customer data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
