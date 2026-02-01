'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ForecastSummary from '@/components/ForecastSummary';
import DemandList from '@/components/DemandList';
import CapacityGrid from '@/components/CapacityGrid';
import BudgetOverview from '@/components/BudgetOverview';
import ScenarioBuilder from '@/components/ScenarioBuilder';
import CarLookup from '@/components/CarLookup';
import OverrideOptions from '@/components/OverrideOptions';
import ResultsGrid from '@/components/ResultsGrid';
import DirectCarInput from '@/components/DirectCarInput';
import AllocationList from '@/components/AllocationList';
import { evaluateShops, evaluateShopsDirect, getCarByNumber } from '@/lib/api';
import { Car, EvaluationOverrides, EvaluationResult } from '@/types';

type TabId = 'quick-shop' | 'monthly-load' | 'network-view';
type InputMode = 'lookup' | 'direct';

// Wrapper component to handle the Suspense boundary for useSearchParams
export default function PlanningPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <PlanningContent />
    </Suspense>
  );
}

function PlanningContent() {
  const { user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('quick-shop');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());

  // Quick Shop state
  const [inputMode, setInputMode] = useState<InputMode>('lookup');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [car, setCar] = useState<Car | null>(null);
  const [directInput, setDirectInput] = useState<Partial<Car>>({});
  const [overrides, setOverrides] = useState<EvaluationOverrides>({});
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Handle URL parameter for pre-filling car number
  useEffect(() => {
    const carParam = searchParams.get('car');
    if (carParam && !car) {
      setActiveTab('quick-shop');
      // Auto-lookup the car
      getCarByNumber(carParam)
        .then((result) => {
          setCar(result.car);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load car');
        });
    }
  }, [searchParams, car]);

  const handleCarFound = (foundCar: Car) => {
    setCar(foundCar);
    setResults([]);
    setError(null);
  };

  // Navigate to Quick Shop with a specific car
  const handleShopCarNow = (carNumber: string) => {
    setActiveTab('quick-shop');
    setCar(null);
    setResults([]);
    setError(null);
    // Lookup the car
    getCarByNumber(carNumber)
      .then((result) => {
        setCar(result.car);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load car');
      });
  };

  const handleEvaluate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let evaluationResults: EvaluationResult[];

      if (inputMode === 'lookup' && car) {
        evaluationResults = await evaluateShops(car.car_number, overrides);
      } else if (inputMode === 'direct' && directInput.product_code) {
        evaluationResults = await evaluateShopsDirect(directInput, overrides);
      } else {
        setError('Please provide car information');
        setLoading(false);
        return;
      }

      setResults(evaluationResults);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to evaluate shops';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [car, directInput, inputMode, overrides]);

  const handleRefresh = useCallback(() => {
    handleEvaluate();
  }, [handleEvaluate]);

  const eligibleCount = results.filter((r) => r.is_eligible).length;
  const totalCount = results.length;
  const canEvaluate = inputMode === 'lookup' ? !!car : !!directInput.product_code;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Only require auth for Monthly Load and Network View tabs
  const requiresAuth = activeTab !== 'quick-shop';
  if (requiresAuth && !user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Authentication Required
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Please log in to access {activeTab === 'monthly-load' ? 'Monthly Load' : 'Network View'}.
        </p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'quick-shop',
      label: 'Quick Shop',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: 'monthly-load',
      label: 'Monthly Load',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'network-view',
      label: 'Network View',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
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
            Shop selection, capacity management, and network forecasting
          </p>
        </div>
        {activeTab !== 'quick-shop' && (
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
        )}
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

      {/* Tab Content */}
      {activeTab === 'quick-shop' && (
        <div className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex items-center justify-end gap-4">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setInputMode('lookup')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  inputMode === 'lookup'
                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Car Lookup
              </button>
              <button
                onClick={() => setInputMode('direct')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  inputMode === 'direct'
                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Direct Input
              </button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-600 dark:text-gray-400">Advanced</span>
              <button
                onClick={() => setAdvancedMode(!advancedMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  advancedMode ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    advancedMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Car Input Section */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {inputMode === 'lookup' ? 'Car Lookup' : 'Car Information'}
              </h3>
              {inputMode === 'direct' && (
                <span className="text-xs text-gray-500 dark:text-gray-400">Enter car details manually</span>
              )}
            </div>
            <div className="card-body">
              {inputMode === 'lookup' ? (
                <CarLookup onCarFound={handleCarFound} />
              ) : (
                <DirectCarInput
                  value={directInput}
                  onChange={setDirectInput}
                  advancedMode={advancedMode}
                />
              )}
            </div>
          </div>

          {/* Car Details & Overrides */}
          {(inputMode === 'lookup' ? car : true) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {inputMode === 'lookup' && car && (
                <div className="card">
                  <div className="card-header flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Car Details</h3>
                    <button
                      onClick={handleEvaluate}
                      disabled={loading}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Shop This Car Now
                    </button>
                  </div>
                  <div className="card-body">
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Car Number</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{car.car_number}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Product Code</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{car.product_code}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Material Type</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{car.material_type}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Stencil Class</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{car.stencil_class || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Lining Type</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{car.lining_type || 'None'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Nitrogen Pad Stage</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{car.nitrogen_pad_stage || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Commodity</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {car.commodity?.description || car.commodity_cin || 'N/A'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Asbestos</dt>
                        <dd className="mt-1">
                          {car.asbestos_abatement_required ? (
                            <span className="badge badge-danger">Abatement Required</span>
                          ) : car.has_asbestos ? (
                            <span className="badge badge-warning">Present</span>
                          ) : (
                            <span className="badge badge-success">None</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              <div className={`card ${inputMode === 'direct' ? 'lg:col-span-2' : ''}`}>
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Service Options</h3>
                </div>
                <div className="card-body">
                  <OverrideOptions overrides={overrides} onChange={setOverrides} />
                  <div className="mt-6">
                    <button
                      onClick={handleEvaluate}
                      disabled={loading || !canEvaluate}
                      className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center">
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Evaluating...
                        </span>
                      ) : (
                        'Evaluate Shops'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-500 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Results Section */}
          {results.length > 0 && (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Evaluation Results</h3>
                <div className="flex items-center space-x-4">
                  <span className="badge badge-success">{eligibleCount} Eligible</span>
                  <span className="badge badge-info">{totalCount} Total</span>
                </div>
              </div>
              <ResultsGrid
                results={results}
                lastUpdated={lastUpdated || undefined}
                onRefresh={handleRefresh}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'monthly-load' && (
        <div className="space-y-6">
          {/* Allocations with Shop Now buttons */}
          <AllocationList onShopCarNow={handleShopCarNow} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DemandList fiscalYear={fiscalYear} />
            <BudgetOverview fiscalYear={fiscalYear} />
          </div>
          <CapacityGrid months={18} />
        </div>
      )}

      {activeTab === 'network-view' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ForecastSummary fiscalYear={fiscalYear} />
            </div>
            <div>
              <ForecastSummary fiscalYear={fiscalYear} compact />
            </div>
          </div>
          <ScenarioBuilder />
        </div>
      )}
    </div>
  );
}
