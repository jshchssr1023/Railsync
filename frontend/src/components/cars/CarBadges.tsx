'use client';

import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const currentYear = new Date().getFullYear();

export function QualBadge({ year }: { year: number | null }) {
  if (!year) return <span className="text-gray-400 dark:text-gray-600">-</span>;
  if (year <= currentYear) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
        <AlertTriangle className="w-3 h-3" /> Overdue
      </span>
    );
  }
  if (year === currentYear + 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        <Clock className="w-3 h-3" /> {year}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle className="w-3 h-3" /> {year}
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400">-</span>;
  const colors: Record<string, string> = {
    'Complete': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'Released': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'Arrived': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    'Enroute': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    'To Be Routed': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    'To Be Scrapped': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'Scrapped': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    'Upmarketed': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
      {status}
    </span>
  );
}

export function QualStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    overdue:  { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Overdue' },
    due:      { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'Due' },
    due_soon: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Due Soon' },
    current:  { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Current' },
    exempt:   { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: 'Exempt' },
    unknown:  { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-500', label: 'Unknown' },
  };
  const c = config[status] || config.unknown;
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}
