'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { DollarSign, FileText, AlertTriangle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface ShoppingType {
  id: number;
  code: string;
  name: string;
  description: string;
  is_planned: boolean;
  default_cost_owner: 'lessor' | 'lessee';
  tier_preference: number;
  sort_order: number;
  estimated_cost: number;
  customer_billable: boolean;
  project_required: boolean;
}

export interface ShoppingReason {
  id: number;
  shopping_type_id: number;
  code: string;
  name: string;
  sort_order: number;
}

export interface SelectedShoppingType {
  shopping_type: ShoppingType;
  shopping_reason?: ShoppingReason;
  is_selected: boolean;
  allocate_to_customer: boolean;
  override_cost?: number;
  project_number?: string;
}

interface ShoppingTypeSummary {
  total_selected: number;
  lessor_cost: number;
  customer_cost: number;
  total_cost: number;
}

interface ServiceOptionsSelectorProps {
  carNumber: string;
  onChange?: (selections: SelectedShoppingType[]) => void;
  className?: string;
}

export default function ServiceOptionsSelector({
  carNumber,
  onChange,
  className = '',
}: ServiceOptionsSelectorProps) {
  const [shoppingTypes, setShoppingTypes] = useState<ShoppingType[]>([]);
  const [reasons, setReasons] = useState<Record<number, ShoppingReason[]>>({});
  const [selections, setSelections] = useState<Record<string, SelectedShoppingType>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch shopping types on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [typesRes, reasonsRes] = await Promise.all([
          fetch(`${API_URL}/shopping-types`),
          fetch(`${API_URL}/shopping-reasons`),
        ]);

        if (cancelled) return;

        if (!typesRes.ok || !reasonsRes.ok) {
          throw new Error('Failed to fetch shopping types');
        }

        const typesJson = await typesRes.json();
        const reasonsJson = await reasonsRes.json();

        if (!cancelled) {
          const types = typesJson.data || [];
          setShoppingTypes(types);

          // Group reasons by shopping_type_id
          const reasonsByType: Record<number, ShoppingReason[]> = {};
          (reasonsJson.data || []).forEach((r: ShoppingReason) => {
            if (!reasonsByType[r.shopping_type_id]) {
              reasonsByType[r.shopping_type_id] = [];
            }
            reasonsByType[r.shopping_type_id].push(r);
          });
          setReasons(reasonsByType);

          // Initialize selections
          const initial: Record<string, SelectedShoppingType> = {};
          types.forEach((t: ShoppingType) => {
            initial[t.code] = {
              shopping_type: t,
              is_selected: false,
              allocate_to_customer: t.customer_billable,
            };
          });
          setSelections(initial);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load shopping types');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Notify parent of selection changes
  useEffect(() => {
    if (onChange) {
      const selected = Object.values(selections).filter(s => s.is_selected);
      onChange(selected);
    }
  }, [selections, onChange]);

  const toggleSelection = useCallback((code: string) => {
    setSelections(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        is_selected: !prev[code].is_selected,
      },
    }));
  }, []);

  const toggleCustomerAllocation = useCallback((code: string) => {
    setSelections(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        allocate_to_customer: !prev[code].allocate_to_customer,
      },
    }));
  }, []);

  const setReason = useCallback((code: string, reason: ShoppingReason | undefined) => {
    setSelections(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        shopping_reason: reason,
      },
    }));
  }, []);

  const setProjectNumber = useCallback((code: string, projectNumber: string) => {
    setSelections(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        project_number: projectNumber,
      },
    }));
  }, []);

  const setOverrideCost = useCallback((code: string, cost: number | undefined) => {
    setSelections(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        override_cost: cost,
      },
    }));
  }, []);

  // Calculate summary
  const summary = useMemo<ShoppingTypeSummary>(() => {
    const selected = Object.values(selections).filter(s => s.is_selected);
    let lessorCost = 0;
    let customerCost = 0;

    selected.forEach(s => {
      const cost = s.override_cost ?? s.shopping_type.estimated_cost;
      if (s.allocate_to_customer) {
        customerCost += cost;
      } else {
        lessorCost += cost;
      }
    });

    return {
      total_selected: selected.length,
      lessor_cost: lessorCost,
      customer_cost: customerCost,
      total_cost: lessorCost + customerCost,
    };
  }, [selections]);

  if (loading) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg ${className}`}>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shopping Types</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select work to be performed. Check &quot;Bill Customer&quot; to allocate cost.
        </p>
      </div>

      {/* Shopping Types Grid */}
      <div className="space-y-3">
        {shoppingTypes.map((type) => {
          const sel = selections[type.code];
          if (!sel) return null;
          const typeReasons = reasons[type.id] || [];
          const effectiveCost = sel.override_cost ?? type.estimated_cost;

          return (
            <div
              key={type.code}
              className={`border rounded-lg transition-colors ${
                sel.is_selected
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="p-3">
                <div className="flex items-start gap-3">
                  {/* Selection Checkbox */}
                  <div className="flex items-center h-5 mt-0.5">
                    <input
                      type="checkbox"
                      checked={sel.is_selected}
                      onChange={() => toggleSelection(type.code)}
                      className="h-4 w-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                    />
                  </div>

                  {/* Type Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{type.name}</span>
                      {type.project_required && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Project #
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        type.default_cost_owner === 'lessee'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        Default: {type.default_cost_owner === 'lessee' ? 'Customer' : 'Owner'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{type.description}</p>
                  </div>

                  {/* Cost Display */}
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      ${effectiveCost.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Expanded Options when Selected */}
                {sel.is_selected && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Shopping Reason Dropdown */}
                      {typeReasons.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Shopping Reason
                          </label>
                          <select
                            value={sel.shopping_reason?.id || ''}
                            onChange={(e) => {
                              const reasonId = parseInt(e.target.value);
                              const reason = typeReasons.find(r => r.id === reasonId);
                              setReason(type.code, reason);
                            }}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            <option value="">Select reason...</option>
                            {typeReasons.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Project Number (if required) */}
                      {type.project_required && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Project Number *
                          </label>
                          <input
                            type="text"
                            value={sel.project_number || ''}
                            onChange={(e) => setProjectNumber(type.code, e.target.value)}
                            placeholder="Enter project #"
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          {!sel.project_number && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Required
                            </p>
                          )}
                        </div>
                      )}

                      {/* Cost Override */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Override Cost
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                          <input
                            type="number"
                            value={sel.override_cost ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : undefined;
                              setOverrideCost(type.code, val);
                            }}
                            placeholder={type.estimated_cost.toString()}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md pl-6 pr-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Customer Billing Checkbox */}
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sel.allocate_to_customer}
                          onChange={() => toggleCustomerAllocation(type.code)}
                          className="h-4 w-4 text-amber-600 border-gray-300 dark:border-gray-600 rounded focus:ring-amber-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-amber-600" />
                          Allocate to Customer Account (Billable)
                        </span>
                      </label>
                      {sel.allocate_to_customer && (
                        <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                          Customer pays ${effectiveCost.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Selected</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {summary.total_selected} types
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Owner Cost</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              ${summary.lessor_cost.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Customer Cost</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              ${summary.customer_cost.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Estimate</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              ${summary.total_cost.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ShoppingTypeSummary };
