'use client';

import { useState } from 'react';
import { EvaluationResult, Car, EvaluationOverrides } from '@/types';
import { useAuth, useAuthFetch } from '@/context/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface SelectShopModalProps {
  shop: EvaluationResult;
  car?: Partial<Car>;
  overrides?: EvaluationOverrides;
  onClose: () => void;
  onSuccess?: (eventId: string) => void;
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
  const [notes, setNotes] = useState('');
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
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create service event');
      }

      onSuccess?.(data.data.event_id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select shop');
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

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
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
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Confirm Selection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
