'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { ProjectAssignment } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RelockDialogProps {
  open: boolean;
  onConfirm: (data: { new_shop_code: string; new_target_month: string; new_target_date?: string; new_estimated_cost?: number; reason: string }) => void;
  onCancel: () => void;
  assignment: ProjectAssignment | null;
  loading?: boolean;
  getAccessToken: () => string | null;
}

interface ShopOption {
  shop_code: string;
  shop_name: string;
}

export default function RelockDialog({
  open,
  onConfirm,
  onCancel,
  assignment,
  loading = false,
  getAccessToken,
}: RelockDialogProps) {
  const [shopCode, setShopCode] = useState('');
  const [targetMonth, setTargetMonth] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [reason, setReason] = useState('');
  const [shops, setShops] = useState<ShopOption[]>([]);

  const fetchShops = useCallback(async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/shops?active=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setShops(data.data || []);
    } catch {
      // Non-critical
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (open && assignment) {
      setShopCode(assignment.shop_code);
      setTargetMonth(assignment.target_month);
      setTargetDate(assignment.target_date || '');
      setEstimatedCost(assignment.estimated_cost ? String(assignment.estimated_cost) : '');
      setReason('');
      fetchShops();
    }
  }, [open, assignment, fetchShops]);

  if (!open || !assignment) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Relock Assignment
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Car {assignment.car_number} - currently locked at {assignment.shop_name || assignment.shop_code} ({assignment.target_month})
                  </p>
                </div>
              </div>
              <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current state (read-only summary) */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Current Shop</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{assignment.shop_name || assignment.shop_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Current Month</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{assignment.target_month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Lock Version</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">v{assignment.lock_version}</span>
              </div>
            </div>

            {/* New values */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Shop *</label>
                <select
                  value={shopCode}
                  onChange={e => setShopCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="">Select shop...</option>
                  {shops.map(s => (
                    <option key={s.shop_code} value={s.shop_code}>{s.shop_code} - {s.shop_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Month *</label>
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={e => setTargetMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Cost</label>
                <input
                  type="number"
                  value={estimatedCost}
                  onChange={e => setEstimatedCost(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Relock *</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  placeholder="Mandatory: explain why this assignment is being changed..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm({
                  new_shop_code: shopCode,
                  new_target_month: targetMonth,
                  new_target_date: targetDate || undefined,
                  new_estimated_cost: estimatedCost ? parseFloat(estimatedCost) : undefined,
                  reason,
                })}
                disabled={loading || !shopCode || !targetMonth || !reason.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                {loading ? 'Relocking...' : 'Confirm Relock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
