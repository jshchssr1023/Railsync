'use client';

import { useState } from 'react';
import { getCarByNumber } from '@/lib/api';
import { Car } from '@/types';

interface CarLookupProps {
  onCarFound: (car: Car) => void;
}

export default function CarLookup({ onCarFound }: CarLookupProps) {
  const [carNumber, setCarNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!carNumber.trim()) {
      setError('Please enter a car number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getCarByNumber(carNumber.trim());
      onCarFound(result.car);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch car data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1">
          <label htmlFor="carNumber" className="label">
            Car Number
          </label>
          <input
            type="text"
            id="carNumber"
            value={carNumber}
            onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
            placeholder="e.g., UTLX123456"
            className="input"
            disabled={loading}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary h-[42px] w-full sm:w-auto"
          >
            {loading ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                Loading...
              </span>
            ) : (
              'Look Up Car'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/30 border border-danger-500 text-danger-700 dark:text-danger-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Quick access to real cars in the database */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium">Try these cars:</span>{' '}
        <button
          type="button"
          onClick={() => setCarNumber('ACFX600001')}
          className="text-primary-600 hover:underline font-mono"
        >
          ACFX600001
        </button>
        {', '}
        <button
          type="button"
          onClick={() => setCarNumber('ACFX600002')}
          className="text-primary-600 hover:underline font-mono"
        >
          ACFX600002
        </button>
        {', '}
        <button
          type="button"
          onClick={() => setCarNumber('ACFX600003')}
          className="text-primary-600 hover:underline font-mono"
        >
          ACFX600003
        </button>
        {' '}
        <a
          href="/contracts"
          className="text-gray-400 hover:text-primary-600 hover:underline ml-1"
        >
          (view all 137 cars)
        </a>
      </div>
    </form>
  );
}
