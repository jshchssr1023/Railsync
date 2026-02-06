'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save, Trash2, Plus, ArrowRight, Lock,
} from 'lucide-react';
import {
  listBudgetScenarios, createBudgetScenario, updateBudgetScenario,
  deleteBudgetScenario, getBudgetScenarioImpact,
  BudgetScenario, ScenarioImpact,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

interface BudgetScenarioPanelProps {
  fiscalYear: number;
}

const SLIDER_KEYS = ['assignment', 'qualification', 'commodity_conversion', 'bad_orders'] as const;

const SLIDER_LABELS: Record<string, string> = {
  assignment: 'Assignment',
  qualification: 'Qualification',
  commodity_conversion: 'Commodity Conversion',
  bad_orders: 'Bad Orders',
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatDelta(value: number): string {
  const sign = value >= 0 ? '+' : '';
  if (Math.abs(value) >= 1_000_000) {
    return `${sign}$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${sign}$${(value / 1_000).toFixed(1)}K`;
  }
  return `${sign}$${value.toFixed(0)}`;
}

export default function BudgetScenarioPanel({ fiscalYear }: BudgetScenarioPanelProps) {
  const toast = useToast();
  const [scenarios, setScenarios] = useState<BudgetScenario[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [impact, setImpact] = useState<ScenarioImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [impactLoading, setImpactLoading] = useState(false);
  const [editName, setEditName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BudgetScenario | null>(null);

  // Local slider values for instant preview
  const [localSliders, setLocalSliders] = useState<Record<string, number>>({
    assignment: 0, qualification: 0, commodity_conversion: 0, bad_orders: 0,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedScenario = scenarios.find(s => s.id === selectedId) || null;
  const isSystem = selectedScenario?.is_system ?? false;

  // Load scenarios
  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBudgetScenarios();
      setScenarios(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch {
      toast.error('Failed to load budget scenarios');
    } finally {
      setLoading(false);
    }
  }, [selectedId, toast]);

  useEffect(() => { fetchScenarios(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When scenario selection changes, sync sliders and fetch impact
  useEffect(() => {
    if (!selectedId) return;
    const sc = scenarios.find(s => s.id === selectedId);
    if (sc) {
      setLocalSliders({
        assignment: Number(sc.slider_assignment),
        qualification: Number(sc.slider_qualification),
        commodity_conversion: Number(sc.slider_commodity_conversion),
        bad_orders: Number(sc.slider_bad_orders),
      });
      setEditName(sc.name);
      setIsEditing(false);
    }
  }, [selectedId, scenarios]);

  // Fetch impact when scenario or fiscal year changes
  const fetchImpact = useCallback(async () => {
    if (!selectedId) return;
    setImpactLoading(true);
    try {
      const data = await getBudgetScenarioImpact(selectedId, fiscalYear);
      setImpact(data);
    } catch {
      setImpact(null);
    } finally {
      setImpactLoading(false);
    }
  }, [selectedId, fiscalYear]);

  useEffect(() => { fetchImpact(); }, [fetchImpact]);

  // Client-side impact preview when sliders change (debounced)
  const computeLocalImpact = useCallback(() => {
    if (!impact) return impact;
    const preview = { ...impact };
    preview.categories = impact.categories.map(cat => {
      const key = cat.name.toLowerCase().replace(/ /g, '_');
      const slider = localSliders[key] ?? cat.slider;
      const impacted = cat.base * (1 + slider / 100);
      return { ...cat, slider, impacted };
    });
    const impactedTotal = preview.running_repairs.base + preview.categories.reduce((s, c) => s + c.impacted, 0);
    const baseTotal = preview.running_repairs.base + preview.categories.reduce((s, c) => s + c.base, 0);
    preview.total = { base: baseTotal, impacted: impactedTotal, delta: impactedTotal - baseTotal };
    return preview;
  }, [impact, localSliders]);

  const displayImpact = computeLocalImpact();

  const handleSliderChange = (key: string, value: number) => {
    setLocalSliders(prev => ({ ...prev, [key]: value }));
  };

  // Save custom scenario slider changes
  const handleSave = async () => {
    if (!selectedId || isSystem) return;
    try {
      await updateBudgetScenario(selectedId, {
        name: editName,
        sliders: {
          assignment: localSliders.assignment,
          qualification: localSliders.qualification,
          commodity_conversion: localSliders.commodity_conversion,
          bad_orders: localSliders.bad_orders,
        },
      });
      toast.success('Scenario saved');
      await fetchScenarios();
      // Refresh server-side impact
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(fetchImpact, 300);
    } catch {
      toast.error('Failed to save scenario');
    }
  };

  const handleCreate = async () => {
    try {
      const sc = await createBudgetScenario('New Scenario', {
        assignment: 0, qualification: 0, commodity_conversion: 0, bad_orders: 0,
      });
      setScenarios(prev => [...prev, sc]);
      setSelectedId(sc.id);
      setIsEditing(true);
      toast.success('Custom scenario created');
    } catch {
      toast.error('Failed to create scenario');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBudgetScenario(deleteTarget.id);
      toast.success('Scenario deleted');
      if (selectedId === deleteTarget.id) {
        setSelectedId(scenarios.find(s => s.id !== deleteTarget.id)?.id || null);
      }
      setDeleteTarget(null);
      await fetchScenarios();
    } catch {
      toast.error('Failed to delete scenario');
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="animate-pulse space-y-4">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="card-body space-y-4">
          {/* Scenario Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Budget Scenario
            </label>
            <div className="flex gap-2">
              <select
                value={selectedId || ''}
                onChange={e => setSelectedId(e.target.value)}
                className="input flex-1 text-sm"
              >
                {scenarios.map(sc => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}{sc.is_system ? ' (System)' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreate}
                className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                title="New custom scenario"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Name edit (custom only) */}
          {selectedScenario && !isSystem && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => setIsEditing(false)}
                  onKeyDown={e => e.key === 'Enter' && setIsEditing(false)}
                  className="input text-sm flex-1"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline decoration-dashed"
                >
                  Rename
                </button>
              )}
              <button
                onClick={() => setDeleteTarget(selectedScenario)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                title="Delete scenario"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Sliders */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Budget Multipliers
              {isSystem && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400">
                  <Lock className="w-3 h-3" /> System preset
                </span>
              )}
            </h4>
            {SLIDER_KEYS.map(key => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {SLIDER_LABELS[key]}
                  </span>
                  <span className={`text-sm font-medium ${
                    localSliders[key] > 0 ? 'text-red-600 dark:text-red-400' :
                    localSliders[key] < 0 ? 'text-green-600 dark:text-green-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {localSliders[key] >= 0 ? '+' : ''}{localSliders[key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={5}
                  value={localSliders[key]}
                  onChange={e => handleSliderChange(key, Number(e.target.value))}
                  disabled={isSystem}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            ))}
          </div>

          {/* Save button for custom scenarios */}
          {!isSystem && (
            <button
              onClick={handleSave}
              className="btn btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              <Save className="w-4 h-4" />
              Save Scenario
            </button>
          )}

          {/* Impact Card */}
          {displayImpact && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Scenario Impact — FY{fiscalYear}
              </h4>

              {/* Running Repairs — static */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Running Repairs
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatCurrency(displayImpact.running_repairs.base)}
                </span>
              </div>

              {/* Dynamic categories */}
              {displayImpact.categories.map(cat => {
                const changed = Math.abs(cat.slider) > 0;
                return (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{cat.name}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {changed ? (
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400">{formatCurrency(cat.base)}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className={cat.impacted > cat.base ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                            {formatCurrency(cat.impacted)}
                          </span>
                        </span>
                      ) : (
                        formatCurrency(cat.base)
                      )}
                    </span>
                  </div>
                );
              })}

              {/* Total */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-gray-900 dark:text-gray-100">Total</span>
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">{formatCurrency(displayImpact.total.base)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-900 dark:text-gray-100">
                      {formatCurrency(displayImpact.total.impacted)}
                    </span>
                  </span>
                </div>
                <div className="flex justify-end mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    displayImpact.total.delta > 0
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : displayImpact.total.delta < 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {formatDelta(displayImpact.total.delta)}
                    {displayImpact.total.base > 0 && (
                      <> ({((displayImpact.total.delta / displayImpact.total.base) * 100).toFixed(1)}%)</>
                    )}
                  </span>
                </div>
              </div>

              {impactLoading && (
                <p className="text-xs text-gray-400 text-center">Refreshing...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Scenario"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
