'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Shield, ShieldOff, RotateCcw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import {
  getAbatementConfig,
  updateAbatementConfig,
  getRiderAbatementOverrides,
  setRiderAbatementOverride,
  deleteRiderAbatementOverride,
} from '@/lib/api';

interface ShoppingTypeConfig {
  id: string;
  code: string;
  name: string;
  description: string | null;
  qualifies_for_abatement: boolean;
}

interface RiderOverride {
  id: string | null;
  shopping_type_id: string;
  shopping_type_code: string;
  shopping_type_name: string;
  qualifies_for_abatement: boolean;
  is_override: boolean;
}

interface ActiveRider {
  id: string;
  rider_id: string;
  rider_name: string | null;
  customer_name: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function AbatementConfigPanel() {
  const [globalConfig, setGlobalConfig] = useState<ShoppingTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rider override section
  const [showRiderSection, setShowRiderSection] = useState(false);
  const [riders, setRiders] = useState<ActiveRider[]>([]);
  const [selectedRider, setSelectedRider] = useState<string>('');
  const [riderOverrides, setRiderOverrides] = useState<RiderOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [savingOverride, setSavingOverride] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAbatementConfig();
      setGlobalConfig(data as ShoppingTypeConfig[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRiders = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/riders?status=Active&limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success) setRiders(json.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadConfig();
    loadRiders();
  }, [loadConfig, loadRiders]);

  const handleToggleGlobal = async (typeId: string, qualifies: boolean) => {
    setSaving(typeId);
    try {
      await updateAbatementConfig(typeId, qualifies);
      setGlobalConfig(prev =>
        prev.map(t => t.id === typeId ? { ...t, qualifies_for_abatement: qualifies } : t)
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const loadRiderOverrides = async (riderId: string) => {
    setLoadingOverrides(true);
    try {
      const data = await getRiderAbatementOverrides(riderId);
      setRiderOverrides(data as RiderOverride[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingOverrides(false);
    }
  };

  const handleRiderSelect = (riderId: string) => {
    setSelectedRider(riderId);
    if (riderId) loadRiderOverrides(riderId);
    else setRiderOverrides([]);
  };

  const handleToggleRider = async (typeId: string, qualifies: boolean) => {
    if (!selectedRider) return;
    setSavingOverride(typeId);
    try {
      await setRiderAbatementOverride(selectedRider, typeId, qualifies);
      setRiderOverrides(prev =>
        prev.map(o => o.shopping_type_id === typeId
          ? { ...o, qualifies_for_abatement: qualifies, is_override: true }
          : o
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingOverride(null);
    }
  };

  const handleResetOverride = async (typeId: string) => {
    if (!selectedRider) return;
    setSavingOverride(typeId);
    try {
      await deleteRiderAbatementOverride(selectedRider, typeId);
      // Reload to get global default
      await loadRiderOverrides(selectedRider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingOverride(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Global Config */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Global Abatement Rules
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Shopping types marked as abatement-eligible will suspend rent charges
          for the duration the car is in shop. Per-rider overrides can be set below.
        </p>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Shopping Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Code
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Abatement Eligible
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {globalConfig.map(type => (
                <tr key={type.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{type.name}</p>
                    {type.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{type.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                    {type.code}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleGlobal(type.id, !type.qualifies_for_abatement)}
                      disabled={saving === type.id}
                      className="inline-flex items-center"
                    >
                      {saving === type.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      ) : type.qualifies_for_abatement ? (
                        <div className="w-10 h-5 bg-green-500 rounded-full relative transition-colors">
                          <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                        </div>
                      ) : (
                        <div className="w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full relative transition-colors">
                          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                        </div>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Rider Overrides */}
      <div>
        <button
          onClick={() => setShowRiderSection(!showRiderSection)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
        >
          {showRiderSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Per-Rider Overrides
        </button>

        {showRiderSection && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Rider overrides take precedence over global settings. Use the reset button to revert a type to the global default.
              </p>
            </div>

            <select
              value={selectedRider}
              onChange={e => handleRiderSelect(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select a rider...</option>
              {riders.map(r => (
                <option key={r.id} value={r.id}>
                  {r.rider_id} — {r.rider_name || r.customer_name}
                </option>
              ))}
            </select>

            {loadingOverrides && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            )}

            {selectedRider && !loadingOverrides && riderOverrides.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Eligible</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {riderOverrides.map(o => (
                      <tr key={o.shopping_type_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          {o.shopping_type_name}
                          <span className="ml-1 text-xs text-gray-400 font-mono">{o.shopping_type_code}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleToggleRider(o.shopping_type_id, !o.qualifies_for_abatement)}
                            disabled={savingOverride === o.shopping_type_id}
                          >
                            {savingOverride === o.shopping_type_id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
                            ) : o.qualifies_for_abatement ? (
                              <Shield className="w-4 h-4 text-green-500 mx-auto" />
                            ) : (
                              <ShieldOff className="w-4 h-4 text-gray-400 mx-auto" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            o.is_override
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {o.is_override ? 'Override' : 'Global'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {o.is_override && (
                            <button
                              onClick={() => handleResetOverride(o.shopping_type_id)}
                              disabled={savingOverride === o.shopping_type_id}
                              className="text-xs text-gray-500 hover:text-primary-600 dark:hover:text-primary-400"
                              title="Reset to global default"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
