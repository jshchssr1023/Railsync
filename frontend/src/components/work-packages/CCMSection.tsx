'use client';

import { useState } from 'react';
import {
  Loader2,
  Edit3,
  Check,
  X,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/** CCM fields to display, grouped for readability */
const CCM_FIELD_GROUPS: Array<{
  label: string;
  fields: Array<{ key: string; label: string; type: 'boolean' | 'text' }>;
}> = [
  {
    label: 'Cleaning Requirements',
    fields: [
      { key: 'food_grade', label: 'Food Grade', type: 'boolean' },
      { key: 'mineral_wipe', label: 'Mineral Wipe', type: 'boolean' },
      { key: 'kosher_wash', label: 'Kosher Wash', type: 'boolean' },
      { key: 'kosher_wipe', label: 'Kosher Wipe', type: 'boolean' },
    ],
  },
  {
    label: 'Nitrogen & Fittings',
    fields: [
      { key: 'nitrogen_applied', label: 'Nitrogen Applied', type: 'boolean' },
      { key: 'nitrogen_psi', label: 'Nitrogen PSI', type: 'text' },
      { key: 'decal_requirements', label: 'Decal Requirements', type: 'text' },
      { key: 'special_fittings_vendor_requirements', label: 'Special Fittings / Vendor Requirements', type: 'text' },
    ],
  },
  {
    label: 'Documentation',
    fields: [
      { key: 'documentation_required_prior_to_release', label: 'Documentation Required Prior to Release', type: 'text' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CCMOverride {
  field_name: string;
  original_value: string;
  override_value: string;
  override_reason: string;
}

interface CCMSectionProps {
  workPackageId: string;
  ccmSnapshot?: any;
  ccmOverrides?: CCMOverride[];
  isIssued: boolean;
  readOnly?: boolean;
  onOverrideAdded?: () => void;
}

interface OverrideFormState {
  field_name: string;
  original_value: string;
  override_value: string;
  override_reason: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFieldValue(value: unknown, type: 'boolean' | 'text'): string {
  if (value === null || value === undefined || value === '') return '--';
  if (type === 'boolean') {
    return value === true || value === 'true' ? 'Yes' : 'No';
  }
  return String(value);
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CCMSection({
  workPackageId,
  ccmSnapshot,
  ccmOverrides = [],
  isIssued,
  readOnly = false,
  onOverrideAdded,
}: CCMSectionProps) {
  const { getAccessToken } = useAuth();
  const toast = useToast();

  // Which field is currently being overridden (null = none)
  const [editingField, setEditingField] = useState<string | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    field_name: '',
    original_value: '',
    override_value: '',
    override_reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(CCM_FIELD_GROUPS.map((g) => g.label))
  );

  // Build a map of overrides by field_name for quick lookup
  const overrideMap = new Map<string, CCMOverride>();
  ccmOverrides.forEach((ov) => overrideMap.set(ov.field_name, ov));

  // -----------------------------------------------------------------------
  // Override submission
  // -----------------------------------------------------------------------

  const handleStartOverride = (fieldKey: string, fieldType: 'boolean' | 'text') => {
    const currentValue = ccmSnapshot?.[fieldKey];
    setEditingField(fieldKey);
    setOverrideForm({
      field_name: fieldKey,
      original_value: formatFieldValue(currentValue, fieldType),
      override_value: '',
      override_reason: '',
    });
  };

  const handleCancelOverride = () => {
    setEditingField(null);
    setOverrideForm({
      field_name: '',
      original_value: '',
      override_value: '',
      override_reason: '',
    });
  };

  const handleSubmitOverride = async () => {
    if (!overrideForm.override_value.trim() || !overrideForm.override_reason.trim()) {
      toast.warning('Both override value and reason are required');
      return;
    }

    setSubmitting(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/work-packages/${workPackageId}/ccm-overrides`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field_name: overrideForm.field_name,
          original_value: overrideForm.original_value,
          override_value: overrideForm.override_value.trim(),
          override_reason: overrideForm.override_reason.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to add override (${res.status})`);
      }

      toast.success(`Override added for ${formatFieldLabel(overrideForm.field_name)}`);
      handleCancelOverride();
      onOverrideAdded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add override');
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Toggle group expand/collapse
  // -----------------------------------------------------------------------

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // No snapshot placeholder
  // -----------------------------------------------------------------------

  if (!ccmSnapshot && ccmOverrides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No Care & Cleaning Manual data available.
        </p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Override count summary */}
      {ccmOverrides.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>
            {ccmOverrides.length} field{ccmOverrides.length !== 1 ? 's' : ''} overridden from CCM defaults.
          </span>
        </div>
      )}

      {/* Field groups */}
      {CCM_FIELD_GROUPS.map((group) => {
        const isExpanded = expandedGroups.has(group.label);

        return (
          <div
            key={group.label}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* Group header */}
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                {group.label}
              </span>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* Group fields */}
            {isExpanded && (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {group.fields.map((field) => {
                  const override = overrideMap.get(field.key);
                  const rawValue = ccmSnapshot?.[field.key];
                  const displayValue = formatFieldValue(rawValue, field.type);
                  const isEditing = editingField === field.key;
                  const canOverride = !isIssued && !readOnly && !override;

                  return (
                    <div key={field.key} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        {/* Label + value */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {field.label}
                            </span>
                            {override && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                Overridden
                              </span>
                            )}
                          </div>

                          {override ? (
                            <div className="mt-1 space-y-1">
                              {/* Original value struck through */}
                              <div className="text-sm text-gray-400 dark:text-gray-500 line-through">
                                {override.original_value || '--'}
                              </div>
                              {/* Override value */}
                              <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                {override.override_value}
                              </div>
                              {/* Reason */}
                              <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                                Reason: {override.override_reason}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                              {displayValue}
                            </div>
                          )}
                        </div>

                        {/* Override toggle button */}
                        {canOverride && !isEditing && (
                          <button
                            type="button"
                            onClick={() => handleStartOverride(field.key, field.type)}
                            className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Override this field"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Inline override form */}
                      {isEditing && (
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
                          <div className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                            Override: {field.label}
                          </div>

                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Current value: <span className="font-medium text-gray-700 dark:text-gray-300">{overrideForm.original_value}</span>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              New Value <span className="text-red-500">*</span>
                            </label>
                            {field.type === 'boolean' ? (
                              <select
                                value={overrideForm.override_value}
                                onChange={(e) =>
                                  setOverrideForm((prev) => ({ ...prev, override_value: e.target.value }))
                                }
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              >
                                <option value="">Select...</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={overrideForm.override_value}
                                onChange={(e) =>
                                  setOverrideForm((prev) => ({ ...prev, override_value: e.target.value }))
                                }
                                placeholder="Enter new value"
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Reason <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={overrideForm.override_reason}
                              onChange={(e) =>
                                setOverrideForm((prev) => ({ ...prev, override_reason: e.target.value }))
                              }
                              placeholder="Why is this override needed?"
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={handleCancelOverride}
                              disabled={submitting}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmitOverride}
                              disabled={
                                submitting ||
                                !overrideForm.override_value.trim() ||
                                !overrideForm.override_reason.trim()
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {submitting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              Apply Override
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
