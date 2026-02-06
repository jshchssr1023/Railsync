'use client';

interface OneTimeMovementSectionProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function OneTimeMovementSection({ value, onChange }: OneTimeMovementSectionProps) {
  return (
    <section className="card p-6 space-y-3">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">One Time Movement Approval</h2>

      <div className="flex gap-6">
        {[true, false].map((opt) => (
          <label key={String(opt)} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="one_time_movement"
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-[var(--color-text-primary)]">{opt ? 'Yes' : 'No'}</span>
          </label>
        ))}
      </div>

      {value && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded text-sm text-[var(--color-text-secondary)]">
          If the car is to move under FRA One Time Movement Approval and/or Transport Canada Temporary
          Certificate, please review the One Time Movement Approval Procedures. Identify car defects
          requiring movement approval in the comments section.
        </div>
      )}
    </section>
  );
}
