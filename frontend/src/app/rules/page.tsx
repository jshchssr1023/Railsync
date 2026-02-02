'use client';

import { useState, useEffect, useCallback } from 'react';
import { listRules, updateRule } from '@/lib/api';
import { EligibilityRule } from '@/types';
import { useAuth } from '@/context/AuthContext';

export default function RulesPage() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await listRules(!showInactive);
      setRules(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggleActive = async (rule: EligibilityRule) => {
    setSaving(true);

    try {
      const updated = await updateRule(rule.rule_id, {
        is_active: !rule.is_active,
      });

      setRules(rules.map((r) => (r.rule_id === updated.rule_id ? updated : r)));
    } catch (err: any) {
      setError(err.message || 'Failed to update rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlocking = async (rule: EligibilityRule) => {
    setSaving(true);

    try {
      const updated = await updateRule(rule.rule_id, {
        is_blocking: !rule.is_blocking,
      });

      setRules(rules.map((r) => (r.rule_id === updated.rule_id ? updated : r)));
    } catch (err: any) {
      setError(err.message || 'Failed to update rule');
    } finally {
      setSaving(false);
    }
  };

  const groupedRules = rules.reduce((acc, rule) => {
    const category = rule.rule_category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(rule);
    return acc;
  }, {} as Record<string, EligibilityRule[]>);

  const categoryLabels: Record<string, string> = {
    car_type: 'Car Type Rules',
    material: 'Material Handling Rules',
    lining: 'Lining Capability Rules',
    certification: 'Certification Rules',
    commodity: 'Commodity Restriction Rules',
    capacity: 'Capacity Rules',
    network: 'Network Rules',
    special: 'Special Handling Rules',
    service: 'Service Capability Rules',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-primary-600 mx-auto"
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
          <p className="mt-2 text-gray-500">Loading rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Eligibility Rules</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage the rules used to evaluate shop eligibility
          </p>
        </div>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">Show inactive rules</span>
        </label>
      </div>

      {/* Admin Notice */}
      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
          <p className="text-sm">
            <strong>Note:</strong> You are viewing rules in read-only mode. Sign in as an admin to modify rules.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-danger-50 border border-danger-500 text-danger-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Rules by Category */}
      {Object.entries(groupedRules).map(([category, categoryRules]) => (
        <div key={category} className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              {categoryLabels[category] || category}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {categoryRules.length} rule{categoryRules.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Rule ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="text-center">Priority</th>
                  <th className="text-center">Blocking</th>
                  <th className="text-center">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categoryRules
                  .sort((a, b) => a.priority - b.priority)
                  .map((rule) => (
                    <tr
                      key={rule.rule_id}
                      className={!rule.is_active ? 'bg-gray-50 text-gray-400' : ''}
                    >
                      <td>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {rule.rule_id}
                        </code>
                      </td>
                      <td className="font-medium">{rule.rule_name}</td>
                      <td className="max-w-md">
                        <p className="text-sm text-gray-600 truncate">
                          {rule.rule_description || '-'}
                        </p>
                      </td>
                      <td className="text-center">{rule.priority}</td>
                      <td className="text-center">
                        {isAdmin ? (
                          <button
                            onClick={() => handleToggleBlocking(rule)}
                            disabled={saving}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                              rule.is_blocking
                                ? 'bg-danger-50 text-danger-700 hover:bg-danger-100'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {rule.is_blocking ? 'Yes' : 'No'}
                          </button>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rule.is_blocking
                              ? 'bg-danger-50 text-danger-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {rule.is_blocking ? 'Yes' : 'No'}
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        {isAdmin ? (
                          <button
                            onClick={() => handleToggleActive(rule)}
                            disabled={saving}
                            className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            style={{
                              backgroundColor: rule.is_active
                                ? '#22c55e'
                                : '#d1d5db',
                            }}
                          >
                            <span
                              className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                rule.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              rule.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {rules.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No rules found
        </div>
      )}
    </div>
  );
}
