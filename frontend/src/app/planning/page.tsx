'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Calendar, BarChart3, Eye, Zap, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ForecastSummary from '@/components/ForecastSummary';
import CapacityGrid from '@/components/CapacityGrid';
import ScenarioBuilder from '@/components/ScenarioBuilder';
import CarLookup from '@/components/CarLookup';
import OverrideOptions from '@/components/OverrideOptions';
import ResultsGrid from '@/components/ResultsGrid';
import DirectCarInput from '@/components/DirectCarInput';
import AllocationList from '@/components/AllocationList';
import AllocationTimeline from '@/components/AllocationTimeline';
import ServiceOptionsSelector from '@/components/ServiceOptionsSelector';
import ShopLoadingTool from '@/components/ShopLoadingTool';
import CarDetailCard from '@/components/CarDetailCard';
import { ErrorBoundary, FetchError } from '@/components/ErrorBoundary';
import { evaluateShops, evaluateShopsDirect, getCarByNumber, checkAssignmentConflicts, AssignmentConflict } from '@/lib/api';
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
  const [conflict, setConflict] = useState<AssignmentConflict | null>(null);
  const [showCarDetail, setShowCarDetail] = useState<string | null>(null);
  const [projectAlert, setProjectAlert] = useState<{
    project_id: string;
    project_number: string;
    project_name: string;
    scope_of_work: string;
  } | null>(null);

  // Handle URL parameters for tab selection and car pre-fill
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['quick-shop', 'monthly-load', 'network-view'].includes(tabParam)) {
      setActiveTab(tabParam as TabId);
    }

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
    setProjectAlert(null);

    // Check if car belongs to an active project
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/cars/${foundCar.car_number}/project-history`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('railsync_access_token') || ''}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          const active = data.data.find((p: { status: string }) =>
            p.status === 'active' || p.status === 'in_progress'
          );
          if (active) {
            setProjectAlert({
              project_id: active.project_id || active.id,
              project_number: active.project_number,
              project_name: active.project_name,
              scope_of_work: active.scope_of_work || '',
            });
          }
        }
      })
      .catch(() => { /* non-critical */ });
  };

  // Navigate to Quick Shop with a specific car
  const handleShopCarNow = async (carNumber: string) => {
    console.log('[Shop Now] Starting with car:', carNumber);
    setActiveTab('quick-shop');
    setInputMode('lookup'); // Ensure we're in lookup mode
    setCar(null);
    setResults([]);
    setError(null);
    setConflict(null);
    setLoading(true);

    try {
      console.log('[Shop Now] Fetching car data...');
      const [result, conflictResult] = await Promise.all([
        getCarByNumber(carNumber),
        checkAssignmentConflicts(carNumber),
      ]);
      console.log('[Shop Now] Got car:', result.car);
      setCar(result.car);
      if (conflictResult) {
        console.log('[Shop Now] Conflict detected:', conflictResult);
        setConflict(conflictResult);
      }
    } catch (err) {
      console.error('[Shop Now] Error:', err);
      setError(err instanceof Error ? err.message : `Failed to load car ${carNumber}`);
    } finally {
      setLoading(false);
      console.log('[Shop Now] Done, loading=false');
    }
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

  // Auth is optional - all tabs accessible without login for demo purposes

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'quick-shop',
      label: 'Quick Shop',
      icon: (
        <Search className="w-5 h-5" aria-hidden="true" />
      ),
    },
    {
      id: 'monthly-load',
      label: 'Monthly Load',
      icon: (
        <Calendar className="w-5 h-5" aria-hidden="true" />
      ),
    },
    {
      id: 'network-view',
      label: 'Network View',
      icon: (
        <BarChart3 className="w-5 h-5" aria-hidden="true" />
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCarDetail(car.car_number)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                        Full Details
                      </button>
                      <button
                        onClick={handleEvaluate}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4" aria-hidden="true" />
                        Shop This Car Now
                      </button>
                    </div>
                  </div>
                  {conflict && (
                    <div className="mx-4 mb-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <div className="text-sm">
                          <p className="font-medium text-yellow-800 dark:text-yellow-200">Existing Assignment Detected</p>
                          <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                            This car is already assigned to <strong>{conflict.existing_assignment.shop_name || conflict.existing_assignment.shop_code}</strong> for <strong>{conflict.existing_assignment.target_month}</strong> (Status: {conflict.existing_assignment.status})
                          </p>
                          <p className="text-yellow-600 dark:text-yellow-400 mt-1 text-xs">
                            Creating a new assignment may cause a conflict. Consider updating the existing assignment instead.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {projectAlert && (
                    <div className="mx-4 mb-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Zap className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <div className="text-sm flex-1">
                          <p className="font-medium text-indigo-800 dark:text-indigo-200">
                            This car belongs to project {projectAlert.project_number}
                          </p>
                          <p className="text-indigo-700 dark:text-indigo-300 mt-0.5">
                            {projectAlert.project_name}{projectAlert.scope_of_work ? ` — ${projectAlert.scope_of_work}` : ''}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <a
                              href={`/projects?project=${projectAlert.project_id}&tab=plan&car=${car?.car_number || ''}`}
                              className="inline-block px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                              Plan to Project
                            </a>
                            <button
                              onClick={() => setProjectAlert(null)}
                              className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded"
                            >
                              Continue Individual
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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

              {/* Service Options - shown when car is selected in lookup mode */}
              {inputMode === 'lookup' && car && (
                <div className="card lg:col-span-2">
                  <div className="card-body">
                    <ServiceOptionsSelector carNumber={car.car_number} />
                  </div>
                </div>
              )}

              {/* Evaluation Overrides for Direct Input mode */}
              <div className={`card ${inputMode === 'direct' ? 'lg:col-span-2' : ''}`}>
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {inputMode === 'lookup' ? 'Additional Options' : 'Service Options'}
                  </h3>
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
                          <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" aria-hidden="true" />
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

          {/* Error Message with Retry */}
          {error && (
            <FetchError
              error={error}
              onRetry={() => {
                setError(null);
                if (car) handleEvaluate();
              }}
            />
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
                carNumber={car?.car_number}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'monthly-load' && (
        <div className="space-y-6">
          {/* Shop Loading Tool - Drag and Drop */}
          <ErrorBoundary>
            <ShopLoadingTool months={6} />
          </ErrorBoundary>

          {/* Timeline View */}
          <ErrorBoundary>
            <AllocationTimeline />
          </ErrorBoundary>

          {/* Allocations with Shop Now buttons */}
          <ErrorBoundary>
            <AllocationList onShopCarNow={handleShopCarNow} />
          </ErrorBoundary>

          {/* Capacity Grid */}
          <ErrorBoundary>
            <CapacityGrid months={18} />
          </ErrorBoundary>

          {/* Link to Budget page for forecasts */}
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

      {activeTab === 'network-view' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ErrorBoundary>
                <ForecastSummary fiscalYear={fiscalYear} />
              </ErrorBoundary>
            </div>
            <div>
              <ErrorBoundary>
                <ForecastSummary fiscalYear={fiscalYear} compact />
              </ErrorBoundary>
            </div>
          </div>
          <ErrorBoundary>
            <ScenarioBuilder />
          </ErrorBoundary>
        </div>
      )}

      {/* Car Detail Card Modal */}
      {showCarDetail && (
        <CarDetailCard
          carNumber={showCarDetail}
          onClose={() => setShowCarDetail(null)}
          onShopNow={(carNumber) => {
            setShowCarDetail(null);
            handleShopCarNow(carNumber);
          }}
        />
      )}
    </div>
  );
}
