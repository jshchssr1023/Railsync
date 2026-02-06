'use client';

import ShoppingClassification from '@/components/ShoppingClassification';

interface ReasonForShoppingSectionProps {
  values: {
    shopping_type_code: string;
    shopping_reason_code: string;
    clean_grade: string;
    is_kosher: boolean;
    is_food_grade: boolean;
    dry_grade: string;
  };
  onChange: (field: string, value: string | boolean) => void;
}

const REASON_OPTIONS = [
  'Return Condition',
  'Qualification',
  'Running Repair',
  'Bad Order',
  'Commodity Conversion',
  'Lease Assignment',
  'Lease Return',
  'Preventive Maintenance',
  'Insurance Claim',
];

export default function ReasonForShoppingSection({ values, onChange }: ReasonForShoppingSectionProps) {
  return (
    <section className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Reason for Shopping</h2>

      <ShoppingClassification
        typeId={values.shopping_type_code}
        reasonId={values.shopping_reason_code}
        onTypeChange={(id) => onChange('shopping_type_code', id)}
        onReasonChange={(id) => onChange('shopping_reason_code', id)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Clean Grade</label>
          <input
            type="text"
            value={values.clean_grade}
            onChange={(e) => onChange('clean_grade', e.target.value)}
            className="input w-full"
            placeholder="e.g. A, B, C"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Kosher</label>
          <div className="flex gap-4">
            {[true, false].map((opt) => (
              <label key={String(opt)} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="is_kosher"
                  checked={values.is_kosher === opt}
                  onChange={() => onChange('is_kosher', opt)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[var(--color-text-primary)]">{opt ? 'Yes' : 'No'}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Food Grade</label>
          <div className="flex gap-4">
            {[true, false].map((opt) => (
              <label key={String(opt)} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="is_food_grade"
                  checked={values.is_food_grade === opt}
                  onChange={() => onChange('is_food_grade', opt)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[var(--color-text-primary)]">{opt ? 'Yes' : 'No'}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Dry Grade</label>
          <input
            type="text"
            value={values.dry_grade}
            onChange={(e) => onChange('dry_grade', e.target.value)}
            className="input w-full"
            placeholder="e.g. 1, 2, 3"
          />
        </div>
      </div>
    </section>
  );
}
