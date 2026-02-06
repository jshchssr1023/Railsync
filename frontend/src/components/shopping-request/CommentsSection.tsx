'use client';

interface CommentsSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CommentsSection({ value, onChange }: CommentsSectionProps) {
  return (
    <section className="card p-6 space-y-3">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Comments</h2>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input w-full"
        rows={4}
        placeholder="Enter any additional notes or special instructions..."
      />
    </section>
  );
}
