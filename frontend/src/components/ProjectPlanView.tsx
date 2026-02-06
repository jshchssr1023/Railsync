'use client';

import { useState, useMemo } from 'react';
import { Lock, Unlock, RefreshCw, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ProjectAssignment, ProjectPlanSummary } from '@/types';

const PLAN_STATE_STYLES: Record<string, string> = {
  Planned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  Locked: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
  Superseded: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

interface ProjectPlanViewProps {
  plan: ProjectPlanSummary | null;
  loading: boolean;
  onLockSelected: (ids: string[]) => void;
  onRelock: (assignment: ProjectAssignment) => void;
  onCancel: (assignment: ProjectAssignment) => void;
  onPlanCars: () => void;
  onCreateDemand?: () => void;
  isActive: boolean;
}

export default function ProjectPlanView({
  plan,
  loading,
  onLockSelected,
  onRelock,
  onCancel,
  onPlanCars,
  onCreateDemand,
  isActive,
}: ProjectPlanViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());
  const [showSuperseded, setShowSuperseded] = useState(false);

  const activeAssignments = useMemo(() => {
    if (!plan) return [];
    return plan.assignments.filter(a =>
      showSuperseded ? true : a.plan_state !== 'Superseded'
    );
  }, [plan, showSuperseded]);

  const groupedByShop = useMemo(() => {
    const groups: Record<string, ProjectAssignment[]> = {};
    for (const a of activeAssignments) {
      const key = `${a.shop_code} - ${a.shop_name || a.shop_code}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return groups;
  }, [activeAssignments]);

  const plannedIds = useMemo(() => {
    return activeAssignments
      .filter(a => a.plan_state === 'Planned')
      .map(a => a.id);
  }, [activeAssignments]);

  const toggleShop = (key: string) => {
    const next = new Set(expandedShops);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedShops(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === plannedIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(plannedIds));
    }
  };

  if (loading || !plan) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan Summary Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {plan.unplanned_cars} Unplanned
          </span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
            {plan.planned_cars} Planned
          </span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
            {plan.locked_cars} Locked
          </span>
          <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
            {plan.completed_cars} Complete
          </span>
        </div>
        {plan.total_estimated_cost > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Est. ${plan.total_estimated_cost.toLocaleString()}
          </span>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500">
          v{plan.plan_version}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {isActive && (
          <button
            onClick={onPlanCars}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Plan Cars
          </button>
        )}
        {isActive && onCreateDemand && plan && plan.unplanned_cars > 0 && (
          <button
            onClick={onCreateDemand}
            className="px-3 py-1.5 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30"
          >
            Create Demand ({plan.unplanned_cars} cars)
          </button>
        )}
        {selectedIds.size > 0 && (
          <button
            onClick={() => {
              onLockSelected(Array.from(selectedIds));
              setSelectedIds(new Set());
            }}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex items-center gap-1"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock Selected ({selectedIds.size})
          </button>
        )}
        {plannedIds.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="px-3 py-1.5 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {selectedIds.size === plannedIds.length ? 'Deselect All' : 'Select All Planned'}
          </button>
        )}
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 ml-auto">
          <input
            type="checkbox"
            checked={showSuperseded}
            onChange={e => setShowSuperseded(e.target.checked)}
            className="rounded"
          />
          Show superseded
        </label>
      </div>

      {/* Grouped by Shop */}
      {Object.keys(groupedByShop).length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No plan assignments yet. Click &ldquo;Plan Cars&rdquo; to start.
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(groupedByShop).map(([shopKey, assignments]) => {
            const isExpanded = expandedShops.has(shopKey) || Object.keys(groupedByShop).length <= 3;
            const shopPlanned = assignments.filter(a => a.plan_state === 'Planned').length;
            const shopLocked = assignments.filter(a => a.plan_state === 'Locked').length;
            const shopCost = assignments
              .filter(a => a.plan_state !== 'Cancelled' && a.plan_state !== 'Superseded')
              .reduce((s, a) => s + (Number(a.estimated_cost) || 0), 0);

            return (
              <div key={shopKey} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleShop(shopKey)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{shopKey}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {assignments.filter(a => a.plan_state !== 'Superseded' && a.plan_state !== 'Cancelled').length} cars
                    </span>
                  </div>
                  <div className="flex gap-2 items-center text-xs">
                    {shopPlanned > 0 && <span className="text-blue-600 dark:text-blue-400">{shopPlanned} planned</span>}
                    {shopLocked > 0 && <span className="text-indigo-600 dark:text-indigo-400">{shopLocked} locked</span>}
                    {shopCost > 0 && <span className="text-gray-500">${shopCost.toLocaleString()}</span>}
                  </div>
                </button>

                {isExpanded && (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-white dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-8" />
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Car</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Month</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Cost</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">State</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Lock</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {assignments.map(a => (
                        <tr
                          key={a.id}
                          className={`${a.plan_state === 'Superseded' ? 'opacity-50' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/30`}
                        >
                          <td className="px-3 py-2">
                            {a.plan_state === 'Planned' && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(a.id)}
                                onChange={() => toggleSelect(a.id)}
                                className="rounded"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {a.car_number}
                            {a.is_opportunistic && (
                              <span className="ml-1 px-1 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 rounded">
                                bundled
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">{a.target_month}</td>
                          <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {a.estimated_cost ? `$${Number(a.estimated_cost).toLocaleString()}` : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_STATE_STYLES[a.plan_state] || ''}`}>
                              {a.plan_state}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                            {a.plan_state === 'Locked' && (
                              <span className="flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                v{a.lock_version}
                              </span>
                            )}
                            {a.plan_state === 'Planned' && <Unlock className="w-3 h-3 text-gray-400" />}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {a.plan_state === 'Locked' && isActive && (
                                <button
                                  onClick={() => onRelock(a)}
                                  className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                  title="Relock (change shop/month)"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {(a.plan_state === 'Planned' || a.plan_state === 'Locked') && isActive && (
                                <button
                                  onClick={() => onCancel(a)}
                                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                  title="Cancel plan"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
