'use client';

import { useEffect, useState } from 'react';
import { listScenarios } from '@/lib/api';
import { Scenario } from '@/types';

export default function ScenarioComparisonWidget() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listScenarios()
      .then(setScenarios)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return <div className="text-sm text-gray-500 text-center">No scenarios</div>;
  }

  const weightLabels: Record<string, string> = {
    cost: 'Cost',
    cycle_time: 'Speed',
    aitx_preference: 'AITX',
    capacity_balance: 'Capacity',
    quality_score: 'Quality',
  };

  return (
    <div className="space-y-3">
      {scenarios.slice(0, 4).map((scenario) => (
        <div key={scenario.id} className="border border-gray-200 dark:border-gray-700 rounded p-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{scenario.name}</span>
            {scenario.is_default && (
              <span className="text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 px-1 rounded">
                Default
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {Object.entries(scenario.weights || {}).map(([key, value]) => {
              const weight = typeof value === 'number' ? value : 0;
              return (
                <div key={key} className="flex-1 text-center">
                  <div
                    className="bg-primary-500 rounded-t mx-auto"
                    style={{ width: '12px', height: `${weight * 0.4}px`, minHeight: '2px' }}
                  />
                  <div className="text-[8px] text-gray-500 mt-0.5">{weightLabels[key] || key}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
