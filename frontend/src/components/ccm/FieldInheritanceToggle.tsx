'use client';

import { CCMScopeLevel } from '@/types';

interface FieldInheritanceToggleProps<T> {
  label: string;
  fieldKey: string;
  value: T | null | undefined;
  inheritedValue?: T | null;
  inheritedFrom?: CCMScopeLevel | null;
  onChange: (value: T | null) => void;
  renderInput: (value: T | null | undefined, onChange: (value: T | null) => void, disabled: boolean) => React.ReactNode;
  helpText?: string;
}

const SCOPE_LEVEL_LABELS: Record<CCMScopeLevel, string> = {
  customer: 'Customer',
  master_lease: 'Master Lease',
  rider: 'Rider',
  amendment: 'Amendment',
};

export default function FieldInheritanceToggle<T>({
  label,
  fieldKey,
  value,
  inheritedValue,
  inheritedFrom,
  onChange,
  renderInput,
  helpText,
}: FieldInheritanceToggleProps<T>) {
  // Determine if we're showing inherited value or local value
  const isInherited = value === null || value === undefined;
  const displayValue = isInherited ? inheritedValue : value;
  const hasInheritedValue = inheritedValue !== null && inheritedValue !== undefined;

  const handleOverride = () => {
    // Set local value to the inherited value (user can then modify)
    onChange(inheritedValue ?? null);
  };

  const handleResetToInherit = () => {
    // Clear local value to inherit from parent
    onChange(null);
  };

  return (
    <div className="space-y-1.5">
      {/* Label Row */}
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fieldKey} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>

        {/* Inheritance Badge/Toggle */}
        {hasInheritedValue && (
          <div className="flex items-center gap-2">
            {isInherited ? (
              <>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  Inherited from {inheritedFrom ? SCOPE_LEVEL_LABELS[inheritedFrom] : 'parent'}
                </span>
                <button
                  type="button"
                  onClick={handleOverride}
                  className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                >
                  Override
                </button>
              </>
            ) : (
              <>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                  Set at this level
                </span>
                <button
                  type="button"
                  onClick={handleResetToInherit}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Reset to inherit
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={isInherited ? 'opacity-60' : ''}>
        {renderInput(displayValue, onChange, isInherited)}
      </div>

      {/* Help Text */}
      {helpText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{helpText}</p>
      )}
    </div>
  );
}

// Convenience components for common field types

interface TextFieldProps {
  label: string;
  fieldKey: string;
  value: string | null | undefined;
  inheritedValue?: string | null;
  inheritedFrom?: CCMScopeLevel | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  helpText?: string;
  multiline?: boolean;
}

export function InheritableTextField({
  label,
  fieldKey,
  value,
  inheritedValue,
  inheritedFrom,
  onChange,
  placeholder,
  helpText,
  multiline = false,
}: TextFieldProps) {
  return (
    <FieldInheritanceToggle
      label={label}
      fieldKey={fieldKey}
      value={value}
      inheritedValue={inheritedValue}
      inheritedFrom={inheritedFrom}
      onChange={onChange}
      helpText={helpText}
      renderInput={(val, change, disabled) =>
        multiline ? (
          <textarea
            id={fieldKey}
            value={val ?? ''}
            onChange={(e) => change(e.target.value || null)}
            disabled={disabled}
            placeholder={placeholder}
            className="input w-full min-h-[80px]"
            rows={3}
          />
        ) : (
          <input
            id={fieldKey}
            type="text"
            value={val ?? ''}
            onChange={(e) => change(e.target.value || null)}
            disabled={disabled}
            placeholder={placeholder}
            className="input w-full"
          />
        )
      }
    />
  );
}

interface BooleanFieldProps {
  label: string;
  fieldKey: string;
  value: boolean | null | undefined;
  inheritedValue?: boolean | null;
  inheritedFrom?: CCMScopeLevel | null;
  onChange: (value: boolean | null) => void;
  helpText?: string;
}

export function InheritableBooleanField({
  label,
  fieldKey,
  value,
  inheritedValue,
  inheritedFrom,
  onChange,
  helpText,
}: BooleanFieldProps) {
  return (
    <FieldInheritanceToggle
      label={label}
      fieldKey={fieldKey}
      value={value}
      inheritedValue={inheritedValue}
      inheritedFrom={inheritedFrom}
      onChange={onChange}
      helpText={helpText}
      renderInput={(val, change, disabled) => (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={fieldKey}
              checked={val === true}
              onChange={() => change(true)}
              disabled={disabled}
              className="w-4 h-4 text-primary-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={fieldKey}
              checked={val === false}
              onChange={() => change(false)}
              disabled={disabled}
              className="w-4 h-4 text-primary-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
          </label>
        </div>
      )}
    />
  );
}
