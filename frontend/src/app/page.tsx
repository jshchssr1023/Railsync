'use client';

import { useState } from 'react';
import CarLookup from '@/components/CarLookup';
import OverrideOptions from '@/components/OverrideOptions';
import ResultsGrid from '@/components/ResultsGrid';
import { evaluateShops } from '@/lib/api';
import { Car, EvaluationOverrides, EvaluationResult } from '@/types';

export default function Dashboard() {
  const [car, setCar] = useState<Car | null>(null);
  const [overrides, setOverrides] = useState<EvaluationOverrides>({});
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCarFound = (foundCar: Car) => {
    setCar(foundCar);
    setResults([]);
    setError(null);
  };

  const handleEvaluate = async () => {
    if (!car) return;

    setLoading(true);
    setError(null);

    try {
      const evaluationResults = await evaluateShops(car.car_number, overrides);
      setResults(evaluationResults);
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate shops');
    } finally {
      setLoading(false);
    }
  };

  const eligibleCount = results.filter((r) => r.is_eligible).length;
  const totalCount = results.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shop Evaluation</h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter a car number to evaluate eligible repair shops
          </p>
        </div>
      </div>

      {/* Car Lookup Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Car Lookup</h3>
        </div>
        <div className="card-body">
          <CarLookup onCarFound={handleCarFound} />
        </div>
      </div>

      {/* Car Details & Overrides */}
      {car && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Car Details */}
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
                  <dd className="mt-1 text-sm text-gray-900">
                    {car.stencil_class || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Lining Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {car.lining_type || 'None'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Nitrogen Pad Stage
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {car.nitrogen_pad_stage || 'N/A'}
                  </dd>
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

          {/* Override Options */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Override Options</h3>
            </div>
            <div className="card-body">
              <OverrideOptions overrides={overrides} onChange={setOverrides} />

              <div className="mt-6">
                <button
                  onClick={handleEvaluate}
                  disabled={loading}
                  className="btn btn-primary w-full"
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
        <div className="bg-danger-50 border border-danger-500 text-danger-700 px-4 py-3 rounded-lg">
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
              <span className="badge badge-success">
                {eligibleCount} Eligible
              </span>
              <span className="badge badge-info">{totalCount} Total</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <ResultsGrid results={results} />
          </div>
        </div>
      )}
    </div>
  );
}
