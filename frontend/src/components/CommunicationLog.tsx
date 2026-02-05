'use client';

import { useState } from 'react';
import { MessageSquare, Eye, Plus } from 'lucide-react';
import type { ProjectCommunication, CommunicationType, CommunicationMethod } from '@/types';

const COMM_TYPE_LABELS: Record<string, string> = {
  plan_shared: 'Plan Shared',
  lock_notification: 'Lock Notification',
  relock_notification: 'Relock Notification',
  status_update: 'Status Update',
  completion_notice: 'Completion Notice',
  other: 'Other',
};

const COMM_METHOD_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  meeting: 'Meeting',
  portal: 'Portal',
  other: 'Other',
};

interface CommunicationLogProps {
  communications: ProjectCommunication[];
  loading: boolean;
  onLog: (data: {
    communication_type: CommunicationType;
    communicated_to?: string;
    communication_method?: CommunicationMethod;
    subject?: string;
    notes?: string;
  }) => void;
  isActive: boolean;
}

export default function CommunicationLog({
  communications,
  loading,
  onLog,
  isActive,
}: CommunicationLogProps) {
  const [showForm, setShowForm] = useState(false);
  const [viewSnapshot, setViewSnapshot] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    communication_type: 'plan_shared' as CommunicationType,
    communicated_to: '',
    communication_method: 'email' as CommunicationMethod,
    subject: '',
    notes: '',
  });

  const handleSubmit = () => {
    onLog({
      communication_type: form.communication_type,
      communicated_to: form.communicated_to || undefined,
      communication_method: form.communication_method || undefined,
      subject: form.subject || undefined,
      notes: form.notes || undefined,
    });
    setShowForm(false);
    setForm({
      communication_type: 'plan_shared',
      communicated_to: '',
      communication_method: 'email',
      subject: '',
      notes: '',
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isActive && (
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Communication
        </button>
      )}

      {/* Log Form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type *</label>
              <select
                value={form.communication_type}
                onChange={e => setForm({ ...form, communication_type: e.target.value as CommunicationType })}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              >
                {Object.entries(COMM_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Method</label>
              <select
                value={form.communication_method}
                onChange={e => setForm({ ...form, communication_method: e.target.value as CommunicationMethod })}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              >
                {Object.entries(COMM_METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Communicated To</label>
            <input
              type="text"
              value={form.communicated_to}
              onChange={e => setForm({ ...form, communicated_to: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              placeholder="Recipient name/email"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              placeholder="Brief subject line"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {communications.length === 0 ? (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No communications logged yet
        </div>
      ) : (
        <div className="space-y-2">
          {communications.map(c => (
            <div key={c.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {COMM_TYPE_LABELS[c.communication_type] || c.communication_type}
                    </span>
                    {c.communication_method && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        via {COMM_METHOD_LABELS[c.communication_method] || c.communication_method}
                      </span>
                    )}
                  </div>
                  {c.subject && <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{c.subject}</p>}
                  {c.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.notes}</p>}
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {c.communicated_by_name || 'Unknown'} &middot; {new Date(c.communicated_at).toLocaleString()}
                    {c.communicated_to && <> &middot; To: {c.communicated_to}</>}
                  </div>
                </div>
                <button
                  onClick={() => setViewSnapshot(c.plan_version_snapshot)}
                  className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                  title="View plan snapshot"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Snapshot Modal */}
      {viewSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setViewSnapshot(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Plan Snapshot</h3>
              <button onClick={() => setViewSnapshot(null)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <span className="text-xs">Close</span>
              </button>
            </div>
            <pre className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-96">
              {JSON.stringify(viewSnapshot, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
