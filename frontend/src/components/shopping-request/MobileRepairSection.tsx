'use client';

interface MobileRepairSectionProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function MobileRepairSection({ value, onChange }: MobileRepairSectionProps) {
  return (
    <section className="card p-6 space-y-3">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Mobile Repair Unit</h2>
      <div className="flex gap-6">
        {([true, false] as const).map((opt) => (
          <label key={String(opt)} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mobile_repair_unit"
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-[var(--color-text-primary)]">{opt ? 'Yes' : 'No'}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
