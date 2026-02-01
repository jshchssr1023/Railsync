'use client';

import { useState } from 'react';
import { EvaluationResult, Car, EvaluationOverrides } from '@/types';
import { useAuth, useAuthFetch } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type ActionType = 'confirm' | 'plan';

interface SelectShopModalProps {
  shop: EvaluationResult;
  car?: Partial<Car>;
  overrides?: EvaluationOverrides;
  onClose: () => void;
  onSuccess?: (eventId: string, actionType: ActionType) => void;
}

export default function SelectShopModal({
  shop,
  car,
  overrides,
  onClose,
  onSuccess,
}: SelectShopModalProps) {
  const { user, isAuthenticated } = useAuth();
  const authFetch = useAuthFetch();
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [actionType, setActionType] = useState<ActionType>('confirm');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setError('Please log in to select a shop');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await authFetch(`${API_BASE}/service-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          car_number: car?.car_number || null,
          assigned_shop: shop.shop.shop_code,
          car_input: car,
          evaluation_result: shop,
          overrides,
          notes: notes || null,
          action_type: actionType, // 'confirm' or 'plan'
          status: actionType === 'confirm' ? 'Confirmed' : 'Planned',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create service event');
      }

      // Show success toast
      toast.success(
        actionType === 'confirm' ? 'Shop Confirmed' : 'Shop Planned',
        `${car?.car_number || 'Car'} assigned to ${shop.shop.shop_name}`
      );

      onSuccess?.(data.data.event_id, actionType);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select shop';
      setError(message);
      toast.error('Selection Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Confirm Shop Selection
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create a service event for this shop assignment
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Shop Summary */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {shop.shop.shop_name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {shop.shop.shop_code} | {shop.shop.primary_railroad}
                  </p>
                </div>
                {shop.shop.is_preferred_network && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded">
                    Preferred
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Estimated Cost</span>
                  <p className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    {formatCurrency(shop.cost_breakdown.total_cost)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Hours Backlog</span>
                  <p className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    {Number(shop.backlog.hours_backlog || 0).toFixed(0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Car Info */}
            {car?.car_number && (
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">Car Number: </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {car.car_number}
                </span>
              </div>
            )}

            {/* Cost Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cost Breakdown
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Labor</span>
                  <span>{formatCurrency(shop.cost_breakdown.labor_cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Material</span>
                  <span>{formatCurrency(shop.cost_breakdown.material_cost)}</span>
                </div>
                {shop.cost_breakdown.abatement_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Abatement</span>
                    <span>{formatCurrency(shop.cost_breakdown.abatement_cost)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Freight</span>
                  <span>{formatCurrency(shop.cost_breakdown.freight_cost)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span>Total</span>
                  <span>{formatCurrency(shop.cost_breakdown.total_cost)}</span>
                </div>
              </div>
            </div>

            {/* Action Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Action Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActionType('confirm')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    actionType === 'confirm'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      actionType === 'confirm'
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-400'
                    }`}>
                      {actionType === 'confirm' && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">Confirm</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Immediately assign car to shop. Deducts from available capacity.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('plan')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    actionType === 'plan'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      actionType === 'plan'
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-400'
                    }`}>
                      {actionType === 'plan' && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">Plan / Hold</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Reserve for future. Does not affect confirmed capacity.
                  </p>
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Add any notes about this assignment..."
              />
            </div>

            {/* Auth Notice */}
            {!isAuthenticated && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                You must be logged in to select a shop. Please log in first.
              </div>
            )}

            {/* User Info */}
            {user && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Assigning as: {user.email} ({user.role})
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !isAuthenticated}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                actionType === 'confirm'
                  ? 'bg-primary-600 hover:bg-primary-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting
                ? 'Creating...'
                : actionType === 'confirm'
                ? 'Confirm & Assign'
                : 'Plan for Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
