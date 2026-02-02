'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ShoppingType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_planned: boolean;
  default_cost_owner: string;
  tier_preference: number;
}

interface ShoppingReason {
  id: string;
  code: string;
  name: string;
  type_id: string;
  type_code: string;
  is_planned: boolean;
  default_cost_owner: string;
}

interface ShoppingClassificationProps {
  typeId?: string;
  reasonId?: string;
  onTypeChange: (typeId: string, type: ShoppingType | null) => void;
  onReasonChange: (reasonId: string, reason: ShoppingReason | null) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function ShoppingClassification({
  typeId,
  reasonId,
  onTypeChange,
  onReasonChange,
  disabled = false,
  compact = false,
}: ShoppingClassificationProps) {
  const [types, setTypes] = useState<ShoppingType[]>([]);
  const [reasons, setReasons] = useState<ShoppingReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<ShoppingType | null>(null);

  // Fetch shopping types
  useEffect(() => {
    fetch(`${API_URL}/shopping-types`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTypes(d.data);
          if (typeId) {
            const t = d.data.find((x: ShoppingType) => x.id === typeId);
            setSelectedType(t || null);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [typeId]);

  // Fetch reasons when type changes
  useEffect(() => {
    if (!selectedType) {
      setReasons([]);
      return;
    }

    fetch(`${API_URL}/shopping-reasons?type_id=${selectedType.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setReasons(d.data);
      })
      .catch(console.error);
  }, [selectedType]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const type = types.find(t => t.id === id) || null;
    setSelectedType(type);
    onTypeChange(id, type);
    // Clear reason when type changes
    onReasonChange('', null);
  };

  const handleReasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const reason = reasons.find(r => r.id === id) || null;
    onReasonChange(id, reason);
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  const selectClass = compact
    ? 'text-xs py-1 px-2'
    : 'text-sm py-1.5 px-3';

  return (
    <div className={`flex ${compact ? 'gap-2' : 'gap-4'} ${compact ? 'flex-row' : 'flex-col sm:flex-row'}`}>
      <div className={compact ? 'flex-1' : 'flex-1 min-w-[180px]'}>
        {!compact && (
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Shopping Type
          </label>
        )}
        <select
          value={typeId || ''}
          onChange={handleTypeChange}
          disabled={disabled}
          className={`w-full border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500 ${selectClass} disabled:opacity-50`}
        >
          <option value="">Select type...</option>
          {types.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className={compact ? 'flex-1' : 'flex-1 min-w-[180px]'}>
        {!compact && (
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Shopping Reason
          </label>
        )}
        <select
          value={reasonId || ''}
          onChange={handleReasonChange}
          disabled={disabled || !selectedType}
          className={`w-full border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500 ${selectClass} disabled:opacity-50`}
        >
          <option value="">{selectedType ? 'Select reason...' : 'Select type first'}</option>
          {reasons.map(r => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {selectedType && !compact && (
        <div className="flex items-end gap-2 text-xs">
          <span className={`px-2 py-1 rounded ${selectedType.is_planned ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
            {selectedType.is_planned ? 'Planned' : 'Unplanned'}
          </span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
            Tier {selectedType.tier_preference}
          </span>
        </div>
      )}
    </div>
  );
}
