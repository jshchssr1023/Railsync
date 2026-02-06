'use client';

import { useState, useEffect } from 'react';
import { listShops } from '@/lib/api';
import { ShopSummary } from '@/types';

interface CarShoppingStatusSectionProps {
  values: {
    residue_clean: string;
    gasket: string;
    o_rings: string;
    last_known_commodity: string;
    lining_current: string;
    lining_alternative: string;
    preferred_shop_code: string;
  };
  onChange: (field: string, value: string) => void;
}

function TriStateRadio({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{label}</label>
      <div className="flex gap-4">
        {(['unknown', 'yes', 'no'] as const).map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-[var(--color-text-primary)] capitalize">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

const COMMODITIES = [
  'Caustic Soda',
  'Vegetable Oil',
  'Ethanol',
  'Sulfuric Acid',
  'Hydrochloric Acid',
  'Propylene Oxide',
  'Styrene Monomer',
  'Butadiene',
  'Phosphoric Acid',
  'Methanol',
];

export default function CarShoppingStatusSection({ values, onChange }: CarShoppingStatusSectionProps) {
  const [shops, setShops] = useState<ShopSummary[]>([]);

  useEffect(() => {
    listShops().then(setShops).catch(console.error);
  }, []);

  return (
    <section className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Car Shopping Status</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TriStateRadio
          label="Residue Clean"
          name="residue_clean"
          value={values.residue_clean}
          onChange={(val) => onChange('residue_clean', val)}
        />
        <TriStateRadio
          label="Gasket"
          name="gasket"
          value={values.gasket}
          onChange={(val) => onChange('gasket', val)}
        />
        <TriStateRadio
          label="O-Rings"
          name="o_rings"
          value={values.o_rings}
          onChange={(val) => onChange('o_rings', val)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Last Known Commodity</label>
          <select
            value={values.last_known_commodity}
            onChange={(e) => onChange('last_known_commodity', e.target.value)}
            className="input w-full"
          >
            <option value="">Select commodity...</option>
            {COMMODITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Preference Requested Shop</label>
          <select
            value={values.preferred_shop_code}
            onChange={(e) => onChange('preferred_shop_code', e.target.value)}
            className="input w-full"
          >
            <option value="">Select shop...</option>
            {shops.map((s) => (
              <option key={s.shop_code} value={s.shop_code}>
                {s.shop_name} ({s.shop_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Lining Preferences</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">Current Lining</label>
            <input
              type="text"
              value={values.lining_current}
              onChange={(e) => onChange('lining_current', e.target.value)}
              className="input w-full"
              placeholder="e.g. Touch-Up"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">Alternative</label>
            <input
              type="text"
              value={values.lining_alternative}
              onChange={(e) => onChange('lining_alternative', e.target.value)}
              className="input w-full"
              placeholder="e.g. Full Reline"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
