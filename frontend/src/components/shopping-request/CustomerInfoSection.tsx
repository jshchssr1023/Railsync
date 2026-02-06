'use client';

interface CustomerInfoSectionProps {
  values: {
    customer_company: string;
    customer_first_name: string;
    customer_last_name: string;
    customer_email: string;
    customer_phone: string;
  };
  onChange: (field: string, value: string) => void;
}

export default function CustomerInfoSection({ values, onChange }: CustomerInfoSectionProps) {
  return (
    <section className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Customer Information</h2>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Company</label>
        <div className="flex gap-4">
          {(['all_customers', 'aitx_only'] as const).map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="customer_company"
                value={val}
                checked={values.customer_company === val}
                onChange={() => onChange('customer_company', val)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-[var(--color-text-primary)]">
                {val === 'all_customers' ? 'All Customers' : 'AITX Only'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">First Name</label>
          <input
            type="text"
            value={values.customer_first_name}
            onChange={(e) => onChange('customer_first_name', e.target.value)}
            className="input w-full"
            placeholder="Joshua"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Last Name</label>
          <input
            type="text"
            value={values.customer_last_name}
            onChange={(e) => onChange('customer_last_name', e.target.value)}
            className="input w-full"
            placeholder="Chesser"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Email</label>
          <input
            type="email"
            value={values.customer_email}
            onChange={(e) => onChange('customer_email', e.target.value)}
            className="input w-full"
            placeholder="JChesser@aitx.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Phone</label>
          <input
            type="text"
            value={values.customer_phone}
            onChange={(e) => onChange('customer_phone', e.target.value)}
            className="input w-full"
            placeholder="(555) 123-4567"
          />
        </div>
      </div>
    </section>
  );
}
