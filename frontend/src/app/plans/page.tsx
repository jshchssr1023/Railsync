'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface MasterPlan {
  id: string;
  name: string;
  description?: string;
  fiscal_year: number;
  planning_month: string;
  status: 'draft' | 'active' | 'archived';
  version_count?: number;
  latest_version?: number;
  current_allocation_count?: number;
  current_estimated_cost?: number;
  created_at: string;
  updated_at: string;
}

interface PlanVersion {
  id: string;
  plan_id: string;
  version_number: number;
  label?: string;
  notes?: string;
  allocation_count: number;
  total_estimated_cost: number;
  allocation_delta?: number;
  cost_delta?: number;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function MasterPlansPage() {
  const { isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<MasterPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MasterPlan | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('auth_token');

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_URL}/master-plans`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setPlans(data.data);
    } catch (err) {
      setError('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async (planId: string) => {
    try {
      const res = await fetch(`${API_URL}/master-plans/${planId}/versions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setVersions(data.data);
    } catch (err) {
      console.error('Failed to load versions');
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchPlans();
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedPlan) fetchVersions(selectedPlan.id);
  }, [selectedPlan]);

  const handleCreatePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch(`${API_URL}/master-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description'),
          fiscal_year: parseInt(formData.get('fiscal_year') as string),
          planning_month: formData.get('planning_month'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlans([data.data, ...plans]);
        setShowCreateModal(false);
      }
    } catch (err) {
      setError('Failed to create plan');
    }
  };

  const handleCreateVersion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPlan) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch(`${API_URL}/master-plans/${selectedPlan.id}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          label: formData.get('label'),
          notes: formData.get('notes'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVersions([data.data, ...versions]);
        setShowVersionModal(false);
        fetchPlans(); // Refresh counts
      }
    } catch (err) {
      setError('Failed to create version');
    }
  };

  const handleStatusChange = async (planId: string, status: string) => {
    try {
      const res = await fetch(`${API_URL}/master-plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setPlans(plans.map(p => p.id === planId ? { ...p, status: status as MasterPlan['status'] } : p));
      }
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const formatCurrency = (val?: number) =>
    val ? `$${(val / 1000000).toFixed(1)}M` : '-';

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'archived': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
      default: return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view master plans.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Master Plans</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Version control for monthly planning cycles
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + New Plan
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plans List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Planning Cycles</h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : plans.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No plans yet</div>
                ) : (
                  plans.map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        selectedPlan?.id === plan.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {plan.name}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(plan.status)}`}>
                          {plan.status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {formatMonth(plan.planning_month)} • {plan.version_count || 0} versions
                      </div>
                      <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {plan.current_allocation_count || 0} allocations • {formatCurrency(plan.current_estimated_cost)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Plan Details & Versions */}
          <div className="lg:col-span-2">
            {selectedPlan ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                {/* Plan Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {selectedPlan.name}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedPlan.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedPlan.status}
                        onChange={(e) => handleStatusChange(selectedPlan.id, e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                      <button
                        onClick={() => setShowVersionModal(true)}
                        className="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                      >
                        + Snapshot
                      </button>
                    </div>
                  </div>
                </div>

                {/* Version History */}
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Version History
                  </h3>
                  {versions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>No versions yet</p>
                      <p className="text-sm mt-1">Create a snapshot to capture current allocations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((v, i) => (
                        <div
                          key={v.id}
                          className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center text-sm font-medium">
                                v{v.version_number}
                              </span>
                              <div>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {v.label || `Version ${v.version_number}`}
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(v.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-gray-900 dark:text-gray-100">
                                {v.allocation_count} allocations
                              </div>
                              <div className="text-gray-500 dark:text-gray-400">
                                {formatCurrency(v.total_estimated_cost)}
                              </div>
                            </div>
                          </div>
                          {i < versions.length - 1 && (v.allocation_delta !== 0 || v.cost_delta !== 0) && (
                            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
                              <span className={v.allocation_delta && v.allocation_delta > 0 ? 'text-green-600' : 'text-red-600'}>
                                {v.allocation_delta && v.allocation_delta > 0 ? '+' : ''}{v.allocation_delta} allocations
                              </span>
                              <span className="mx-2 text-gray-300">|</span>
                              <span className={v.cost_delta && v.cost_delta > 0 ? 'text-green-600' : 'text-red-600'}>
                                {v.cost_delta && v.cost_delta > 0 ? '+' : ''}{formatCurrency(v.cost_delta)} cost
                              </span>
                            </div>
                          )}
                          {v.notes && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              {v.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
                Select a plan to view details and version history
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Create Master Plan
              </h2>
              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plan Name
                  </label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="e.g., March 2026 S&OP"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Planning Month
                  </label>
                  <input
                    name="planning_month"
                    type="month"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fiscal Year
                  </label>
                  <input
                    name="fiscal_year"
                    type="number"
                    required
                    defaultValue={new Date().getFullYear()}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Optional description..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Version Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowVersionModal(false)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Create Version Snapshot
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                This will capture all current allocations for {selectedPlan?.planning_month}.
              </p>
              <form onSubmit={handleCreateVersion} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Version Label
                  </label>
                  <input
                    name="label"
                    type="text"
                    placeholder="e.g., After Customer Review"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="What changed in this version..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowVersionModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Create Snapshot
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
