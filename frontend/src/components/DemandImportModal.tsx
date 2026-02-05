'use client';

import { useState, useCallback } from 'react';
import { X, CloudUpload } from 'lucide-react';
import { createDemand } from '@/lib/api';
import { EventType, DemandPriority } from '@/types';

interface DemandImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedDemand {
  name: string;
  target_month: string;
  car_count: number;
  event_type: string;
  car_type?: string;
  priority?: string;
}

function parseCSV(content: string): ParsedDemand[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const demands: ParsedDemand[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    if (row.name && row.target_month && row.car_count && row.event_type) {
      demands.push({
        name: row.name,
        target_month: row.target_month,
        car_count: parseInt(row.car_count, 10) || 0,
        event_type: row.event_type,
        car_type: row.car_type,
        priority: row.priority,
      });
    }
  }

  return demands;
}

export default function DemandImportModal({ onClose, onSuccess }: DemandImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedDemand[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setResults(null);

    try {
      const content = await selectedFile.text();
      const parsed = parseCSV(content);
      if (parsed.length === 0) {
        setError('No valid demands found in CSV. Required columns: name, target_month, car_count, event_type');
        return;
      }
      setPreview(parsed);
    } catch (e) {
      setError('Failed to parse CSV file');
    }
  }, []);

  const handleImport = async () => {
    if (preview.length === 0) return;

    setImporting(true);
    setError(null);

    let success = 0;
    let failed = 0;
    const fiscalYear = new Date().getFullYear();

    for (const demand of preview) {
      try {
        await createDemand({
          name: demand.name,
          fiscal_year: fiscalYear,
          target_month: demand.target_month,
          car_count: demand.car_count,
          event_type: demand.event_type as EventType,
          car_type: demand.car_type,
          priority: (demand.priority || 'Medium') as DemandPriority,
          status: 'Forecast',
        });
        success++;
      } catch (e) {
        failed++;
      }
    }

    setImporting(false);
    setResults({ success, failed });

    if (failed === 0) {
      setTimeout(() => onSuccess(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Import Demands from CSV</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {!results && (
            <>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p className="mb-2">Upload a CSV file with the following columns:</p>
                <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  name, target_month, car_count, event_type, car_type, priority
                </code>
              </div>

              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <CloudUpload className="w-10 h-10 text-gray-400 mb-2" aria-hidden="true" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {file ? file.name : 'Click to select CSV file'}
                  </span>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded text-sm">
                  {error}
                </div>
              )}

              {preview.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Preview ({preview.length} demands)
                  </h4>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-2 py-1 text-left">Name</th>
                          <th className="px-2 py-1 text-left">Month</th>
                          <th className="px-2 py-1 text-right">Cars</th>
                          <th className="px-2 py-1 text-left">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {preview.slice(0, 5).map((d, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1">{d.name}</td>
                            <td className="px-2 py-1">{d.target_month}</td>
                            <td className="px-2 py-1 text-right">{d.car_count}</td>
                            <td className="px-2 py-1">{d.event_type}</td>
                          </tr>
                        ))}
                        {preview.length > 5 && (
                          <tr>
                            <td colSpan={4} className="px-2 py-1 text-center text-gray-500">
                              ... and {preview.length - 5} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {results && (
            <div className="text-center py-4">
              <div className={`text-4xl mb-2 ${results.failed === 0 ? 'text-green-500' : 'text-yellow-500'}`}>
                {results.failed === 0 ? '✓' : '⚠'}
              </div>
              <p className="text-gray-900 dark:text-gray-100">
                Imported {results.success} demands
                {results.failed > 0 && `, ${results.failed} failed`}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && preview.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn btn-primary"
            >
              {importing ? 'Importing...' : `Import ${preview.length} Demands`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
