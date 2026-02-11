'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertTriangle, ClipboardList, Package, Trash2,
  RefreshCw, Calendar, User, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface PendingCar {
  car_number: string;
  car_type: string;
  lessee_name: string;
  lessee_code: string;
  current_status: string;
  operational_status_group: string;
  commodity: string;
  car_age: number;
}

export default function TriagePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [cars, setCars] = useState<PendingCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showScrapDialog, setShowScrapDialog] = useState<string | null>(null);
  const [scrapForm, setScrapForm] = useState({ reason: '', estimated_salvage_value: '' });
  const [scrapSubmitting, setScrapSubmitting] = useState(false);
  const [scrapError, setScrapError] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
  const fetchWithAuth = (endpoint: string, opts?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  const loadCars = useCallback(async () => {
    try {
      // Fetch cars with pending status group from the browse API
      const res = await fetchWithAuth('/cars-browse');
      const allCars = (res.data || []) as PendingCar[];
      // Filter to pending (once the operational_status_group column is returned)
      // For now, show cars that are in the pending group
      const pending = allCars.filter((c: any) => c.operational_status_group === 'pending');
      setCars(pending);
    } catch {
      setCars([]);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadCars().finally(() => setLoading(false));
    }
  }, [isAuthenticated, loadCars]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCars();
    setRefreshing(false);
  };

  const handleScrapSubmit = async () => {
    if (!showScrapDialog || !scrapForm.reason) return;
    setScrapSubmitting(true);
    setScrapError(null);
    try {
      const res = await fetchWithAuth('/scraps', {
        method: 'POST',
        body: JSON.stringify({
          car_number: showScrapDialog,
          reason: scrapForm.reason,
          estimated_salvage_value: scrapForm.estimated_salvage_value ? parseFloat(scrapForm.estimated_salvage_value) : undefined,
        }),
      });
      if (!res.success) throw new Error(res.error || 'Failed to create scrap proposal');
      setShowScrapDialog(null);
      setScrapForm({ reason: '', estimated_salvage_value: '' });
      await loadCars();
    } catch (err: any) {
      setScrapError(err.message);
    } finally {
      setScrapSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Please sign in to view the triage queue
        </h2>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Pending Triage
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cars awaiting disposition decision. Each car requires individual review per R13.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Queue */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : cars.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Pending Cars</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All cars have been triaged. Check back when new cars enter the pending queue.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cars.map((car) => (
            <div
              key={car.car_number}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <Link
                      href={`/cars?search=${car.car_number}`}
                      className="text-base font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      {car.car_number}
                    </Link>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {car.car_type && <span>{car.car_type}</span>}
                      {car.lessee_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {car.lessee_name}
                        </span>
                      )}
                      {car.commodity && <span>{car.commodity}</span>}
                      {car.car_age != null && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {car.car_age}yr
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/assignments?car_number=${car.car_number}&source=triage`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Assign
                  </Link>
                  <Link
                    href={`/releases?car_number=${car.car_number}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Release
                  </Link>
                  <button
                    onClick={() => { setShowScrapDialog(car.car_number); setScrapError(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Scrap
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scrap Proposal Dialog */}
      {showScrapDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
              Propose Scrap: {showScrapDialog}
            </h3>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Scrap is irreversible once in progress. This car will be permanently decommissioned.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={scrapForm.reason}
                  onChange={(e) => setScrapForm(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Why should this car be scrapped?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estimated Salvage Value ($)
                </label>
                <input
                  type="number"
                  value={scrapForm.estimated_salvage_value}
                  onChange={(e) => setScrapForm(prev => ({ ...prev, estimated_salvage_value: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>

              {scrapError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-xs text-red-700 dark:text-red-400">{scrapError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowScrapDialog(null); setScrapForm({ reason: '', estimated_salvage_value: '' }); }}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScrapSubmit}
                  disabled={!scrapForm.reason || scrapSubmitting}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {scrapSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Propose Scrap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
