'use client';

import { useState, useEffect, useCallback } from 'react';
import { listRules, updateRule, createRule } from '@/lib/api';
import { EligibilityRule } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Plus, X, Pencil, Save } from 'lucide-react';

const CATEGORIES = [
  { value: 'car_type', label: 'Car Type Rules' },
  { value: 'material', label: 'Material Handling Rules' },
  { value: 'lining', label: 'Lining Capability Rules' },
  { value: 'certification', label: 'Certification Rules' },
  { value: 'commodity', label: 'Commodity Restriction Rules' },
  { value: 'capacity', label: 'Capacity Rules' },
  { value: 'network', label: 'Network Rules' },
  { value: 'special', label: 'Special Handling Rules' },
  { value: 'service', label: 'Service Capability Rules' },
];

const categoryLabels: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

const emptyForm = {
  rule_id: '',
  rule_name: '',
  rule_category: 'car_type',
  rule_description: '',
  priority: 100,
  is_active: true,
  is_blocking: false,
  condition_json: {},
};

export default function RulesPage() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create/Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Inline editing
  const [inlineEdit, setInlineEdit] = useState<string | null>(null);
  const [inlineValues, setInlineValues] = useState<{ rule_name: string; rule_description: string; priority: number }>({ rule_name: '', rule_description: '', priority: 0 });

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

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleToggleActive = async (rule: EligibilityRule) => {
    setSaving(true);
    try {
      const updated = await updateRule(rule.rule_id, { is_active: !rule.is_active });
      setRules(rules.map(r => r.rule_id === updated.rule_id ? updated : r));
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleToggleBlocking = async (rule: EligibilityRule) => {
    setSaving(true);
    try {
      const updated = await updateRule(rule.rule_id, { is_blocking: !rule.is_blocking });
      setRules(rules.map(r => r.rule_id === updated.rule_id ? updated : r));
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const newRule = await createRule({
        rule_id: form.rule_id,
        rule_name: form.rule_name,
        rule_category: form.rule_category,
        rule_description: form.rule_description,
        priority: form.priority,
        is_active: form.is_active,
        is_blocking: form.is_blocking,
        condition_json: form.condition_json,
      });
      setRules(prev => [...prev, newRule]);
      setShowForm(false);
      setForm(emptyForm);
    } catch (err: any) { setError(err.message || 'Failed to create rule'); }
    finally { setSaving(false); }
  };

  const startInlineEdit = (rule: EligibilityRule) => {
    setInlineEdit(rule.rule_id);
    setInlineValues({ rule_name: rule.rule_name, rule_description: rule.rule_description || '', priority: rule.priority });
  };

  const saveInlineEdit = async (ruleId: string) => {
    setSaving(true);
    try {
      const updated = await updateRule(ruleId, inlineValues);
      setRules(rules.map(r => r.rule_id === updated.rule_id ? updated : r));
      setInlineEdit(null);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const groupedRules = rules.reduce((acc, rule) => {
    const category = rule.rule_category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(rule);
    return acc;
  }, {} as Record<string, EligibilityRule[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Eligibility Rules</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage the rules used to evaluate shop eligibility</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
            Show inactive
          </label>
          {isAdmin && (
            <button onClick={() => { setShowForm(!showForm); setForm(emptyForm); }} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">
              <Plus className="w-4 h-4" /> New Rule
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-lg text-sm">
          <strong>Note:</strong> You are viewing rules in read-only mode. Sign in as an admin to modify rules.
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Create Rule Form */}
      {showForm && isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Create New Rule</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rule ID</label>
              <input value={form.rule_id} onChange={e => setForm({ ...form, rule_id: e.target.value })} placeholder="e.g. CAR_TYPE_TANK" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input value={form.rule_name} onChange={e => setForm({ ...form, rule_name: e.target.value })} placeholder="Rule display name" className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select value={form.rule_category} onChange={e => setForm({ ...form, rule_category: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea value={form.rule_description} onChange={e => setForm({ ...form, rule_description: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.is_blocking} onChange={e => setForm({ ...form, is_blocking: e.target.checked })} className="h-4 w-4 text-red-600 border-gray-300 rounded" />
                Blocking
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleCreate} disabled={saving || !form.rule_id || !form.rule_name} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Rule
            </button>
          </div>
        </div>
      )}

      {/* Rules by Category */}
      {Object.entries(groupedRules).map(([category, categoryRules]) => (
        <div key={category} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{categoryLabels[category] || category}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{categoryRules.length} rule{categoryRules.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Rule ID</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Description</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Priority</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Blocking</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Active</th>
                  {isAdmin && <th className="px-4 py-2 text-xs font-medium text-gray-500" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {categoryRules.sort((a, b) => a.priority - b.priority).map(rule => (
                  <tr key={rule.rule_id} className={`${!rule.is_active ? 'bg-gray-50 dark:bg-gray-900/30 opacity-60' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                    <td className="px-4 py-2">
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">{rule.rule_id}</code>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                      {inlineEdit === rule.rule_id ? (
                        <input value={inlineValues.rule_name} onChange={e => setInlineValues({ ...inlineValues, rule_name: e.target.value })} className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                      ) : rule.rule_name}
                    </td>
                    <td className="px-4 py-2 max-w-md">
                      {inlineEdit === rule.rule_id ? (
                        <input value={inlineValues.rule_description} onChange={e => setInlineValues({ ...inlineValues, rule_description: e.target.value })} className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{rule.rule_description || '-'}</p>
                      )}
                    </td>
                    <td className="text-center px-4 py-2 text-gray-700 dark:text-gray-300">
                      {inlineEdit === rule.rule_id ? (
                        <input type="number" value={inlineValues.priority} onChange={e => setInlineValues({ ...inlineValues, priority: parseInt(e.target.value) || 0 })} className="w-16 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                      ) : rule.priority}
                    </td>
                    <td className="text-center px-4 py-2">
                      {isAdmin ? (
                        <button onClick={() => handleToggleBlocking(rule)} disabled={saving} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${rule.is_blocking ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                          {rule.is_blocking ? 'Yes' : 'No'}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rule.is_blocking ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{rule.is_blocking ? 'Yes' : 'No'}</span>
                      )}
                    </td>
                    <td className="text-center px-4 py-2">
                      {isAdmin ? (
                        <button onClick={() => handleToggleActive(rule)} disabled={saving} className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none" style={{ backgroundColor: rule.is_active ? '#22c55e' : '#d1d5db' }}>
                          <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${rule.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{rule.is_active ? 'Active' : 'Inactive'}</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2">
                        {inlineEdit === rule.rule_id ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveInlineEdit(rule.rule_id)} disabled={saving} className="p-1 text-green-600 hover:text-green-700"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setInlineEdit(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => startInlineEdit(rule)} className="p-1 text-gray-400 hover:text-primary-600"><Pencil className="w-4 h-4" /></button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {rules.length === 0 && <div className="text-center py-12 text-gray-500 dark:text-gray-400">No rules found</div>}
    </div>
  );
}
