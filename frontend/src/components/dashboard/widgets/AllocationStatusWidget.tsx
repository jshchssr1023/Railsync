'use client';

import { useEffect, useState } from 'react';
import { listAllocations } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  'Planned Shopping': 'bg-blue-500',
  'Enroute': 'bg-yellow-500',
  'Arrived': 'bg-purple-500',
  'Complete': 'bg-green-500',
  'Released': 'bg-gray-500',
};

export default function AllocationStatusWidget() {
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAllocations()
      .then((data) => {
        const counts: Record<string, number> = {};
        data.allocations.forEach((a) => {
          counts[a.status] = (counts[a.status] || 0) + 1;
        });
        setStatusCounts(counts);
      })
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

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <div className="text-sm text-gray-500 text-center">No allocations</div>;
  }

  return (
    <div className="space-y-2">
      {Object.entries(statusCounts).map(([status, count]) => (
        <div key={status} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status] || 'bg-gray-400'}`} />
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{status}</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{count}</span>
        </div>
      ))}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Total</span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{total}</span>
      </div>
    </div>
  );
}
