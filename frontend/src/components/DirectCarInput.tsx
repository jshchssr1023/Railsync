'use client';

import { Car } from '@/types';

interface DirectCarInputProps {
  value: Partial<Car>;
  onChange: (value: Partial<Car>) => void;
  advancedMode: boolean;
}

const MATERIAL_TYPES = ['Carbon Steel', 'Stainless', 'Aluminum'] as const;

const LINING_TYPES = [
  'None',
  'High Bake',
  'Plasite',
  'Rubber',
  'Vinyl Ester',
  'Epoxy',
] as const;

const PRODUCT_CODE_GROUPS = [
  'Tank',
  'Hopper',
  'Covered Hopper',
  'Boxcar',
  'Gondola',
  'Flatcar',
  'Autorack',
] as const;

export default function DirectCarInput({
  value,
  onChange,
  advancedMode,
}: DirectCarInputProps) {
  const handleChange = (
    field: keyof Car,
    newValue: string | number | boolean | null
  ) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <div className="space-y-6">
      {/* Quick Mode Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Product Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value.product_code || ''}
            onChange={(e) => handleChange('product_code', e.target.value)}
            placeholder="e.g., DOTX"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Tank car product code (determines car type)
          </p>
        </div>

        {/* Material Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Material Type
          </label>
          <select
            value={value.material_type || 'Carbon Steel'}
            onChange={(e) => handleChange('material_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          >
            {MATERIAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Lining Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lining Type
          </label>
          <select
            value={value.lining_type || 'None'}
            onChange={(e) =>
              handleChange(
                'lining_type',
                e.target.value === 'None' ? null : e.target.value
              )
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          >
            {LINING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced Mode Fields */}
      {advancedMode && (
        <>
          {/* Car Identity Section */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Car Identity
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Car Number
                </label>
                <input
                  type="text"
                  value={value.car_number || ''}
                  onChange={(e) => handleChange('car_number', e.target.value)}
                  placeholder="e.g., AITX 123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stencil Class
                </label>
                <input
                  type="text"
                  value={value.stencil_class || ''}
                  onChange={(e) => handleChange('stencil_class', e.target.value)}
                  placeholder="e.g., 111A100W1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">DOT specification class</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Code Group
                </label>
                <select
                  value={value.product_code || ''}
                  onChange={(e) => handleChange('product_code', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select group...</option>
                  {PRODUCT_CODE_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Commodity Section */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Commodity</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commodity CIN
                </label>
                <input
                  type="text"
                  value={value.commodity_cin || ''}
                  onChange={(e) => handleChange('commodity_cin', e.target.value)}
                  placeholder="e.g., 1234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Chemical Identification Number for last cargo
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nitrogen Pad Stage
                </label>
                <select
                  value={value.nitrogen_pad_stage ?? ''}
                  onChange={(e) =>
                    handleChange(
                      'nitrogen_pad_stage',
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Not required</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((stage) => (
                    <option key={stage} value={stage}>
                      Stage {stage}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Nitrogen padding stage requirement (1-9)
                </p>
              </div>
            </div>
          </div>

          {/* Compliance Section */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Compliance & Special
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={value.has_asbestos || false}
                  onChange={(e) => handleChange('has_asbestos', e.target.checked)}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Has Asbestos</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={value.asbestos_abatement_required || false}
                  onChange={(e) =>
                    handleChange('asbestos_abatement_required', e.target.checked)
                  }
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Asbestos Abatement Required
                </span>
              </label>
            </div>
          </div>

          {/* Ownership Section */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Ownership</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner Code
                </label>
                <input
                  type="text"
                  value={value.owner_code || ''}
                  onChange={(e) => handleChange('owner_code', e.target.value)}
                  placeholder="e.g., AITX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lessee Code
                </label>
                <input
                  type="text"
                  value={value.lessee_code || ''}
                  onChange={(e) => handleChange('lessee_code', e.target.value)}
                  placeholder="e.g., BNSF"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick mode hint */}
      {!advancedMode && (
        <p className="text-sm text-gray-500 italic">
          Enable Advanced mode to enter additional car attributes like stencil
          class, commodity CIN, nitrogen requirements, and asbestos indicators.
        </p>
      )}
    </div>
  );
}
