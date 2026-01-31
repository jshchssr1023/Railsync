'use client';

import { useState } from 'react';
import { EvaluationResult } from '@/types';

interface ResultsGridProps {
  results: EvaluationResult[];
}

type SortField = 'total_cost' | 'hours_backlog' | 'shop_name';
type SortDirection = 'asc' | 'desc';

export default function ResultsGrid({ results }: ResultsGridProps) {
  const [sortField, setSortField] = useState<SortField>('total_cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showEligibleOnly, setShowEligibleOnly] = useState(false);
  const [expandedShop, setExpandedShop] = useState<string | null>(null);

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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg
        className="w-4 h-4 text-primary-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 text-primary-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  return (
    <div>
      {/* Filter Controls */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showEligibleOnly}
            onChange={(e) => setShowEligibleOnly(e.target.checked)}
            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">Show eligible shops only</span>
        </label>
        <span className="text-sm text-gray-500">
          Showing {sortedResults.length} of {results.length} shops
        </span>
      </div>

      {/* Results Table */}
      <table className="table">
        <thead>
          <tr>
            <th className="w-8"></th>
            <th
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('shop_name')}
            >
              <div className="flex items-center space-x-1">
                <span>Shop</span>
                <SortIcon field="shop_name" />
              </div>
            </th>
            <th>Railroad</th>
            <th>Region</th>
            <th
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('total_cost')}
            >
              <div className="flex items-center space-x-1">
                <span>Total Cost</span>
                <SortIcon field="total_cost" />
              </div>
            </th>
            <th
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('hours_backlog')}
            >
              <div className="flex items-center space-x-1">
                <span>Backlog</span>
                <SortIcon field="hours_backlog" />
              </div>
            </th>
            <th>En Route</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedResults.map((result) => (
            <>
              <tr
                key={result.shop.shop_code}
                className={`cursor-pointer ${
                  !result.is_eligible ? 'bg-gray-50 text-gray-500' : ''
                }`}
                onClick={() =>
                  setExpandedShop(
                    expandedShop === result.shop.shop_code
                      ? null
                      : result.shop.shop_code
                  )
                }
              >
                <td>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      expandedShop === result.shop.shop_code
                        ? 'transform rotate-90'
                        : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </td>
                <td>
                  <div>
                    <div className="font-medium">{result.shop.shop_name}</div>
                    <div className="text-xs text-gray-500">
                      {result.shop.shop_code}
                    </div>
                  </div>
                </td>
                <td>{result.shop.primary_railroad}</td>
                <td>{result.shop.region}</td>
                <td className="font-medium">
                  {formatCurrency(result.cost_breakdown.total_cost)}
                </td>
                <td>
                  <div>
                    <div>{result.backlog.hours_backlog.toFixed(0)} hrs</div>
                    <div className="text-xs text-gray-500">
                      {result.backlog.cars_backlog} cars
                    </div>
                  </div>
                </td>
                <td>
                  <div className="text-xs">
                    <div>0-6d: {result.backlog.cars_en_route_0_6}</div>
                    <div>7-14d: {result.backlog.cars_en_route_7_14}</div>
                  </div>
                </td>
                <td>
                  {result.is_eligible ? (
                    <span className="badge badge-success">Eligible</span>
                  ) : (
                    <span className="badge badge-danger">Ineligible</span>
                  )}
                  {result.shop.is_preferred_network && (
                    <span className="badge badge-info ml-1">Preferred</span>
                  )}
                </td>
              </tr>

              {/* Expanded Details Row */}
              {expandedShop === result.shop.shop_code && (
                <tr className="bg-gray-50">
                  <td colSpan={8} className="px-8 py-4">
                    <div className="grid grid-cols-3 gap-6">
                      {/* Cost Breakdown */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          Cost Breakdown
                        </h4>
                        <dl className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Labor</dt>
                            <dd>
                              {formatCurrency(result.cost_breakdown.labor_cost)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Materials</dt>
                            <dd>
                              {formatCurrency(result.cost_breakdown.material_cost)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Abatement</dt>
                            <dd>
                              {formatCurrency(result.cost_breakdown.abatement_cost)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Freight</dt>
                            <dd>
                              {formatCurrency(result.cost_breakdown.freight_cost)}
                            </dd>
                          </div>
                          <div className="flex justify-between font-medium pt-1 border-t">
                            <dt>Total</dt>
                            <dd>
                              {formatCurrency(result.cost_breakdown.total_cost)}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* Capacity by Work Type */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          Capacity
                        </h4>
                        {result.capacity.length > 0 ? (
                          <dl className="space-y-1 text-sm">
                            {result.capacity.map((cap) => (
                              <div
                                key={cap.work_type}
                                className="flex justify-between"
                              >
                                <dt className="text-gray-500 capitalize">
                                  {cap.work_type}
                                </dt>
                                <dd>
                                  {cap.current_utilization_pct.toFixed(0)}% used
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="text-sm text-gray-500">
                            No capacity data available
                          </p>
                        )}
                      </div>

                      {/* Failed Rules */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          {result.is_eligible
                            ? 'Passed All Rules'
                            : 'Failed Rules'}
                        </h4>
                        {result.failed_rules.length > 0 ? (
                          <ul className="space-y-2 text-sm">
                            {result.failed_rules.map((rule) => (
                              <li
                                key={rule.rule_id}
                                className="bg-danger-50 text-danger-700 px-3 py-2 rounded"
                              >
                                <div className="font-medium">{rule.rule_name}</div>
                                <div className="text-xs">{rule.reason}</div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-success-700">
                            All eligibility criteria met
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {sortedResults.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No shops match the current filters
        </div>
      )}
    </div>
  );
}
