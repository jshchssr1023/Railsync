'use client';

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import ShoppingClassification from './ShoppingClassification';
import EstimateLinesTable, { EstimateLine } from './EstimateLinesTable';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ShopEventModalProps {
  carNumber: string;
  shopCode: string;
  shopName: string;
  targetMonth: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ShoppingType {
  id: string;
  code: string;
  name: string;
  is_planned: boolean;
  default_cost_owner: string;
  tier_preference: number;
}

interface ShoppingReason {
  id: string;
  code: string;
  name: string;
  type_id: string;
  default_cost_owner: string;
}

export default function ShopEventModal({
  carNumber,
  shopCode,
  shopName,
  targetMonth,
  onClose,
  onSuccess,
}: ShopEventModalProps) {
  const [typeId, setTypeId] = useState('');
  const [reasonId, setReasonId] = useState('');
  const [selectedType, setSelectedType] = useState<ShoppingType | null>(null);
  const [selectedReason, setSelectedReason] = useState<ShoppingReason | null>(null);
  const [estimateLines, setEstimateLines] = useState<EstimateLine[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (id: string, type: ShoppingType | null) => {
    setTypeId(id);
    setSelectedType(type);
  };

  const handleReasonChange = (id: string, reason: ShoppingReason | null) => {
    setReasonId(id);
    setSelectedReason(reason);
  };

  const handleSave = async () => {
    if (!typeId) {
      setError('Shopping Type is required');
      return;
    }

    // Validate estimate lines - check for missing override reasons
    const invalidLines = estimateLines.filter(line => {
      const defaultAllocate = selectedType?.default_cost_owner === 'customer';
      return line.allocateToCustomer !== defaultAllocate && !line.allocationOverrideReason;
    });

    if (invalidLines.length > 0) {
      setError('Some estimate lines need override reasons for non-default allocation');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('railsync_access_token');
      const res = await fetch(`${API_URL}/shopping-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          car_number: carNumber,
          shop_code: shopCode,
          target_month: targetMonth,
          shopping_type_id: typeId,
          shopping_reason_id: reasonId || null,
          notes,
          estimate_lines: estimateLines.map(line => ({
            description: line.description,
            estimated_cost: line.estimatedCost,
            labor_hours: line.laborHours,
            materials_cost: line.materialsCost,
            allocate_to_customer: line.allocateToCustomer,
            allocation_override_reason: line.allocationOverrideReason,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create shop event');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const totalEstimate = estimateLines.reduce((sum, l) => sum + (l.estimatedCost || 0), 0);
  const customerTotal = estimateLines
    .filter(l => l.allocateToCustomer)
    .reduce((sum, l) => sum + (l.estimatedCost || 0), 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Create Shop Event
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {carNumber} → {shopName} ({targetMonth})
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Shopping Classification */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Shopping Classification
              </h3>
              <ShoppingClassification
                typeId={typeId}
                reasonId={reasonId}
                onTypeChange={handleTypeChange}
                onReasonChange={handleReasonChange}
              />
              {selectedType && (
                <div className="mt-3 flex gap-3 text-xs">
                  <span className={`px-2 py-1 rounded ${
                    selectedType.is_planned
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                  }`}>
                    {selectedType.is_planned ? 'Planned' : 'Unplanned'}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                    Default: {selectedType.default_cost_owner === 'customer' ? 'Customer Pays' : 'Lessor Pays'}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                    Tier {selectedType.tier_preference}
                  </span>
                </div>
              )}
            </div>

            {/* Estimate Lines */}
            <div>
              <EstimateLinesTable
                lines={estimateLines}
                onChange={setEstimateLines}
                defaultAllocateToCustomer={selectedType?.default_cost_owner === 'customer'}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional notes or instructions..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-sm">
              {estimateLines.length > 0 && (
                <span className="text-gray-600 dark:text-gray-400">
                  Total: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totalEstimate)}</span>
                  {customerTotal > 0 && (
                    <span className="ml-3 text-amber-600 dark:text-amber-400">
                      Customer: {formatCurrency(customerTotal)}
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !typeId}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Create Shop Event'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
