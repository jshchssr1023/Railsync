'use client';

import TypeaheadSearch from '@/components/TypeaheadSearch';
import { searchCars } from '@/lib/api';

interface CarInfoSectionProps {
  values: {
    car_number: string;
    current_railroad: string;
    current_location_city: string;
    current_location_state: string;
    next_railroad: string;
    next_location_city: string;
    next_location_state: string;
    stcc_or_un_number: string;
  };
  onChange: (field: string, value: string) => void;
  onCarSelected?: (car: { car_number: string; car_mark: string; car_type: string; lessee_name: string }) => void;
}

export default function CarInfoSection({ values, onChange, onCarSelected }: CarInfoSectionProps) {
  return (
    <section className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Car Information</h2>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
          Car Number <span className="text-red-500">*</span>
        </label>
        {values.car_number ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] px-3 py-2 rounded border border-[var(--color-border)]">
              {values.car_number}
            </span>
            <button
              type="button"
              onClick={() => onChange('car_number', '')}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Clear
            </button>
          </div>
        ) : (
          <TypeaheadSearch
            placeholder="Search by car number..."
            onSearch={(q) => searchCars(q, 10)}
            onSelect={(car) => {
              onChange('car_number', car.car_number);
              onCarSelected?.(car);
            }}
            renderItem={(car) => (
              <div>
                <span className="font-mono font-medium">{car.car_number}</span>
                <span className="text-[var(--color-text-tertiary)] ml-2 text-xs">{car.car_type} &middot; {car.lessee_name}</span>
              </div>
            )}
            getKey={(car) => car.car_number}
            minChars={3}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Current Railroad</label>
          <input
            type="text"
            value={values.current_railroad}
            onChange={(e) => onChange('current_railroad', e.target.value)}
            className="input w-full"
            placeholder="e.g. BNSF"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Current Location (City)</label>
          <input
            type="text"
            value={values.current_location_city}
            onChange={(e) => onChange('current_location_city', e.target.value)}
            className="input w-full"
            placeholder="Houston"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Current Location (State)</label>
          <input
            type="text"
            value={values.current_location_state}
            onChange={(e) => onChange('current_location_state', e.target.value)}
            className="input w-full"
            placeholder="TX"
            maxLength={2}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Next Railroad</label>
          <input
            type="text"
            value={values.next_railroad}
            onChange={(e) => onChange('next_railroad', e.target.value)}
            className="input w-full"
            placeholder="e.g. UP"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Next Location (City)</label>
          <input
            type="text"
            value={values.next_location_city}
            onChange={(e) => onChange('next_location_city', e.target.value)}
            className="input w-full"
            placeholder="Chicago"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Next Location (State)</label>
          <input
            type="text"
            value={values.next_location_state}
            onChange={(e) => onChange('next_location_state', e.target.value)}
            className="input w-full"
            placeholder="IL"
            maxLength={2}
          />
        </div>
      </div>

      <div className="max-w-xs">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">STCC or UN Number</label>
        <input
          type="text"
          value={values.stcc_or_un_number}
          onChange={(e) => onChange('stcc_or_un_number', e.target.value)}
          className="input w-full"
          placeholder="e.g. 4821210"
        />
      </div>
    </section>
  );
}
