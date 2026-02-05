'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ArrowLeftRight } from 'lucide-react';
import { Allocation, AllocationStatus } from '@/types';
import { listAllocations } from '@/lib/api';
import { FetchError } from '@/components/ErrorBoundary';

interface AllocationListProps {
  onShopCarNow?: (carNumber: string) => void;
  onBatchAction?: (selectedIds: string[], action: 'shop' | 'cancel' | 'reassign') => void;
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
  onBatchAction,
  shopCode,
  targetMonth,
}: AllocationListProps) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [shoppingTypeFilter, setShoppingTypeFilter] = useState<string>('');
  const [shoppingTypes, setShoppingTypes] = useState<{id: string; code: string; name: string}[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      // Clear selection when data changes
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load allocations');
    } finally {
      setLoading(false);
    }
  }, [shopCode, targetMonth, statusFilter]);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  // Fetch shopping types for filter
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/shopping-types`)
      .then(r => r.json())
      .then(d => d.success && setShoppingTypes(d.data))
      .catch(() => {});
  }, []);

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

  // Filter allocations by shopping type
  const filteredAllocations = useMemo(() => {
    if (!shoppingTypeFilter) return allocations;
    return allocations.filter(a => (a as any).shopping_type_id === shoppingTypeFilter);
  }, [allocations, shoppingTypeFilter]);

  // Filter to show only allocations that need shopping (have car_number)
  const shoppableAllocations = useMemo(() =>
    filteredAllocations.filter(
      (a) => a.car_number && ['Need Shopping', 'To Be Routed', 'Planned Shopping'].includes(a.status)
    ), [filteredAllocations]
  );

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === shoppableAllocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shoppableAllocations.map(a => a.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBatchAction = (action: 'shop' | 'cancel' | 'reassign') => {
    if (selectedIds.size === 0) return;
    onBatchAction?.(Array.from(selectedIds), action);
  };

  const isAllSelected = shoppableAllocations.length > 0 && selectedIds.size === shoppableAllocations.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < shoppableAllocations.length;

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
            {selectedIds.size > 0 && (
              <span className="ml-2 text-primary-600 dark:text-primary-400 font-medium">
                • {selectedIds.size} selected
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
          <select
            value={shoppingTypeFilter}
            onChange={(e) => setShoppingTypeFilter(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="">All Types</option>
            {shoppingTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            onClick={fetchAllocations}
            className="btn btn-secondary text-sm py-1.5"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {selectedIds.size} car{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => handleBatchAction('shop')}
            className="btn btn-primary text-sm py-1.5 px-3"
          >
            <Search className="w-4 h-4 mr-1" aria-hidden="true" />
            Shop Selected
          </button>
          <button
            onClick={() => handleBatchAction('reassign')}
            className="btn btn-secondary text-sm py-1.5 px-3"
          >
            <ArrowLeftRight className="w-4 h-4 mr-1" aria-hidden="true" />
            Reassign
          </button>
          <button
            onClick={clearSelection}
            className="btn btn-ghost text-sm py-1.5 px-3 text-gray-600 dark:text-gray-400"
          >
            Clear
          </button>
        </div>
      )}

      {/* Error with Retry */}
      {error && (
        <FetchError error={error} onRetry={fetchAllocations} />
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading allocations...</div>
        ) : filteredAllocations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No allocations found {shoppingTypeFilter && '(try clearing type filter)'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      title={isAllSelected ? 'Deselect all' : 'Select all shoppable'}
                    />
                  </th>
                  <th>Car Number</th>
                  <th>Type</th>
                  <th>Shop</th>
                  <th>Month</th>
                  <th>Status</th>
                  <th className="text-right">Est. Cost</th>
                  <th>Arrival</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllocations.map((allocation) => {
                  const isShoppable = allocation.car_number &&
                    ['Need Shopping', 'To Be Routed', 'Planned Shopping'].includes(allocation.status);
                  const isSelected = selectedIds.has(allocation.id);
                  const shopType = shoppingTypes.find(t => t.id === (allocation as any).shopping_type_id);

                  return (
                    <tr
                      key={allocation.id}
                      className={`
                        hover:bg-gray-50 dark:hover:bg-gray-800
                        ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
                      `}
                    >
                      <td>
                        {isShoppable && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(allocation.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        )}
                      </td>
                      <td>
                        <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                          {allocation.car_number || allocation.car_id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="text-xs text-gray-600 dark:text-gray-400 max-w-[120px] truncate" title={shopType?.name}>
                        {shopType?.name?.split('/')[0]?.trim() || '-'}
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
                        {isShoppable && (
                          <button
                            onClick={() => onShopCarNow?.(allocation.car_number!)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 rounded hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                            title="Shop this car now"
                          >
                            <Search className="w-3.5 h-3.5" aria-hidden="true" />
                            Shop Now
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
