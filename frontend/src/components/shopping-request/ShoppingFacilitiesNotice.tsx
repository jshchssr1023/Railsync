export default function ShoppingFacilitiesNotice() {
  return (
    <section className="card p-6 border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-900/10">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Shopping Facilities Notice</h2>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        Although non-AITX repair facilities are noted herein, the selection decision for any railcar repair
        is at the full discretion of AITX. Lessees may request a non-AITX facility for consideration;
        however, AITX will make the final determination based on:
      </p>
      <ul className="mt-2 text-sm text-[var(--color-text-secondary)] list-disc list-inside space-y-1">
        <li>Location</li>
        <li>Quality of workmanship</li>
        <li>Administrative and operational performance</li>
        <li>Cost effectiveness</li>
      </ul>
    </section>
  );
}
