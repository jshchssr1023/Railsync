'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { Loader2, Truck, MapPin, DollarSign, Calculator } from 'lucide-react';

interface FreightRate {
  id?: string;
  origin_code: string;
  origin_name?: string;
  destination_code: string;
  destination_name?: string;
  rate_per_mile?: number;
  flat_rate?: number;
  distance_miles?: number;
  total_cost?: number;
  effective_date?: string;
}

interface Origin {
  code: string;
  name: string;
  city?: string;
  state?: string;
}

interface CalcResult {
  origin_code: string;
  shop_code: string;
  distance_miles: number;
  rate_per_mile: number;
  total_cost: number;
  estimated_transit_days: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function FreightPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [origins, setOrigins] = useState<Origin[]>([]);
  const [defaultRate, setDefaultRate] = useState<FreightRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'calculator' | 'rates'>('calculator');

  // Calculator
  const [originCode, setOriginCode] = useState('');
  const [shopCode, setShopCode] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);

  // Rate lookup
  const [lookupOrigin, setLookupOrigin] = useState('');
  const [lookupDest, setLookupDest] = useState('');
  const [lookupResult, setLookupResult] = useState<FreightRate | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

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

  useEffect(() => {
    if (isAuthenticated) loadInitialData();
  }, [isAuthenticated]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [originsData, rateData] = await Promise.all([
        fetchWithAuth('/freight/origins'),
        fetchWithAuth('/freight/rates'),
      ]);
      if (originsData.success) setOrigins(originsData.data || []);
      if (rateData.success) setDefaultRate(rateData.data);
    } catch {
      toast.error('Failed to load freight data');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!originCode || !shopCode) {
      toast.error('Enter both origin and shop codes');
      return;
    }
    setCalculating(true);
    setCalcResult(null);
    try {
      const data = await fetchWithAuth('/freight/calculate', {
        method: 'POST',
        body: JSON.stringify({ origin_code: originCode, shop_code: shopCode }),
      });
      if (data.success) {
        setCalcResult(data.data);
      } else {
        toast.error(data.error || 'Calculation failed');
      }
    } catch {
      toast.error('Failed to calculate freight');
    } finally {
      setCalculating(false);
    }
  };

  const handleLookupRate = async () => {
    if (!lookupOrigin || !lookupDest) {
      toast.error('Enter both origin and destination');
      return;
    }
    setLookingUp(true);
    setLookupResult(null);
    try {
      const data = await fetchWithAuth(`/freight/rates?origin=${lookupOrigin}&destination=${lookupDest}`);
      if (data.success) {
        setLookupResult(data.data);
      } else {
        toast.error(data.error || 'Rate not found');
      }
    } catch {
      toast.error('Failed to lookup rate');
    } finally {
      setLookingUp(false);
    }
  };

  if (!isAuthenticated) {
    return <div className="text-center py-12 text-gray-500">Please sign in to access freight tools.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Freight Calculator</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Calculate freight costs and lookup rates for car shipments between origins and shops
        </p>
      </div>

      {/* Default rate card */}
      {defaultRate && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-4">
          <DollarSign className="w-5 h-5 text-green-600" />
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Default Rate</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              ${defaultRate.rate_per_mile?.toFixed(2) || defaultRate.flat_rate?.toFixed(2) || '0.00'}
              {defaultRate.rate_per_mile ? '/mile' : ' flat'}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {[
          { key: 'calculator' as const, label: 'Calculator', icon: Calculator },
          { key: 'rates' as const, label: 'Rate Lookup', icon: DollarSign },
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : tab === 'calculator' ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Freight Cost Calculator</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />
                  Origin
                </label>
                {origins.length > 0 ? (
                  <select
                    value={originCode}
                    onChange={(e) => setOriginCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select origin...</option>
                    {origins.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} - {o.name}{o.city ? ` (${o.city}, ${o.state})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={originCode}
                    onChange={(e) => setOriginCode(e.target.value)}
                    placeholder="Origin code"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Truck className="w-3.5 h-3.5 inline mr-1" />
                  Destination Shop
                </label>
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value)}
                  placeholder="Shop code"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                Calculate
              </button>
            </div>
          </div>

          {calcResult && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Result</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Distance</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{calcResult.distance_miles} mi</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Rate</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">${calcResult.rate_per_mile.toFixed(2)}/mi</div>
                </div>
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <div className="text-sm text-primary-600 dark:text-primary-400">Total Cost</div>
                  <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">${calcResult.total_cost.toLocaleString()}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Transit Days</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{calcResult.estimated_transit_days}</div>
                </div>
              </div>
            </div>
          )}

          {/* Origins reference */}
          {origins.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Available Origins ({origins.length})</h3>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {origins.map((o) => (
                      <tr key={o.code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-2 text-sm font-mono font-medium text-primary-600 dark:text-primary-400">{o.code}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{o.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                          {o.city && o.state ? `${o.city}, ${o.state}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Rate Lookup</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origin Code</label>
                <input
                  type="text"
                  value={lookupOrigin}
                  onChange={(e) => setLookupOrigin(e.target.value)}
                  placeholder="Origin code"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination Code</label>
                <input
                  type="text"
                  value={lookupDest}
                  onChange={(e) => setLookupDest(e.target.value)}
                  placeholder="Destination code"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleLookupRate}
                disabled={lookingUp}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                Lookup Rate
              </button>
            </div>
          </div>

          {lookupResult && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Rate Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Route</div>
                  <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {lookupResult.origin_code} &rarr; {lookupResult.destination_code}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Rate</div>
                  <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                    {lookupResult.rate_per_mile != null
                      ? `$${lookupResult.rate_per_mile.toFixed(2)}/mile`
                      : lookupResult.flat_rate != null
                      ? `$${lookupResult.flat_rate.toFixed(2)} flat`
                      : 'N/A'}
                  </div>
                </div>
                {lookupResult.distance_miles != null && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Distance</div>
                    <div className="text-lg text-gray-900 dark:text-gray-100">{lookupResult.distance_miles} miles</div>
                  </div>
                )}
                {lookupResult.total_cost != null && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Cost</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">${lookupResult.total_cost.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
