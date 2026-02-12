'use client';

import { useState } from 'react';
import {
  X, Clock, AlertTriangle, Check, RefreshCw, FileText, Loader2,
  Send, ThumbsUp, ThumbsDown, Zap, Undo2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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
  new_rate?: number;
  rejection_reason?: string | null;
  version?: number;
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
  onStatusChange?: () => void;
}

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;
}

async function lifecycleAction(amendmentId: string, action: string, body?: object): Promise<any> {
  const token = getToken();
  const res = await fetch(`${API_URL}/amendments/${amendmentId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || `Failed to ${action} amendment`);
  return data;
}

export default function AmendmentModal({ amendment, onClose, onResync, onStatusChange }: AmendmentModalProps) {
  const [resyncing, setResyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusColors: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    Pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    Active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    Superseded: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };

  const handleResync = async () => {
    if (!onResync) return;
    setResyncing(true);
    setActionResult(null);
    try {
      await onResync(amendment.rider_id);
      setActionResult({ success: true, message: 'Schedules synchronized successfully' });
    } catch (error: any) {
      setActionResult({ success: false, message: error.message || 'Failed to resync schedules' });
    } finally {
      setResyncing(false);
    }
  };

  const handleAction = async (action: string, body?: object) => {
    setActionLoading(action);
    setActionResult(null);
    try {
      await lifecycleAction(amendment.amendment_id, action, body);
      const labels: Record<string, string> = {
        submit: 'Submitted for review',
        approve: 'Approved',
        reject: 'Sent back to draft',
        activate: 'Activated — rate changes applied',
      };
      setActionResult({ success: true, message: labels[action] || 'Success' });
      onStatusChange?.();
    } catch (error: any) {
      setActionResult({ success: false, message: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    await handleAction('reject', { reason: rejectReason });
    setShowRejectForm(false);
    setRejectReason('');
  };

  const isReadOnly = amendment.status === 'Active' || amendment.status === 'Superseded';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              amendment.status === 'Draft' ? 'bg-gray-100 dark:bg-gray-700' :
              amendment.status === 'Pending' ? 'bg-amber-100 dark:bg-amber-900/30' :
              amendment.status === 'Approved' ? 'bg-blue-100 dark:bg-blue-900/30' :
              amendment.status === 'Active' ? 'bg-green-100 dark:bg-green-900/30' :
              'bg-gray-100 dark:bg-gray-700'
            }`}>
              <FileText className={`w-5 h-5 ${
                amendment.status === 'Pending' ? 'text-amber-600 dark:text-amber-400' :
                amendment.status === 'Approved' ? 'text-blue-600 dark:text-blue-400' :
                amendment.status === 'Active' ? 'text-green-600 dark:text-green-400' :
                'text-gray-600 dark:text-gray-400'
              }`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Amendment {amendment.amendment_code}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {amendment.amendment_type} — v{amendment.version || 1}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Status Badge + Effective Date */}
          <div className="flex items-center justify-between mb-6">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[amendment.status] || statusColors.Draft}`}>
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

          {/* Rejection reason banner */}
          {amendment.rejection_reason && amendment.status === 'Draft' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <Undo2 className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">Returned for revision</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{amendment.rejection_reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Impact Summary */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Impact Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {amendment.cars_impacted || amendment.total_cars_affected || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Cars Affected</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {amendment.cars_with_conflicts || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Conflicts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {amendment.cars_needing_resync || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Needing Resync</p>
              </div>
            </div>
          </div>

          {/* Rate Change */}
          {amendment.new_rate && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Rate Change: ${Number(amendment.new_rate).toFixed(2)}/mo per car
              </p>
            </div>
          )}

          {/* Changes Table */}
          {(amendment.comparison && amendment.comparison.length > 0) || amendment.required_shop_date || amendment.service_interval_days ? (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Changes</h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Before</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {amendment.required_shop_date && (
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">Required Shop Date</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-500">{formatDate(amendment.previous_shop_date) || 'Not set'}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-green-600 dark:text-green-400">{formatDate(amendment.required_shop_date)}</td>
                      </tr>
                    )}
                    {amendment.service_interval_days && (
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">Service Interval (days)</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-500">{amendment.previous_service_interval || '365'}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-green-600 dark:text-green-400">{amendment.service_interval_days}</td>
                      </tr>
                    )}
                    {amendment.comparison?.map((comp, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{comp.field}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-500">{String(comp.before) || '-'}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-green-600 dark:text-green-400">{String(comp.after) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Description */}
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
                <span className="text-sm text-gray-600 dark:text-gray-400">Created: {formatDate(amendment.created_at)}</span>
              </div>
              {amendment.approved_at && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Approved by {amendment.approved_by}: {formatDate(amendment.approved_at)}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${amendment.days_until_effective <= 0 ? 'bg-green-500' : 'bg-amber-400'}`} />
                <span className="text-sm text-gray-600 dark:text-gray-400">Effective: {formatDate(amendment.effective_date)}</span>
              </div>
            </div>
          </div>

          {/* Reject Form */}
          {showRejectForm && (
            <div className="mb-4 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">Send Back — Reason Required</h4>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent mb-2"
                placeholder="Explain why this amendment needs revision..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || actionLoading === 'reject'}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {actionLoading === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
                  Confirm Send Back
                </button>
              </div>
            </div>
          )}

          {/* Action Result */}
          {actionResult && (
            <div className={`mb-4 p-3 rounded-lg ${actionResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
              <div className="flex items-center gap-2">
                {actionResult.success ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span className="text-sm">{actionResult.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions — status-aware */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
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

            {/* Draft: Submit for Review */}
            {amendment.status === 'Draft' && !actionResult?.success && (
              <button
                onClick={() => handleAction('submit')}
                disabled={actionLoading === 'submit'}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {actionLoading === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit for Review
              </button>
            )}

            {/* Pending: Approve + Send Back */}
            {amendment.status === 'Pending' && !actionResult?.success && (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={showRejectForm}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <ThumbsDown className="w-4 h-4" />
                  Send Back
                </button>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading === 'approve'}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {actionLoading === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  Approve
                </button>
              </>
            )}

            {/* Approved: Activate */}
            {amendment.status === 'Approved' && !actionResult?.success && (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={showRejectForm}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <ThumbsDown className="w-4 h-4" />
                  Send Back
                </button>
                <button
                  onClick={() => handleAction('activate')}
                  disabled={actionLoading === 'activate'}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {actionLoading === 'activate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Activate
                </button>
              </>
            )}

            {/* Resync (any status with conflicts) */}
            {onResync && (amendment.cars_with_conflicts || 0) > 0 && !actionResult?.success && (
              <button
                onClick={handleResync}
                disabled={resyncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${resyncing ? 'animate-spin' : ''}`} />
                Re-sync
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
