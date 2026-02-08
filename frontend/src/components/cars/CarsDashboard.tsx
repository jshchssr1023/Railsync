'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Train, Activity, MapPin, BarChart3 } from 'lucide-react';
import SummaryCard from './SummaryCard';
import FleetDonutChart from './FleetDonutChart';
import Level2BarChart from './Level2BarChart';
import AgeDistributionChart from './AgeDistributionChart';
import StatusTrendChart from './StatusTrendChart';
import CarTypeIcon from './CarTypeIcon';

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getAuthToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
}

async function apiFetch<T>(endpoint: string): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TotalsResponse {
  success: boolean;
  data: {
    total: number;
    by_type: { name: string; count: number }[];
    by_status: { name: string; count: number }[];
    by_region: { name: string; count: number }[];
    age_distribution: { bucket: string; count: number }[];
  };
}

interface Level2Response {
  success: boolean;
  data: { name: string; count: number }[];
}

interface StatusTrendResponse {
  success: boolean;
  data: {
    weeks: Record<string, any>[];
    statuses: string[];
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CarsDashboardProps {
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CarsDashboard({
  filters,
  onFilterChange,
  collapsed,
  onToggleCollapse,
}: CarsDashboardProps) {
  // Data state
  const [totals, setTotals] = useState<TotalsResponse['data'] | null>(null);
  const [level2, setLevel2] = useState<Level2Response['data']>([]);
  const [trendWeeks, setTrendWeeks] = useState<Record<string, any>[]>([]);
  const [trendStatuses, setTrendStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [level2Loading, setLevel2Loading] = useState(false);

  // Cache refs
  const totalsCache = useRef<CacheEntry<TotalsResponse['data']> | null>(null);
  const trendCache = useRef<CacheEntry<StatusTrendResponse['data']> | null>(null);
  const level2Cache = useRef<Record<string, CacheEntry<Level2Response['data']>>>({});

  const activeCarType = filters.car_type || null;

  // Build query string from filters for the totals endpoint
  const buildFilterQuery = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [filters]);

  // Fetch totals
  useEffect(() => {
    const filterKey = JSON.stringify(filters);
    const cached = totalsCache.current;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && filterKey === JSON.stringify(filters)) {
      setTotals(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    apiFetch<TotalsResponse>(`/cars-summary/totals${buildFilterQuery()}`)
      .then(res => {
        setTotals(res.data);
        totalsCache.current = { data: res.data, timestamp: Date.now() };
      })
      .catch(() => setTotals(null))
      .finally(() => setLoading(false));
  }, [filters, buildFilterQuery]);

  // Fetch level2 when car_type is active
  useEffect(() => {
    if (!activeCarType) {
      setLevel2([]);
      return;
    }

    const cached = level2Cache.current[activeCarType];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setLevel2(cached.data);
      return;
    }

    setLevel2Loading(true);
    apiFetch<Level2Response>(`/cars-summary/level2?car_type=${encodeURIComponent(activeCarType)}`)
      .then(res => {
        setLevel2(res.data);
        level2Cache.current[activeCarType] = { data: res.data, timestamp: Date.now() };
      })
      .catch(() => setLevel2([]))
      .finally(() => setLevel2Loading(false));
  }, [activeCarType]);

  // Fetch status trend on mount
  useEffect(() => {
    const cached = trendCache.current;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setTrendWeeks(cached.data.weeks);
      setTrendStatuses(cached.data.statuses);
      return;
    }

    apiFetch<StatusTrendResponse>('/cars-summary/status-trend')
      .then(res => {
        setTrendWeeks(res.data.weeks);
        setTrendStatuses(res.data.statuses);
        trendCache.current = { data: res.data, timestamp: Date.now() };
      })
      .catch(() => {
        setTrendWeeks([]);
        setTrendStatuses([]);
      });
  }, []);

  // Handlers
  const handleSliceClick = (typeName: string) => {
    if (activeCarType === typeName) {
      onFilterChange('car_type', '');
    } else {
      onFilterChange('car_type', typeName);
    }
  };

  const handleBarClick = (commodityName: string) => {
    onFilterChange('commodity', commodityName);
  };

  // Collapsed state
  if (collapsed) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard</span>
            {totals && (
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                {totals.total.toLocaleString()} cars
              </span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    );
  }

  // Skeleton loading
  if (loading && !totals) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <button onClick={onToggleCollapse} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronUp className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        {/* Summary card skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-9 w-9 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        {/* Chart skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div className="h-[280px] bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div className="h-[280px] bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const typesCount = totals?.by_type?.length ?? 0;
  const statusCount = totals?.by_status?.length ?? 0;
  const regionsCount = totals?.by_region?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fleet Overview</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Collapse dashboard"
        >
          <ChevronUp className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Row 1: Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Cars"
          value={totals?.total ?? 0}
          icon={<Train className="w-5 h-5" />}
          color="primary"
        />
        <SummaryCard
          label="Car Types"
          value={typesCount}
          icon={<CarTypeIcon type={null} size="md" />}
          color="blue"
        />
        <SummaryCard
          label="Statuses"
          value={statusCount}
          icon={<Activity className="w-5 h-5" />}
          color="amber"
        />
        <SummaryCard
          label="Regions"
          value={regionsCount}
          icon={<MapPin className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Row 2: Fleet Donut + Level2 Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FleetDonutChart
          data={totals?.by_type ?? []}
          total={totals?.total ?? 0}
          activeType={activeCarType}
          onSliceClick={handleSliceClick}
        />
        {level2Loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          </div>
        ) : (
          <Level2BarChart
            data={level2}
            carType={activeCarType}
            onBarClick={handleBarClick}
          />
        )}
      </div>

      {/* Row 3: Age Distribution + Status Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AgeDistributionChart data={totals?.age_distribution ?? []} />
        <StatusTrendChart weeks={trendWeeks} statuses={trendStatuses} />
      </div>
    </div>
  );
}
