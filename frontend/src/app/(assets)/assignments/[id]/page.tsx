'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FetchError } from '@/components/ErrorBoundary';
import { useToast } from '@/components/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ServiceOption {
  id: string;
  service_type: string;
  service_category: string;
  description?: string;
  due_date?: string;
  is_required: boolean;
  is_selected: boolean;
  status: string;
  estimated_cost?: number;
  actual_cost?: number;
}

interface Assignment {
  id: string;
  car_number: string;
  shop_code: string;
  shop_name?: string;
  target_month: string;
  target_date?: string;
  status: string;
  priority: number;
  is_expedited: boolean;
  expedite_reason?: string;
  estimated_cost?: number;
  actual_cost?: number;
  source: string;
  created_at: string;
  service_options?: ServiceOption[];
}

const STATUS_COLORS: Record<string, string> = {
  Planned: 'bg-blue-100 text-blue-800',
  Scheduled: 'bg-indigo-100 text-indigo-800',
  Enroute: 'bg-yellow-100 text-yellow-800',
  Arrived: 'bg-orange-100 text-orange-800',
  InShop: 'bg-purple-100 text-purple-800',
  Complete: 'bg-green-100 text-green-800',
  Cancelled: 'bg-gray-100 text-gray-800',
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddOption, setShowAddOption] = useState(false);

  const fetchAssignment = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/assignments/${params.id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load');
      setAssignment(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const handleAddOption = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const res = await fetch(`${API_URL}/assignments/${params.id}/service-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: formData.get('service_type'),
          service_category: formData.get('service_category'),
          description: formData.get('description'),
          estimated_cost: parseFloat(formData.get('estimated_cost') as string) || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to add');
      setShowAddOption(false);
      fetchAssignment();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add option');
    }
  };

  const handleToggleOption = async (optionId: string, isSelected: boolean) => {
    try {
      await fetch(`${API_URL}/service-options/${optionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_selected: !isSelected }),
      });
      fetchAssignment();
    } catch (err) {
      toast.error('Failed to update option');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="container mx-auto p-6">
        <FetchError error={error || 'Assignment not found'} onRetry={fetchAssignment} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Assignment: {assignment.car_number}
          </h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[assignment.status] || 'bg-gray-100'}`}>
          {assignment.status}
        </span>
      </div>

      {/* Assignment Details */}
      <div className="card p-4">
        <h2 className="text-lg font-semibold mb-4">Assignment Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Shop</dt>
            <dd className="font-medium">{assignment.shop_name || assignment.shop_code}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Target Month</dt>
            <dd className="font-medium">{assignment.target_month}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Priority</dt>
            <dd className="font-medium">{PRIORITY_LABELS[assignment.priority]}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Source</dt>
            <dd className="font-medium">{assignment.source.replace('_', ' ')}</dd>
          </div>
          {assignment.estimated_cost && (
            <div>
              <dt className="text-gray-500">Estimated Cost</dt>
              <dd className="font-medium">${assignment.estimated_cost.toLocaleString()}</dd>
            </div>
          )}
          {assignment.is_expedited && (
            <div className="col-span-2">
              <dt className="text-gray-500">Expedite Reason</dt>
              <dd className="font-medium text-red-600">{assignment.expedite_reason}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Service Options */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Service Options</h2>
          <button
            onClick={() => setShowAddOption(!showAddOption)}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            {showAddOption ? 'Cancel' : '+ Add Option'}
          </button>
        </div>

        {showAddOption && (
          <form onSubmit={handleAddOption} className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select name="service_type" required className="input w-full text-sm">
                  <option value="tank_qualification">Tank Qualification</option>
                  <option value="rule_88b">Rule 88B</option>
                  <option value="safety_relief">Safety Relief</option>
                  <option value="bad_order_repair">Bad Order Repair</option>
                  <option value="running_repair">Running Repair</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="painting">Painting</option>
                  <option value="inspection">Inspection</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select name="service_category" required className="input w-full text-sm">
                  <option value="qualification">Qualification</option>
                  <option value="repair">Repair</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inspection">Inspection</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input name="description" className="input w-full text-sm" placeholder="Optional description" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estimated Cost</label>
              <input name="estimated_cost" type="number" step="0.01" className="input w-full text-sm" placeholder="0.00" />
            </div>
            <button type="submit" className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">
              Add Service Option
            </button>
          </form>
        )}

        {assignment.service_options && assignment.service_options.length > 0 ? (
          <div className="space-y-2">
            {assignment.service_options.map((opt) => (
              <div
                key={opt.id}
                className={`flex items-center justify-between p-3 rounded border ${
                  opt.is_selected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={opt.is_selected}
                    onChange={() => handleToggleOption(opt.id, opt.is_selected)}
                    className="h-4 w-4"
                  />
                  <div>
                    <p className="font-medium text-sm">{opt.service_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{opt.service_category} {opt.description && `- ${opt.description}`}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  {opt.estimated_cost && <p className="text-gray-600">${opt.estimated_cost.toLocaleString()}</p>}
                  <p className={`text-xs ${opt.is_required ? 'text-red-600' : 'text-gray-400'}`}>
                    {opt.is_required ? 'Required' : 'Optional'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No service options attached to this assignment.</p>
        )}
      </div>
    </div>
  );
}
