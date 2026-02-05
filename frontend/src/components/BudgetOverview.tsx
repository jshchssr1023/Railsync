'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { BudgetSummary, RunningRepairsBudget, ServiceEventBudget } from '@/types';
import { getBudgetSummary, getRunningRepairsBudget, getServiceEventBudgets } from '@/lib/api';
import { FetchError } from '@/components/ErrorBoundary';

interface BudgetOverviewProps {
  fiscalYear?: number;
}

export default function BudgetOverview({ fiscalYear }: BudgetOverviewProps) {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [runningRepairs, setRunningRepairs] = useState<RunningRepairsBudget[]>([]);
  const [serviceEvents, setServiceEvents] = useState<ServiceEventBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Calculate variance percentage
  const getVariance = (actual: number, budget: number): { pct: number; favorable: boolean } => {
    if (budget === 0) return { pct: 0, favorable: true };
    const variance = ((budget - actual) / budget) * 100;
    return { pct: Math.abs(variance), favorable: variance >= 0 };
  };

  // Variance indicator component
  const VarianceIndicator = ({ actual, budget }: { actual: number; budget: number }) => {
    const { pct, favorable } = getVariance(actual, budget);
    if (budget === 0 || actual === 0) return null;

    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        favorable ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'
      }`}>
        {favorable ? (
          <ArrowUp className="w-3 h-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="w-3 h-3" aria-hidden="true" />
        )}
        {pct.toFixed(1)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
          <FetchError error={error} onRetry={fetchData} />
        </div>
      </div>
    );
  }

  // Calculate running repairs totals
  const rrTotalBudget = runningRepairs.reduce((s, r) => s + r.monthly_budget, 0);
  const rrTotalActual = runningRepairs.reduce((s, r) => s + r.actual_spend, 0);
  const rrTotalRemaining = runningRepairs.reduce((s, r) => s + r.remaining_budget, 0);

  // Calculate service events totals
  const seTotalBudget = serviceEvents.reduce((s, e) => s + e.total_budget, 0);
  const seTotalCars = serviceEvents.reduce((s, e) => s + e.budgeted_car_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Budget Overview - FY{currentYear}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Maintenance budget tracking and allocation
        </p>
      </div>

      {/* Budget Health - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Running Repairs Card */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Running Repairs</h3>
            {summary && (
              <VarianceIndicator actual={summary.running_repairs.actual_spend} budget={summary.running_repairs.total_budget} />
            )}
          </div>
          <div className="card-body space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Annual Budget</span>
              <span className="font-medium">{formatCurrency(rrTotalBudget)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Actual Spend</span>
              <span className="font-medium text-success-600 dark:text-success-400">
                {formatCurrency(rrTotalActual)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
              <span className="text-gray-600 dark:text-gray-400">Remaining</span>
              <span className={`font-bold ${
                rrTotalRemaining >= 0
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-danger-600 dark:text-danger-400'
              }`}>
                {formatCurrency(rrTotalRemaining)}
              </span>
            </div>
            {/* Monthly Trend */}
            {runningRepairs.length > 0 && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Monthly Trend</p>
                <div className="flex gap-1 items-end h-16">
                  {runningRepairs.map((rr) => {
                    const maxBudget = Math.max(...runningRepairs.map(r => r.monthly_budget));
                    const heightPct = maxBudget > 0 ? (rr.monthly_budget / maxBudget) * 100 : 0;
                    const spendPct = rr.monthly_budget > 0 ? (rr.actual_spend / rr.monthly_budget) * 100 : 0;
                    return (
                      <div key={rr.id} className="flex-1 flex flex-col items-center gap-0.5" title={`${formatMonth(rr.month)}: ${formatCurrency(rr.actual_spend)} / ${formatCurrency(rr.monthly_budget)}`}>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-sm relative" style={{ height: `${heightPct}%`, minHeight: '4px' }}>
                          <div
                            className={`absolute bottom-0 w-full rounded-sm ${spendPct > 100 ? 'bg-red-400' : 'bg-primary-400'}`}
                            style={{ height: `${Math.min(spendPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-400">Jan</span>
                  <span className="text-[10px] text-gray-400">Dec</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Service Events Card */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Service Events</h3>
            {summary && (
              <VarianceIndicator
                actual={summary.service_events.planned_cost + summary.service_events.actual_cost}
                budget={summary.service_events.total_budget || (summary.service_events.planned_cost + summary.service_events.actual_cost)}
              />
            )}
          </div>
          <div className="card-body space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Annual Budget</span>
              <span className="font-medium">{formatCurrency(seTotalBudget)}</span>
            </div>
            {summary && (
              <>
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
              </>
            )}
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
              <span className="text-gray-600 dark:text-gray-400">Remaining</span>
              <span className={`font-bold ${
                (summary?.service_events.remaining ?? seTotalBudget) >= 0
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-danger-600 dark:text-danger-400'
              }`}>
                {formatCurrency(summary?.service_events.remaining ?? seTotalBudget)}
              </span>
            </div>
            {/* Event Type Breakdown */}
            {serviceEvents.length > 0 && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">By Event Type</p>
                <div className="space-y-2">
                  {['Qualification', 'Assignment', 'Return'].map((type) => {
                    const events = serviceEvents.filter(e => e.event_type === type);
                    const typeBudget = events.reduce((s, e) => s + e.total_budget, 0);
                    const typeCars = events.reduce((s, e) => s + e.budgeted_car_count, 0);
                    if (events.length === 0) return null;
                    return (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{type}</span>
                        <div className="text-right">
                          <span className="font-medium">{formatCurrency(typeBudget)}</span>
                          <span className="text-xs text-gray-400 ml-2">({typeCars} cars)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
