'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wrench, Truck, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { getPipelineMetrics, PipelineMetrics } from '@/lib/api';

interface PipelineSummaryCardsProps {
  fiscalYear: number;
}

export default function PipelineSummaryCards({ fiscalYear }: PipelineSummaryCardsProps) {
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPipelineMetrics(fiscalYear);
      setMetrics(data);
    } catch {
      // Non-critical — show zeros
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-4 h-20" />
        ))}
      </div>
    );
  }

  const inShop = metrics?.in_shop ?? 0;
  const enroute = metrics?.enroute ?? 0;
  const completed = metrics?.completed ?? 0;
  const qualifications = metrics?.completed_qualifications ?? 0;
  const assignments = metrics?.completed_assignments ?? 0;
  const badOrders = metrics?.completed_bad_orders ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">In Shop</span>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{inShop}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Enroute</span>
          </div>
          <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{enroute}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">Completed</span>
          </div>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100">{completed}</p>
        </div>
      </div>

      {/* Branched breakdown of completed */}
      {completed > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Completed breakdown
          </button>
          {expanded && (
            <div className="mt-2 ml-2 space-y-1 text-sm">
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Qualifications
                </span>
                <span className="font-medium">{qualifications}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  Assignments
                </span>
                <span className="font-medium">{assignments}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Bad Orders
                </span>
                <span className="font-medium">{badOrders}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
