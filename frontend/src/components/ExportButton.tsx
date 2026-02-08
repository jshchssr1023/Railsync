'use client';

import { Download } from 'lucide-react';
import { useExportCSV, type ExportColumn } from '@/hooks/useExportCSV';

export interface ExportButtonProps {
  data: Record<string, any>[];
  columns: ExportColumn[];
  filename: string;
  label?: string;
  disabled?: boolean;
}

export default function ExportButton({
  data,
  columns,
  filename,
  label = 'Export CSV',
  disabled = false,
}: ExportButtonProps) {
  const { exportCSV } = useExportCSV();

  const handleClick = () => {
    exportCSV(data, columns, filename);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || data.length === 0}
      title={data.length === 0 ? 'No data to export' : label}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <Download className="w-4 h-4" aria-hidden="true" />
      {label}
    </button>
  );
}
