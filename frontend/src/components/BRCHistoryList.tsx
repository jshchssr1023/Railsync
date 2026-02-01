'use client';

import { useState, useEffect } from 'react';
import { getBRCHistory } from '@/lib/api';
import { BRCImportHistory } from '@/types';

export default function BRCHistoryList() {
  const [history, setHistory] = useState<BRCImportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await getBRCHistory();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load BRC history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Loading import history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchHistory}
          className="mt-2 text-sm text-primary-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No BRC imports yet</p>
        <p className="text-xs mt-1">Import a BRC file to see history here</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Imported
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Filename
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Records
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Matched
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Running Repairs
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Errors
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {history.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {new Date(item.imported_at).toLocaleString()}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {item.filename}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                {item.record_count.toLocaleString()}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                  {item.matched_count.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                  {item.running_repair_count.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                {item.error_count > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                    {item.error_count.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
