'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getShoppingEvent,
  transitionShoppingEventState,
  getShoppingEventStateHistory,
  listEstimateVersions,
  getEstimate,
  getEstimateDecisions,
  recordLineDecisions,
  generateApprovalPacket,
  getShoppingEventProjectFlags,
  bundleProjectWork,
} from '@/lib/api';
import { ShoppingEvent, StateHistoryEntry, EstimateSubmission, EstimateLineDecision } from '@/types';
import { Info, AlertTriangle, ChevronDown, Zap } from 'lucide-react';
import StateProgressBar from '@/components/StateProgressBar';

// ---------------------------------------------------------------------------
// State badge color mapping
// ---------------------------------------------------------------------------
const STATE_COLORS: Record<string, string> = {
  REQUESTED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  ASSIGNED_TO_SHOP: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  INBOUND: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  INSPECTION: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  ESTIMATE_SUBMITTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ESTIMATE_UNDER_REVIEW: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ESTIMATE_APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CHANGES_REQUIRED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  WORK_AUTHORIZED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  IN_REPAIR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  QA_COMPLETE: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  FINAL_ESTIMATE_SUBMITTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  FINAL_ESTIMATE_APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  READY_FOR_RELEASE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  RELEASED: 'bg-green-200 text-green-900 dark:bg-green-900/50 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

// ---------------------------------------------------------------------------
// Estimate status badge colors
// ---------------------------------------------------------------------------
const ESTIMATE_STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  changes_required: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

// ---------------------------------------------------------------------------
// Valid state transitions with labels, targets, and button colors
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS: Record<string, { label: string; target: string; color: string }[]> = {
  REQUESTED: [{ label: 'Assign to Shop', target: 'ASSIGNED_TO_SHOP', color: 'bg-blue-600 hover:bg-blue-700' }],
  ASSIGNED_TO_SHOP: [{ label: 'Mark Inbound', target: 'INBOUND', color: 'bg-blue-600 hover:bg-blue-700' }],
  INBOUND: [{ label: 'Start Inspection', target: 'INSPECTION', color: 'bg-indigo-600 hover:bg-indigo-700' }],
  INSPECTION: [{ label: 'Submit Estimate', target: 'ESTIMATE_SUBMITTED', color: 'bg-yellow-600 hover:bg-yellow-700' }],
  ESTIMATE_SUBMITTED: [{ label: 'Begin Review', target: 'ESTIMATE_UNDER_REVIEW', color: 'bg-yellow-600 hover:bg-yellow-700' }],
  ESTIMATE_UNDER_REVIEW: [
    { label: 'Approve Estimate', target: 'ESTIMATE_APPROVED', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Request Changes', target: 'CHANGES_REQUIRED', color: 'bg-orange-600 hover:bg-orange-700' },
  ],
  CHANGES_REQUIRED: [{ label: 'Resubmit Estimate', target: 'ESTIMATE_SUBMITTED', color: 'bg-yellow-600 hover:bg-yellow-700' }],
  ESTIMATE_APPROVED: [{ label: 'Authorize Work', target: 'WORK_AUTHORIZED', color: 'bg-green-600 hover:bg-green-700' }],
  WORK_AUTHORIZED: [{ label: 'Start Repair', target: 'IN_REPAIR', color: 'bg-purple-600 hover:bg-purple-700' }],
  IN_REPAIR: [{ label: 'QA Complete', target: 'QA_COMPLETE', color: 'bg-teal-600 hover:bg-teal-700' }],
  QA_COMPLETE: [{ label: 'Submit Final Estimate', target: 'FINAL_ESTIMATE_SUBMITTED', color: 'bg-yellow-600 hover:bg-yellow-700' }],
  FINAL_ESTIMATE_SUBMITTED: [{ label: 'Approve Final', target: 'FINAL_ESTIMATE_APPROVED', color: 'bg-green-600 hover:bg-green-700' }],
  FINAL_ESTIMATE_APPROVED: [{ label: 'Ready for Release', target: 'READY_FOR_RELEASE', color: 'bg-emerald-600 hover:bg-emerald-700' }],
  READY_FOR_RELEASE: [{ label: 'Release', target: 'RELEASED', color: 'bg-green-700 hover:bg-green-800' }],
};

// ---------------------------------------------------------------------------
// Terminal states that cannot be cancelled
// ---------------------------------------------------------------------------
const TERMINAL_STATES = new Set(['RELEASED', 'CANCELLED']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function stateLabel(state: string): string {
  return state.replace(/_/g, ' ');
}

// ===========================================================================
// Page Component
// ===========================================================================
export default function ShoppingEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  const [event, setEvent] = useState<ShoppingEvent | null>(null);
  const [history, setHistory] = useState<StateHistoryEntry[]>([]);
  const [estimates, setEstimates] = useState<EstimateSubmission[]>([]);
  const [expandedEstimate, setExpandedEstimate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [gateWarning, setGateWarning] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Project flag detection
  const [projectFlag, setProjectFlag] = useState<{
    project_id: string;
    project_car_id: string;
    project_number: string;
    project_name: string;
    scope_of_work: string;
    assignment_id?: string;
    shop_code?: string;
    target_month?: string;
    plan_state?: string;
  } | null>(null);
  const [bundling, setBundling] = useState(false);
  const [bundleSuccess, setBundleSuccess] = useState(false);

  // Estimate decisions & approval
  const [decisionsMap, setDecisionsMap] = useState<Record<string, (EstimateLineDecision & { line_number: number })[]>>({});
  const [showApprovalForm, setShowApprovalForm] = useState<string | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<'approved' | 'changes_required' | 'rejected'>('approved');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [lineApprovals, setLineApprovals] = useState<Record<string, 'approve' | 'review' | 'reject'>>({});
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [eventData, historyData, estimateData] = await Promise.all([
        getShoppingEvent(id),
        getShoppingEventStateHistory(id),
        listEstimateVersions(id),
      ]);
      setEvent(eventData);
      setHistory(historyData);
      setEstimates(estimateData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shopping event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Fetch project flags for the shopping event
  useEffect(() => {
    if (!id) return;
    getShoppingEventProjectFlags(id)
      .then(flag => setProjectFlag(flag))
      .catch(() => { /* non-critical */ });
  }, [id]);

  // -----------------------------------------------------------------------
  // Load decisions for an estimate when expanded
  // -----------------------------------------------------------------------
  const fetchDecisions = useCallback(async (estimateId: string) => {
    if (decisionsMap[estimateId]) return;
    try {
      const decisions = await getEstimateDecisions(estimateId);
      setDecisionsMap((prev) => ({ ...prev, [estimateId]: decisions }));
    } catch {
      // Silently fail — decisions are supplementary
    }
  }, [decisionsMap]);

  // -----------------------------------------------------------------------
  // Load full estimate with lines when expanding
  // -----------------------------------------------------------------------
  const handleExpandEstimate = useCallback(async (estId: string) => {
    if (expandedEstimate === estId) {
      setExpandedEstimate(null);
      return;
    }
    setExpandedEstimate(estId);
    // Load full estimate with lines if not already loaded
    const existing = estimates.find((e) => e.id === estId);
    if (existing && (!existing.lines || existing.lines.length === 0)) {
      try {
        const full = await getEstimate(estId);
        setEstimates((prev) =>
          prev.map((e) => (e.id === estId ? { ...e, lines: full.lines } : e))
        );
      } catch {
        // Fall through — lines might just be empty
      }
    }
    fetchDecisions(estId);
  }, [expandedEstimate, estimates, fetchDecisions]);

  // -----------------------------------------------------------------------
  // Approval packet submission
  // -----------------------------------------------------------------------
  const handleSubmitApproval = async (estimateId: string) => {
    setSubmittingApproval(true);
    setApprovalError(null);
    try {
      const est = estimates.find((e) => e.id === estimateId);
      const lineDecs = (est?.lines || []).map((line) => ({
        line_id: line.id,
        decision: lineApprovals[line.id] || 'approve' as const,
      }));
      await generateApprovalPacket(estimateId, {
        overall_decision: approvalDecision,
        line_decisions: lineDecs,
        notes: approvalNotes || undefined,
      });
      setShowApprovalForm(null);
      setApprovalDecision('approved');
      setApprovalNotes('');
      setLineApprovals({});
      await fetchAll();
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Failed to submit approval');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // -----------------------------------------------------------------------
  // Open approval form (pre-populate line defaults)
  // -----------------------------------------------------------------------
  const openApprovalForm = (estimateId: string) => {
    const est = estimates.find((e) => e.id === estimateId);
    const defaults: Record<string, 'approve' | 'review' | 'reject'> = {};
    (est?.lines || []).forEach((line) => {
      defaults[line.id] = 'approve';
    });
    setLineApprovals(defaults);
    setApprovalDecision('approved');
    setApprovalNotes('');
    setApprovalError(null);
    setShowApprovalForm(estimateId);
  };

  // -----------------------------------------------------------------------
  // State transition handler
  // -----------------------------------------------------------------------
  const handleTransition = async (targetState: string, notes?: string) => {
    setTransitioning(true);
    setTransitionError(null);
    setGateWarning(null);
    try {
      await transitionShoppingEventState(id, targetState, notes || undefined);
      setTransitionNotes('');
      setShowCancelForm(false);
      setCancelReason('');
      await fetchAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transition failed';
      // Detect 409 gate-blocked errors
      if (message.includes('409') || message.toLowerCase().includes('gate') || message.toLowerCase().includes('blocked')) {
        setGateWarning(message);
      } else {
        setTransitionError(message);
      }
    } finally {
      setTransitioning(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    await handleTransition('CANCELLED', cancelReason.trim());
  };

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  if (error || !event) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-700 dark:text-red-400 mb-4">{error || 'Shopping event not found'}</p>
          <button
            onClick={fetchAll}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 mr-3"
          >
            Retry
          </button>
          <Link href="/shopping" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            Back to Shopping Events
          </Link>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------
  const transitions = VALID_TRANSITIONS[event.state] || [];
  const canCancel = !TERMINAL_STATES.has(event.state);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Back link                                                         */}
      {/* ----------------------------------------------------------------- */}
      <Link
        href="/shopping"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        &larr; Back to Shopping Events
      </Link>

      {/* ----------------------------------------------------------------- */}
      {/* Header section                                                    */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {event.event_number}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span>Car <span className="font-medium text-gray-900 dark:text-gray-100">{event.car_number}</span></span>
            <span>&bull;</span>
            <span>Shop <span className="font-medium text-gray-900 dark:text-gray-100">{event.shop_name || event.shop_code}</span></span>
            {event.batch_number && (
              <>
                <span>&bull;</span>
                <span>Batch <span className="font-medium text-gray-900 dark:text-gray-100">{event.batch_number}</span></span>
              </>
            )}
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${STATE_COLORS[event.state] || 'bg-gray-100 text-gray-800'}`}
        >
          {stateLabel(event.state)}
        </span>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* State Progress Bar                                                */}
      {/* ----------------------------------------------------------------- */}
      <StateProgressBar currentState={event.state} />

      {/* ----------------------------------------------------------------- */}
      {/* Error / Warning banners                                           */}
      {/* ----------------------------------------------------------------- */}
      {transitionError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-400">{transitionError}</p>
          </div>
          <button onClick={() => setTransitionError(null)} className="text-red-400 hover:text-red-600">
            &times;
          </button>
        </div>
      )}

      {gateWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Gate Blocked</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">{gateWarning}</p>
          </div>
          <button onClick={() => setGateWarning(null)} className="text-amber-400 hover:text-amber-600">
            &times;
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* State Transition Actions                                          */}
      {/* ----------------------------------------------------------------- */}
      {(transitions.length > 0 || canCancel) && (
        <div className="card p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Actions</h2>

          {/* Optional notes for forward transitions */}
          {transitions.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Transition Notes (optional)
              </label>
              <input
                type="text"
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                placeholder="Add notes for this transition..."
                className="input w-full text-sm"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {transitions.map((t) => (
              <button
                key={t.target}
                disabled={transitioning}
                onClick={() => handleTransition(t.target, transitionNotes || undefined)}
                className={`px-4 py-2 text-sm font-medium text-white rounded ${t.color} disabled:opacity-50`}
              >
                {transitioning ? 'Processing...' : t.label}
              </button>
            ))}

            {canCancel && !showCancelForm && (
              <button
                onClick={() => setShowCancelForm(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                disabled={transitioning}
              >
                Cancel Event
              </button>
            )}
          </div>

          {/* Cancel form */}
          {showCancelForm && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
              <label className="block text-sm font-medium text-red-700 dark:text-red-400">
                Cancellation Reason (required)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Provide a reason for cancellation..."
                className="w-full px-3 py-2 text-sm border border-red-300 dark:border-red-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-red-500 focus:border-red-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={transitioning || !cancelReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                >
                  {transitioning ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
                <button
                  onClick={() => {
                    setShowCancelForm(false);
                    setCancelReason('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Estimate Submissions                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="card p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Estimate Submissions
        </h2>

        {estimates.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No estimates have been submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {estimates.map((est) => (
              <div key={est.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Clickable summary row */}
                <button
                  onClick={() => handleExpandEstimate(est.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      v{est.version_number}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        ESTIMATE_STATUS_COLORS[est.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {est.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(est.total_cost)}
                    </span>
                    {est.submitted_at && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatDate(est.submitted_at)}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedEstimate === est.id ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                </button>

                {/* Expanded lines with decisions */}
                {expandedEstimate === est.id && est.lines && est.lines.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">AAR</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Labor</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Material</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Decision</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resp.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {est.lines.map((line) => {
                            const lineDecisions = (decisionsMap[est.id] || []).filter(
                              (d) => d.estimate_line_id === line.id
                            );
                            const latestDecision = lineDecisions[0];
                            const hasOverride = lineDecisions.some(
                              (d) => d.decision_notes?.includes('[OVERRIDE]')
                            );

                            return (
                              <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{line.line_number}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{line.aar_code || '--'}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-xs truncate">{line.description || '--'}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                                  {line.labor_hours != null ? Number(line.labor_hours).toFixed(1) : '--'}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                                  {formatCurrency(line.material_cost)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-medium text-gray-900 dark:text-gray-100">
                                  {formatCurrency(line.total_cost)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {latestDecision ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span
                                        className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                                          latestDecision.decision === 'approve'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : latestDecision.decision === 'reject'
                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        }`}
                                      >
                                        {latestDecision.decision}
                                      </span>
                                      <span className="text-[10px] text-gray-400">
                                        {latestDecision.decision_source === 'ai' ? 'AI' : 'HU'}
                                      </span>
                                      {hasOverride && (
                                        <span
                                          className="text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded font-bold"
                                          title="Human override of AI decision"
                                        >
                                          OVR
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">--</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {latestDecision?.responsibility && latestDecision.responsibility !== 'unknown' ? (
                                    <span
                                      className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                                        latestDecision.responsibility === 'lessor'
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                      }`}
                                    >
                                      {latestDecision.responsibility}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">--</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Approval action */}
                    {est.status === 'submitted' && (
                      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        {showApprovalForm === est.id ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Review Estimate v{est.version_number}
                            </h4>

                            {/* Per-line decisions */}
                            <div className="space-y-2">
                              {est.lines?.map((line) => (
                                <div key={line.id} className="flex items-center gap-3 text-sm">
                                  <span className="w-6 text-gray-500">#{line.line_number}</span>
                                  <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                                    {line.description || line.aar_code || 'Line'}
                                  </span>
                                  <select
                                    value={lineApprovals[line.id] || 'approve'}
                                    onChange={(e) =>
                                      setLineApprovals((prev) => ({
                                        ...prev,
                                        [line.id]: e.target.value as 'approve' | 'review' | 'reject',
                                      }))
                                    }
                                    className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  >
                                    <option value="approve">Approve</option>
                                    <option value="review">Changes Required</option>
                                    <option value="reject">Reject</option>
                                  </select>
                                </div>
                              ))}
                            </div>

                            {/* Overall decision */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Overall:
                              </label>
                              <select
                                value={approvalDecision}
                                onChange={(e) =>
                                  setApprovalDecision(e.target.value as 'approved' | 'changes_required' | 'rejected')
                                }
                                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              >
                                <option value="approved">Approved</option>
                                <option value="changes_required">Changes Required</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>

                            {/* Notes */}
                            <textarea
                              value={approvalNotes}
                              onChange={(e) => setApprovalNotes(e.target.value)}
                              placeholder="Review notes (optional)..."
                              rows={2}
                              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />

                            {approvalError && (
                              <p className="text-sm text-red-600 dark:text-red-400">{approvalError}</p>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSubmitApproval(est.id)}
                                disabled={submittingApproval}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                              >
                                {submittingApproval ? 'Submitting...' : 'Submit Decision'}
                              </button>
                              <button
                                onClick={() => setShowApprovalForm(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => openApprovalForm(est.id)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                          >
                            Review &amp; Approve
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {expandedEstimate === est.id && (!est.lines || est.lines.length === 0) && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No line items on this estimate.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* State History Timeline                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="card p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          State History
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No state transitions recorded.</p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

            <div className="space-y-4">
              {history.map((entry, idx) => (
                <div key={entry.id} className="relative pl-8">
                  {/* Dot */}
                  <div
                    className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 ${
                      idx === 0
                        ? 'bg-primary-600 border-primary-600'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {entry.from_state ? (
                        <>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              STATE_COLORS[entry.from_state] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {stateLabel(entry.from_state)}
                          </span>
                          <span className="text-gray-400">&rarr;</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Created &rarr;</span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          STATE_COLORS[entry.to_state] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {stateLabel(entry.to_state)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {entry.changed_by_email && <span>{entry.changed_by_email}</span>}
                      <span>{formatDate(entry.changed_at)}</span>
                    </div>
                    {entry.notes && (
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Project Flag Banner                                              */}
      {/* ----------------------------------------------------------------- */}
      {projectFlag && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-emerald-800 dark:text-emerald-200">
                This car belongs to active project {projectFlag.project_number}
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
                {projectFlag.project_name} &mdash; {projectFlag.scope_of_work}
              </p>
              {projectFlag.shop_code && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Planned: {projectFlag.shop_code} ({projectFlag.target_month}) &bull; {projectFlag.plan_state}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                {!bundleSuccess ? (
                  <button
                    onClick={async () => {
                      if (!event || !projectFlag) return;
                      const confirmed = window.confirm(
                        `Bundle project work for ${projectFlag.project_number} onto this shopping event at ${event.shop_code}?`
                      );
                      if (!confirmed) return;
                      setBundling(true);
                      try {
                        const currentMonth = new Date().toISOString().slice(0, 7);
                        await bundleProjectWork(id, {
                          project_id: projectFlag.project_id,
                          project_car_id: projectFlag.project_car_id,
                          car_number: event.car_number,
                          shop_code: event.shop_code,
                          target_month: currentMonth,
                        });
                        setBundleSuccess(true);
                      } catch (err) {
                        console.error('Bundle failed:', err);
                        setError(err instanceof Error ? err.message : 'Failed to bundle project work');
                      } finally {
                        setBundling(false);
                      }
                    }}
                    disabled={bundling}
                    className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {bundling ? 'Bundling...' : 'Bundle Project Work'}
                  </button>
                ) : (
                  <span className="px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 rounded font-medium">
                    Bundled successfully
                  </span>
                )}
                <Link
                  href={`/projects?project=${projectFlag.project_id}&tab=plan`}
                  className="px-3 py-1.5 text-sm border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  View Project
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Event Details card                                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="card p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Event Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Shopping Type</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">{event.shopping_type_code || '--'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Shopping Reason</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">{event.shopping_reason_code || '--'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Scope of Work</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {event.scope_of_work_id ? (
                <Link
                  href={`/scope-of-work/${event.scope_of_work_id}`}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {event.scope_of_work_id.slice(0, 8)}...
                </Link>
              ) : (
                '--'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Created By</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">{event.created_by_id}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Created At</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">{formatDate(event.created_at)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Updated At</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">{formatDate(event.updated_at)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Version</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">{event.version}</dd>
          </div>
          {event.cancellation_reason && (
            <div className="col-span-2 md:col-span-4">
              <dt className="text-gray-500 dark:text-gray-400">Cancellation Reason</dt>
              <dd className="font-medium text-red-700 dark:text-red-400">{event.cancellation_reason}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
