'use client';

/**
 * EstimateReviewPanel — BRC Viewer / Estimate Review UI
 *
 * Sprint 10 gap closure: Full estimate review page with:
 * - Versioned estimate list with cost summary
 * - Line-level decision table with confidence scores + basis
 * - Decision history modal per line (append-only audit trail)
 * - Approval packet creation + release
 * - Cost breakdown (labor/material/total) with version comparison
 */

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  BarChart3,
  History,
  X,
} from 'lucide-react';
import {
  getEstimate,
  getEstimateDecisions,
  recordLineDecisions,
  generateApprovalPacket,
} from '@/lib/api';
import { EstimateSubmission, EstimateLine, EstimateLineDecision } from '@/types';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Props {
  shoppingEventId: string;
  estimates: EstimateSubmission[];
  onEstimatesChange: (estimates: EstimateSubmission[]) => void;
  onApprovalComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  changes_required: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const DECISION_ICONS: Record<string, React.ReactNode> = {
  approve: <CheckCircle className="w-3.5 h-3.5 text-green-600" />,
  review: <Clock className="w-3.5 h-3.5 text-yellow-600" />,
  reject: <XCircle className="w-3.5 h-3.5 text-red-600" />,
};

const BASIS_LABELS: Record<string, string> = {
  cri_table: 'CRI Table',
  lease_clause: 'Lease Clause',
  policy: 'Company Policy',
  manual: 'Manual Review',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EstimateReviewPanel({
  shoppingEventId,
  estimates,
  onEstimatesChange,
  onApprovalComplete,
}: Props) {
  // Expanded estimate tracking
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadedEstimates, setLoadedEstimates] = useState<Record<string, EstimateSubmission>>({});

  // Decision history modal
  const [historyLineId, setHistoryLineId] = useState<string | null>(null);
  const [historyDecisions, setHistoryDecisions] = useState<(EstimateLineDecision & { line_number: number })[]>([]);
  const [decisionsMap, setDecisionsMap] = useState<Record<string, (EstimateLineDecision & { line_number: number })[]>>({});

  // Approval form
  const [reviewMode, setReviewMode] = useState<string | null>(null);
  const [lineApprovals, setLineApprovals] = useState<Record<string, 'approve' | 'review' | 'reject'>>({});
  const [overallDecision, setOverallDecision] = useState<'approved' | 'changes_required' | 'rejected'>('approved');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  // Version comparison
  const [compareMode, setCompareMode] = useState(false);

  // ---------------------------------------------------------------------------
  // Load estimate with lines + decisions
  // ---------------------------------------------------------------------------

  const loadEstimate = useCallback(async (estId: string) => {
    if (loadedEstimates[estId]?.lines) {
      setExpandedId(expandedId === estId ? null : estId);
      return;
    }

    try {
      const [fullEst, decisions] = await Promise.all([
        getEstimate(estId),
        getEstimateDecisions(estId),
      ]);
      setLoadedEstimates((prev) => ({ ...prev, [estId]: fullEst }));
      setDecisionsMap((prev) => ({ ...prev, [estId]: decisions }));
      setExpandedId(estId);
    } catch {
      setExpandedId(expandedId === estId ? null : estId);
    }
  }, [expandedId, loadedEstimates]);

  // ---------------------------------------------------------------------------
  // Load decision history for a line
  // ---------------------------------------------------------------------------

  const openDecisionHistory = useCallback(async (lineId: string, estId: string) => {
    setHistoryLineId(lineId);
    const all = decisionsMap[estId] || [];
    setHistoryDecisions(all.filter((d) => d.estimate_line_id === lineId));
  }, [decisionsMap]);

  // ---------------------------------------------------------------------------
  // Begin review
  // ---------------------------------------------------------------------------

  const startReview = (estId: string) => {
    const est = loadedEstimates[estId];
    if (!est?.lines) return;

    const defaults: Record<string, 'approve' | 'review' | 'reject'> = {};
    for (const line of est.lines) {
      const decisions = (decisionsMap[estId] || []).filter((d) => d.estimate_line_id === line.id);
      const latest = decisions[0];
      defaults[line.id] = latest?.decision || 'approve';
    }
    setLineApprovals(defaults);
    setOverallDecision('approved');
    setApprovalNotes('');
    setReviewMode(estId);
    setError('');
  };

  // ---------------------------------------------------------------------------
  // Submit approval
  // ---------------------------------------------------------------------------

  const handleSubmitApproval = async () => {
    if (!reviewMode) return;
    setSubmitting(true);
    setError('');

    try {
      const est = loadedEstimates[reviewMode];
      if (!est?.lines) throw new Error('No lines to review');

      // Record per-line decisions
      const decisions = est.lines.map((line) => ({
        estimate_line_id: line.id,
        decision_source: 'human' as const,
        decision: lineApprovals[line.id] || ('approve' as const),
        responsibility: 'unknown' as const,
      }));
      await recordLineDecisions(reviewMode, decisions);

      // Generate approval packet
      const lineDecs = est.lines.map((line) => ({
        line_id: line.id,
        decision: (lineApprovals[line.id] || 'approve') as 'approve' | 'review' | 'reject',
      }));
      await generateApprovalPacket(reviewMode, {
        overall_decision: overallDecision,
        line_decisions: lineDecs,
        notes: approvalNotes || undefined,
      });

      // Refresh estimate
      const refreshed = await getEstimate(reviewMode);
      setLoadedEstimates((prev) => ({ ...prev, [reviewMode!]: refreshed }));

      // Update parent
      onEstimatesChange(
        estimates.map((e) => (e.id === reviewMode ? { ...e, status: overallDecision === 'approved' ? 'approved' : overallDecision === 'rejected' ? 'rejected' : 'changes_required' } : e))
      );

      setReviewMode(null);
      setShowConfirm(false);
      onApprovalComplete?.();
    } catch (err: any) {
      setError(err.message || 'Failed to submit approval');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Cost summary for all versions
  // ---------------------------------------------------------------------------

  const costSummary = estimates.length > 0
    ? {
        latest: estimates[0],
        totalVersions: estimates.length,
        laborHours: Number(estimates[0]?.total_labor_hours || 0),
        materialCost: Number(estimates[0]?.total_material_cost || 0),
        totalCost: Number(estimates[0]?.total_cost || 0),
        previousCost: estimates.length > 1 ? Number(estimates[1]?.total_cost || 0) : null,
      }
    : null;

  const costDelta = costSummary?.previousCost != null
    ? costSummary.totalCost - costSummary.previousCost
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Cost Summary Banner */}
      {costSummary && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Estimate Cost Summary
            </h3>
            {estimates.length > 1 && (
              <button
                onClick={() => setCompareMode(!compareMode)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {compareMode ? 'Hide comparison' : 'Compare versions'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Cost</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                {formatCurrency(costSummary.totalCost)}
              </p>
              {costDelta != null && costDelta !== 0 && (
                <p className={`text-xs font-medium ${costDelta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {costDelta > 0 ? '+' : ''}{formatCurrency(costDelta)} vs v{estimates.length > 1 ? estimates[1].version_number : '?'}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Labor Hours</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                {costSummary.laborHours.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Material Cost</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                {formatCurrency(costSummary.materialCost)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Versions</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                {costSummary.totalVersions}
              </p>
              <p className={`text-xs ${STATUS_COLORS[costSummary.latest.status] || ''} px-1.5 py-0.5 rounded-full inline-block mt-0.5`}>
                {costSummary.latest.status.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          {/* Version comparison */}
          {compareMode && estimates.length > 1 && (
            <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 dark:text-gray-400">
                    <th className="text-left py-1">Version</th>
                    <th className="text-left py-1">Status</th>
                    <th className="text-right py-1">Labor</th>
                    <th className="text-right py-1">Material</th>
                    <th className="text-right py-1">Total</th>
                    <th className="text-right py-1">Delta</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {estimates.map((est, idx) => {
                    const prev = estimates[idx + 1];
                    const delta = prev ? Number(est.total_cost || 0) - Number(prev.total_cost || 0) : null;
                    return (
                      <tr key={est.id} className="border-t border-gray-100 dark:border-gray-700/50">
                        <td className="py-1 font-medium">v{est.version_number}</td>
                        <td className="py-1">
                          <span className={`px-1.5 py-0.5 rounded-full ${STATUS_COLORS[est.status] || ''}`}>
                            {est.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-1 text-right font-mono">{Number(est.total_labor_hours || 0).toFixed(1)}</td>
                        <td className="py-1 text-right font-mono">{formatCurrency(est.total_material_cost)}</td>
                        <td className="py-1 text-right font-mono font-medium">{formatCurrency(est.total_cost)}</td>
                        <td className="py-1 text-right font-mono">
                          {delta != null ? (
                            <span className={delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-400'}>
                              {delta > 0 ? '+' : ''}{formatCurrency(delta)}
                            </span>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Estimate versions */}
      {estimates.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
          No estimates submitted yet.
        </p>
      ) : (
        <div className="space-y-2">
          {estimates.map((est) => {
            const loaded = loadedEstimates[est.id];
            const lines = loaded?.lines || [];
            const isExpanded = expandedId === est.id;

            return (
              <div key={est.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                {/* Header row */}
                <button
                  onClick={() => loadEstimate(est.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      v{est.version_number}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[est.status] || 'bg-gray-100 text-gray-800'}`}>
                      {est.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100 font-mono">
                      {formatCurrency(est.total_cost)}
                    </span>
                    {est.submitted_at && (
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {formatDate(est.submitted_at)}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {lines.length > 0 ? (
                      <>
                        {/* Lines table with enhanced decision data */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">AAR/Job</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Labor Hrs</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Material</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Decision</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Confidence</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Basis</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resp.</th>
                                <th className="px-3 py-2 w-8"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {lines.map((line) => {
                                const lineDecisions = (decisionsMap[est.id] || []).filter(
                                  (d) => d.estimate_line_id === line.id
                                );
                                const latest = lineDecisions[0];
                                const hasOverride = lineDecisions.some(
                                  (d) => d.decision_notes?.includes('[OVERRIDE]')
                                );

                                return (
                                  <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{line.line_number}</td>
                                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs font-mono">
                                      {line.aar_code || line.job_code || '--'}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[200px] truncate text-xs">
                                      {line.description || '--'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-xs text-gray-700 dark:text-gray-300">
                                      {line.labor_hours != null ? Number(line.labor_hours).toFixed(1) : '--'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-xs text-gray-700 dark:text-gray-300">
                                      {formatCurrency(line.material_cost)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                                      {formatCurrency(line.total_cost)}
                                    </td>
                                    {/* Decision */}
                                    <td className="px-3 py-2 text-center">
                                      {latest ? (
                                        <span className="inline-flex items-center gap-1">
                                          {DECISION_ICONS[latest.decision]}
                                          <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                                            latest.decision === 'approve'
                                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                              : latest.decision === 'reject'
                                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                          }`}>
                                            {latest.decision}
                                          </span>
                                          <span className="text-[9px] text-gray-400">
                                            {latest.decision_source === 'ai' ? 'AI' : 'HU'}
                                          </span>
                                          {hasOverride && (
                                            <span className="text-[9px] px-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded font-bold">
                                              OVR
                                            </span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-400">--</span>
                                      )}
                                    </td>
                                    {/* Confidence */}
                                    <td className="px-3 py-2 text-center">
                                      {latest?.confidence_score != null ? (
                                        <div className="inline-flex items-center gap-1">
                                          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${
                                                Number(latest.confidence_score) >= 0.8
                                                  ? 'bg-green-500'
                                                  : Number(latest.confidence_score) >= 0.5
                                                  ? 'bg-yellow-500'
                                                  : 'bg-red-500'
                                              }`}
                                              style={{ width: `${Number(latest.confidence_score) * 100}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] text-gray-500 font-mono">
                                            {(Number(latest.confidence_score) * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400">--</span>
                                      )}
                                    </td>
                                    {/* Basis */}
                                    <td className="px-3 py-2 text-center">
                                      {latest?.basis_type ? (
                                        <span
                                          className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                                          title={latest.basis_reference || ''}
                                        >
                                          {BASIS_LABELS[latest.basis_type] || latest.basis_type}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-400">--</span>
                                      )}
                                    </td>
                                    {/* Responsibility */}
                                    <td className="px-3 py-2 text-center">
                                      {latest?.responsibility && latest.responsibility !== 'unknown' ? (
                                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                                          latest.responsibility === 'lessor'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                        }`}>
                                          {latest.responsibility}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-400">--</span>
                                      )}
                                    </td>
                                    {/* History button */}
                                    <td className="px-2 py-2">
                                      {lineDecisions.length > 0 && (
                                        <button
                                          onClick={() => openDecisionHistory(line.id, est.id)}
                                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                          title={`${lineDecisions.length} decision(s)`}
                                        >
                                          <History className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            {/* Totals row */}
                            <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t-2 border-gray-300 dark:border-gray-600">
                              <tr>
                                <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  TOTALS ({lines.length} lines)
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                                  {Number(est.total_labor_hours || 0).toFixed(1)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(est.total_material_cost)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(est.total_cost)}
                                </td>
                                <td colSpan={5}></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Actions */}
                        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
                          {est.status === 'submitted' && (
                            <>
                              {reviewMode === est.id ? (
                                <div className="w-full space-y-3">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Review Estimate v{est.version_number}
                                  </h4>

                                  {/* Per-line decisions */}
                                  <div className="space-y-1.5">
                                    {lines.map((line) => (
                                      <div key={line.id} className="flex items-center gap-3 text-sm">
                                        <span className="w-6 text-gray-500 text-xs">#{line.line_number}</span>
                                        <span className="flex-1 truncate text-gray-700 dark:text-gray-300 text-xs">
                                          {line.description || line.aar_code || 'Line'}
                                        </span>
                                        <span className="text-xs font-mono text-gray-500">{formatCurrency(line.total_cost)}</span>
                                        <select
                                          value={lineApprovals[line.id] || 'approve'}
                                          onChange={(e) =>
                                            setLineApprovals((prev) => ({
                                              ...prev,
                                              [line.id]: e.target.value as 'approve' | 'review' | 'reject',
                                            }))
                                          }
                                          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        >
                                          <option value="approve">Approve</option>
                                          <option value="review">Changes Req.</option>
                                          <option value="reject">Reject</option>
                                        </select>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Overall */}
                                  <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall:</label>
                                    <select
                                      value={overallDecision}
                                      onChange={(e) => setOverallDecision(e.target.value as typeof overallDecision)}
                                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    >
                                      <option value="approved">Approved</option>
                                      <option value="changes_required">Changes Required</option>
                                      <option value="rejected">Rejected</option>
                                    </select>
                                  </div>

                                  <textarea
                                    value={approvalNotes}
                                    onChange={(e) => setApprovalNotes(e.target.value)}
                                    placeholder="Review notes (optional)..."
                                    rows={2}
                                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  />

                                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setShowConfirm(true)}
                                      disabled={submitting}
                                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                                    >
                                      {submitting ? 'Submitting...' : 'Submit Decision'}
                                    </button>
                                    <button
                                      onClick={() => setReviewMode(null)}
                                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startReview(est.id)}
                                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  Review &amp; Approve
                                </button>
                              )}
                            </>
                          )}

                          {(est.status === 'approved' || est.status === 'changes_required' || est.status === 'rejected') && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Decision recorded: {est.status.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading lines...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Decision History Modal */}
      {historyLineId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setHistoryLineId(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <History className="w-4 h-4" />
                Decision History
              </h3>
              <button onClick={() => setHistoryLineId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {historyDecisions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No decisions recorded.</p>
              ) : (
                <div className="space-y-3">
                  {historyDecisions.map((dec, idx) => (
                    <div
                      key={dec.id || idx}
                      className={`p-3 rounded-lg border ${
                        idx === 0 ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {DECISION_ICONS[dec.decision]}
                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                            dec.decision === 'approve'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : dec.decision === 'reject'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {dec.decision}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded">
                            {dec.decision_source === 'ai' ? 'AI' : 'Human'}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">LATEST</span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {dec.decided_at ? formatDate(dec.decided_at) : '--'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                        {dec.confidence_score != null && (
                          <div>
                            <span className="text-gray-500">Confidence:</span>{' '}
                            <span className="font-mono">{(Number(dec.confidence_score) * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        {dec.responsibility && dec.responsibility !== 'unknown' && (
                          <div>
                            <span className="text-gray-500">Responsibility:</span>{' '}
                            <span className="font-medium">{dec.responsibility}</span>
                          </div>
                        )}
                        {dec.basis_type && (
                          <div>
                            <span className="text-gray-500">Basis:</span>{' '}
                            <span>{BASIS_LABELS[dec.basis_type] || dec.basis_type}</span>
                          </div>
                        )}
                        {dec.basis_reference && (
                          <div>
                            <span className="text-gray-500">Reference:</span>{' '}
                            <span className="font-mono">{dec.basis_reference}</span>
                          </div>
                        )}
                      </div>

                      {dec.decision_notes && (
                        <p className={`text-xs mt-2 ${
                          dec.decision_notes.includes('[OVERRIDE]')
                            ? 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 px-2 py-1 rounded'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {dec.decision_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        title="Submit Estimate Decision"
        description={`This will record an overall decision of "${overallDecision.replace(/_/g, ' ')}" for this estimate.`}
        variant={overallDecision === 'rejected' ? 'danger' : 'warning'}
        confirmLabel="Submit Decision"
        onConfirm={handleSubmitApproval}
        irreversibleWarning={overallDecision === 'approved'}
      />
    </div>
  );
}
