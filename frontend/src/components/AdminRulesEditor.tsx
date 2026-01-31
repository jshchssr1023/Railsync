'use client';

import { useState, useEffect } from 'react';
import { EligibilityRule, ApiResponse } from '@/types';
import { useAuthFetch, useAuth } from '@/context/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RuleFormData {
  rule_id: string;
  rule_name: string;
  rule_category: string;
  rule_description: string;
  priority: number;
  is_active: boolean;
  is_blocking: boolean;
  condition_json: string;
}

const RULE_CATEGORIES = [
  'car_type',
  'material',
  'lining',
  'certification',
  'commodity',
  'capacity',
  'network',
  'special',
  'service',
];

export default function AdminRulesEditor() {
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<EligibilityRule | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('all');

  const [formData, setFormData] = useState<RuleFormData>({
    rule_id: '',
    rule_name: '',
    rule_category: 'car_type',
    rule_description: '',
    priority: 100,
    is_active: true,
    is_blocking: true,
    condition_json: '{}',
  });

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Fetch rules
  useEffect(() => {
    fetchRules();
  }, [filterCategory, filterActive]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterActive !== 'all') {
        params.append('active', filterActive);
      }

      const response = await fetch(`${API_BASE}/rules?${params.toString()}`);
      const data: ApiResponse<EligibilityRule[]> = await response.json();

      if (data.success && data.data) {
        let filteredRules = data.data;
        if (filterCategory) {
          filteredRules = filteredRules.filter((r) => r.rule_category === filterCategory);
        }
        setRules(filteredRules);
      }
    } catch (err) {
      setError('Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRule = (rule: EligibilityRule) => {
    setSelectedRule(rule);
    setFormData({
      rule_id: rule.rule_id,
      rule_name: rule.rule_name,
      rule_category: rule.rule_category,
      rule_description: rule.rule_description || '',
      priority: rule.priority,
      is_active: rule.is_active,
      is_blocking: rule.is_blocking,
      condition_json: JSON.stringify(rule.condition_json, null, 2),
    });
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleCreateNew = () => {
    setSelectedRule(null);
    setFormData({
      rule_id: '',
      rule_name: '',
      rule_category: 'car_type',
      rule_description: '',
      priority: 100,
      is_active: true,
      is_blocking: true,
      condition_json: '{\n  "type": "capability_check",\n  "capability_type": "car_type",\n  "match_field": "product_code"\n}',
    });
    setIsCreating(true);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      setError('Only administrators can modify rules');
      return;
    }

    // Validate JSON
    let conditionJson;
    try {
      conditionJson = JSON.parse(formData.condition_json);
    } catch {
      setError('Invalid JSON in condition_json field');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        rule_id: formData.rule_id,
        rule_name: formData.rule_name,
        rule_category: formData.rule_category,
        rule_description: formData.rule_description || null,
        priority: formData.priority,
        is_active: formData.is_active,
        is_blocking: formData.is_blocking,
        condition_json: conditionJson,
      };

      let response;
      if (isCreating) {
        response = await authFetch(`${API_BASE}/rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await authFetch(`${API_BASE}/rules/${formData.rule_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save rule');
      }

      setSuccess(isCreating ? 'Rule created successfully' : 'Rule updated successfully');
      setIsEditing(false);
      setIsCreating(false);
      fetchRules();

      // Select the saved rule
      if (data.data) {
        setSelectedRule(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: EligibilityRule) => {
    if (!isAdmin) {
      setError('Only administrators can modify rules');
      return;
    }

    try {
      const response = await authFetch(`${API_BASE}/rules/${rule.rule_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to toggle rule');
      }

      fetchRules();
      setSuccess(`Rule ${rule.is_active ? 'deactivated' : 'activated'} successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle rule');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <svg className="w-12 h-12 mx-auto text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">Access Restricted</h3>
          <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            Only administrators can access the rules editor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px]">
      {/* Left Panel - Rules List */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Eligibility Rules</h3>
            <button
              onClick={handleCreateNew}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              + New Rule
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">All Categories</option>
              {RULE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="all">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No rules found</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {rules.map((rule) => (
                <div
                  key={rule.rule_id}
                  onClick={() => handleSelectRule(rule)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedRule?.rule_id === rule.rule_id
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-500'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {rule.rule_name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {rule.rule_category.replace('_', ' ')} • Priority: {rule.priority}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {rule.is_blocking && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded">
                          Blocking
                        </span>
                      )}
                      <span
                        className={`w-2 h-2 rounded-full ${
                          rule.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Rule Editor */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="m-4 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="m-4 p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-400 rounded-lg">
            {success}
          </div>
        )}

        {selectedRule || isCreating ? (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {isCreating ? 'Create New Rule' : 'Edit Rule'}
              </h3>
              <div className="flex gap-2">
                {!isEditing && !isCreating && (
                  <>
                    <button
                      onClick={() => selectedRule && handleToggleActive(selectedRule)}
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        selectedRule?.is_active
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {selectedRule?.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Edit
                    </button>
                  </>
                )}
                {isEditing && (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setIsCreating(false);
                        if (selectedRule) handleSelectRule(selectedRule);
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Rule ID (only for creation) */}
              {isCreating && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rule ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.rule_id}
                    onChange={(e) => setFormData({ ...formData, rule_id: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                    placeholder="e.g., TANK_CAR_CHECK"
                  />
                </div>
              )}

              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.rule_name}
                  onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.rule_category}
                    onChange={(e) => setFormData({ ...formData, rule_category: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                  >
                    {RULE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority (lower = runs first)
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.rule_description}
                  onChange={(e) => setFormData({ ...formData, rule_description: e.target.value })}
                  disabled={!isEditing}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
              </div>

              {/* Flags */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    disabled={!isEditing}
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_blocking}
                    onChange={(e) => setFormData({ ...formData, is_blocking: e.target.checked })}
                    disabled={!isEditing}
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Blocking (fails evaluation if rule fails)</span>
                </label>
              </div>

              {/* Condition JSON */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Condition (JSON)
                </label>
                <textarea
                  value={formData.condition_json}
                  onChange={(e) => setFormData({ ...formData, condition_json: e.target.value })}
                  disabled={!isEditing}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-900 font-mono text-sm"
                  placeholder="{}"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>Select a rule to view or edit</p>
              <p className="text-sm mt-1">or click &quot;+ New Rule&quot; to create one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
