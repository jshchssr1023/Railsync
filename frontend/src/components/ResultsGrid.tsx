'use client';

import { useState, useEffect } from 'react';
import { ArrowUpDown, ChevronUp, ChevronDown, RefreshCw, Download, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { EvaluationResult } from '@/types';
import ShopDetailDrawer from './ShopDetailDrawer';
import ShopComparisonModal from './ShopComparisonModal';

interface ResultsGridProps {
  results: EvaluationResult[];
  lastUpdated?: Date;
  onRefresh?: () => void;
  carNumber?: string;
}

type SortField = 'total_cost' | 'hours_backlog' | 'shop_name' | 'en_route_0_6' | 'railroad';
type SortDirection = 'asc' | 'desc';

// LocalStorage keys
const STORAGE_KEYS = {
  sortField: 'railsync_sortField',
  sortDirection: 'railsync_sortDirection',
  showAllColumns: 'railsync_showAllColumns',
  showEligibleOnly: 'railsync_showEligibleOnly',
};

export default function ResultsGrid({ results, lastUpdated, onRefresh, carNumber }: ResultsGridProps) {
  // Initialize state from localStorage
  const [sortField, setSortField] = useState<SortField>('en_route_0_6');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showEligibleOnly, setShowEligibleOnly] = useState(false);
  const [selectedShop, setSelectedShop] = useState<EvaluationResult | null>(null);
  const [compareShops, setCompareShops] = useState<Set<string>>(new Set());
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSortField = localStorage.getItem(STORAGE_KEYS.sortField) as SortField;
      const savedSortDir = localStorage.getItem(STORAGE_KEYS.sortDirection) as SortDirection;
      const savedShowAll = localStorage.getItem(STORAGE_KEYS.showAllColumns);
      const savedEligible = localStorage.getItem(STORAGE_KEYS.showEligibleOnly);

      if (savedSortField) setSortField(savedSortField);
      if (savedSortDir) setSortDirection(savedSortDir);
      if (savedShowAll) setShowAllColumns(savedShowAll === 'true');
      if (savedEligible) setShowEligibleOnly(savedEligible === 'true');
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.sortField, sortField);
      localStorage.setItem(STORAGE_KEYS.sortDirection, sortDirection);
      localStorage.setItem(STORAGE_KEYS.showAllColumns, String(showAllColumns));
      localStorage.setItem(STORAGE_KEYS.showEligibleOnly, String(showEligibleOnly));
    }
  }, [sortField, sortDirection, showAllColumns, showEligibleOnly]);

  const handleShopClick = (result: EvaluationResult) => {
    setSelectedShop(result);
  };

  const handleCompare = (result: EvaluationResult) => {
    const newCompare = new Set(compareShops);
    if (newCompare.has(result.shop.shop_code)) {
      newCompare.delete(result.shop.shop_code);
    } else if (newCompare.size < 3) {
      newCompare.add(result.shop.shop_code);
    }
    setCompareShops(newCompare);
  };

  // Get shops selected for comparison
  const getCompareResults = () => {
    return results.filter((r) => compareShops.has(r.shop.shop_code));
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Shop Name',
      'Shop Code',
      'Railroad',
      'Total Cost',
      'Labor Cost',
      'Material Cost',
      'Abatement Cost',
      'Freight Cost',
      'Preferred',
      'Hours Backlog',
      'Cars Backlog',
      'En Route 0-6',
      'En Route 7-14',
      'Weekly Inbound',
      'Weekly Outbound',
      'Available Hours',
      'Utilization %',
      'At Risk',
      'Eligible',
      'Restriction Code',
    ];

    const rows = sortedResults.map((r) => {
      const cap = getCapacitySummary(r);
      return [
        r.shop.shop_name,
        r.shop.shop_code,
        r.shop.primary_railroad,
        r.cost_breakdown.total_cost,
        r.cost_breakdown.labor_cost,
        r.cost_breakdown.material_cost,
        r.cost_breakdown.abatement_cost,
        r.cost_breakdown.freight_cost,
        r.shop.is_preferred_network ? 'Yes' : 'No',
        r.backlog.hours_backlog,
        r.backlog.cars_backlog,
        r.backlog.cars_en_route_0_6,
        r.backlog.cars_en_route_7_14,
        r.backlog.weekly_inbound,
        r.backlog.weekly_outbound,
        cap.availHours.toFixed(0),
        cap.avgUtil.toFixed(1),
        isAtRisk(r) ? 'Yes' : 'No',
        r.is_eligible ? 'Yes' : 'No',
        r.restriction_code || '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shop_evaluation_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredResults = showEligibleOnly
    ? results.filter((r) => r.is_eligible)
    : results;

  const sortedResults = [...filteredResults].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'total_cost':
        comparison = a.cost_breakdown.total_cost - b.cost_breakdown.total_cost;
        break;
      case 'hours_backlog':
        comparison = a.backlog.hours_backlog - b.backlog.hours_backlog;
        break;
      case 'shop_name':
        comparison = a.shop.shop_name.localeCompare(b.shop.shop_name);
        break;
      case 'en_route_0_6':
        comparison = a.backlog.cars_en_route_0_6 - b.backlog.cars_en_route_0_6;
        break;
      case 'railroad':
        comparison = a.shop.primary_railroad.localeCompare(b.shop.primary_railroad);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRestrictionBadge = (code: string | null | undefined) => {
    if (!code) return null;
    const colors: Record<string, string> = {
      'Y': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      'N': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
      'RC1': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
      'RC2': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
      'RC3': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      'RC4': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[code] || 'bg-gray-100 dark:bg-gray-700'}`}>
        {code}
      </span>
    );
  };

  const getUtilizationColor = (pct: number) => {
    if (pct >= 95) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
    if (pct >= 85) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30';
    if (pct >= 70) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
    return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
  };

  const isAtRisk = (result: EvaluationResult) => {
    // At risk if utilization > 90% or backlog > 100 hours
    const avgUtilization = result.capacity.length > 0
      ? result.capacity.reduce((sum, c) => sum + c.current_utilization_pct, 0) / result.capacity.length
      : 0;
    return avgUtilization > 90 || result.backlog.hours_backlog > 100;
  };

  const getCapacitySummary = (result: EvaluationResult) => {
    if (!result.capacity || result.capacity.length === 0) return { avgUtil: 0, availHours: 0 };
    const avgUtil = result.capacity.reduce((sum, c) => sum + parseFloat(String(c.current_utilization_pct || 0)), 0) / result.capacity.length;
    const availHours = result.capacity.reduce((sum, c) => sum + parseFloat(String(c.available_hours || 0)), 0);
    return { avgUtil, availHours };
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
      );
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-primary-600" aria-hidden="true" />
    ) : (
      <ChevronDown className="w-4 h-4 text-primary-600" aria-hidden="true" />
    );
  };

  return (
    <div>
      {/* Filter Controls */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showEligibleOnly}
              onChange={(e) => setShowEligibleOnly(e.target.checked)}
              className="h-4 w-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 bg-white dark:bg-gray-700"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Eligible only</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllColumns}
              onChange={(e) => setShowAllColumns(e.target.checked)}
              className="h-4 w-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 bg-white dark:bg-gray-700"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Show all columns</span>
          </label>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Refresh
            </button>
          )}
          <button
            onClick={exportToCSV}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export CSV
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {sortedResults.length} of {results.length} shops
          </span>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="table min-w-full">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('shop_name')}>
                <div className="flex items-center space-x-1">
                  <span>Shop</span>
                  <SortIcon field="shop_name" />
                </div>
              </th>
              <th className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('railroad')}>
                <div className="flex items-center space-x-1">
                  <span>Railroad</span>
                  <SortIcon field="railroad" />
                </div>
              </th>
              <th className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total_cost')}>
                <div className="flex items-center space-x-1">
                  <span>Total $</span>
                  <SortIcon field="total_cost" />
                </div>
              </th>
              <th>Preferred</th>
              <th className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('hours_backlog')}>
                <div className="flex items-center space-x-1">
                  <span>Hours BL</span>
                  <SortIcon field="hours_backlog" />
                </div>
              </th>
              <th className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('en_route_0_6')}>
                <div className="flex items-center space-x-1">
                  <span>0-6 Days</span>
                  <SortIcon field="en_route_0_6" />
                </div>
              </th>
              {/* Capacity Preview Columns */}
              <th className="bg-purple-50 dark:bg-purple-900/30">
                <div className="flex items-center space-x-1">
                  <span>Avail Hrs</span>
                </div>
              </th>
              <th className="bg-purple-50 dark:bg-purple-900/30">
                <div className="flex items-center space-x-1">
                  <span>% Util</span>
                </div>
              </th>
              <th className="bg-purple-50 dark:bg-purple-900/30">Risk</th>
              <th>RC Code</th>

              {/* Expandable Cost Breakdown */}
              {showAllColumns && (
                <>
                  <th className="bg-blue-50">Labor $</th>
                  <th className="bg-blue-50">Material $</th>
                  <th className="bg-blue-50">Abate $</th>
                  <th className="bg-blue-50">Freight $</th>
                </>
              )}

              {/* Expandable Capacity */}
              {showAllColumns && (
                <>
                  <th className="bg-green-50">Cars BL</th>
                  <th className="bg-green-50">7-14 Days</th>
                  <th className="bg-green-50">Week IB</th>
                  <th className="bg-green-50">Week OB</th>
                </>
              )}

              <th>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedResults.map((result) => (
              <tr
                key={result.shop.shop_code}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  !result.is_eligible ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400' : ''
                } ${compareShops.has(result.shop.shop_code) ? 'ring-2 ring-primary-500 ring-inset' : ''}`}
                onClick={() => handleShopClick(result)}
              >
                <td>
                  {compareShops.has(result.shop.shop_code) ? (
                    <span className="text-primary-600 font-bold text-xs">C</span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  )}
                </td>
                <td>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{result.shop.shop_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{result.shop.shop_code}</div>
                  </div>
                </td>
                <td>{result.shop.primary_railroad}</td>
                <td className="font-medium">{formatCurrency(result.cost_breakdown.total_cost)}</td>
                <td>
                  {result.shop.is_preferred_network ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td>{Number(result.backlog.hours_backlog || 0).toFixed(0)}</td>
                <td>
                  <span className={result.backlog.cars_en_route_0_6 > 5 ? 'text-orange-600 font-medium' : ''}>
                    {result.backlog.cars_en_route_0_6}
                  </span>
                </td>
                {/* Capacity Preview Columns */}
                <td className="bg-purple-50/50 dark:bg-purple-900/20">
                  {getCapacitySummary(result).availHours.toFixed(0)}
                </td>
                <td className={`${getUtilizationColor(getCapacitySummary(result).avgUtil)} px-2 py-1 rounded text-center font-medium`}>
                  {getCapacitySummary(result).avgUtil.toFixed(0)}%
                </td>
                <td className="bg-purple-50/50 dark:bg-purple-900/20 text-center">
                  {isAtRisk(result) ? (
                    <span className="text-red-500" title="At Risk: High utilization or backlog">
                      <AlertTriangle className="w-5 h-5 inline" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="text-green-500" title="Capacity OK">
                      <CheckCircle className="w-5 h-5 inline" aria-hidden="true" />
                    </span>
                  )}
                </td>
                <td>{getRestrictionBadge(result.restriction_code)}</td>

                {/* Expandable Cost Breakdown */}
                {showAllColumns && (
                  <>
                    <td className="bg-blue-50/50">{formatCurrency(result.cost_breakdown.labor_cost)}</td>
                    <td className="bg-blue-50/50">{formatCurrency(result.cost_breakdown.material_cost)}</td>
                    <td className="bg-blue-50/50">{formatCurrency(result.cost_breakdown.abatement_cost)}</td>
                    <td className="bg-blue-50/50">{formatCurrency(result.cost_breakdown.freight_cost)}</td>
                  </>
                )}

                {/* Expandable Capacity */}
                {showAllColumns && (
                  <>
                    <td className="bg-green-50/50">{result.backlog.cars_backlog}</td>
                    <td className="bg-green-50/50">{result.backlog.cars_en_route_7_14}</td>
                    <td className="bg-green-50/50">{result.backlog.weekly_inbound}</td>
                    <td className="bg-green-50/50">{result.backlog.weekly_outbound}</td>
                  </>
                )}

                <td>
                  {result.is_eligible ? (
                    <span className="badge badge-success">Eligible</span>
                  ) : (
                    <span className="badge badge-danger">Ineligible</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedResults.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No shops match the current filters
        </div>
      )}

      {/* Compare indicator */}
      {compareShops.size > 0 && (
        <div className="px-4 py-2 bg-primary-50 border-t border-primary-200 flex items-center justify-between">
          <span className="text-sm text-primary-700">
            {compareShops.size} shop{compareShops.size > 1 ? 's' : ''} selected for comparison
          </span>
          <div className="flex items-center gap-3">
            {compareShops.size >= 2 && (
              <button
                onClick={() => setShowCompareModal(true)}
                className="text-sm bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700"
              >
                Compare Now
              </button>
            )}
            <button
              onClick={() => setCompareShops(new Set())}
              className="text-sm text-primary-600 hover:text-primary-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {showCompareModal && (
        <ShopComparisonModal
          shops={getCompareResults()}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {/* Shop Detail Drawer */}
      <ShopDetailDrawer
        shop={selectedShop}
        isOpen={selectedShop !== null}
        onClose={() => setSelectedShop(null)}
        onCompare={handleCompare}
        isComparing={selectedShop ? compareShops.has(selectedShop.shop.shop_code) : false}
        carNumber={carNumber}
        onAssign={onRefresh}
      />
    </div>
  );
}
