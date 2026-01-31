'use client';

import { EvaluationResult, RuleEvaluation } from '@/types';

interface ShopDetailDrawerProps {
  shop: EvaluationResult | null;
  isOpen: boolean;
  onClose: () => void;
  onCompare?: (shop: EvaluationResult) => void;
  isComparing?: boolean;
}

export default function ShopDetailDrawer({
  shop,
  isOpen,
  onClose,
  onCompare,
  isComparing = false,
}: ShopDetailDrawerProps) {
  if (!shop) return null;

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
      Y: 'bg-green-100 text-green-800',
      N: 'bg-red-100 text-red-800',
      RC1: 'bg-yellow-100 text-yellow-800',
      RC2: 'bg-orange-100 text-orange-800',
      RC3: 'bg-purple-100 text-purple-800',
      RC4: 'bg-blue-100 text-blue-800',
    };
    return (
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded ${colors[code] || 'bg-gray-100'}`}
      >
        {code}
      </span>
    );
  };

  // Cost breakdown data for bar chart
  const costData = [
    { label: 'Labor', value: shop.cost_breakdown.labor_cost, color: 'bg-blue-500' },
    { label: 'Material', value: shop.cost_breakdown.material_cost, color: 'bg-green-500' },
    { label: 'Abatement', value: shop.cost_breakdown.abatement_cost, color: 'bg-orange-500' },
    { label: 'Freight', value: shop.cost_breakdown.freight_cost, color: 'bg-purple-500' },
  ];
  const maxCost = Math.max(...costData.map((d) => d.value), 1);

  // Hours by type data for bar chart
  const hoursData = shop.hours_by_type
    ? [
        { label: 'Cleaning', value: shop.hours_by_type.cleaning, color: 'bg-cyan-500' },
        { label: 'Flare', value: shop.hours_by_type.flare, color: 'bg-red-500' },
        { label: 'Mechanical', value: shop.hours_by_type.mechanical, color: 'bg-yellow-500' },
        { label: 'Blast', value: shop.hours_by_type.blast, color: 'bg-gray-500' },
        { label: 'Lining', value: shop.hours_by_type.lining, color: 'bg-indigo-500' },
        { label: 'Paint', value: shop.hours_by_type.paint, color: 'bg-pink-500' },
        { label: 'Other', value: shop.hours_by_type.other, color: 'bg-slate-500' },
      ].filter((d) => d.value > 0)
    : [];
  const maxHours = Math.max(...hoursData.map((d) => d.value), 1);

  // Group rules by category
  const groupedRules: Record<string, RuleEvaluation[]> = {};
  if (shop.rules) {
    shop.rules.forEach((rule) => {
      // Extract category from rule name (e.g., "TankCar" -> "Car Type", "HighBakeLining" -> "Lining")
      let category = 'Other';
      if (rule.rule.includes('Car') || rule.rule.includes('Tank') || rule.rule.includes('Hopper')) {
        category = 'Car Type';
      } else if (rule.rule.includes('Material') || rule.rule.includes('Aluminum') || rule.rule.includes('Stainless')) {
        category = 'Material';
      } else if (rule.rule.includes('Lining') || rule.rule.includes('Bake') || rule.rule.includes('Plasite') || rule.rule.includes('Rubber') || rule.rule.includes('Vinyl') || rule.rule.includes('Epoxy')) {
        category = 'Lining';
      } else if (rule.rule.includes('Blast') || rule.rule.includes('Paint')) {
        category = 'Blast/Paint';
      } else if (rule.rule.includes('HM201') || rule.rule.includes('AAR') || rule.rule.includes('DOT') || rule.rule.includes('Compliance')) {
        category = 'Compliance';
      } else if (rule.rule.includes('Asbestos') || rule.rule.includes('Kosher') || rule.rule.includes('Nitrogen') || rule.rule.includes('Network')) {
        category = 'Special';
      }
      if (!groupedRules[category]) groupedRules[category] = [];
      groupedRules[category].push(rule);
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{shop.shop.shop_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">{shop.shop.shop_code}</span>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">{shop.shop.primary_railroad}</span>
              {shop.shop.is_preferred_network && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                  Preferred
                </span>
              )}
              {shop.restriction_code && getRestrictionBadge(shop.restriction_code)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-140px)] px-6 py-4 space-y-6">
          {/* Eligibility Status */}
          <div
            className={`p-4 rounded-lg ${
              shop.is_eligible ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {shop.is_eligible ? (
                <>
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium text-green-800">Eligible for Service</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="font-medium text-red-800">Not Eligible</span>
                </>
              )}
            </div>
            {!shop.is_eligible && shop.failed_rules.length > 0 && (
              <div className="mt-2 text-sm text-red-700">
                Failed: {shop.failed_rules.map((r) => r.rule_name).join(', ')}
              </div>
            )}
          </div>

          {/* Cost Breakdown Card */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Cost Breakdown</h3>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(shop.cost_breakdown.total_cost)}
              </span>
            </div>
            <div className="space-y-3">
              {costData.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${(item.value / maxCost) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Capacity Metrics Card */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Capacity Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {shop.backlog.hours_backlog.toFixed(0)}
                </div>
                <div className="text-xs text-gray-500">Hours Backlog</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{shop.backlog.cars_backlog}</div>
                <div className="text-xs text-gray-500">Cars Backlog</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {shop.backlog.cars_en_route_0_6}
                </div>
                <div className="text-xs text-gray-500">En Route 0-6 Days</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {shop.backlog.cars_en_route_7_14}
                </div>
                <div className="text-xs text-gray-500">En Route 7-14 Days</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {shop.backlog.weekly_inbound}
                </div>
                <div className="text-xs text-gray-500">Weekly Inbound</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {shop.backlog.weekly_outbound}
                </div>
                <div className="text-xs text-gray-500">Weekly Outbound</div>
              </div>
            </div>
          </div>

          {/* Hours by Work Type */}
          {hoursData.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Estimated Hours by Work Type</h3>
              <div className="space-y-3">
                {hoursData.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium">{item.value}h</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${(item.value / maxHours) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rules Evaluation */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Rules Evaluation</h3>
            {Object.keys(groupedRules).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedRules).map(([category, rules]) => (
                  <div key={category}>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {category}
                    </h4>
                    <div className="space-y-1">
                      {rules.map((rule, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between text-sm py-2 px-3 rounded ${
                            rule.result === 0 ? 'bg-red-50' : rule.result === 1 ? 'bg-green-50' : 'bg-gray-50'
                          }`}
                        >
                          <span className="text-gray-700">{rule.rule}</span>
                          <div className="flex items-center gap-2">
                            {rule.result === 1 && (
                              <span className="text-green-600 font-medium flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Pass
                              </span>
                            )}
                            {rule.result === 0 && (
                              <span className="text-red-600 font-medium flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Fail
                              </span>
                            )}
                            {rule.result === 'NA' && (
                              <span className="text-gray-400 font-medium">N/A</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : shop.failed_rules.length > 0 ? (
              <div className="space-y-2">
                {shop.failed_rules.map((rule) => (
                  <div key={rule.rule_id} className="bg-red-50 text-red-700 px-3 py-2 rounded">
                    <div className="font-medium">{rule.rule_name}</div>
                    <div className="text-xs">{rule.reason}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-700">All eligibility criteria met</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between">
          {onCompare && (
            <button
              onClick={() => onCompare(shop)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isComparing
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isComparing ? 'Remove from Compare' : 'Add to Compare'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
