'use client';

import { useState, useEffect, useCallback } from 'react';
import { Allocation, AllocationStatus } from '@/types';
import { listAllocations } from '@/lib/api';

interface AllocationListProps {
  onShopCarNow?: (carNumber: string) => void;
  shopCode?: string;
  targetMonth?: string;
}

const STATUS_COLORS: Record<AllocationStatus, string> = {
  'Need Shopping': 'badge-warning',
  'To Be Routed': 'badge-info',
  'Planned Shopping': 'badge-info',
  'Enroute': 'badge-warning',
  'Arrived': 'badge-success',
  'Complete': 'badge-success',
  'Released': 'badge-secondary',
};

export default function AllocationList({
  onShopCarNow,
  shopCode,
  targetMonth,
}: AllocationListProps) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAllocations({
        shop_code: shopCode,
        target_month: targetMonth,
        status: statusFilter || undefined,
      });
      setAllocations(data.allocations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load allocations');
    } finally {
      setLoading(false);
    }
  }, [shopCode, targetMonth, statusFilter]);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter to show only allocations that need shopping (have car_number)
  const shoppableAllocations = allocations.filter(
    (a) => a.car_number && ['Need Shopping', 'To Be Routed', 'Planned Shopping'].includes(a.status)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Car Allocations
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {allocations.length} allocations, {shoppableAllocations.length} need shopping
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="">All Status</option>
            <option value="Need Shopping">Need Shopping</option>
            <option value="Planned Shopping">Planned Shopping</option>
            <option value="Enroute">Enroute</option>
            <option value="Complete">Complete</option>
          </select>
          <button
            onClick={fetchAllocations}
            className="btn btn-secondary text-sm py-1.5"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading allocations...</div>
        ) : allocations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No allocations found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Car Number</th>
                  <th>Shop</th>
                  <th>Month</th>
                  <th>Status</th>
                  <th className="text-right">Est. Cost</th>
                  <th>Arrival</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((allocation) => (
                  <tr key={allocation.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td>
                      <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                        {allocation.car_number || allocation.car_id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="text-gray-700 dark:text-gray-300">
                      {allocation.shop_code}
                    </td>
                    <td className="text-gray-600 dark:text-gray-400">
                      {allocation.target_month}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[allocation.status]}`}>
                        {allocation.status}
                      </span>
                    </td>
                    <td className="text-right text-gray-700 dark:text-gray-300">
                      {formatCurrency(allocation.estimated_cost)}
                    </td>
                    <td className="text-gray-600 dark:text-gray-400">
                      {formatDate(allocation.planned_arrival_date)}
                    </td>
                    <td className="text-right">
                      {allocation.car_number &&
                        ['Need Shopping', 'To Be Routed', 'Planned Shopping'].includes(allocation.status) && (
                          <button
                            onClick={() => onShopCarNow?.(allocation.car_number!)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 rounded hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                            title="Shop this car now"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Shop Now
                          </button>
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
