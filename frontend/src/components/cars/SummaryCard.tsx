'use client';
import { useEffect, useRef, useState } from 'react';

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string; // e.g. 'primary', 'green', 'amber', 'blue'
  onClick?: () => void;
  active?: boolean;
}

export default function SummaryCard({ label, value, icon, color = 'primary', onClick, active }: SummaryCardProps) {
  // Animated count-up from 0 to value
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (value === 0) { setDisplayValue(0); return; }
    const duration = 600;
    const start = performance.now();
    const from = ref.current;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(from + (value - from) * eased);
      setDisplayValue(current);
      if (progress < 1) requestAnimationFrame(step);
      else ref.current = value;
    };
    requestAnimationFrame(step);
  }, [value]);

  const colorClasses: Record<string, string> = {
    primary: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20',
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  };

  return (
    <button
      onClick={onClick}
      className={`card text-left w-full transition-all ${
        active
          ? 'ring-2 ring-primary-500 dark:ring-primary-400'
          : 'hover:shadow-md'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="card-body p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1 tabular-nums">
              {displayValue.toLocaleString()}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${colorClasses[color] || colorClasses.primary}`}>
            {icon}
          </div>
        </div>
      </div>
    </button>
  );
}
