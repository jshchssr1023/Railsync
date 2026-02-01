'use client';

import { useState, useEffect, useCallback } from 'react';
import { BudgetSummary, RunningRepairsBudget, ServiceEventBudget } from '@/types';
import { getBudgetSummary, getRunningRepairsBudget, getServiceEventBudgets } from '@/lib/api';

interface BudgetOverviewProps {
  fiscalYear?: number;
}

export default function BudgetOverview({ fiscalYear }: BudgetOverviewProps) {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [runningRepairs, setRunningRepairs] = useState<RunningRepairsBudget[]>([]);
  const [serviceEvents, setServiceEvents] = useState<ServiceEventBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'running' | 'service'>('summary');

  const currentYear = fiscalYear || new Date().getFullYear();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, rrData, seData] = await Promise.all([
        getBudgetSummary(currentYear),
        getRunningRepairsBudget(currentYear),
        getServiceEventBudgets(currentYear),
      ]);
      setSummary(summaryData);
      setRunningRepairs(rrData);
      setServiceEvents(seData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-danger-600 dark:text-danger-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Budget Overview - FY{currentYear}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Maintenance budget tracking and allocation
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(summary.total.budget)}
              </p>
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500"
                  style={{ width: `${Math.min(summary.total.consumed_pct, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {summary.total.consumed_pct.toFixed(1)}% committed
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-500 dark:text-gray-400">Committed</p>
              <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">
                {formatCurrency(summary.total.committed)}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Planned + Actual spending
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
              <p className={`text-2xl font-bold ${
                summary.total.remaining >= 0
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-danger-600 dark:text-danger-400'
              }`}>
                {formatCurrency(summary.total.remaining)}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Available for allocation
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4">
          {[
            { id: 'summary', label: 'Summary' },
            { id: 'running', label: 'Running Repairs' },
            { id: 'service', label: 'Service Events' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Running Repairs Summary */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Running Repairs</h3>
            </div>
            <div className="card-body space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Annual Budget</span>
                <span className="font-medium">{formatCurrency(summary.running_repairs.total_budget)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Actual Spend</span>
                <span className="font-medium text-success-600 dark:text-success-400">
                  {formatCurrency(summary.running_repairs.actual_spend)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <span className="text-gray-600 dark:text-gray-400">Remaining</span>
                <span className={`font-bold ${
                  summary.running_repairs.remaining >= 0
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-danger-600 dark:text-danger-400'
                }`}>
                  {formatCurrency(summary.running_repairs.remaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Service Events Summary */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Service Events</h3>
            </div>
            <div className="card-body space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Annual Budget</span>
                <span className="font-medium">{formatCurrency(summary.service_events.total_budget)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Planned</span>
                <span className="font-medium text-warning-600 dark:text-warning-400">
                  {formatCurrency(summary.service_events.planned_cost)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Actual</span>
                <span className="font-medium text-success-600 dark:text-success-400">
                  {formatCurrency(summary.service_events.actual_cost)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <span className="text-gray-600 dark:text-gray-400">Remaining</span>
                <span className={`font-bold ${
                  summary.service_events.remaining >= 0
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-danger-600 dark:text-danger-400'
                }`}>
                  {formatCurrency(summary.service_events.remaining)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'running' && (
        <div className="card overflow-hidden">
          {runningRepairs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No running repairs budget data for FY{currentYear}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Cars on Lease</th>
                    <th className="text-right">$/Car/Month</th>
                    <th className="text-right">Monthly Budget</th>
                    <th className="text-right">Actual Spend</th>
                    <th className="text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {runningRepairs.map((rr) => (
                    <tr key={rr.id}>
                      <td className="font-medium">{formatMonth(rr.month)}</td>
                      <td className="text-right">{rr.cars_on_lease.toLocaleString()}</td>
                      <td className="text-right">{formatCurrency(rr.allocation_per_car)}</td>
                      <td className="text-right">{formatCurrency(rr.monthly_budget)}</td>
                      <td className="text-right text-success-600 dark:text-success-400">
                        {formatCurrency(rr.actual_spend)}
                      </td>
                      <td className={`text-right font-medium ${
                        rr.remaining_budget >= 0
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-danger-600 dark:text-danger-400'
                      }`}>
                        {formatCurrency(rr.remaining_budget)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'service' && (
        <div className="card overflow-hidden">
          {serviceEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No service event budgets for FY{currentYear}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>Event Type</th>
                    <th className="text-right">Budgeted Cars</th>
                    <th className="text-right">Avg Cost/Car</th>
                    <th className="text-right">Total Budget</th>
                    <th>Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceEvents.map((se) => (
                    <tr key={se.id}>
                      <td className="font-medium">{se.event_type}</td>
                      <td className="text-right">{se.budgeted_car_count.toLocaleString()}</td>
                      <td className="text-right">{formatCurrency(se.avg_cost_per_car)}</td>
                      <td className="text-right font-medium">
                        {formatCurrency(se.total_budget)}
                      </td>
                      <td className="text-gray-500 dark:text-gray-400">
                        {se.customer_code || se.fleet_segment || se.car_type || 'All'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
