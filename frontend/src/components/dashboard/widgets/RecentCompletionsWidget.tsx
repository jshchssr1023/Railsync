'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { getBRCHistory } from '@/lib/api';
import { BRCImportHistory } from '@/types';

export default function RecentCompletionsWidget() {
  const [history, setHistory] = useState<BRCImportHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBRCHistory()
      .then((data) => setHistory(data.slice(0, 5)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <FileText className="w-8 h-8 mb-2" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-xs">No BRC imports yet</span>
      </div>
    );
  }

  const totalRecords = history.reduce((sum, h) => sum + h.record_count, 0);
  const totalMatched = history.reduce((sum, h) => sum + h.matched_count, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{totalRecords}</div>
          <div className="text-[10px] text-gray-500">Total BRCs</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalMatched}</div>
          <div className="text-[10px] text-gray-500">Matched</div>
        </div>
      </div>
      <div className="space-y-1">
        {history.slice(0, 3).map((h) => (
          <div key={h.id} className="flex justify-between items-center text-xs">
            <span className="text-gray-600 dark:text-gray-400 truncate max-w-[100px]">{h.filename}</span>
            <span className="text-gray-500">{h.record_count} records</span>
          </div>
        ))}
      </div>
    </div>
  );
}
