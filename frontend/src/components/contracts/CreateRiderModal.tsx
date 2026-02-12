'use client';

import { useState } from 'react';
import { X, Loader2, FileText } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface MasterLease {
  id: string;
  lease_id: string;
  lease_name?: string;
  start_date: string;
  end_date: string;
}

interface CreateRiderModalProps {
  lease: MasterLease;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateRiderModal({ lease, onClose, onCreated }: CreateRiderModalProps) {
  const [form, setForm] = useState({
    rider_id: '',
    rider_name: '',
    effective_date: lease.start_date?.slice(0, 10) || new Date().toISOString().split('T')[0],
    expiration_date: lease.end_date?.slice(0, 10) || '',
    rate_per_car: '',
    specific_terms: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;

  const handleSubmit = async () => {
    if (!form.rider_id || !form.effective_date) {
      setError('Rider ID and effective date are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/riders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          rider_id: form.rider_id,
          master_lease_id: lease.id,
          rider_name: form.rider_name || null,
          effective_date: form.effective_date,
          expiration_date: form.expiration_date || null,
          rate_per_car: form.rate_per_car ? parseFloat(form.rate_per_car) : null,
          specific_terms: form.specific_terms || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create rider');
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Rider</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Lease: {lease.lease_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Date range info */}
        <div className="px-6 pt-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Rider dates must fall within lease period: {lease.start_date?.slice(0, 10)} — {lease.end_date?.slice(0, 10) || 'Open-ended'}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rider ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.rider_id}
                onChange={e => setForm(p => ({ ...p, rider_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="RDR-ML-CUST-A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rider Name
              </label>
              <input
                type="text"
                value={form.rider_name}
                onChange={e => setForm(p => ({ ...p, rider_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Schedule A - Initial Fleet"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.effective_date}
                onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))}
                min={lease.start_date?.slice(0, 10)}
                max={lease.end_date?.slice(0, 10) || undefined}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expiration Date
              </label>
              <input
                type="date"
                value={form.expiration_date}
                onChange={e => setForm(p => ({ ...p, expiration_date: e.target.value }))}
                min={form.effective_date}
                max={lease.end_date?.slice(0, 10) || undefined}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rate / Car ($/mo)
            </label>
            <input
              type="number"
              value={form.rate_per_car}
              onChange={e => setForm(p => ({ ...p, rate_per_car: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="450.00"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Specific Terms
            </label>
            <textarea
              value={form.specific_terms}
              onChange={e => setForm(p => ({ ...p, specific_terms: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Rider-specific terms and conditions..."
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.rider_id || !form.effective_date || submitting}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Create Rider
          </button>
        </div>
      </div>
    </div>
  );
}
