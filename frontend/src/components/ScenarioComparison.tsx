'use client';

import { useState } from 'react';
import { Scenario, Allocation } from '@/types';
import { generateAllocations } from '@/lib/api';

interface ScenarioResult {
  scenario: Scenario;
  allocations: Allocation[];
  summary: {
    total_cars: number;
    total_cost: number;
    avg_cost_per_car: number;
    unallocated_cars: number;
  };
  by_network: Record<string, { count: number; cost: number }>;
}

interface ScenarioComparisonProps {
  demandIds: string[];
  scenarios: Scenario[];
  onApply?: (scenarioId: string) => void;
}

export default function ScenarioComparison({
  demandIds,
  scenarios,
  onApply,
}: ScenarioComparisonProps) {
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const runComparison = async () => {
    if (demandIds.length === 0) {
      setError('Please select at least one demand to compare');
      return;
    }

    setLoading(true);
    setComparing(true);
    setError(null);
    setResults([]);

    try {
      const comparisonResults: ScenarioResult[] = [];

      for (const scenario of scenarios) {
        const result = await generateAllocations(demandIds, scenario.id, true);

        // Group by network
        const byNetwork: Record<string, { count: number; cost: number }> = {};
        for (const alloc of result.allocations) {
          const network = alloc.shop_code.startsWith('AITX') ? 'AITX' : 'External';
          if (!byNetwork[network]) {
            byNetwork[network] = { count: 0, cost: 0 };
          }
          byNetwork[network].count++;
          byNetwork[network].cost += alloc.estimated_cost || 0;
        }

        comparisonResults.push({
          scenario,
          allocations: result.allocations,
          summary: result.summary,
          by_network: byNetwork,
        });
      }

      setResults(comparisonResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare scenarios');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getBestValue = (key: keyof ScenarioResult['summary'], lower = true) => {
    if (results.length === 0) return null;
    const values = results.map((r) => r.summary[key]);
    return lower ? Math.min(...values) : Math.max(...values);
  };

  const isBest = (result: ScenarioResult, key: keyof ScenarioResult['summary'], lower = true) => {
    const best = getBestValue(key, lower);
    return result.summary[key] === best;
  };

  if (!comparing) {
    return (
      <div className="card">
        <div className="card-body text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Compare Allocation Scenarios
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Run a preview allocation for each scenario to compare costs, capacity usage, and network distribution.
          </p>
          <button
            onClick={runComparison}
            disabled={loading || demandIds.length === 0}
            className="btn btn-primary"
          >
            {loading ? 'Running Comparison...' : 'Start Comparison'}
          </button>
          {demandIds.length === 0 && (
            <p className="text-xs text-warning-600 dark:text-warning-400 mt-2">
              Select demands to compare
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Scenario Comparison
        </h3>
        <button onClick={runComparison} disabled={loading} className="btn btn-secondary text-sm">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && results.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {scenarios.map((s) => (
            <div key={s.id} className="card animate-pulse">
              <div className="card-body space-y-3">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {results.map((result) => (
            <div key={result.scenario.id} className="card">
              <div className="card-body space-y-4">
                {/* Scenario Header */}
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {result.scenario.name}
                    </h4>
                    {result.scenario.is_default && (
                      <span className="badge badge-info text-xs">Default</span>
                    )}
                  </div>
                </div>

                {/* Total Cost */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Cost</p>
                  <p
                    className={`text-2xl font-bold ${
                      isBest(result, 'total_cost')
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {formatCurrency(result.summary.total_cost)}
                  </p>
                  {isBest(result, 'total_cost') && (
                    <span className="text-xs text-success-600 dark:text-success-400">
                      Lowest Cost
                    </span>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Cars</p>
                    <p className="font-medium">{result.summary.total_cars}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg/Car</p>
                    <p className="font-medium">{formatCurrency(result.summary.avg_cost_per_car)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Unallocated</p>
                    <p
                      className={`font-medium ${
                        result.summary.unallocated_cars > 0
                          ? 'text-warning-600'
                          : 'text-success-600'
                      }`}
                    >
                      {result.summary.unallocated_cars}
                    </p>
                  </div>
                </div>

                {/* Network Distribution */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Network Split</p>
                  <div className="space-y-1">
                    {Object.entries(result.by_network).map(([network, data]) => (
                      <div key={network} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{network}</span>
                        <span className="font-medium">
                          {data.count} ({formatCurrency(data.cost)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Apply Button */}
                {onApply && (
                  <button
                    onClick={() => onApply(result.scenario.id)}
                    className="btn btn-primary w-full text-sm"
                  >
                    Apply This Scenario
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Metric</th>
                  {results.map((r) => (
                    <th key={r.scenario.id} className="text-center">
                      {r.scenario.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Total Cost</td>
                  {results.map((r) => (
                    <td
                      key={r.scenario.id}
                      className={`text-center ${
                        isBest(r, 'total_cost')
                          ? 'bg-success-50 dark:bg-success-900/30 font-bold text-success-700 dark:text-success-300'
                          : ''
                      }`}
                    >
                      {formatCurrency(r.summary.total_cost)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Avg Cost/Car</td>
                  {results.map((r) => (
                    <td
                      key={r.scenario.id}
                      className={`text-center ${
                        isBest(r, 'avg_cost_per_car')
                          ? 'bg-success-50 dark:bg-success-900/30 font-bold text-success-700 dark:text-success-300'
                          : ''
                      }`}
                    >
                      {formatCurrency(r.summary.avg_cost_per_car)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Total Cars</td>
                  {results.map((r) => (
                    <td key={r.scenario.id} className="text-center">
                      {r.summary.total_cars}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Unallocated</td>
                  {results.map((r) => (
                    <td
                      key={r.scenario.id}
                      className={`text-center ${
                        isBest(r, 'unallocated_cars')
                          ? 'bg-success-50 dark:bg-success-900/30 font-bold text-success-700 dark:text-success-300'
                          : r.summary.unallocated_cars > 0
                          ? 'text-warning-600'
                          : ''
                      }`}
                    >
                      {r.summary.unallocated_cars}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">AITX Cars</td>
                  {results.map((r) => (
                    <td key={r.scenario.id} className="text-center">
                      {r.by_network['AITX']?.count || 0}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">External Cars</td>
                  {results.map((r) => (
                    <td key={r.scenario.id} className="text-center">
                      {r.by_network['External']?.count || 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
