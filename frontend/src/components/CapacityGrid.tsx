'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ShopMonthlyCapacity } from '@/types';
import { getCapacity, initializeCapacity, getCapacityCars, CapacityCar } from '@/lib/api';
import { FetchError } from '@/components/ErrorBoundary';

interface CapacityGridProps {
  startMonth?: string;
  months?: number;
}

interface TooltipState {
  visible: boolean;
  shopCode: string;
  month: string;
  x: number;
  y: number;
  cars: CapacityCar[];
  loading: boolean;
}

export default function CapacityGrid({
  startMonth,
  months = 12
}: CapacityGridProps) {
  const [capacityData, setCapacityData] = useState<ShopMonthlyCapacity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [networkFilter, setNetworkFilter] = useState<string>('');
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    shopCode: '',
    month: '',
    x: 0,
    y: 0,
    cars: [],
    loading: false,
  });

  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate date range
  const dateRange = useMemo(() => {
    const start = startMonth
      ? new Date(startMonth + '-01')
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const end = new Date(start);
    end.setMonth(end.getMonth() + months - 1);

    const startStr = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}`;
    const endStr = `${end.getFullYear()}-${(end.getMonth() + 1).toString().padStart(2, '0')}`;

    // Generate month headers
    const monthHeaders: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      monthHeaders.push(
        `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`
      );
      current.setMonth(current.getMonth() + 1);
    }

    return { startStr, endStr, monthHeaders };
  }, [startMonth, months]);

  const fetchCapacity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCapacity(
        dateRange.startStr,
        dateRange.endStr,
        networkFilter || undefined
      );
      setCapacityData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load capacity');
    } finally {
      setLoading(false);
    }
  }, [dateRange.startStr, dateRange.endStr, networkFilter]);

  useEffect(() => {
    fetchCapacity();
  }, [fetchCapacity]);

  const handleInitialize = async () => {
    if (!confirm('Initialize capacity for all shops for the next 18 months?')) return;
    setInitializing(true);
    try {
      const result = await initializeCapacity(20);
      alert(`Initialized ${result.count} capacity records`);
      fetchCapacity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize capacity');
    } finally {
      setInitializing(false);
    }
  };

  // Tooltip handlers
  const handleCellMouseEnter = async (
    e: React.MouseEvent<HTMLTableCellElement>,
    shopCode: string,
    month: string,
    cap: ShopMonthlyCapacity
  ) => {
    if (cap.allocated_count === 0) return;

    // Clear any pending timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }

    // Delay showing tooltip to avoid flicker
    tooltipTimeoutRef.current = setTimeout(async () => {
      const rect = e.currentTarget.getBoundingClientRect();
      const gridRect = gridRef.current?.getBoundingClientRect();

      setTooltip({
        visible: true,
        shopCode,
        month,
        x: rect.left - (gridRect?.left || 0) + rect.width / 2,
        y: rect.bottom - (gridRect?.top || 0) + 8,
        cars: [],
        loading: true,
      });

      try {
        const cars = await getCapacityCars(shopCode, month);
        setTooltip(prev => ({
          ...prev,
          cars,
          loading: false,
        }));
      } catch {
        setTooltip(prev => ({
          ...prev,
          loading: false,
        }));
      }
    }, 300);
  };

  const handleCellMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // Group by shop
  const shopData = useMemo(() => {
    const byShop = new Map<string, Map<string, ShopMonthlyCapacity>>();

    for (const cap of capacityData) {
      if (!byShop.has(cap.shop_code)) {
        byShop.set(cap.shop_code, new Map());
      }
      byShop.get(cap.shop_code)!.set(cap.month, cap);
    }

    return Array.from(byShop.entries())
      .map(([shop_code, months]) => ({ shop_code, months }))
      .sort((a, b) => a.shop_code.localeCompare(b.shop_code));
  }, [capacityData]);

  const getUtilizationClass = (pct: number) => {
    if (pct >= 95) return 'bg-danger-100 dark:bg-danger-900/50 text-danger-800 dark:text-danger-200';
    if (pct >= 85) return 'bg-warning-100 dark:bg-warning-900/50 text-warning-800 dark:text-warning-200';
    if (pct >= 70) return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200';
    return 'bg-success-100 dark:bg-success-900/50 text-success-800 dark:text-success-200';
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const formatMonthFull = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Shop Capacity Grid
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {shopData.length} shops, {months} months • Hover cells to see assigned cars
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={networkFilter}
            onChange={(e) => setNetworkFilter(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="">All Networks</option>
            <option value="AITX">AITX Only</option>
            <option value="Primary">Primary</option>
          </select>
          <button
            onClick={handleInitialize}
            disabled={initializing}
            className="btn btn-secondary text-sm py-1.5"
          >
            {initializing ? 'Initializing...' : 'Initialize Capacity'}
          </button>
        </div>
      </div>

      {/* Error with Retry */}
      {error && (
        <FetchError error={error} onRetry={fetchCapacity} />
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-success-100 dark:bg-success-900/50 border border-success-200 dark:border-success-800"></span>
          <span className="text-gray-600 dark:text-gray-400">&lt;70%</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800"></span>
          <span className="text-gray-600 dark:text-gray-400">70-85%</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-warning-100 dark:bg-warning-900/50 border border-warning-200 dark:border-warning-800"></span>
          <span className="text-gray-600 dark:text-gray-400">85-95%</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-danger-100 dark:bg-danger-900/50 border border-danger-200 dark:border-danger-800"></span>
          <span className="text-gray-600 dark:text-gray-400">&gt;95%</span>
        </span>
      </div>

      {/* Grid */}
      <div className="card overflow-hidden relative" ref={gridRef}>
        {shopData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No capacity data found. Click &quot;Initialize Capacity&quot; to set up.
          </div>
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="sticky left-0 z-30 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-r border-b border-gray-200 dark:border-gray-700 min-w-[100px]">
                    Shop
                  </th>
                  {dateRange.monthHeaders.map((month) => (
                    <th
                      key={month}
                      className="px-2 py-2 text-center font-medium text-gray-700 dark:text-gray-300 min-w-[60px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                    >
                      {formatMonth(month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {shopData.map(({ shop_code, months }) => (
                  <tr key={shop_code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-2 font-medium text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">
                      {shop_code}
                    </td>
                    {dateRange.monthHeaders.map((month) => {
                      const cap = months.get(month);
                      if (!cap) {
                        return (
                          <td key={month} className="px-2 py-2 text-center text-gray-400">
                            -
                          </td>
                        );
                      }
                      return (
                        <td
                          key={month}
                          className={`px-2 py-2 text-center cursor-pointer transition-all hover:ring-2 hover:ring-primary-400 hover:ring-inset ${getUtilizationClass(cap.utilization_pct)}`}
                          onMouseEnter={(e) => handleCellMouseEnter(e, shop_code, month, cap)}
                          onMouseLeave={handleCellMouseLeave}
                        >
                          {cap.allocated_count}/{cap.total_capacity}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 min-w-[200px] max-w-[300px] pointer-events-none"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {tooltip.shopCode}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatMonthFull(tooltip.month)}
              </span>
            </div>

            {tooltip.loading ? (
              <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
                Loading...
              </div>
            ) : tooltip.cars.length === 0 ? (
              <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
                No cars assigned
              </div>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {tooltip.cars.map((car, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-gray-900 dark:text-gray-100">
                      {car.car_number}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      car.status === 'Complete' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      car.status === 'Enroute' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {car.status}
                    </span>
                  </div>
                ))}
                {tooltip.cars.length >= 50 && (
                  <div className="text-center text-xs text-gray-400 pt-1">
                    + more cars...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
