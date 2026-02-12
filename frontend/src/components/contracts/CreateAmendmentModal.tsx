'use client';

import { useState } from 'react';
import { X, Loader2, FileText } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface LeaseRider {
  id: string;
  rider_id: string;
  rider_name?: string;
  lease_id: string;
  customer_name: string;
}

interface CreateAmendmentModalProps {
  rider: LeaseRider;
  onClose: () => void;
  onCreated: () => void;
}

const AMENDMENT_TYPES = [
  { value: 'Rate Change', description: 'Adjust the per-car monthly rate' },
  { value: 'Add Cars', description: 'Add cars to the rider' },
  { value: 'Remove Cars', description: 'Remove cars from the rider' },
  { value: 'Extension', description: 'Extend the rider term' },
  { value: 'Terms Change', description: 'Modify service or commercial terms' },
];

export default function CreateAmendmentModal({ rider, onClose, onCreated }: CreateAmendmentModalProps) {
  const [form, setForm] = useState({
    amendment_id: '',
    amendment_type: 'Rate Change',
    effective_date: new Date().toISOString().split('T')[0],
    change_summary: '',
    new_rate: '',
    required_shop_date: '',
    service_interval_days: '',
    cars_added: '',
    cars_removed: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;

  const handleSubmit = async () => {
    if (!form.amendment_id || !form.effective_date || !form.change_summary) {
      setError('Amendment ID, effective date, and change summary are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/amendments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          amendment_id: form.amendment_id,
          rider_id: rider.id,
          amendment_type: form.amendment_type,
          effective_date: form.effective_date,
          change_summary: form.change_summary,
          new_rate: form.new_rate ? parseFloat(form.new_rate) : undefined,
          required_shop_date: form.required_shop_date || undefined,
          service_interval_days: form.service_interval_days ? parseInt(form.service_interval_days) : undefined,
          cars_added: form.cars_added ? parseInt(form.cars_added) : undefined,
          cars_removed: form.cars_removed ? parseInt(form.cars_removed) : undefined,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create amendment');
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const showRateField = form.amendment_type === 'Rate Change';
  const showCarFields = form.amendment_type === 'Add Cars' || form.amendment_type === 'Remove Cars';
  const showServiceFields = form.amendment_type === 'Terms Change';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Amendment</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {rider.rider_name || rider.rider_id} — {rider.customer_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amendment ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.amendment_id}
                onChange={e => setForm(p => ({ ...p, amendment_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="AMD-RDR-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.effective_date}
                onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amendment Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {AMENDMENT_TYPES.map(type => (
                <label
                  key={type.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.amendment_type === type.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-500'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="amendment_type"
                    value={type.value}
                    checked={form.amendment_type === type.value}
                    onChange={e => setForm(p => ({ ...p, amendment_type: e.target.value }))}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{type.value}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{type.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {showRateField && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Rate ($/mo per car)
              </label>
              <input
                type="number"
                value={form.new_rate}
                onChange={e => setForm(p => ({ ...p, new_rate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="475.00"
                step="0.01"
                min="0"
              />
            </div>
          )}

          {showCarFields && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cars Added</label>
                <input
                  type="number"
                  value={form.cars_added}
                  onChange={e => setForm(p => ({ ...p, cars_added: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cars Removed</label>
                <input
                  type="number"
                  value={form.cars_removed}
                  onChange={e => setForm(p => ({ ...p, cars_removed: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
          )}

          {showServiceFields && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Required Shop Date</label>
                <input
                  type="date"
                  value={form.required_shop_date}
                  onChange={e => setForm(p => ({ ...p, required_shop_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service Interval (days)</label>
                <input
                  type="number"
                  value={form.service_interval_days}
                  onChange={e => setForm(p => ({ ...p, service_interval_days: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="365"
                  min="1"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Change Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.change_summary}
              onChange={e => setForm(p => ({ ...p, change_summary: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Describe the purpose and scope of this amendment..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Internal notes..."
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.amendment_id || !form.effective_date || !form.change_summary || submitting}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Create Draft
          </button>
        </div>
      </div>
    </div>
  );
}
