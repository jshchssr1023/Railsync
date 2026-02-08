'use client';

import { List, LayoutGrid, Square } from 'lucide-react';
import { useDensity, DensityMode } from '@/context/DensityContext';

const MODES: { value: DensityMode; label: string; icon: typeof List }[] = [
  { value: 'compact',     label: 'Compact',     icon: List },
  { value: 'comfortable', label: 'Comfortable', icon: LayoutGrid },
  { value: 'spacious',    label: 'Spacious',    icon: Square },
];

export default function DensityToggle() {
  const { density, setDensity } = useDensity();

  return (
    <div
      className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 p-0.5"
      role="radiogroup"
      aria-label="Display density"
    >
      {MODES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={density === value}
          aria-label={label}
          title={label}
          onClick={() => setDensity(value)}
          className={`p-1.5 rounded-md transition-colors ${
            density === value
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

export { useDensity } from '@/context/DensityContext';
