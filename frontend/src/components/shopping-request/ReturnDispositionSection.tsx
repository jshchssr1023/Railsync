'use client';

interface ReturnDispositionSectionProps {
  values: {
    disposition_city: string;
    disposition_state: string;
    disposition_route: string;
    disposition_payer_of_freight: string;
    disposition_comment: string;
  };
  onChange: (field: string, value: string) => void;
}

export default function ReturnDispositionSection({ values, onChange }: ReturnDispositionSectionProps) {
  return (
    <section className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Return Disposition</h2>

      <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Outbound Disposition</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">City</label>
          <input
            type="text"
            value={values.disposition_city}
            onChange={(e) => onChange('disposition_city', e.target.value)}
            className="input w-full"
            placeholder="Destination city"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">State</label>
          <input
            type="text"
            value={values.disposition_state}
            onChange={(e) => onChange('disposition_state', e.target.value)}
            className="input w-full"
            placeholder="TX"
            maxLength={2}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Route</label>
          <input
            type="text"
            value={values.disposition_route}
            onChange={(e) => onChange('disposition_route', e.target.value)}
            className="input w-full"
            placeholder="Routing instructions"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Payer of Freight</label>
        <input
          type="text"
          value={values.disposition_payer_of_freight}
          onChange={(e) => onChange('disposition_payer_of_freight', e.target.value)}
          className="input w-full"
          placeholder="Freight payer name or code"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Disposition Comment</label>
        <textarea
          value={values.disposition_comment}
          onChange={(e) => onChange('disposition_comment', e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Additional disposition notes..."
        />
      </div>
    </section>
  );
}
