'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { Loader2, Calculator, Clock, Settings } from 'lucide-react';

interface WorkHoursFactor {
  factor_type: string;
  factor_value: string;
  base_hours: number;
  complexity_multiplier: number;
  description: string | null;
}

interface CalculationResult {
  base_hours: number;
  adjusted_hours: number;
  factors_applied: { name: string; multiplier: number }[];
  total_multiplier: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const FACTOR_TYPES = [
  { value: 'car_type', label: 'Car Type' },
  { value: 'event_type', label: 'Event Type' },
  { value: 'shop_tier', label: 'Shop Tier' },
  { value: 'commodity_class', label: 'Commodity Class' },
];

const FACTOR_VALUES: Record<string, string[]> = {
  car_type: ['Tank', 'Hopper', 'Gondola', 'Boxcar', 'Flatcar', 'Intermodal'],
  event_type: ['SQ', 'AM', 'QR', 'BR', 'WH', 'RA', 'PR', 'CM'],
  shop_tier: ['Tier1', 'Tier2', 'Tier3'],
  commodity_class: ['A', 'B', 'C', 'D', 'E', 'hazmat', 'kosher'],
};

export default function WorkHoursPage() {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [factorType, setFactorType] = useState('car_type');
  const [factorValue, setFactorValue] = useState('Tank');
  const [factors, setFactors] = useState<WorkHoursFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(false);

  // Calculator state
  const [calcCar, setCalcCar] = useState({ car_type: 'Tank', event_type: 'SQ', commodity_class: 'D' });
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const [tab, setTab] = useState<'factors' | 'calculator'>('factors');

  const isAdmin = user?.role === 'admin';
  const getToken = () => localStorage.getItem('railsync_access_token');

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    });
    return res.json();
  };

  const loadFactors = async () => {
    setLoadingFactors(true);
    try {
      const data = await fetchWithAuth(`/work-hours/factors?factor_type=${factorType}&factor_value=${factorValue}`);
      if (data.success) setFactors(Array.isArray(data.data) ? data.data : [data.data].filter(Boolean));
    } catch {
      toast.error('Failed to load work hours factors');
    } finally {
      setLoadingFactors(false);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const data = await fetchWithAuth('/work-hours/calculate', {
        method: 'POST',
        body: JSON.stringify({ car: calcCar, overrides: {} }),
      });
      if (data.success) {
        setCalcResult(data.data);
      } else {
        toast.error(data.error || 'Calculation failed');
      }
    } catch {
      toast.error('Failed to calculate work hours');
    } finally {
      setCalculating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12 text-gray-500">Please sign in to view work hours configuration.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Work Hours Configuration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          View work hour factors and calculate estimated labor hours for service events
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {[
          { key: 'factors' as const, label: 'Factors', icon: Settings },
          { key: 'calculator' as const, label: 'Calculator', icon: Calculator },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'factors' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Factor Type</label>
              <select
                value={factorType}
                onChange={(e) => { setFactorType(e.target.value); setFactorValue(FACTOR_VALUES[e.target.value]?.[0] || ''); }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {FACTOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Factor Value</label>
              <select
                value={factorValue}
                onChange={(e) => setFactorValue(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {(FACTOR_VALUES[factorType] || []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadFactors}
              disabled={loadingFactors}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loadingFactors ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              Load Factors
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {loadingFactors ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : factors.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Select a factor type and value, then click "Load Factors"</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Factor Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Value</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Base Hours</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Complexity Mult.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {factors.map((f, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{f.factor_type}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{f.factor_value}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-gray-100">{f.base_hours}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-gray-100">{f.complexity_multiplier}x</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{f.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'calculator' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Work Hours Calculator</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Car Type</label>
                <select
                  value={calcCar.car_type}
                  onChange={(e) => setCalcCar({ ...calcCar, car_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {FACTOR_VALUES.car_type.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type</label>
                <select
                  value={calcCar.event_type}
                  onChange={(e) => setCalcCar({ ...calcCar, event_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {FACTOR_VALUES.event_type.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Commodity Class</label>
                <select
                  value={calcCar.commodity_class}
                  onChange={(e) => setCalcCar({ ...calcCar, commodity_class: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {FACTOR_VALUES.commodity_class.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                Calculate Hours
              </button>
            </div>
          </div>

          {calcResult && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Calculation Result</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Base Hours</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{calcResult.base_hours}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Multiplier</div>
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{calcResult.total_multiplier}x</div>
                </div>
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <div className="text-sm text-primary-600 dark:text-primary-400">Adjusted Hours</div>
                  <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">{calcResult.adjusted_hours}</div>
                </div>
              </div>
              {calcResult.factors_applied && calcResult.factors_applied.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase">Factors Applied</h4>
                  <div className="space-y-1">
                    {calcResult.factors_applied.map((f, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{f.name}</span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">{f.multiplier}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
