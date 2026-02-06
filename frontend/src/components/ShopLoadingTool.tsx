'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Allocation, ShopMonthlyCapacity } from '@/types';
import { getCapacity, listAllocations } from '@/lib/api';
import { Car, GripVertical, AlertTriangle, Check, X, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ShopLoadingToolProps {
  startMonth?: string;
  months?: number;
}

interface DragItem {
  allocation: Allocation;
  sourceCell?: { shopCode: string; month: string };
}

export default function ShopLoadingTool({
  startMonth,
  months = 6
}: ShopLoadingToolProps) {
  // Data state
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [capacityData, setCapacityData] = useState<ShopMonthlyCapacity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Need Shopping');
  const [selectedAllocations, setSelectedAllocations] = useState<Set<string>>(new Set());
  const [hoveredCell, setHoveredCell] = useState<{ shopCode: string; month: string } | null>(null);
  const [cellDetails, setCellDetails] = useState<{ shopCode: string; month: string; cars: string[] } | null>(null);

  // Shop filter state
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<number | ''>('');
  const [aitxOnly, setAitxOnly] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);

  // Drag state
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ shopCode: string; month: string } | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Calculate date range
  const dateRange = useMemo(() => {
    const start = startMonth
      ? new Date(startMonth + '-01')
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const end = new Date(start);
    end.setMonth(end.getMonth() + months - 1);

    const startStr = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}`;
    const endStr = `${end.getFullYear()}-${(end.getMonth() + 1).toString().padStart(2, '0')}`;

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

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allocData, capData] = await Promise.all([
        listAllocations({ status: statusFilter || undefined }),
        getCapacity(dateRange.startStr, dateRange.endStr)
      ]);
      setAllocations(allocData.allocations || []);
      setCapacityData(capData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [dateRange.startStr, dateRange.endStr, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch filter options
  useEffect(() => {
    fetch(`${API_URL}/shops/regions`)
      .then(r => r.json())
      .then(d => d.success && setRegions(d.data || []))
      .catch(() => {});
  }, []);

  // Group capacity by shop with filters
  const shopCapacity = useMemo(() => {
    const byShop = new Map<string, Map<string, ShopMonthlyCapacity>>();

    for (const cap of capacityData) {
      // Apply AITX filter (shop codes starting with AITX-)
      if (aitxOnly && !cap.shop_code.startsWith('AITX-')) continue;

      if (!byShop.has(cap.shop_code)) {
        byShop.set(cap.shop_code, new Map());
      }
      byShop.get(cap.shop_code)!.set(cap.month, cap);
    }

    return Array.from(byShop.entries())
      .map(([shop_code, months]) => ({ shop_code, months }))
      .sort((a, b) => a.shop_code.localeCompare(b.shop_code));
  }, [capacityData, aitxOnly]);

  // Filter allocations
  const filteredAllocations = useMemo(() => {
    return allocations.filter(a => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!a.car_number?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allocations, searchQuery]);

  // Unassigned allocations (left pane)
  const unassignedAllocations = useMemo(() => {
    return filteredAllocations.filter(a =>
      a.status === 'Need Shopping' || a.status === 'To Be Routed'
    );
  }, [filteredAllocations]);

  // Get allocations for a specific cell
  const getCellAllocations = useCallback((shopCode: string, month: string) => {
    return allocations.filter(a =>
      a.shop_code === shopCode &&
      a.target_month === month &&
      a.status !== 'Need Shopping' &&
      a.status !== 'To Be Routed'
    );
  }, [allocations]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, allocation: Allocation) => {
    setDraggedItem({ allocation });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', allocation.id);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverCell(null);
  };

  const handleDragOver = (e: React.DragEvent, shopCode: string, month: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell({ shopCode, month });
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = async (e: React.DragEvent, shopCode: string, month: string) => {
    e.preventDefault();
    setDragOverCell(null);

    if (!draggedItem) return;

    const allocationIds = selectedAllocations.size > 0 && selectedAllocations.has(draggedItem.allocation.id)
      ? Array.from(selectedAllocations)
      : [draggedItem.allocation.id];

    await assignAllocations(allocationIds, shopCode, month);
    setSelectedAllocations(new Set());
  };

  // Assign allocations to shop
  const assignAllocations = async (allocationIds: string[], shopCode: string, month: string) => {
    setAssigning(true);
    try {
      const token = localStorage.getItem('railsync_access_token');
      const results = await Promise.all(
        allocationIds.map(async (id) => {
          const res = await fetch(`${API_URL}/allocations/${id}/assign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ shop_code: shopCode, target_month: month }),
          });
          return res.json();
        })
      );

      // Refresh data
      await fetchData();

      const successCount = results.filter(r => r.success).length;
      if (successCount < allocationIds.length) {
        setError(`Assigned ${successCount}/${allocationIds.length} cars. Some failed due to capacity.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setAssigning(false);
      setDraggedItem(null);
    }
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedAllocations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all visible
  const selectAll = () => {
    setSelectedAllocations(new Set(unassignedAllocations.map(a => a.id)));
  };

  const clearSelection = () => {
    setSelectedAllocations(new Set());
  };

  // Utility functions
  const getUtilizationClass = (pct: number, isDragOver: boolean) => {
    if (isDragOver) return 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/30';
    if (pct >= 100) return 'bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100 cursor-not-allowed';
    if (pct >= 95) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
    if (pct >= 85) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';
    if (pct >= 70) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  // Fetch cell details on hover
  const handleCellHover = async (shopCode: string, month: string) => {
    setHoveredCell({ shopCode, month });
    const cellAllocs = getCellAllocations(shopCode, month);
    setCellDetails({
      shopCode,
      month,
      cars: cellAllocs.map(a => a.car_number || a.car_mark_number || '?').slice(0, 10)
    });
  };

  const handleCellLeave = () => {
    setHoveredCell(null);
    setCellDetails(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shop Loading Tool</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Drag cars to assign • {shopCapacity.length} shops
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={aitxOnly}
                onChange={(e) => setAitxOnly(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-gray-600 dark:text-gray-400">AITX Network Only</span>
            </label>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane - Unassigned Cars */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800/50">
          {/* Left Header */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                Cars to Assign ({unassignedAllocations.length})
              </span>
              {selectedAllocations.size > 0 && (
                <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                  {selectedAllocations.size} selected
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search cars..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Car List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {unassignedAllocations.map((allocation) => (
              <div
                key={allocation.id}
                draggable
                onDragStart={(e) => handleDragStart(e, allocation)}
                onDragEnd={handleDragEnd}
                onClick={() => toggleSelection(allocation.id)}
                className={`
                  flex items-center gap-2 p-2 rounded-lg cursor-grab active:cursor-grabbing
                  transition-all border
                  ${selectedAllocations.has(allocation.id)
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                  ${draggedItem?.allocation.id === allocation.id ? 'opacity-50' : ''}
                `}
              >
                <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <Car className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate">
                    {allocation.car_number || allocation.car_mark_number?.slice(0, 8) || '-'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {allocation.status}
                  </div>
                </div>
                {selectedAllocations.has(allocation.id) && (
                  <Check className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                )}
              </div>
            ))}
            {unassignedAllocations.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                No cars to assign
              </div>
            )}
          </div>
        </div>

        {/* Right Pane - Capacity Grid */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[100px]">
                  Shop
                </th>
                {dateRange.monthHeaders.map((month) => (
                  <th
                    key={month}
                    className="px-2 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 min-w-[80px]"
                  >
                    {formatMonth(month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shopCapacity.map(({ shop_code, months }) => (
                <tr key={shop_code} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-2 font-medium text-gray-900 dark:text-gray-100 border-r border-b border-gray-200 dark:border-gray-700">
                    {shop_code}
                  </td>
                  {dateRange.monthHeaders.map((month) => {
                    const cap = months.get(month);
                    const isDragOver = dragOverCell?.shopCode === shop_code && dragOverCell?.month === month;
                    const isHovered = hoveredCell?.shopCode === shop_code && hoveredCell?.month === month;
                    const utilizationPct = cap ? cap.utilization_pct : 0;
                    const canDrop = cap && utilizationPct < 100;

                    return (
                      <td
                        key={month}
                        onDragOver={canDrop ? (e) => handleDragOver(e, shop_code, month) : undefined}
                        onDragLeave={handleDragLeave}
                        onDrop={canDrop ? (e) => handleDrop(e, shop_code, month) : undefined}
                        onMouseEnter={() => handleCellHover(shop_code, month)}
                        onMouseLeave={handleCellLeave}
                        className={`
                          relative px-2 py-2 text-center border-b border-gray-200 dark:border-gray-700
                          transition-all cursor-pointer
                          ${cap ? getUtilizationClass(utilizationPct, isDragOver) : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400'}
                        `}
                      >
                        {cap ? (
                          <>
                            <div className="font-medium">
                              {cap.allocated_count}/{cap.total_capacity}
                            </div>
                            <div className="text-[10px] opacity-75">
                              {utilizationPct.toFixed(0)}%
                            </div>
                          </>
                        ) : (
                          '-'
                        )}

                        {/* Hover Tooltip */}
                        {isHovered && cellDetails && cellDetails.cars.length > 0 && (
                          <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1 p-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap">
                            <div className="font-medium mb-1">Assigned Cars:</div>
                            {cellDetails.cars.map((car, i) => (
                              <div key={i} className="font-mono">{car}</div>
                            ))}
                            {getCellAllocations(shop_code, month).length > 10 && (
                              <div className="text-gray-400 mt-1">
                                +{getCellAllocations(shop_code, month).length - 10} more
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {shopCapacity.length === 0 && (
                <tr>
                  <td colSpan={dateRange.monthHeaders.length + 1} className="p-8 text-center text-gray-500">
                    No shop capacity data found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer - Legend */}
      <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs">
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"></span>
            <span className="text-gray-600 dark:text-gray-400">&lt;70%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700"></span>
            <span className="text-gray-600 dark:text-gray-400">70-85%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700"></span>
            <span className="text-gray-600 dark:text-gray-400">85-95%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"></span>
            <span className="text-gray-600 dark:text-gray-400">&gt;95%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/50 border border-red-400 dark:border-red-600"></span>
            <span className="text-gray-600 dark:text-gray-400">Full</span>
          </span>
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          {assigning ? 'Assigning...' : 'Drag cars to assign • Click to multi-select • Hover cells for details'}
        </div>
      </div>
    </div>
  );
}
