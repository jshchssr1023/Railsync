'use client';

import { EvaluationResult } from '@/types';

interface ShopComparisonModalProps {
  shops: EvaluationResult[];
  onClose: () => void;
}

export default function ShopComparisonModal({ shops, onClose }: ShopComparisonModalProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Find best/worst values for highlighting
  const getValueClass = (values: number[], current: number, lowerIsBetter: boolean) => {
    const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
    const worst = lowerIsBetter ? Math.max(...values) : Math.min(...values);
    if (current === best) return 'text-green-600 font-semibold';
    if (current === worst && values.length > 2) return 'text-red-600';
    return '';
  };

  const costValues = shops.map((s) => s.cost_breakdown.total_cost);
  const backlogValues = shops.map((s) => s.backlog.hours_backlog);
  const enRouteValues = shops.map((s) => s.backlog.cars_en_route_0_6);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Shop Comparison</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
            <div className={`grid gap-6 ${shops.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {shops.map((shop) => (
                <div key={shop.shop.shop_code} className="border rounded-lg overflow-hidden">
                  {/* Shop Header */}
                  <div className={`p-4 ${shop.is_eligible ? 'bg-green-50' : 'bg-red-50'}`}>
                    <h3 className="font-bold text-lg">{shop.shop.shop_name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{shop.shop.shop_code}</span>
                      <span>|</span>
                      <span>{shop.shop.primary_railroad}</span>
                      {shop.shop.is_preferred_network && (
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
                          Preferred
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      {shop.is_eligible ? (
                        <span className="text-green-700 text-sm font-medium">Eligible</span>
                      ) : (
                        <span className="text-red-700 text-sm font-medium">Not Eligible</span>
                      )}
                    </div>
                  </div>

                  {/* Cost Section */}
                  <div className="p-4 border-b">
                    <h4 className="font-semibold text-gray-700 mb-3">Cost Breakdown</h4>
                    <div className={`text-2xl font-bold mb-3 ${getValueClass(costValues, shop.cost_breakdown.total_cost, true)}`}>
                      {formatCurrency(shop.cost_breakdown.total_cost)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Labor</span>
                        <span>{formatCurrency(shop.cost_breakdown.labor_cost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Material</span>
                        <span>{formatCurrency(shop.cost_breakdown.material_cost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Abatement</span>
                        <span>{formatCurrency(shop.cost_breakdown.abatement_cost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Freight</span>
                        <span>{formatCurrency(shop.cost_breakdown.freight_cost)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Capacity Section */}
                  <div className="p-4 border-b">
                    <h4 className="font-semibold text-gray-700 mb-3">Capacity</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className={`text-xl font-bold ${getValueClass(backlogValues, shop.backlog.hours_backlog, true)}`}>
                          {Number(shop.backlog.hours_backlog || 0).toFixed(0)}
                        </div>
                        <div className="text-xs text-gray-500">Hours Backlog</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xl font-bold">{shop.backlog.cars_backlog}</div>
                        <div className="text-xs text-gray-500">Cars Backlog</div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className={`text-xl font-bold ${getValueClass(enRouteValues, shop.backlog.cars_en_route_0_6, true)}`}>
                          {shop.backlog.cars_en_route_0_6}
                        </div>
                        <div className="text-xs text-gray-500">En Route 0-6</div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="text-xl font-bold">{shop.backlog.cars_en_route_7_14}</div>
                        <div className="text-xs text-gray-500">En Route 7-14</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Weekly In</span>
                        <span className="font-medium text-blue-600">{shop.backlog.weekly_inbound}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Weekly Out</span>
                        <span className="font-medium text-green-600">{shop.backlog.weekly_outbound}</span>
                      </div>
                    </div>
                  </div>

                  {/* Hours by Type */}
                  {shop.hours_by_type && (
                    <div className="p-4 border-b">
                      <h4 className="font-semibold text-gray-700 mb-3">Est. Hours by Type</h4>
                      <div className="space-y-1 text-sm">
                        {Object.entries(shop.hours_by_type).map(([type, hours]) => (
                          hours > 0 && (
                            <div key={type} className="flex justify-between">
                              <span className="text-gray-500 capitalize">{type}</span>
                              <span>{hours}h</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rules Summary */}
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Rules Summary</h4>
                    {shop.rules ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-600">Passed</span>
                          <span className="font-medium">{shop.rules.filter((r) => r.result === 1).length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-600">Failed</span>
                          <span className="font-medium">{shop.rules.filter((r) => r.result === 0).length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">N/A</span>
                          <span className="font-medium">{shop.rules.filter((r) => r.result === 'NA').length}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm">
                        {shop.failed_rules.length > 0 ? (
                          <div className="text-red-600">
                            {shop.failed_rules.length} rule(s) failed
                          </div>
                        ) : (
                          <div className="text-green-600">All rules passed</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span>Best value</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span>Worst value</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
