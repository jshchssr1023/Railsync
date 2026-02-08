'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { Loader2, Plus, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, FileText, Pencil } from 'lucide-react';
import EditableCell from '@/components/EditableCell';

interface ServicePlan {
  id: string;
  customer_code: string | null;
  name: string;
  description: string | null;
  status: string;
  car_flow_rate: number;
  start_date: string;
  end_date: string;
  fiscal_year: number;
  response_deadline: string | null;
  created_at: string;
  options?: PlanOption[];
}

interface PlanOption {
  id: string;
  plan_id: string;
  name: string;
  description: string | null;
  status: string;
  target_month: string | null;
  shop_code: string | null;
  estimated_cost: number | null;
  car_count: number;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function ServicePlansPage() {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    customer_code: '',
    fiscal_year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    car_flow_rate: 0,
    response_deadline: '',
  });

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

  useEffect(() => {
    if (isAuthenticated) loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, filterStatus, filterYear]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterYear) params.append('fiscal_year', filterYear);
      const data = await fetchWithAuth(`/service-plans?${params}`);
      if (data.success) setPlans(data.data);
    } catch {
      toast.error('Failed to load service plans');
    } finally {
      setLoading(false);
    }
  };

  const loadPlanDetail = async (id: string) => {
    try {
      const data = await fetchWithAuth(`/service-plans/${id}`);
      if (data.success) {
        setPlans((prev) =>
          prev.map((p) => (p.id === id ? { ...p, options: data.data.options } : p))
        );
      }
    } catch {
      toast.error('Failed to load plan details');
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedPlan === id) {
      setExpandedPlan(null);
    } else {
      setExpandedPlan(id);
      const plan = plans.find((p) => p.id === id);
      if (!plan?.options) loadPlanDetail(id);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const data = await fetchWithAuth('/service-plans', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (data.success) {
        toast.success('Service plan created');
        setShowCreateForm(false);
        setForm({ name: '', description: '', customer_code: '', fiscal_year: new Date().getFullYear(), start_date: '', end_date: '', car_flow_rate: 0, response_deadline: '' });
        loadPlans();
      } else {
        toast.error(data.error || 'Failed to create plan');
      }
    } catch {
      toast.error('Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const data = await fetchWithAuth(`/service-plans/${id}/approve`, { method: 'POST' });
      if (data.success) {
        toast.success('Plan approved');
        loadPlans();
      } else {
        toast.error(data.error || 'Failed to approve');
      }
    } catch {
      toast.error('Failed to approve plan');
    }
  };

  // Update a single field on a service plan (inline edit)
  const handleUpdatePlanField = async (
    id: string,
    field: 'name' | 'description',
    newValue: string | number,
  ) => {
    try {
      const data = await fetchWithAuth(`/service-plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: newValue }),
      });
      if (data.success) {
        // Update local state immediately
        setPlans((prev) =>
          prev.map((p) => (p.id === id ? { ...p, [field]: newValue } : p))
        );
        toast.success('Plan updated');
      } else {
        toast.error(data.error || 'Failed to update plan');
        throw new Error(data.error || 'Failed to update plan');
      }
    } catch (err) {
      toast.error('Failed to update plan');
      throw err;
    }
  };

  // Update a single field on a plan option (inline edit)
  const handleUpdateOptionField = async (
    optionId: string,
    planId: string,
    field: 'name' | 'description',
    newValue: string | number,
  ) => {
    try {
      const data = await fetchWithAuth(`/service-plan-options/${optionId}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: newValue }),
      });
      if (data.success) {
        // Update local state immediately
        setPlans((prev) =>
          prev.map((p) => {
            if (p.id !== planId || !p.options) return p;
            return {
              ...p,
              options: p.options.map((opt) =>
                opt.id === optionId ? { ...opt, [field]: newValue } : opt
              ),
            };
          })
        );
        toast.success('Option updated');
      } else {
        toast.error(data.error || 'Failed to update option');
        throw new Error(data.error || 'Failed to update option');
      }
    } catch (err) {
      toast.error('Failed to update option');
      throw err;
    }
  };

  const handleReject = async (id: string) => {
    try {
      const data = await fetchWithAuth(`/service-plans/${id}/reject`, { method: 'POST' });
      if (data.success) {
        toast.success('Plan rejected');
        loadPlans();
      } else {
        toast.error(data.error || 'Failed to reject');
      }
    } catch {
      toast.error('Failed to reject plan');
    }
  };

  const years = [...new Set(plans.map((p) => p.fiscal_year))].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Service Plans</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Multi-option service proposals with approval workflow
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Plan
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Create Service Plan</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="FY2026 Q1 Service Plan"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Code</label>
              <input
                type="text"
                value={form.customer_code}
                onChange={(e) => setForm({ ...form, customer_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fiscal Year *</label>
              <input
                type="number"
                required
                value={form.fiscal_year}
                onChange={(e) => setForm({ ...form, fiscal_year: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date *</label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Car Flow Rate</label>
              <input
                type="number"
                value={form.car_flow_rate}
                onChange={(e) => setForm({ ...form, car_flow_rate: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Response Deadline</label>
              <input
                type="date"
                value={form.response_deadline}
                onChange={(e) => setForm({ ...form, response_deadline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Plan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
        {years.length > 0 && (
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      {/* Plans list */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No service plans found</p>
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <button
                onClick={() => toggleExpand(plan.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-center gap-4 text-left">
                  {expandedPlan === plan.id ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{plan.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {plan.customer_code && <span className="mr-3">Customer: {plan.customer_code}</span>}
                      FY{plan.fiscal_year} &middot; {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {plan.car_flow_rate > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{plan.car_flow_rate} cars/mo</span>
                  )}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[plan.status] || STATUS_STYLES.draft}`}>
                    {plan.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </button>

              {expandedPlan === plan.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                  {/* Editable plan name */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Plan Name</label>
                    <EditableCell
                      value={plan.name}
                      type="text"
                      editable={isAdmin && plan.status === 'draft'}
                      onSave={(v) => handleUpdatePlanField(plan.id, 'name', v)}
                      className="font-medium"
                    />
                  </div>

                  {/* Editable description */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Description</label>
                    <EditableCell
                      value={plan.description || ''}
                      type="text"
                      editable={isAdmin && plan.status === 'draft'}
                      onSave={(v) => handleUpdatePlanField(plan.id, 'description', v)}
                      placeholder="No description"
                    />
                  </div>

                  {/* Admin actions */}
                  {isAdmin && plan.status === 'pending_approval' && (
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => handleApprove(plan.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(plan.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}

                  {/* Options */}
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Plan Options</h3>
                  {plan.options && plan.options.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Option</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Target Month</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Shop</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Est. Cost</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cars</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {plan.options.map((opt) => (
                            <tr key={opt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-medium">
                                <EditableCell
                                  value={opt.name}
                                  type="text"
                                  editable={isAdmin && plan.status === 'draft'}
                                  onSave={(v) => handleUpdateOptionField(opt.id, plan.id, 'name', v)}
                                  className="font-medium"
                                />
                                {opt.description && (
                                  <div className="mt-0.5">
                                    <EditableCell
                                      value={opt.description}
                                      type="text"
                                      editable={isAdmin && plan.status === 'draft'}
                                      onSave={(v) => handleUpdateOptionField(opt.id, plan.id, 'description', v)}
                                      className="text-xs text-gray-500 dark:text-gray-400"
                                    />
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[opt.status] || STATUS_STYLES.draft}`}>
                                  {opt.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">{opt.target_month || '-'}</td>
                              <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">{opt.shop_code || '-'}</td>
                              <td className="px-3 py-2 text-sm text-right text-gray-900 dark:text-gray-100">
                                {opt.estimated_cost != null ? `$${opt.estimated_cost.toLocaleString()}` : '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-center text-gray-600 dark:text-gray-400">{opt.car_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" />
                      {plan.options ? 'No options defined yet' : 'Loading options...'}
                    </div>
                  )}

                  <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    Created: {new Date(plan.created_at).toLocaleString()}
                    {plan.response_deadline && (
                      <span className="ml-4">Deadline: {new Date(plan.response_deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
