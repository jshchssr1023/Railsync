'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, BarChart3, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ForecastSummary from '@/components/ForecastSummary';
import CapacityGrid from '@/components/CapacityGrid';
import AllocationList from '@/components/AllocationList';
import AllocationTimeline from '@/components/AllocationTimeline';
import ShopLoadingTool from '@/components/ShopLoadingTool';
import PipelineSummaryCards from '@/components/PipelineSummaryCards';
import BudgetScenarioPanel from '@/components/BudgetScenarioPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';

type TabId = 'monthly-load' | 'forecast';

export default function PlanningPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    }>
      <PlanningContent />
    </Suspense>
  );
}

function PlanningContent() {
  const { isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('monthly-load');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [budgetExpanded, setBudgetExpanded] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'monthly-load' || tabParam === 'forecast') {
      setActiveTab(tabParam);
    }
    // Legacy: redirect old network-view param to forecast
    if (tabParam === 'network-view') {
      setActiveTab('forecast');
    }
  }, [searchParams]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'monthly-load',
      label: 'Monthly Load',
      icon: <Calendar className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'forecast',
      label: 'Maintenance Forecast',
      icon: <BarChart3 className="w-5 h-5" aria-hidden="true" />,
    },
  ];

  const years = [
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Network Planning
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Capacity management and maintenance forecasting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">Fiscal Year:</label>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            className="input py-1.5 text-sm w-24"
          >
            {years.map((y) => (
              <option key={y} value={y}>FY{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Monthly Load Tab */}
      {activeTab === 'monthly-load' && (
        <div className="space-y-6">
          <ErrorBoundary>
            <ShopLoadingTool months={6} />
          </ErrorBoundary>

          <ErrorBoundary>
            <AllocationTimeline />
          </ErrorBoundary>

          <ErrorBoundary>
            <AllocationList />
          </ErrorBoundary>

          <ErrorBoundary>
            <CapacityGrid months={18} />
          </ErrorBoundary>

          {/* Link to Budget page */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Budget & Demand Forecasts</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">View budget tracking and demand forecasts on the Budget page</p>
                </div>
              </div>
              <a
                href="/budget"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 rounded-lg transition-colors"
              >
                View Budget
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Forecast Tab */}
      {activeTab === 'forecast' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column — Pipeline + Budget */}
          <div className="lg:col-span-2 space-y-4">
            {/* Pipeline Summary */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Pipeline — FY{fiscalYear}
                </h3>
              </div>
              <div className="card-body">
                <ErrorBoundary>
                  <PipelineSummaryCards fiscalYear={fiscalYear} />
                </ErrorBoundary>
              </div>
            </div>

            {/* Budget by Type */}
            <div className="card">
              <div className="card-header">
                <button
                  onClick={() => setBudgetExpanded(!budgetExpanded)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  {budgetExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Budget Breakdown — FY{fiscalYear}
                  </h3>
                </button>
              </div>
              {budgetExpanded && (
                <div className="card-body">
                  <ErrorBoundary>
                    <ForecastSummary fiscalYear={fiscalYear} />
                  </ErrorBoundary>
                </div>
              )}
              {!budgetExpanded && (
                <div className="card-body">
                  <ErrorBoundary>
                    <ForecastSummary fiscalYear={fiscalYear} compact />
                  </ErrorBoundary>
                </div>
              )}
            </div>
          </div>

          {/* Right Column — Scenario Panel */}
          <div>
            <ErrorBoundary>
              <BudgetScenarioPanel fiscalYear={fiscalYear} />
            </ErrorBoundary>
          </div>
        </div>
      )}
    </div>
  );
}
