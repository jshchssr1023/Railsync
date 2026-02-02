'use client';

import { useState } from 'react';
import { X, Clock, AlertTriangle, Check, ArrowRight, RefreshCw, FileText } from 'lucide-react';

interface Amendment {
  amendment_id: string;
  amendment_code: string;
  rider_id: string;
  rider_name: string;
  lease_id: string;
  customer_name: string;
  amendment_type: string;
  effective_date: string;
  change_summary: string;
  status: string;
  is_latest_version: boolean;
  required_shop_date: string | null;
  previous_shop_date: string | null;
  service_interval_days: number | null;
  previous_service_interval: number | null;
  cars_impacted: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  days_until_effective: number;
  total_cars_affected: number | null;
  cars_with_conflicts: number | null;
  cars_needing_resync: number | null;
  comparison?: AmendmentComparison[];
}

interface AmendmentComparison {
  field: string;
  before: string | number | null;
  after: string | number | null;
}

interface AmendmentModalProps {
  amendment: Amendment;
  onClose: () => void;
  onResync?: (riderId: string) => Promise<void>;
}

export default function AmendmentModal({ amendment, onClose, onResync }: AmendmentModalProps) {
  const [resyncing, setResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const statusColors: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    Active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    Superseded: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };

  const handleResync = async () => {
    if (!onResync) return;

    setResyncing(true);
    setResyncResult(null);

    try {
      await onResync(amendment.rider_id);
      setResyncResult({ success: true, message: 'Schedules synchronized successfully' });
    } catch (error: any) {
      setResyncResult({ success: false, message: error.message || 'Failed to resync schedules' });
    } finally {
      setResyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Amendment Details
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {amendment.amendment_code}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Status and Timeline */}
          <div className="flex items-center justify-between mb-6">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[amendment.status] || statusColors.Pending}`}>
              {amendment.status}
            </span>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              {amendment.days_until_effective > 0 ? (
                <span>Effective in {amendment.days_until_effective} days</span>
              ) : amendment.days_until_effective === 0 ? (
                <span className="text-amber-600 font-medium">Effective Today</span>
              ) : (
                <span>Effective {formatDate(amendment.effective_date)}</span>
              )}
            </div>
          </div>

          {/* Impact Summary */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Impact Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {amendment.cars_impacted || amendment.total_cars_affected || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Cars Affected</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {amendment.cars_with_conflicts || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">With Conflicts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {amendment.cars_needing_resync || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Needing Resync</p>
              </div>
            </div>
          </div>

          {/* Before vs After Comparison */}
          {(amendment.comparison && amendment.comparison.length > 0) || amendment.required_shop_date || amendment.service_interval_days ? (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Changes</h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Field
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Before
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        After
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {amendment.required_shop_date && (
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          Required Shop Date
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">
                          {formatDate(amendment.previous_shop_date) || 'Not set'}
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-green-600 dark:text-green-400">
                          {formatDate(amendment.required_shop_date)}
                        </td>
                      </tr>
                    )}
                    {amendment.service_interval_days && (
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          Service Interval (days)
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">
                          {amendment.previous_service_interval || '365'}
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-green-600 dark:text-green-400">
                          {amendment.service_interval_days}
                        </td>
                      </tr>
                    )}
                    {amendment.comparison?.map((comp, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {comp.field}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">
                          {String(comp.before) || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-green-600 dark:text-green-400">
                          {String(comp.after) || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Change Summary */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Description</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              {amendment.change_summary}
            </p>
          </div>

          {/* Timeline */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Created: {formatDate(amendment.created_at)}
                </span>
              </div>
              {amendment.approved_at && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Approved by {amendment.approved_by}: {formatDate(amendment.approved_at)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${amendment.days_until_effective <= 0 ? 'bg-green-500' : 'bg-amber-400'}`} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Effective: {formatDate(amendment.effective_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Resync Result */}
          {resyncResult && (
            <div className={`mb-4 p-3 rounded-lg ${resyncResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
              <div className="flex items-center gap-2">
                {resyncResult.success ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span className="text-sm">{resyncResult.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {amendment.rider_name} | {amendment.customer_name}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Close
            </button>
            {onResync && (amendment.cars_with_conflicts || 0) > 0 && (
              <button
                onClick={handleResync}
                disabled={resyncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${resyncing ? 'animate-spin' : ''}`} />
                Re-sync Schedule
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
