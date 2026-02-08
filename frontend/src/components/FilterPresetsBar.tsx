'use client';

import { useState, useRef, useEffect } from 'react';
import { Bookmark, X } from 'lucide-react';
import type { FilterPreset } from '@/hooks/useFilterPresets';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface FilterPresetsBarProps {
  /** Saved presets to render as pills. */
  presets: FilterPreset[];
  /** Called when the user clicks a preset pill. */
  onApply: (preset: FilterPreset) => void;
  /** Called when the user clicks the delete (X) button on a pill. */
  onDelete: (id: string) => void;
  /** Called when the user saves a new preset with a name. */
  onSave: (name: string) => void;
  /** Current filters — used to determine if there is anything worth saving. */
  currentFilters: Record<string, string>;
  /** Default filters — used to detect if current filters differ from defaults. */
  defaults: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function FilterPresetsBar({
  presets,
  onApply,
  onDelete,
  onSave,
  currentFilters,
  defaults,
}: FilterPresetsBarProps) {
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the save form opens
  useEffect(() => {
    if (saving) {
      inputRef.current?.focus();
    }
  }, [saving]);

  // Determine if the current filters differ from defaults (i.e. there is
  // something meaningful to save).
  const hasActiveFilters = Object.keys(defaults).some(
    (key) => (currentFilters[key] ?? '') !== (defaults[key] ?? ''),
  );

  const handleSave = () => {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setPresetName('');
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setSaving(false);
      setPresetName('');
    }
  };

  // If there are no presets and nothing to save, render nothing
  if (presets.length === 0 && !hasActiveFilters) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset pills */}
      {presets.map((preset) => (
        <span
          key={preset.id}
          className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
        >
          <button
            type="button"
            onClick={() => onApply(preset)}
            className="truncate max-w-[160px]"
            title={`Apply preset: ${preset.name}`}
          >
            {preset.name}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(preset.id);
            }}
            className="p-0.5 rounded-full hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
            title="Delete preset"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* Save current filters button / inline form */}
      {hasActiveFilters && !saving && (
        <button
          type="button"
          onClick={() => setSaving(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          title="Save current filters as a preset"
        >
          <Bookmark className="w-3 h-3" />
          Save Current
        </button>
      )}

      {saving && (
        <span className="inline-flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Preset name..."
            className="w-36 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!presetName.trim()}
            className="px-2 py-1 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setSaving(false);
              setPresetName('');
            }}
            className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}
