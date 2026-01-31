'use client';

import { useState, useCallback } from 'react';
import CarLookup from '@/components/CarLookup';
import OverrideOptions from '@/components/OverrideOptions';
import ResultsGrid from '@/components/ResultsGrid';
import DirectCarInput from '@/components/DirectCarInput';
import { evaluateShops, evaluateShopsDirect } from '@/lib/api';
import { Car, EvaluationOverrides, EvaluationResult } from '@/types';

type InputMode = 'lookup' | 'direct';

export default function Dashboard() {
  const [inputMode, setInputMode] = useState<InputMode>('lookup');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [car, setCar] = useState<Car | null>(null);
  const [directInput, setDirectInput] = useState<Partial<Car>>({});
  const [overrides, setOverrides] = useState<EvaluationOverrides>({});
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const handleCarFound = (foundCar: Car) => {
    setCar(foundCar);
    setResults([]);
    setError(null);
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

  return (
    <div className="space-y-6">
      {/* Page Header with Mode Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shop Evaluation</h2>
          <p className="mt-1 text-sm text-gray-500">
            Find the best repair shop for your railcar
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Input Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setInputMode('lookup')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                inputMode === 'lookup'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Car Lookup
            </button>
            <button
              onClick={() => setInputMode('direct')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                inputMode === 'direct'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Direct Input
            </button>
          </div>

          {/* Advanced Mode Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">Advanced</span>
            <button
              onClick={() => setAdvancedMode(!advancedMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                advancedMode ? 'bg-primary-600' : 'bg-gray-300'
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
      </div>

      {/* Car Input Section */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            {inputMode === 'lookup' ? 'Car Lookup' : 'Car Information'}
          </h3>
          {inputMode === 'direct' && (
            <span className="text-xs text-gray-500">Enter car details manually</span>
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

      {/* Car Details & Overrides - Show when car found (lookup mode) or always (direct mode) */}
      {(inputMode === 'lookup' ? car : true) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Car Details - Only show in lookup mode */}
          {inputMode === 'lookup' && car && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Car Details</h3>
              </div>
              <div className="card-body">
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Car Number</dt>
                    <dd className="mt-1 text-sm text-gray-900">{car.car_number}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Product Code</dt>
                    <dd className="mt-1 text-sm text-gray-900">{car.product_code}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Material Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{car.material_type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Stencil Class</dt>
                    <dd className="mt-1 text-sm text-gray-900">{car.stencil_class || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Lining Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{car.lining_type || 'None'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Nitrogen Pad Stage</dt>
                    <dd className="mt-1 text-sm text-gray-900">{car.nitrogen_pad_stage || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Commodity</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {car.commodity?.description || car.commodity_cin || 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Asbestos</dt>
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

          {/* Override Options */}
          <div className={`card ${inputMode === 'direct' ? 'lg:col-span-2' : ''}`}>
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Service Options</h3>
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
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
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
        <div className="bg-red-50 border border-red-500 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Evaluation Results</h3>
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
  );
}
