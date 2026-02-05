'use client';

import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import type { ProjectAssignment } from '@/types';

interface LockConfirmationModalProps {
  open: boolean;
  onConfirm: (confirmedIds: string[]) => void;
  onCancel: () => void;
  assignments: ProjectAssignment[];
  loading?: boolean;
}

export default function LockConfirmationModal({
  open,
  onConfirm,
  onCancel,
  assignments,
  loading = false,
}: LockConfirmationModalProps) {
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set(assignments.map(a => a.id)));

  const toggleConfirm = (id: string) => {
    const next = new Set(confirmedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setConfirmedIds(next);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Lock Car Assignments
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Locking creates SSOT assignment records. This commits these cars to the specified shops.
                  </p>
                </div>
              </div>
              <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Read-only summary with item-level confirmation */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-8" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Car</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Shop</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Month</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {assignments.map(a => (
                    <tr key={a.id} className={!confirmedIds.has(a.id) ? 'opacity-40' : ''}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={confirmedIds.has(a.id)}
                          onChange={() => toggleConfirm(a.id)}
                          className="rounded"
                          disabled={loading}
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {a.car_number}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                        {a.shop_name || a.shop_code}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                        {a.target_month}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 text-right">
                        {a.estimated_cost ? `$${Number(a.estimated_cost).toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              {confirmedIds.size} of {assignments.length} cars selected for locking
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(Array.from(confirmedIds))}
                disabled={loading || confirmedIds.size === 0}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                {loading ? 'Locking...' : `Confirm Lock (${confirmedIds.size})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
