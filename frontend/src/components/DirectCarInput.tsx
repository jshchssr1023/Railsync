'use client';

import { useState } from 'react';
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

// Field help tooltips
const FIELD_HELP: Record<string, string> = {
  product_code: 'Car type classification code (e.g., Tank, Hopper). Determines which shops can service this car.',
  material_type: 'Car shell material. Affects which shops are qualified and impacts repair costs.',
  lining_type: 'Interior lining type. Specialized linings require certified shops.',
  car_number: 'Unique railroad car identifier (e.g., AITX 123456).',
  stencil_class: 'DOT specification class stenciled on the car (e.g., DOT111A100W1). Determines safety requirements.',
  commodity_cin: 'Chemical Identification Number for the last cargo. Affects cleaning requirements and shop restrictions.',
  nitrogen_pad_stage: 'Nitrogen padding requirement level (1-9). Higher stages require more specialized equipment.',
  has_asbestos: 'Car contains asbestos materials.',
  asbestos_abatement_required: 'Asbestos must be professionally removed before service.',
  owner_code: 'Railroad reporting mark of car owner.',
  lessee_code: 'Current lessee railroad code.',
};

// Tooltip component
function HelpTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500"
      >
        ?
      </button>
      {show && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 text-xs bg-gray-900 dark:bg-gray-700 text-white rounded shadow-lg">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      )}
    </div>
  );
}

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

  const inputClasses = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500";
  const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const helpTextClasses = "mt-1 text-xs text-gray-500 dark:text-gray-400";

  return (
    <div className="space-y-6">
      {/* Quick Mode Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Product Code */}
        <div>
          <label className={labelClasses}>
            Product Code <span className="text-red-500">*</span>
            <HelpTooltip text={FIELD_HELP.product_code} />
          </label>
          <input
            type="text"
            value={value.product_code || ''}
            onChange={(e) => handleChange('product_code', e.target.value)}
            placeholder="e.g., Tank"
            className={inputClasses}
          />
          <p className={helpTextClasses}>
            Car type classification
          </p>
        </div>

        {/* Material Type */}
        <div>
          <label className={labelClasses}>
            Material Type
            <HelpTooltip text={FIELD_HELP.material_type} />
          </label>
          <select
            value={value.material_type || 'Carbon Steel'}
            onChange={(e) => handleChange('material_type', e.target.value)}
            className={inputClasses}
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
          <label className={labelClasses}>
            Lining Type
            <HelpTooltip text={FIELD_HELP.lining_type} />
          </label>
          <select
            value={value.lining_type || 'None'}
            onChange={(e) =>
              handleChange(
                'lining_type',
                e.target.value === 'None' ? null : e.target.value
              )
            }
            className={inputClasses}
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
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Car Identity
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClasses}>
                  Car Number
                  <HelpTooltip text={FIELD_HELP.car_number} />
                </label>
                <input
                  type="text"
                  value={value.car_number || ''}
                  onChange={(e) => handleChange('car_number', e.target.value)}
                  placeholder="e.g., AITX 123456"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>
                  Stencil Class
                  <HelpTooltip text={FIELD_HELP.stencil_class} />
                </label>
                <input
                  type="text"
                  value={value.stencil_class || ''}
                  onChange={(e) => handleChange('stencil_class', e.target.value)}
                  placeholder="e.g., DOT111A100W1"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>
                  Product Code Group
                </label>
                <select
                  value={value.product_code || ''}
                  onChange={(e) => handleChange('product_code', e.target.value)}
                  className={inputClasses}
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
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Commodity
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>
                  Commodity CIN
                  <HelpTooltip text={FIELD_HELP.commodity_cin} />
                </label>
                <input
                  type="text"
                  value={value.commodity_cin || ''}
                  onChange={(e) => handleChange('commodity_cin', e.target.value)}
                  placeholder="e.g., CIN001"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>
                  Nitrogen Pad Stage
                  <HelpTooltip text={FIELD_HELP.nitrogen_pad_stage} />
                </label>
                <select
                  value={value.nitrogen_pad_stage ?? ''}
                  onChange={(e) =>
                    handleChange(
                      'nitrogen_pad_stage',
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  className={inputClasses}
                >
                  <option value="">Not required</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((stage) => (
                    <option key={stage} value={stage}>
                      Stage {stage}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Compliance Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Compliance & Special
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.has_asbestos || false}
                  onChange={(e) => handleChange('has_asbestos', e.target.checked)}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Has Asbestos</span>
                <HelpTooltip text={FIELD_HELP.has_asbestos} />
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.asbestos_abatement_required || false}
                  onChange={(e) =>
                    handleChange('asbestos_abatement_required', e.target.checked)
                  }
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Asbestos Abatement Required
                </span>
                <HelpTooltip text={FIELD_HELP.asbestos_abatement_required} />
              </label>
            </div>
          </div>

          {/* Ownership Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Ownership
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>
                  Owner Code
                  <HelpTooltip text={FIELD_HELP.owner_code} />
                </label>
                <input
                  type="text"
                  value={value.owner_code || ''}
                  onChange={(e) => handleChange('owner_code', e.target.value)}
                  placeholder="e.g., AITX"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className={labelClasses}>
                  Lessee Code
                  <HelpTooltip text={FIELD_HELP.lessee_code} />
                </label>
                <input
                  type="text"
                  value={value.lessee_code || ''}
                  onChange={(e) => handleChange('lessee_code', e.target.value)}
                  placeholder="e.g., BNSF"
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick mode hint */}
      {!advancedMode && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Enable Advanced mode to enter additional car attributes like stencil
          class, commodity CIN, nitrogen requirements, and asbestos indicators.
        </p>
      )}
    </div>
  );
}
