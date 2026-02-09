'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import type { ExportColumn } from '@/hooks/useExportCSV';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface PipelineCar {
  id: string;
  car_id: string;
  car_number: string;
  car_mark: string;
  product_code: string;
  current_status: string;
  needs_shopping_reason: string | null;
  shop_code: string | null;
  shop_name: string | null;
  target_month: string;
  estimated_cost: number;
  actual_cost: number;
  last_shopping_date: string | null;
  plan_status_year: number;
  enroute_date: string | null;
}

interface PipelineData {
  summary: {
    backlog: number;
    pipeline: number;
    active: number;
    healthy: number;
    complete: number;
  };
  backlog: PipelineCar[];
  pipeline: PipelineCar[];
  active: PipelineCar[];
  healthy: PipelineCar[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  return json.data as PipelineData;
};

const PAGE_SIZES = [10, 25, 50, 100];

export default function PipelinePage() {
  const { isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'backlog' | 'pipeline' | 'active' | 'healthy'>('backlog');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, error, isLoading, mutate } = useSWR<PipelineData>(
    `${API_URL}/pipeline/buckets`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const handleShopCar = useCallback((car: PipelineCar) => {
    const params = new URLSearchParams({ shopCar: car.car_number });
    if (car.needs_shopping_reason) {
      params.set('reason', car.needs_shopping_reason);
    }
    router.push(`/shopping?${params.toString()}`);
  }, [router]);

  // Reset to page 1 when tab or search changes
  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Filter and paginate cars
  const { filteredCars, paginatedCars, totalPages, totalFiltered } = useMemo(() => {
    const allCars = data?.[activeTab] || [];

    // Filter by search query
    const filtered = searchQuery.trim()
      ? allCars.filter(car => {
          const query = searchQuery.toLowerCase();
          return (
            car.car_number?.toLowerCase().includes(query) ||
            car.car_mark?.toLowerCase().includes(query) ||
            car.product_code?.toLowerCase().includes(query) ||
            car.shop_name?.toLowerCase().includes(query) ||
            car.shop_code?.toLowerCase().includes(query)
          );
        })
      : allCars;

    // Calculate pagination
    const total = Math.ceil(filtered.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);

    return {
      filteredCars: filtered,
      paginatedCars: paginated,
      totalPages: total,
      totalFiltered: filtered.length,
    };
  }, [data, activeTab, searchQuery, currentPage, pageSize]);

  const pipelineExportColumns: ExportColumn[] = [
    { key: 'car_number', header: 'Car Number' },
    { key: 'car_mark', header: 'Car Mark' },
    { key: 'product_code', header: 'Product Code' },
    { key: 'current_status', header: 'Status' },
    { key: 'shop_name', header: 'Shop', format: (v: string | null) => v || '' },
    { key: 'target_month', header: 'Target Month', format: (v: string | null) => v || '' },
    { key: 'needs_shopping_reason', header: 'Reason', format: (v: string | null) => v || '' },
    { key: 'estimated_cost', header: 'Estimated Cost', format: (v: number) => v != null ? v.toFixed(2) : '' },
  ];

  const pipelineExportFilename = `railsync-pipeline-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'backlog' as const, label: 'Backlog', count: data?.summary.backlog || 0, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    { id: 'pipeline' as const, label: 'Pipeline', count: data?.summary.pipeline || 0, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    { id: 'active' as const, label: 'Active', count: data?.summary.active || 0, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { id: 'healthy' as const, label: 'Healthy', count: data?.summary.healthy || 0, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Pipeline View
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track cars through the shopping lifecycle
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            data={filteredCars}
            columns={pipelineExportColumns}
            filename={pipelineExportFilename}
            disabled={isLoading}
          />
          <button
            onClick={() => mutate()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`p-4 rounded-lg border-2 transition-all ${
              activeTab === tab.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-transparent bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{tab.label}</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {isLoading ? '...' : tab.count.toLocaleString()}
            </div>
            <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full ${tab.color}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-500 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading pipeline data</p>
          <p className="text-sm">{error.message}</p>
          <button onClick={() => mutate()} className="mt-2 text-sm underline">
            Try again
          </button>
        </div>
      )}

      {/* Cars Table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {tabs.find(t => t.id === activeTab)?.label} Cars
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? `${totalFiltered} of ${data?.[activeTab]?.length || 0}` : totalFiltered} cars
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search cars..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 pr-3 py-2 w-48 sm:w-64 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {/* Page Size */}
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
              >
                {PAGE_SIZES.map(size => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading cars...</div>
        ) : paginatedCars.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery
              ? `No cars matching "${searchQuery}"`
              : `No cars in ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()}`}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>Car</th>
                    <th>Product</th>
                    <th>Status</th>
                    {activeTab !== 'backlog' && <th>Shop</th>}
                    {activeTab === 'backlog' && <th>Reason</th>}
                    <th>Target Month</th>
                    {activeTab === 'healthy' && <th>Last Shopped</th>}
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCars.map((car) => (
                    <tr key={car.id}>
                      <td>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {car.car_mark} {car.car_number}
                        </div>
                      </td>
                      <td>{car.product_code || 'N/A'}</td>
                      <td>
                        <StatusBadge status={car.current_status} />
                      </td>
                      {activeTab !== 'backlog' && (
                        <td>{car.shop_name || car.shop_code || '-'}</td>
                      )}
                      {activeTab === 'backlog' && (
                        <td>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {car.needs_shopping_reason || 'Not specified'}
                          </span>
                        </td>
                      )}
                      <td>{car.target_month || '-'}</td>
                      {activeTab === 'healthy' && (
                        <td>{car.last_shopping_date || '-'}</td>
                      )}
                      <td className="text-right">
                        {activeTab === 'backlog' && (
                          <button
                            onClick={() => handleShopCar(car)}
                            className="btn btn-primary btn-sm"
                          >
                            Shop Now
                          </button>
                        )}
                        {activeTab === 'pipeline' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`/planning?car=${car.car_number}`)}
                              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => router.push(`/bad-orders?car=${car.car_number}`)}
                              className="text-red-600 hover:text-red-700 text-xs"
                              title="Report Bad Order"
                            >
                              Report Issue
                            </button>
                          </div>
                        )}
                        {activeTab === 'active' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {car.enroute_date ? `Enroute: ${car.enroute_date}` : 'In Shop'}
                            </span>
                            <button
                              onClick={() => router.push(`/bad-orders?car=${car.car_number}`)}
                              className="text-red-600 hover:text-red-700 text-xs"
                              title="Report Bad Order"
                            >
                              Report Issue
                            </button>
                          </div>
                        )}
                        {activeTab === 'healthy' && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Complete
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalFiltered)} of {totalFiltered}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[100px] text-center">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, string> = {
    planned: 'badge-info',
    scheduled: 'badge-warning',
    enroute: 'badge-warning',
    in_shop: 'badge-primary',
    dispo: 'badge-success',
    completed: 'badge-success',
  };

  return (
    <span className={`badge ${statusConfig[status] || 'badge-info'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
