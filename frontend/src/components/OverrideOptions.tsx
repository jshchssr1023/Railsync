'use client';

import { EvaluationOverrides } from '@/types';

interface OverrideOptionsProps {
  overrides: EvaluationOverrides;
  onChange: (overrides: EvaluationOverrides) => void;
}

export default function OverrideOptions({
  overrides,
  onChange,
}: OverrideOptionsProps) {
  const handleChange = (key: keyof EvaluationOverrides, value: boolean) => {
    onChange({
      ...overrides,
      [key]: value,
    });
  };

  const options = [
    {
      key: 'exterior_paint' as const,
      label: 'Exterior Paint',
      description: 'Require exterior paint service',
    },
    {
      key: 'new_lining' as const,
      label: 'New Lining',
      description: 'Require new interior lining',
    },
    {
      key: 'interior_blast' as const,
      label: 'Interior Blast',
      description: 'Require interior blast cleaning',
    },
    {
      key: 'kosher_cleaning' as const,
      label: 'Kosher Cleaning',
      description: 'Require kosher-certified cleaning',
    },
    {
      key: 'primary_network' as const,
      label: 'Primary Network Only',
      description: 'Limit to preferred network shops',
    },
  ];

  return (
    <div className="space-y-4">
      {options.map((option) => (
        <label
          key={option.key}
          className="flex items-start space-x-3 cursor-pointer group"
        >
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              checked={overrides[option.key] || false}
              onChange={(e) => handleChange(option.key, e.target.checked)}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
            />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-900 group-hover:text-primary-600">
              {option.label}
            </span>
            <p className="text-xs text-gray-500">{option.description}</p>
          </div>
        </label>
      ))}

      {/* Quick Actions */}
      <div className="pt-4 border-t border-gray-200 flex space-x-2">
        <button
          type="button"
          onClick={() =>
            onChange({
              exterior_paint: true,
              new_lining: true,
              interior_blast: true,
              kosher_cleaning: false,
              primary_network: false,
            })
          }
          className="text-xs text-primary-600 hover:underline"
        >
          Full Repair
        </button>
        <span className="text-gray-300">|</span>
        <button
          type="button"
          onClick={() =>
            onChange({
              exterior_paint: false,
              new_lining: false,
              interior_blast: false,
              kosher_cleaning: false,
              primary_network: false,
            })
          }
          className="text-xs text-primary-600 hover:underline"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
