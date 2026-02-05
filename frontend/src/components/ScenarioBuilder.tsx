'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle } from 'lucide-react';
import { Scenario, ScenarioWeights } from '@/types';
import { listScenarios, createScenario } from '@/lib/api';

interface ScenarioBuilderProps {
  onSelect?: (scenario: Scenario) => void;
  selectedId?: string;
}

const DEFAULT_WEIGHTS: ScenarioWeights = {
  cost: 40,
  cycle_time: 20,
  aitx_preference: 20,
  capacity_balance: 10,
  quality_score: 10,
};

const WEIGHT_LABELS: Record<keyof ScenarioWeights, { label: string; description: string }> = {
  cost: { label: 'Cost', description: 'Minimize total cost per car' },
  cycle_time: { label: 'Cycle Time', description: 'Minimize time from arrival to completion' },
  aitx_preference: { label: 'AITX Network', description: 'Prefer internal AITX shops' },
  capacity_balance: { label: 'Capacity Balance', description: 'Distribute work evenly across shops' },
  quality_score: { label: 'Quality', description: 'Prefer shops with higher quality ratings' },
};

export default function ScenarioBuilder({ onSelect, selectedId }: ScenarioBuilderProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [customWeights, setCustomWeights] = useState<ScenarioWeights>(DEFAULT_WEIGHTS);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listScenarios();
      setScenarios(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const handleWeightChange = (key: keyof ScenarioWeights, value: number) => {
    setCustomWeights((prev) => ({ ...prev, [key]: value }));
  };

  const getTotalWeight = () => {
    return Object.values(customWeights).reduce((a, b) => a + b, 0);
  };

  const handleSaveScenario = async () => {
    if (!customName.trim()) {
      setError('Please enter a scenario name');
      return;
    }

    const total = getTotalWeight();
    if (total !== 100) {
      setError(`Weights must sum to 100 (currently ${total})`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const newScenario = await createScenario({
        name: customName.trim(),
        description: customDescription.trim() || undefined,
        weights: customWeights,
        is_default: false,
      });
      setScenarios([...scenarios, newScenario]);
      setShowCreate(false);
      setCustomName('');
      setCustomDescription('');
      setCustomWeights(DEFAULT_WEIGHTS);
      onSelect?.(newScenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scenario');
    } finally {
      setSaving(false);
    }
  };

  const getWeightColor = (value: number) => {
    if (value >= 40) return 'bg-primary-500';
    if (value >= 25) return 'bg-success-500';
    if (value >= 15) return 'bg-warning-500';
    return 'bg-gray-400';
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Allocation Scenarios
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose how to prioritize shop selection
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn btn-secondary text-sm"
        >
          {showCreate ? 'Cancel' : '+ Custom'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Scenario List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => onSelect?.(scenario)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selectedId === scenario.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {scenario.name}
                  </h4>
                  {scenario.is_default && (
                    <span className="badge badge-info text-xs">Default</span>
                  )}
                  {scenario.is_system && (
                    <span className="badge badge-secondary text-xs">System</span>
                  )}
                </div>
                {scenario.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {scenario.description}
                  </p>
                )}
              </div>
              {selectedId === scenario.id && (
                <CheckCircle className="w-5 h-5 text-primary-500" aria-hidden="true" />
              )}
            </div>

            {/* Weight Bars */}
            <div className="mt-3 space-y-1">
              {(Object.entries(scenario.weights) as [keyof ScenarioWeights, number][]).map(
                ([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-gray-500 truncate">{WEIGHT_LABELS[key].label}</span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getWeightColor(value)}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-gray-600 dark:text-gray-400">
                      {value}%
                    </span>
                  </div>
                )
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Create Custom Scenario */}
      {showCreate && (
        <div className="card">
          <div className="card-header">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              Create Custom Scenario
            </h4>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Scenario Name *</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="input"
                  placeholder="e.g., Cost Focus Q2"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <input
                  type="text"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="input"
                  placeholder="Optional description"
                />
              </div>
            </div>

            {/* Weight Sliders */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Adjust Weights
                </span>
                <span
                  className={`text-sm font-medium ${
                    getTotalWeight() === 100
                      ? 'text-success-600 dark:text-success-400'
                      : 'text-danger-600 dark:text-danger-400'
                  }`}
                >
                  Total: {getTotalWeight()}%
                </span>
              </div>

              {(Object.keys(customWeights) as (keyof ScenarioWeights)[]).map((key) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-gray-700 dark:text-gray-300">
                      {WEIGHT_LABELS[key].label}
                    </label>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {customWeights[key]}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customWeights[key]}
                    onChange={(e) => handleWeightChange(key, parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {WEIGHT_LABELS[key].description}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowCreate(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScenario}
                disabled={saving || getTotalWeight() !== 100}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Save Scenario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
