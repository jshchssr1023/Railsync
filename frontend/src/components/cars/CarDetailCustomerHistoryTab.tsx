'use client';

import { useState, useEffect } from 'react';
import { Loader2, Users, User, FileText, Calendar, Info } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('railsync_access_token');
}

async function apiFetch<T>(endpoint: string): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

interface CustomerHistoryEntry {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  lease_number: string;
  lease_name: string;
  lease_status: string;
  rider_number: string;
  rider_name: string;
  rate_per_car: number | null;
  added_date: string | null;
  removed_date: string | null;
  is_active: boolean;
  assignment_status: string;
}

export default function CarDetailCustomerHistoryTab({ carNumber }: { carNumber: string }) {
  const [history, setHistory] = useState<CustomerHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ data: CustomerHistoryEntry[] }>(`/cars/${carNumber}/customer-history`)
      .then(res => setHistory(res.data || []))
      .catch(err => {
        setError(err.message);
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, [carNumber]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Users className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium">Unable to load customer history</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Users className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium">No customer history</p>
        <p className="text-xs mt-1">No customer or lessee assignments found for this car.</p>
      </div>
    );
  }

  const current = history.filter(h => h.is_active);
  const past = history.filter(h => !h.is_active);

  return (
    <div className="space-y-6">
      {/* Current Assignment */}
      {current.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Current Assignment</h3>
          {current.map((entry, i) => (
            <div
              key={`current-${i}`}
              className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.customer_name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{entry.customer_code}</span>
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Active
                    </span>
                  </div>
                </div>
                {entry.rate_per_car != null && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">Rate / Car</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">${entry.rate_per_car.toLocaleString()}</p>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lease</p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {entry.lease_name || entry.lease_number}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Rider</p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{entry.rider_name || entry.rider_number}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lease Status</p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{entry.lease_status}</p>
                </div>
                {entry.added_date && (
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Assigned Since</p>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {entry.added_date.slice(0, 10)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past Assignments */}
      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Past Assignments</h3>
          <div className="relative pl-6 space-y-0">
            <div className="absolute left-[9px] top-1 bottom-1 w-px bg-gray-200 dark:bg-gray-700" />
            {past.map((entry, i) => (
              <div key={`past-${i}`} className="relative py-3">
                <div className="absolute left-[-15px] top-5 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 ring-2 ring-white dark:ring-gray-900" />
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.customer_name}</span>
                        <span className="text-xs text-gray-400">{entry.customer_code}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {entry.lease_name || entry.lease_number}
                        {entry.rider_name && <> &middot; Rider: {entry.rider_name}</>}
                      </p>
                    </div>
                    {entry.rate_per_car != null && (
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">${entry.rate_per_car.toLocaleString()}/car</span>
                    )}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {entry.added_date?.slice(0, 10) || '?'} — {entry.removed_date?.slice(0, 10) || 'Unknown'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notice about data completeness */}
      {past.length === 0 && current.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Historical customer tracking began when this feature was activated. Only assignments recorded after that date are shown.
          </p>
        </div>
      )}
    </div>
  );
}
