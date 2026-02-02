'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AlertCircle, TrendingUp, Truck, Calendar, CheckCircle, Clock, RefreshCw, Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Fetch failed');
  return res.json().then(data => data.data);
});

const TIER_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface FleetMetrics {
  in_shop_count: number;
  planned_count: number;
  enroute_count: number;
  dispo_count: number;
  scheduled_count: number;
  completed_count: number;
  total_fleet: number;
  total_planned_cost: string;
  total_actual_cost: string;
}

interface MonthlyVolume {
  month: string;
  in_shop: number;
  planned: number;
  scheduled: number;
  enroute: number;
  total_cars: number;
  planned_cost: string;
  actual_cost: string;
}

interface TierData {
  tier: number;
  in_shop_count: number;
  planned_count: number;
  total_count: number;
}

interface FilterOptions {
  tiers: number[];
  carTypes: { code: string; group: string }[];
  workTypes: string[];
}

export default function FleetDashboard() {
  const currentYear = new Date().getFullYear();
  const [tierFilter, setTierFilter] = useState<string>('all');

  // Fetch dynamic filter options
  const { data: filterOptions } = useSWR<FilterOptions>(
    `${API_BASE}/filters/options`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const tierParam = tierFilter !== 'all' ? `&tier=${tierFilter}` : '';

  const { data: metrics, error: metricsError, isLoading: metricsLoading, mutate: mutateMetrics } = useSWR<FleetMetrics>(
    `${API_BASE}/fleet/metrics?_=${tierFilter}${tierParam}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: monthlyVolumes, error: volumesError, isLoading: volumesLoading, mutate: mutateVolumes } = useSWR<MonthlyVolume[]>(
    `${API_BASE}/fleet/monthly-volumes?year=${currentYear}${tierParam}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const { data: tierData, error: tierError, isLoading: tierLoading, mutate: mutateTiers } = useSWR<TierData[]>(
    `${API_BASE}/fleet/tier-summary?_=${tierFilter}${tierParam}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const handleRetry = () => {
    mutateMetrics();
    mutateVolumes();
    mutateTiers();
  };

  const handleExportCSV = () => {
    const rows: string[] = [];
    const timestamp = new Date().toISOString().split('T')[0];

    // Fleet Summary Section
    rows.push('FLEET SUMMARY');
    rows.push('Metric,Value');
    if (metrics) {
      rows.push(`Total Fleet,${metrics.total_fleet}`);
      rows.push(`In Shop,${metrics.in_shop_count}`);
      rows.push(`Enroute,${metrics.enroute_count}`);
      rows.push(`Scheduled,${metrics.scheduled_count}`);
      rows.push(`Planned,${metrics.planned_count}`);
      rows.push(`Completed,${metrics.completed_count}`);
      rows.push(`Total Planned Cost,$${parseFloat(metrics.total_planned_cost || '0').toLocaleString()}`);
      rows.push(`Total Actual Cost,$${parseFloat(metrics.total_actual_cost || '0').toLocaleString()}`);
    }
    rows.push('');

    // Monthly Volumes Section
    rows.push('MONTHLY VOLUMES');
    rows.push('Month,In Shop,Planned,Scheduled,Enroute,Total Cars,Planned Cost,Actual Cost');
    if (monthlyVolumes) {
      monthlyVolumes.forEach(v => {
        rows.push(`${v.month},${v.in_shop},${v.planned},${v.scheduled},${v.enroute},${v.total_cars},$${parseFloat(v.planned_cost || '0').toLocaleString()},$${parseFloat(v.actual_cost || '0').toLocaleString()}`);
      });
    }
    rows.push('');

    // Tier Summary Section
    rows.push('TIER SUMMARY');
    rows.push('Tier,In Shop,Planned,Total');
    if (tierData) {
      tierData.forEach(t => {
        rows.push(`Tier ${t.tier},${t.in_shop_count},${t.planned_count},${t.total_count}`);
      });
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fleet-dashboard-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (metricsError || volumesError || tierError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold">Failed to load dashboard data</h2>
        <p className="text-sm text-gray-500 mt-2">Please try again later</p>
        <button
          onClick={handleRetry}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const formatMonth = (monthStr: string) => {
    const parts = monthStr.split('-');
    return MONTH_NAMES[parseInt(parts[1], 10) - 1] || monthStr;
  };

  const pieData = tierData?.map(t => ({
    name: `Tier ${t.tier}`,
    value: t.in_shop_count || 0
  })) || [];

  const barData = monthlyVolumes?.map(v => ({
    month: formatMonth(v.month),
    planned: v.planned + v.scheduled,
    actual: v.in_shop
  })) || [];

  const lastUpdated = new Date().toLocaleTimeString();

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
        >
          <option value="all">All Tiers</option>
          {(filterOptions?.tiers || [1, 2, 3]).map(tier => (
            <option key={tier} value={tier}>Tier {tier}</option>
          ))}
        </select>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        <button
          onClick={handleExportCSV}
          disabled={metricsLoading || volumesLoading || tierLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          Updated: {lastUpdated}
        </span>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          title="Total Fleet"
          value={metrics?.total_fleet ?? 0}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={metricsLoading}
        />
        <MetricCard
          title="In Shop"
          value={metrics?.in_shop_count ?? 0}
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
          loading={metricsLoading}
        />
        <MetricCard
          title="Enroute"
          value={metrics?.enroute_count ?? 0}
          icon={<Truck className="h-5 w-5" />}
          color="yellow"
          loading={metricsLoading}
        />
        <MetricCard
          title="Scheduled"
          value={metrics?.scheduled_count ?? 0}
          icon={<Calendar className="h-5 w-5" />}
          color="blue"
          loading={metricsLoading}
        />
        <MetricCard
          title="Planned"
          value={metrics?.planned_count ?? 0}
          icon={<Clock className="h-5 w-5" />}
          color="purple"
          loading={metricsLoading}
        />
        <MetricCard
          title="Completed"
          value={metrics?.completed_count ?? 0}
          icon={<CheckCircle className="h-5 w-5" />}
          color="gray"
          loading={metricsLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bar Chart - Monthly Volumes */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {currentYear} Monthly Arrivals
          </h3>
          {volumesLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : barData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="planned" fill="#3b82f6" name="Planned" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#10b981" name="Actual" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Pie Chart - Tier Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Cars In Shop by Tier
          </h3>
          {tierLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : pieData.length > 0 && pieData.some(d => d.value > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={TIER_COLORS[index % TIER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No cars in shop
            </div>
          )}
        </div>
      </div>

      {/* Budget Summary */}
      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Budget Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Planned Cost</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${parseFloat(metrics.total_planned_cost || '0').toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Actual Cost</p>
              <p className="text-2xl font-bold text-green-600">
                ${parseFloat(metrics.total_actual_cost || '0').toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Variance</p>
              <p className={`text-2xl font-bold ${
                parseFloat(metrics.total_actual_cost || '0') > parseFloat(metrics.total_planned_cost || '0')
                  ? 'text-red-600' : 'text-green-600'
              }`}>
                ${Math.abs(parseFloat(metrics.total_planned_cost || '0') - parseFloat(metrics.total_actual_cost || '0')).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Cost/Car</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${metrics.total_fleet > 0
                  ? Math.round(parseFloat(metrics.total_planned_cost || '0') / metrics.total_fleet).toLocaleString()
                  : '0'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'gray';
  loading?: boolean;
}

function MetricCard({ title, value, icon, color = 'blue', loading }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    gray: 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
          {loading ? (
            <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}
