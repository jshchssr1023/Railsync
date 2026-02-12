'use client';

import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import {
  Search, Filter, X, ChevronDown, ChevronUp, Loader2,
  Wrench, Warehouse, CheckCircle2, AlertTriangle as AlertTriangleIcon,
  Train, ArrowRightLeft, Trash2,
} from 'lucide-react';
import MobileCarCard from '@/components/MobileCarCard';
import EmptyState from '@/components/EmptyState';
import ExportButton from '@/components/ExportButton';
import { useAuth } from '@/context/AuthContext';
import { useURLFilters } from '@/hooks/useURLFilters';
import { useFilterPresets } from '@/hooks/useFilterPresets';
import FilterPresetsBar from '@/components/FilterPresetsBar';
import type { ExportColumn } from '@/hooks/useExportCSV';

// Car page components (extracted)
import CarTypeDrilldown, { type TypeTreeNode } from '@/components/cars/CarTypeDrilldown';
import { useCarDrawer } from '@/context/CarDrawerContext';
import CarFacetedSidebar from '@/components/cars/CarFacetedSidebar';
import { QualBadge, StatusBadge } from '@/components/cars/CarBadges';
import CarTypeIcon from '@/components/cars/CarTypeIcon';
import CarNumberLink from '@/components/cars/CarNumberLink';
import CarsDashboard from '@/components/cars/CarsDashboard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Car {
  car_number: string;
  car_mark: string;
  car_type: string;
  lessee_name: string;
  commodity: string;
  current_status: string;
  current_region: string;
  car_age: number;
  is_jacketed: boolean;
  is_lined: boolean;
  tank_qual_year: number;
  contract_number: string;
  plan_status: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('railsync_access_token');
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
// Page Wrapper
// ---------------------------------------------------------------------------
export default function CarsPageWrapper() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Please sign in to view the cars directory
        </h2>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    }>
      <CarsPage />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Filter Defaults
// ---------------------------------------------------------------------------
const CARS_FILTER_DEFAULTS: Record<string, string> = {
  type: '',
  commodity: '',
  search: '',
  status: '',
  region: '',
  lessee: '',
  status_group: '',
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
function CarsPage() {
  // --- URL-driven filter state ---
  const { filters, setFilter, setFilters, clearFilters } = useURLFilters(CARS_FILTER_DEFAULTS);
  const selectedType = filters.type || null;
  const selectedCommodity = filters.commodity || null;
  const search = filters.search;
  const statusFilter = filters.status;
  const regionFilter = filters.region;
  const lesseeFilter = filters.lessee;

  // --- Filter presets ---
  const { presets, savePreset, deletePreset, applyPreset } = useFilterPresets(
    'cars',
    (presetFilters) => setFilters(presetFilters),
  );

  // Tree data
  const [tree, setTree] = useState<TypeTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeCollapsed, setTreeCollapsed] = useState(false);

  const [showFilters, setShowFilters] = useState(!!(statusFilter || regionFilter || lesseeFilter));

  // Dashboard collapse (persisted)
  const [dashboardCollapsed, setDashboardCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('railsync_cars_dashboard_collapsed') === 'true';
  });

  const toggleDashboard = useCallback(() => {
    setDashboardCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('railsync_cars_dashboard_collapsed', String(next));
      return next;
    });
  }, []);

  // Sort & pagination
  const [sortField, setSortField] = useState('car_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Data
  const [cars, setCars] = useState<Car[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [carsLoading, setCarsLoading] = useState(true);

  // Drawer (global context)
  const { openCarDrawer, activeCarNumber } = useCarDrawer();

  // Level 2 drill-in tab (visible when a car type is selected)
  const [drillInTab, setDrillInTab] = useState<'car_list' | 'shop_status' | 'shopping_reasons'>('car_list');
  const [drillInData, setDrillInData] = useState<{ shopStatus: any[]; shoppingReasons: any[] }>({ shopStatus: [], shoppingReasons: [] });
  const [drillInLoading, setDrillInLoading] = useState(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fleet status group summary
  const [fleetSummary, setFleetSummary] = useState<{
    on_rent_count: number; in_shop_count: number; idle_storage_count: number;
    pending_count: number; ready_to_load_count: number; scrap_count: number;
    releasing_count: number; total_fleet: number;
  } | null>(null);

  useEffect(() => {
    apiFetch<{ data: any }>('/cars/fleet-summary')
      .then(res => setFleetSummary(res.data))
      .catch(() => {});
  }, []);

  // Reset drill-in tab when type selection changes
  useEffect(() => { setDrillInTab('car_list'); }, [selectedType]);

  // Fetch drill-in analytics when tab changes
  useEffect(() => {
    if (!selectedType || drillInTab === 'car_list') return;
    setDrillInLoading(true);
    const params = new URLSearchParams({ car_type: selectedType });
    Promise.all([
      drillInTab === 'shop_status'
        ? apiFetch<{ data: any[] }>(`/contracts-browse/shop-status-by-type?${params}`).then(r => r.data || []).catch(() => [])
        : Promise.resolve(drillInData.shopStatus),
      drillInTab === 'shopping_reasons'
        ? apiFetch<{ data: any[] }>(`/contracts-browse/shopping-reasons-by-type?${params}`).then(r => r.data || []).catch(() => [])
        : Promise.resolve(drillInData.shoppingReasons),
    ]).then(([shopStatus, shoppingReasons]) => {
      setDrillInData({ shopStatus, shoppingReasons });
    }).finally(() => setDrillInLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, drillInTab]);

  const statusGroupFilter = filters.status_group || null;

  // Distinct values for filter dropdowns
  const [filterOptions, setFilterOptions] = useState<{ statuses: string[]; regions: string[]; lessees: string[] }>({ statuses: [], regions: [], lessees: [] });

  // Fetch tree and filter options on mount
  useEffect(() => {
    apiFetch<{ data: TypeTreeNode[] }>('/contracts-browse/types')
      .then(res => setTree(res.data || []))
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false));

    apiFetch<{ data: { statuses: string[]; regions: string[]; lessees: string[] } }>('/contracts-browse/filters')
      .then(res => setFilterOptions(res.data))
      .catch(() => {});
  }, []);

  // Fetch cars whenever filters/sort/page change
  useEffect(() => {
    setCarsLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(pageSize));
    params.set('sort', sortField);
    params.set('order', sortDir);
    if (selectedType) params.set('car_type', selectedType);
    if (selectedCommodity) params.set('commodity', selectedCommodity);
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (regionFilter) params.set('region', regionFilter);
    if (lesseeFilter) params.set('lessee', lesseeFilter);
    if (statusGroupFilter) params.set('status_group', statusGroupFilter);

    apiFetch<{ data: Car[]; pagination: Pagination }>(`/contracts-browse/cars?${params}`)
      .then(res => {
        setCars(res.data || []);
        setPagination(res.pagination || null);
      })
      .catch(() => { setCars([]); setPagination(null); })
      .finally(() => setCarsLoading(false));
  }, [page, pageSize, sortField, sortDir, selectedType, selectedCommodity, search, statusFilter, regionFilter, lesseeFilter, statusGroupFilter]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [selectedType, selectedCommodity, search, statusFilter, regionFilter, lesseeFilter, statusGroupFilter]);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortField]);

  const handleTypeSelect = (t: string | null) => { setFilter('type', t || ''); };
  const handleCommoditySelect = (c: string | null) => { setFilter('commodity', c || ''); };
  const handleClearTree = () => { setFilters({ type: '', commodity: '' }); };

  const activeFilterCount = [statusFilter, regionFilter, lesseeFilter, search, statusGroupFilter].filter(Boolean).length
    + (selectedType ? 1 : 0) + (selectedCommodity ? 1 : 0);

  const clearAllFilters = () => {
    clearFilters();
    setPage(1);
  };

  // Debounced search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setFilter('search', value);
    }, 300);
  };

  const columns = [
    { key: 'car_number', label: 'Car #', width: 'w-28' },
    { key: 'car_type', label: 'Type', width: 'w-44' },
    { key: 'lessee_name', label: 'Lessee', width: 'w-44' },
    { key: 'commodity', label: 'Commodity', width: 'w-44' },
    { key: 'current_status', label: 'Status', width: 'w-28' },
    { key: 'current_region', label: 'Region', width: 'w-24' },
    { key: 'tank_qual_year', label: 'Tank Qual', width: 'w-24' },
    { key: 'car_age', label: 'Age', width: 'w-16' },
  ];

  const exportColumns: ExportColumn[] = [
    { key: 'car_number', header: 'Car Number' },
    { key: 'car_type', header: 'Type' },
    { key: 'current_status', header: 'Status' },
    { key: 'current_region', header: 'Region' },
    { key: 'lessee_name', header: 'Lessee' },
    { key: 'commodity', header: 'Commodity' },
  ];

  const exportFilename = `railsync-cars-${new Date().toISOString().slice(0, 10)}.csv`;

  // Active filter chips
  const activeChips: { key: string; label: string; value: string }[] = [];
  if (selectedType) activeChips.push({ key: 'type', label: 'Type', value: selectedType });
  if (selectedCommodity) activeChips.push({ key: 'commodity', label: 'Commodity', value: selectedCommodity });
  if (statusFilter) activeChips.push({ key: 'status', label: 'Status', value: statusFilter });
  if (regionFilter) activeChips.push({ key: 'region', label: 'Region', value: regionFilter });
  if (lesseeFilter) activeChips.push({ key: 'lessee', label: 'Lessee', value: lesseeFilter });
  if (search) activeChips.push({ key: 'search', label: 'Search', value: search });
  if (statusGroupFilter) {
    const groupLabels: Record<string, string> = { in_shop: 'In Shop', idle_storage: 'Idle / Storage', ready_to_load: 'Ready to Load', pending: 'Pending' };
    activeChips.push({ key: 'status_group', label: 'Group', value: groupLabels[statusGroupFilter] || statusGroupFilter });
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] md:h-[calc(100vh-2rem)] overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-6">
      {/* Left Panel: Faceted Filter Sidebar (hidden on mobile) */}
      <div className="hidden md:block">
        {treeLoading ? (
          <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : (
          <CarFacetedSidebar
            filters={filters}
            onSetFilter={(key, value) => { setFilter(key, value); setPage(1); }}
            onClearAll={() => { clearAllFilters(); setPage(1); }}
            filterOptions={filterOptions}
            typeTree={tree}
            collapsed={treeCollapsed}
            onToggleCollapse={() => setTreeCollapsed(!treeCollapsed)}
          />
        )}
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        {/* Dashboard Section */}
        <CarsDashboard
          filters={filters}
          onFilterChange={setFilter}
          collapsed={dashboardCollapsed}
          onToggleCollapse={toggleDashboard}
        />

        {/* Fleet Status Group Cards */}
        {fleetSummary && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { key: 'on_rent', label: 'On Rent', count: fleetSummary.on_rent_count, icon: Train, color: 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400', ring: 'ring-green-200 dark:ring-green-800' },
                { key: 'in_shop', label: 'In Shop', count: fleetSummary.in_shop_count, icon: Wrench, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800' },
                { key: 'idle_storage', label: 'Idle / Storage', count: fleetSummary.idle_storage_count, icon: Warehouse, color: 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400', ring: 'ring-gray-200 dark:ring-gray-700' },
                { key: 'ready_to_load', label: 'Ready to Load', count: fleetSummary.ready_to_load_count, icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400', ring: 'ring-green-200 dark:ring-green-800' },
                { key: 'releasing', label: 'Releasing', count: fleetSummary.releasing_count, icon: ArrowRightLeft, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400', ring: 'ring-purple-200 dark:ring-purple-800' },
                { key: 'scrap', label: 'Scrap', count: fleetSummary.scrap_count, icon: Trash2, color: 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400', ring: 'ring-red-200 dark:ring-red-800' },
                { key: 'pending', label: 'Pending Triage', count: fleetSummary.pending_count, icon: AlertTriangleIcon, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800' },
              ].map(({ key, label, count, icon: Icon, color, ring }) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === 'pending') {
                      window.location.href = '/triage';
                    } else {
                      setFilter('status_group', statusGroupFilter === key ? '' : key);
                    }
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                    ${statusGroupFilter === key
                      ? `ring-2 ${ring} border-transparent ${color}`
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
                    }`}
                >
                  <div className={`p-2 rounded-lg ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{count}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {fleetSummary.total_fleet.toLocaleString()} total cars in fleet
            </p>
          </div>
        )}

        {/* Header Bar */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Cars</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {pagination ? `${pagination.total.toLocaleString()} cars` : '...'}
                {selectedType && ` in ${selectedType}`}
                {selectedCommodity && ` / ${selectedCommodity}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                data={cars}
                columns={exportColumns}
                filename={exportFilename}
                disabled={carsLoading}
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>
          </div>

          {/* Filter Presets */}
          <div className="mb-2">
            <FilterPresetsBar
              presets={presets}
              onApply={applyPreset}
              onDelete={deletePreset}
              onSave={(name) => savePreset(name, filters)}
              currentFilters={filters}
              defaults={CARS_FILTER_DEFAULTS}
            />
          </div>

          <div className="flex gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                defaultValue={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search car number..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

          </div>
        </div>

        {/* Active Filter Chips */}
        {activeChips.length > 0 && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 dark:text-gray-500">Active:</span>
            {activeChips.map(chip => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
              >
                <span className="text-primary-400 dark:text-primary-500">{chip.label}:</span>
                <span className="max-w-[120px] truncate">{chip.value}</span>
                <button
                  onClick={() => setFilter(chip.key, '')}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-primary-100 dark:hover:bg-primary-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearAllFilters}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Level 2 Drill-In Tabs (visible when a car type is selected) */}
        {selectedType && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4">
            <nav className="flex gap-4 -mb-px">
              {([
                { key: 'car_list', label: 'Car List' },
                { key: 'shop_status', label: 'Shop Status' },
                { key: 'shopping_reasons', label: 'Shopping Reasons' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDrillInTab(tab.key)}
                  className={`py-2 text-xs font-medium border-b-2 transition-colors ${
                    drillInTab === tab.key
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Drill-In Analytics Panels */}
        {selectedType && drillInTab === 'shop_status' && (
          <div className="flex-1 overflow-auto p-4">
            {drillInLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : drillInData.shopStatus.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No shopping event data available for {selectedType}.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Shop Status Distribution &mdash; {selectedType}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {drillInData.shopStatus.map((item: any) => (
                    <div key={item.state || item.status} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.state || item.status}</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{item.count}</p>
                    </div>
                  ))}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {drillInData.shopStatus.map((item: any) => {
                      const total = drillInData.shopStatus.reduce((s: number, i: any) => s + (i.count || 0), 0);
                      return (
                        <tr key={item.state || item.status}>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.state || item.status}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">{item.count}</td>
                          <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">
                            {total > 0 ? `${((item.count / total) * 100).toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {selectedType && drillInTab === 'shopping_reasons' && (
          <div className="flex-1 overflow-auto p-4">
            {drillInLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : drillInData.shoppingReasons.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No shopping reason data available for {selectedType}.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Shopping Reasons Breakdown &mdash; {selectedType}
                </h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {drillInData.shoppingReasons.map((item: any) => {
                      const total = drillInData.shoppingReasons.reduce((s: number, i: any) => s + (i.count || 0), 0);
                      return (
                        <tr key={item.reason}>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.reason || 'Unknown'}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">{item.count}</td>
                          <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">
                            {total > 0 ? `${((item.count / total) * 100).toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Table / Mobile Cards (shown when drillInTab is 'car_list' or no type selected) */}
        <div className={`flex-1 overflow-auto ${selectedType && drillInTab !== 'car_list' ? 'hidden' : ''}`}>
          {carsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : cars.length === 0 ? (
            <EmptyState
              variant="search"
              title="No cars match the current filters"
              description="Try adjusting your search or filter criteria."
              actionLabel="Clear Filters"
              onAction={clearAllFilters}
            />
          ) : isMobile ? (
            <div className="space-y-3 p-3">
              {cars.map(car => (
                <MobileCarCard
                  key={car.car_number}
                  carNumber={car.car_number}
                  status={car.current_status || 'Unknown'}
                  carType={car.car_type}
                  customer={car.lessee_name}
                  onClick={() => openCarDrawer(car.car_number)}
                />
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none ${col.width}`}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortField === col.key && (
                          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {cars.map(car => (
                  <tr
                    key={car.car_number}
                    onClick={() => openCarDrawer(car.car_number)}
                    className={`cursor-pointer transition-colors ${
                      activeCarNumber === car.car_number
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                      <CarNumberLink carNumber={car.car_number} className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline" />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <CarTypeIcon type={car.car_type} size="sm" className="text-gray-400 dark:text-gray-500" />
                        <span className="truncate max-w-[140px]">{car.car_type || '-'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[176px]">
                      {car.lessee_name || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[176px]">
                      {car.commodity || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                      <StatusBadge status={car.current_status} />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {car.current_region || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                      <QualBadge year={car.tank_qual_year} />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {car.car_age ? `${car.car_age}y` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Page {pagination.page} of {pagination.totalPages} &middot; {pagination.total.toLocaleString()} cars
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                First
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const startPage = Math.max(1, Math.min(page - 2, pagination.totalPages - 4));
                const p = startPage + i;
                if (p > pagination.totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2 py-1 text-xs border rounded ${
                      p === page
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Next
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={page === pagination.totalPages}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
