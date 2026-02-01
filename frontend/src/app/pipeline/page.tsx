'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

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

export default function PipelinePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'backlog' | 'pipeline' | 'active' | 'healthy'>('backlog');

  const { data, error, isLoading, mutate } = useSWR<PipelineData>(
    '/api/pipeline/buckets',
    fetcher,
    { refreshInterval: 30000 }
  );

  const handleShopCar = useCallback((car: PipelineCar) => {
    const params = new URLSearchParams({
      car: car.car_number,
    });
    if (car.needs_shopping_reason) {
      params.set('reason', car.needs_shopping_reason);
    }
    router.push(`/planning?${params.toString()}`);
  }, [router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'backlog' as const, label: 'Backlog', count: data?.summary.backlog || 0, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    { id: 'pipeline' as const, label: 'Pipeline', count: data?.summary.pipeline || 0, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    { id: 'active' as const, label: 'Active', count: data?.summary.active || 0, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { id: 'healthy' as const, label: 'Healthy', count: data?.summary.healthy || 0, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  ];

  const currentCars = data?.[activeTab] || [];

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
        <button
          onClick={() => mutate()}
          className="btn btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {tabs.find(t => t.id === activeTab)?.label} Cars
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentCars.length} cars
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading cars...</div>
        ) : currentCars.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No cars in {tabs.find(t => t.id === activeTab)?.label.toLowerCase()}
          </div>
        ) : (
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
                {currentCars.map((car) => (
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
                        <button
                          onClick={() => router.push(`/planning?car=${car.car_number}`)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          View Details
                        </button>
                      )}
                      {activeTab === 'active' && (
                        <span className="text-xs text-gray-500">
                          {car.enroute_date ? `Enroute: ${car.enroute_date}` : 'In Shop'}
                        </span>
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
