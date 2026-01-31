'use client';

import { useState } from 'react';
import { EvaluationResult, RuleEvaluation } from '@/types';

interface ResultsGridProps {
  results: EvaluationResult[];
  lastUpdated?: Date;
  onRefresh?: () => void;
}

type SortField = 'total_cost' | 'hours_backlog' | 'shop_name' | 'en_route_0_6' | 'railroad';
type SortDirection = 'asc' | 'desc';

// Column group definitions
const COLUMN_GROUPS = {
  cost: { label: 'Cost Breakdown', columns: ['labor', 'material', 'abatement', 'freight'] },
  capacity: { label: 'Capacity', columns: ['cars_backlog', 'en_route_7_14', 'weekly_ib', 'weekly_ob'] },
  hours: { label: 'Hours by Type', columns: ['cleaning', 'flare', 'mechanical', 'blast', 'lining', 'paint'] },
};

export default function ResultsGrid({ results, lastUpdated, onRefresh }: ResultsGridProps) {
  const [sortField, setSortField] = useState<SortField>('en_route_0_6');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showEligibleOnly, setShowEligibleOnly] = useState(false);
  const [expandedShop, setExpandedShop] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAllColumns, setShowAllColumns] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleColumnGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
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
      'Y': 'bg-green-100 text-green-800',
      'N': 'bg-red-100 text-red-800',
      'RC1': 'bg-yellow-100 text-yellow-800',
      'RC2': 'bg-orange-100 text-orange-800',
      'RC3': 'bg-purple-100 text-purple-800',
      'RC4': 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[code] || 'bg-gray-100'}`}>
        {code}
      </span>
    );
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const RulesBreakdown = ({ rules, failedRules }: { rules?: RuleEvaluation[]; failedRules: EvaluationResult['failed_rules'] }) => {
    if (!rules || rules.length === 0) {
      // Fallback to old failed_rules display
      return (
        <div>
          {failedRules.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {failedRules.map((rule) => (
                <li key={rule.rule_id} className="bg-red-50 text-red-700 px-3 py-2 rounded">
                  <div className="font-medium">{rule.rule_name}</div>
                  <div className="text-xs">{rule.reason}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-700">All eligibility criteria met</p>
          )}
        </div>
      );
    }

    // Group rules by category
    const groupedRules: Record<string, RuleEvaluation[]> = {};
    rules.forEach((rule) => {
      const category = rule.rule.split(' ')[0] || 'Other';
      if (!groupedRules[category]) groupedRules[category] = [];
      groupedRules[category].push(rule);
    });

    return (
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Object.entries(groupedRules).map(([category, categoryRules]) => (
          <div key={category}>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{category}</h5>
            <div className="space-y-1">
              {categoryRules.map((rule, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
                  <span className="text-gray-700">{rule.rule}</span>
                  <div className="flex items-center gap-2">
                    {rule.result === 1 && (
                      <span className="text-green-600 font-medium">✓ Pass</span>
                    )}
                    {rule.result === 0 && (
                      <span className="text-red-600 font-medium">✗ Fail</span>
                    )}
                    {rule.result === 'NA' && (
                      <span className="text-gray-400 font-medium">— N/A</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Filter Controls */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showEligibleOnly}
              onChange={(e) => setShowEligibleOnly(e.target.checked)}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Eligible only</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllColumns}
              onChange={(e) => setShowAllColumns(e.target.checked)}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Show all columns</span>
          </label>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
          <span className="text-sm text-gray-500">
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
              <>
                <tr
                  key={result.shop.shop_code}
                  className={`cursor-pointer hover:bg-gray-50 ${
                    !result.is_eligible ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  onClick={() =>
                    setExpandedShop(
                      expandedShop === result.shop.shop_code ? null : result.shop.shop_code
                    )
                  }
                >
                  <td>
                    <svg
                      className={`w-4 h-4 transition-transform ${
                        expandedShop === result.shop.shop_code ? 'transform rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                  <td>
                    <div>
                      <div className="font-medium">{result.shop.shop_name}</div>
                      <div className="text-xs text-gray-500">{result.shop.shop_code}</div>
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
                  <td>{result.backlog.hours_backlog.toFixed(0)}</td>
                  <td>
                    <span className={result.backlog.cars_en_route_0_6 > 5 ? 'text-orange-600 font-medium' : ''}>
                      {result.backlog.cars_en_route_0_6}
                    </span>
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

                {/* Expanded Details Row */}
                {expandedShop === result.shop.shop_code && (
                  <tr className="bg-gray-50">
                    <td colSpan={showAllColumns ? 18 : 9} className="px-8 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Cost Breakdown */}
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                          <h4 className="font-medium text-gray-900 mb-3">Cost Breakdown</h4>
                          <dl className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Labor</dt>
                              <dd className="font-medium">{formatCurrency(result.cost_breakdown.labor_cost)}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Materials</dt>
                              <dd className="font-medium">{formatCurrency(result.cost_breakdown.material_cost)}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Abatement</dt>
                              <dd className="font-medium">{formatCurrency(result.cost_breakdown.abatement_cost)}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Freight</dt>
                              <dd className="font-medium">{formatCurrency(result.cost_breakdown.freight_cost)}</dd>
                            </div>
                            <div className="flex justify-between pt-2 border-t font-semibold">
                              <dt>Total</dt>
                              <dd>{formatCurrency(result.cost_breakdown.total_cost)}</dd>
                            </div>
                          </dl>
                        </div>

                        {/* Capacity & Hours */}
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                          <h4 className="font-medium text-gray-900 mb-3">Capacity & Throughput</h4>
                          <dl className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Hours Backlog</dt>
                              <dd className="font-medium">{result.backlog.hours_backlog.toFixed(0)} hrs</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Cars Backlog</dt>
                              <dd className="font-medium">{result.backlog.cars_backlog}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">En Route 0-6 Days</dt>
                              <dd className="font-medium">{result.backlog.cars_en_route_0_6}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">En Route 7-14 Days</dt>
                              <dd className="font-medium">{result.backlog.cars_en_route_7_14}</dd>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                              <dt className="text-gray-500">Weekly Inbound</dt>
                              <dd className="font-medium text-blue-600">{result.backlog.weekly_inbound}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Weekly Outbound</dt>
                              <dd className="font-medium text-green-600">{result.backlog.weekly_outbound}</dd>
                            </div>
                          </dl>

                          {/* Hours by Type */}
                          {result.hours_by_type && (
                            <div className="mt-4 pt-4 border-t">
                              <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Est. Hours by Type</h5>
                              <div className="grid grid-cols-2 gap-1 text-xs">
                                {Object.entries(result.hours_by_type).map(([type, hours]) => (
                                  hours > 0 && (
                                    <div key={type} className="flex justify-between">
                                      <span className="text-gray-500 capitalize">{type}</span>
                                      <span className="font-medium">{hours}h</span>
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Rules Evaluation */}
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                          <h4 className="font-medium text-gray-900 mb-3">
                            Rules Evaluation
                            {result.restriction_code && (
                              <span className="ml-2">{getRestrictionBadge(result.restriction_code)}</span>
                            )}
                          </h4>
                          <RulesBreakdown rules={result.rules} failedRules={result.failed_rules} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {sortedResults.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No shops match the current filters
        </div>
      )}
    </div>
  );
}
