'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getShoppingEvent,
  transitionShoppingEventState,
  getShoppingEventStateHistory,
  listEstimateVersions,
  getShoppingEventProjectFlags,
  bundleProjectWork,
  revertShoppingEvent,
  getCarCleaningRequirements,
  runEstimatePreReview,
} from '@/lib/api';
import { ShoppingEvent, StateHistoryEntry, EstimateSubmission, CleaningRequirements, AIPreReviewResult } from '@/types';
import { Info, AlertTriangle, ChevronDown, Zap, Droplets, Brain, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import StateProgressBar from '@/components/StateProgressBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useTransitionConfirm } from '@/hooks/useTransitionConfirm';
import EstimateReviewPanel from '@/components/EstimateReviewPanel';

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
// Estimate status colors moved to EstimateReviewPanel component

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
  // expandedEstimate state moved to EstimateReviewPanel
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [gateWarning, setGateWarning] = useState<string | null>(null);
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

  // Commodity & cleaning requirements
  const [cleaningReqs, setCleaningReqs] = useState<CleaningRequirements | null>(null);

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<AIPreReviewResult | null>(null);
  const [runningAiAnalysis, setRunningAiAnalysis] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

  // Estimate decisions moved to EstimateReviewPanel component

  // -----------------------------------------------------------------------
  // Transition confirmation dialog
  // -----------------------------------------------------------------------
  const { confirmDialogProps, requestTransition } = useTransitionConfirm();

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

  // Fetch commodity/cleaning requirements for the car
  useEffect(() => {
    if (!event?.car_number) return;
    getCarCleaningRequirements(event.car_number)
      .then(reqs => setCleaningReqs(reqs as CleaningRequirements))
      .catch(() => { /* non-critical */ });
  }, [event?.car_number]);

  // Estimate approval moved to EstimateReviewPanel component

  const handleRunAiAnalysis = async () => {
    if (!estimates.length) {
      setAiAnalysisError('No estimates available to analyze');
      return;
    }

    const latestEstimate = estimates[0];
    setRunningAiAnalysis(true);
    setAiAnalysisError(null);

    try {
      const result = await runEstimatePreReview(latestEstimate.id);
      setAiAnalysis(result);
    } catch (err) {
      setAiAnalysisError(err instanceof Error ? err.message : 'Failed to run AI analysis');
    } finally {
      setRunningAiAnalysis(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    confirmAndTransition('CANCELLED', cancelReason.trim());
  };

  // -----------------------------------------------------------------------
  // Confirmation-gated transition wrapper
  // -----------------------------------------------------------------------
  const confirmAndTransition = (targetState: string, notes?: string) => {
    const currentState = event?.state || '';
    const eventNumber = event?.event_number || '';

    // Determine reversibility based on target state
    const REVERSIBLE_FORWARD = new Set([
      'ASSIGNED_TO_SHOP', 'INBOUND', 'INSPECTION', 'ESTIMATE_SUBMITTED',
      'ESTIMATE_UNDER_REVIEW', 'CHANGES_REQUIRED',
    ]);
    const REVERSIBLE_BACKWARD = new Set([
      'REQUESTED', 'ASSIGNED_TO_SHOP', 'ESTIMATE_SUBMITTED',
      'ESTIMATE_UNDER_REVIEW', 'IN_REPAIR', 'FINAL_ESTIMATE_APPROVED',
    ]);

    const isReversible = REVERSIBLE_FORWARD.has(targetState) || REVERSIBLE_BACKWARD.has(targetState);

    let variant: 'default' | 'warning' | 'danger' = 'default';
    let irreversible = false;
    let typedConfirmation: string | undefined;

    if (targetState === 'RELEASED') {
      variant = 'danger';
      irreversible = true;
      typedConfirmation = eventNumber;
    } else if (targetState === 'CANCELLED') {
      variant = 'danger';
      irreversible = true;
    } else if (['WORK_AUTHORIZED', 'IN_REPAIR', 'ESTIMATE_APPROVED', 'FINAL_ESTIMATE_APPROVED'].includes(targetState)) {
      variant = 'warning';
      if (targetState === 'IN_REPAIR') irreversible = true;
    }

    const labelState = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    requestTransition({
      title: `Transition to ${labelState(targetState)}`,
      description: `This will move event ${eventNumber} from "${labelState(currentState)}" to "${labelState(targetState)}".`,
      fromState: currentState,
      toState: targetState,
      variant,
      irreversible,
      typedConfirmation,
      summaryItems: [
        { label: 'Event', value: eventNumber },
        { label: 'Car', value: event?.car_number || '' },
        { label: 'Current State', value: labelState(currentState) },
        { label: 'Target State', value: labelState(targetState) },
      ],
      onConfirm: async () => {
        await transitionShoppingEventState(id, targetState, notes || transitionNotes || undefined);
        setTransitionNotes('');
        setShowCancelForm(false);
        setCancelReason('');
        await fetchAll();
      },
      onUndo: isReversible ? async () => {
        await revertShoppingEvent(id);
        await fetchAll();
      } : undefined,
    });
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
      {/* Commodity & Cleaning Requirements                                 */}
      {/* ----------------------------------------------------------------- */}
      {cleaningReqs && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Droplets className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Commodity & Cleaning</h3>
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400 text-xs">Commodity</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {cleaningReqs.commodity_code || '--'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400 text-xs">Description</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {cleaningReqs.commodity_name || '--'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400 text-xs">Cleaning Class</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  cleaningReqs.cleaning_class === 'A' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                  cleaningReqs.cleaning_class === 'B' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                  cleaningReqs.cleaning_class === 'C' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  cleaningReqs.cleaning_class === 'D' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {cleaningReqs.cleaning_class || 'N/A'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400 text-xs">Cleaning</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-xs">
                {cleaningReqs.cleaning_description || '--'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400 text-xs">Special Requirements</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {[
                  cleaningReqs.requires_interior_blast && 'Interior Blast',
                  cleaningReqs.requires_exterior_paint && 'Exterior Paint',
                  cleaningReqs.requires_new_lining && 'New Lining',
                  cleaningReqs.requires_kosher_cleaning && 'Kosher',
                ].filter(Boolean).join(', ') || 'None'}
              </dd>
            </div>
          </dl>
          {cleaningReqs.special_instructions && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
              {cleaningReqs.special_instructions}
            </p>
          )}
        </div>
      )}

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
                onClick={() => confirmAndTransition(t.target, transitionNotes || undefined)}
                className={`px-4 py-2 text-sm font-medium text-white rounded ${t.color} disabled:opacity-50`}
              >
                {t.label}
              </button>
            ))}

            {canCancel && !showCancelForm && (
              <button
                onClick={() => setShowCancelForm(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded"
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
                  disabled={!cancelReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                >
                  Confirm Cancellation
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
      {/* AI Analysis Section                                               */}
      {/* ----------------------------------------------------------------- */}
      {estimates.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                AI Estimate Analysis
              </h2>
            </div>
            <button
              onClick={handleRunAiAnalysis}
              disabled={runningAiAnalysis}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {runningAiAnalysis ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Run AI Analysis
                </>
              )}
            </button>
          </div>

          {aiAnalysisError && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
              {aiAnalysisError}
            </div>
          )}

          {aiAnalysis ? (
            <div className="space-y-4">
              {/* Overall Confidence Score */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <div className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">Overall Confidence</div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-bold ${
                        aiAnalysis.overall_confidence >= 0.8
                          ? 'text-green-600 dark:text-green-400'
                          : aiAnalysis.overall_confidence >= 0.6
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {Math.round(aiAnalysis.overall_confidence * 100)}%
                    </span>
                    {aiAnalysis.overall_confidence >= 0.8 ? (
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : aiAnalysis.overall_confidence < 0.6 ? (
                      <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                    ) : null}
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                  <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">Auto-Approved</div>
                  <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {aiAnalysis.auto_approved}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">of {aiAnalysis.lines_reviewed} lines</div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <div className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">Needs Review</div>
                  <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                    {aiAnalysis.needs_review}
                  </div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-400">of {aiAnalysis.lines_reviewed} lines</div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                  <div className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">Auto-Rejected</div>
                  <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                    {aiAnalysis.auto_rejected}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">of {aiAnalysis.lines_reviewed} lines</div>
                </div>
              </div>

              {/* Suggested Actions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Suggested Actions
                </h3>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  {aiAnalysis.auto_approved > 0 && (
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <span>
                        {aiAnalysis.auto_approved} line{aiAnalysis.auto_approved > 1 ? 's' : ''} can be auto-approved based on historical data and policy compliance
                      </span>
                    </li>
                  )}
                  {aiAnalysis.needs_review > 0 && (
                    <li className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span>
                        {aiAnalysis.needs_review} line{aiAnalysis.needs_review > 1 ? 's require' : ' requires'} manual review due to moderate confidence scores
                      </span>
                    </li>
                  )}
                  {aiAnalysis.auto_rejected > 0 && (
                    <li className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <span>
                        {aiAnalysis.auto_rejected} line{aiAnalysis.auto_rejected > 1 ? 's' : ''} flagged for rejection due to policy violations or significant cost variances
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Line-by-Line Analysis */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Line-by-Line Analysis</h3>
                <div className="space-y-2">
                  {aiAnalysis.line_reviews.map((lineReview) => (
                    <div
                      key={lineReview.estimate_line_id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Line {lineReview.line_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              lineReview.decision === 'approve'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : lineReview.decision === 'review'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {lineReview.decision.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-sm font-bold ${
                              lineReview.confidence_score >= 0.8
                                ? 'text-green-600 dark:text-green-400'
                                : lineReview.confidence_score >= 0.6
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {Math.round(lineReview.confidence_score * 100)}% confidence
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {lineReview.basis_reference}
                          </div>
                        </div>
                      </div>

                      {/* Rule Results */}
                      <div className="space-y-1">
                        {lineReview.rule_results.map((rule, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-xs"
                          >
                            {rule.passed ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {rule.rule.replace(/_/g, ' ')}:
                              </span>
                              <span className="text-gray-600 dark:text-gray-400 ml-1">
                                {rule.note}
                              </span>
                              <span
                                className={`ml-2 ${
                                  rule.confidence >= 0.8
                                    ? 'text-green-600 dark:text-green-400'
                                    : rule.confidence >= 0.6
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                ({Math.round(rule.confidence * 100)}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Click "Run AI Analysis" to analyze the latest estimate using rule-based AI evaluation</p>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Estimate Review Panel (BRC Viewer)                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="card p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Estimate Review
        </h2>
        <EstimateReviewPanel
          shoppingEventId={id}
          estimates={estimates}
          onEstimatesChange={setEstimates}
          onApprovalComplete={fetchAll}
        />
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

      {/* Transition confirmation dialog */}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
