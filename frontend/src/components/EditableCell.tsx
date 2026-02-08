'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Pencil, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EditableCellProps {
  value: string | number;
  type?: 'text' | 'number' | 'select';
  options?: { label: string; value: string }[];
  onSave: (newValue: string | number) => Promise<void> | void;
  editable?: boolean;
  className?: string;
  placeholder?: string;
  formatDisplay?: (value: string | number) => string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EditableCell({
  value,
  type = 'text',
  options,
  onSave,
  editable = true,
  className = '',
  placeholder,
  formatDisplay,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Keep draft in sync when value changes externally while not editing
  useEffect(() => {
    if (!editing) {
      setDraft(String(value ?? ''));
    }
  }, [value, editing]);

  // Focus the input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Select all text for text/number inputs
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  // ------- handlers -------

  const enterEditMode = useCallback(() => {
    if (!editable || saving) return;
    setDraft(String(value ?? ''));
    setError(false);
    setEditing(true);
  }, [editable, saving, value]);

  const cancel = useCallback(() => {
    setDraft(String(value ?? ''));
    setEditing(false);
    setError(false);
  }, [value]);

  const save = useCallback(async () => {
    // Convert draft back to the proper type
    let coerced: string | number = draft;
    if (type === 'number') {
      coerced = draft === '' ? 0 : Number(draft);
      if (Number.isNaN(coerced)) {
        cancel();
        return;
      }
    }

    // Skip save if value hasn't changed
    if (String(coerced) === String(value)) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(false);

    try {
      await onSave(coerced);
      setEditing(false);
    } catch {
      // Flash red then revert
      setError(true);
      setTimeout(() => {
        setError(false);
        cancel();
      }, 800);
    } finally {
      setSaving(false);
    }
  }, [draft, type, value, onSave, cancel]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel],
  );

  // ------- display value -------

  const displayValue = formatDisplay
    ? formatDisplay(value)
    : value != null && value !== ''
      ? String(value)
      : placeholder || '\u2014'; // em-dash fallback

  // ------- edit mode -------

  if (editing) {
    const baseInputClasses =
      'w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 ' +
      'text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 ' +
      'border-gray-300 dark:border-gray-600 transition-colors';

    const errorClasses = error
      ? 'border-red-500 ring-2 ring-red-300 dark:ring-red-700 bg-red-50 dark:bg-red-900/20'
      : '';

    return (
      <div className={`relative inline-flex items-center gap-1 ${className}`}>
        {type === 'select' ? (
          <select
            ref={(el) => {
              inputRef.current = el;
            }}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              // For selects, save immediately on change
              const newVal = e.target.value;
              setDraft(newVal);
              // Use a microtask to let state settle
              Promise.resolve().then(() => {
                const coerced = newVal;
                if (coerced !== String(value)) {
                  setSaving(true);
                  setError(false);
                  Promise.resolve(onSave(coerced))
                    .then(() => setEditing(false))
                    .catch(() => {
                      setError(true);
                      setTimeout(() => {
                        setError(false);
                        cancel();
                      }, 800);
                    })
                    .finally(() => setSaving(false));
                } else {
                  setEditing(false);
                }
              });
            }}
            onBlur={cancel}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={`${baseInputClasses} ${errorClasses}`}
            aria-label="Edit value"
          >
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={(el) => {
              inputRef.current = el;
            }}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            disabled={saving}
            placeholder={placeholder}
            className={`${baseInputClasses} ${errorClasses} ${
              type === 'number' ? 'text-right' : ''
            }`}
            aria-label="Edit value"
            step={type === 'number' ? 'any' : undefined}
          />
        )}

        {saving && (
          <Loader2
            className="w-3.5 h-3.5 animate-spin text-primary-500 absolute right-2 top-1/2 -translate-y-1/2"
            aria-label="Saving"
          />
        )}
      </div>
    );
  }

  // ------- display mode -------

  if (!editable) {
    return (
      <span className={`text-sm text-gray-900 dark:text-gray-100 ${className}`}>
        {displayValue}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={enterEditMode}
      className={`group inline-flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded text-sm
        text-gray-900 dark:text-gray-100
        hover:bg-gray-100 dark:hover:bg-gray-700/60
        focus:outline-none focus:ring-2 focus:ring-primary-500
        transition-colors cursor-pointer ${className}`}
      aria-label={`Edit: ${displayValue}`}
    >
      <span className={value != null && value !== '' ? '' : 'text-gray-400 dark:text-gray-500'}>
        {displayValue}
      </span>
      <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
}
