'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ExternalLink, ChevronDown, Loader2, Calendar, User, Building2,
  Train, Wrench, Clock, CheckCircle, AlertCircle, XCircle, ArrowRight,
} from 'lucide-react';
import {
  getShoppingEvent,
  getShoppingEventStateHistory,
  transitionShoppingEventState,
} from '@/lib/api';
import { ShoppingEvent, StateHistoryEntry, ShoppingEventState } from '@/types';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// State color mapping (mirrored from shopping page / detail page)
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

const STATE_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  ASSIGNED_TO_SHOP: 'Assigned to Shop',
  INBOUND: 'Inbound',
  INSPECTION: 'Inspection',
  ESTIMATE_SUBMITTED: 'Estimate Submitted',
  ESTIMATE_UNDER_REVIEW: 'Estimate Under Review',
  ESTIMATE_APPROVED: 'Estimate Approved',
  CHANGES_REQUIRED: 'Changes Required',
  WORK_AUTHORIZED: 'Work Authorized',
  IN_REPAIR: 'In Repair',
  QA_COMPLETE: 'QA Complete',
  FINAL_ESTIMATE_SUBMITTED: 'Final Estimate Submitted',
  FINAL_ESTIMATE_APPROVED: 'Final Estimate Approved',
  READY_FOR_RELEASE: 'Ready for Release',
  RELEASED: 'Released',
  CANCELLED: 'Cancelled',
};

// Valid state transitions (mirrors the detail page)
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

// Timeline dot color based on state category
function getTimelineDotColor(state: string): string {
  if (state === 'RELEASED') return 'bg-green-500 dark:bg-green-400';
  if (state === 'CANCELLED') return 'bg-red-500 dark:bg-red-400';
  if (['IN_REPAIR', 'WORK_AUTHORIZED', 'QA_COMPLETE'].includes(state)) return 'bg-purple-500 dark:bg-purple-400';
  if (['ESTIMATE_SUBMITTED', 'ESTIMATE_UNDER_REVIEW', 'FINAL_ESTIMATE_SUBMITTED'].includes(state)) return 'bg-yellow-500 dark:bg-yellow-400';
  if (['ESTIMATE_APPROVED', 'FINAL_ESTIMATE_APPROVED', 'READY_FOR_RELEASE'].includes(state)) return 'bg-green-500 dark:bg-green-400';
  if (['INBOUND', 'ASSIGNED_TO_SHOP', 'INSPECTION'].includes(state)) return 'bg-blue-500 dark:bg-blue-400';
  return 'bg-gray-400 dark:bg-gray-500';
}

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

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ShoppingDetailPanelProps {
  eventId: string;
  onClose: () => void;
  /** Called after a successful state transition so the list can refresh */
  onEventUpdated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ShoppingDetailPanel({ eventId, onClose, onEventUpdated }: ShoppingDetailPanelProps) {
  const toast = useToast();

  const [event, setEvent] = useState<ShoppingEvent | null>(null);
  const [history, setHistory] = useState<StateHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [showTransitions, setShowTransitions] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Fetch event detail + state history
  // -------------------------------------------------------------------------
  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ev = await getShoppingEvent(eventId);
      setEvent(ev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const h = await getShoppingEventStateHistory(eventId);
      setHistory(h);
    } catch {
      // History may not be available; show fallback
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
    loadHistory();
  }, [loadEvent, loadHistory]);

  // -------------------------------------------------------------------------
  // Keyboard: Escape to close
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // -------------------------------------------------------------------------
  // Handle state transition
  // -------------------------------------------------------------------------
  const handleTransition = async (targetState: string) => {
    if (!event) return;
    setTransitioning(true);
    try {
      const updated = await transitionShoppingEventState(event.id, targetState);
      setEvent(updated);
      setShowTransitions(false);
      toast.success(`State updated to ${STATE_LABELS[targetState] || targetState}`);
      // Reload history
      loadHistory();
      // Notify parent to refresh the list
      onEventUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update state');
    } finally {
      setTransitioning(false);
    }
  };

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const transitions = event ? (VALID_TRANSITIONS[event.state] || []) : [];
  const isAssignableToShop = event?.state === 'REQUESTED';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      ref={panelRef}
      className="w-[400px] max-w-full flex-shrink-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-slide-in-right md:relative fixed top-0 right-0 h-full md:h-auto z-40 md:z-auto shadow-xl md:shadow-none"
    >
      {/* ----- Header ----- */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : event ? (
              <>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {event.event_number}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Car: {event.car_number}
                </p>
              </>
            ) : (
              <h2 className="text-lg font-bold text-gray-500">Event</h2>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <a
              href={`/shopping/${eventId}`}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              title="Open Full Page"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Quick stats row */}
        {event && (
          <div className="grid grid-cols-3 gap-0 border-t border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
              <div className="mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATE_COLORS[event.state] || 'bg-gray-100 text-gray-800'}`}>
                  {STATE_LABELS[event.state] || event.state}
                </span>
              </div>
            </div>
            <div className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">Shop</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {event.shop_name || event.shop_code || '-'}
              </div>
            </div>
            <div className="px-3 py-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Created</div>
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                {formatShortDate(event.created_at)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ----- Content ----- */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={loadEvent}
              className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : event ? (
          <>
            {/* ----- Event Details Section ----- */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Event Details
              </h3>
              <div className="space-y-1.5">
                <DetailRow icon={<Train className="w-3.5 h-3.5" />} label="Car Number" value={event.car_number} />
                <DetailRow icon={<Building2 className="w-3.5 h-3.5" />} label="Shop" value={event.shop_name || event.shop_code} />
                <DetailRow icon={<Wrench className="w-3.5 h-3.5" />} label="Event Number" value={event.event_number} />
                {event.shopping_type_code && (
                  <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Type Code" value={event.shopping_type_code} />
                )}
                {event.shopping_reason_code && (
                  <DetailRow icon={<AlertCircle className="w-3.5 h-3.5" />} label="Reason Code" value={event.shopping_reason_code} />
                )}
                {event.batch_number && (
                  <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Batch" value={event.batch_number} />
                )}
                <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Created" value={formatDate(event.created_at)} />
                <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Updated" value={formatDate(event.updated_at)} />
                <DetailRow icon={<User className="w-3.5 h-3.5" />} label="Version" value={String(event.version)} />
              </div>
            </div>

            {/* ----- Actions Section ----- */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Actions
              </h3>
              <div className="space-y-2">
                {/* Update Status */}
                {transitions.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowTransitions(!showTransitions)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        Update Status
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showTransitions ? 'rotate-180' : ''}`} />
                    </button>
                    {showTransitions && (
                      <div className="mt-2 space-y-1.5 pl-2">
                        {transitions.map((t) => (
                          <button
                            key={t.target}
                            onClick={() => handleTransition(t.target)}
                            disabled={transitioning}
                            className={`w-full text-left px-3 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 transition-colors ${t.color}`}
                          >
                            {transitioning ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Updating...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <ArrowRight className="w-3.5 h-3.5" />
                                {t.label}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* View Full Details link */}
                <a
                  href={`/shopping/${event.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Full Details
                </a>

                {/* Assign Shop (shown when state is REQUESTED) */}
                {isAssignableToShop && (
                  <a
                    href={`/shopping/${event.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <Building2 className="w-4 h-4" />
                    Assign Shop
                  </a>
                )}
              </div>
            </div>

            {/* ----- State Timeline Section ----- */}
            <div className="px-4 py-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Status Timeline
              </h3>

              {historyLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                </div>
              ) : history.length > 0 ? (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

                  <div className="space-y-4">
                    {history.map((entry, idx) => (
                      <div key={entry.id} className="relative flex items-start gap-3 pl-0">
                        {/* Dot */}
                        <div className={`relative z-10 w-4 h-4 rounded-full flex-shrink-0 mt-0.5 ring-2 ring-white dark:ring-gray-900 ${getTimelineDotColor(entry.to_state)}`} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATE_COLORS[entry.to_state] || 'bg-gray-100 text-gray-800'}`}>
                              {STATE_LABELS[entry.to_state] || entry.to_state}
                            </span>
                            {entry.from_state && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                from {STATE_LABELS[entry.from_state] || entry.from_state}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            {formatDate(entry.changed_at)}
                          </div>
                          {entry.changed_by_email && (
                            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {entry.changed_by_email}
                            </div>
                          )}
                          {entry.notes && (
                            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
                              {entry.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Fallback: show current status with created_at */
                <div className="relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                  <div className="relative flex items-start gap-3 pl-0">
                    <div className={`relative z-10 w-4 h-4 rounded-full flex-shrink-0 mt-0.5 ring-2 ring-white dark:ring-gray-900 ${getTimelineDotColor(event.state)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATE_COLORS[event.state] || 'bg-gray-100 text-gray-800'}`}>
                          {STATE_LABELS[event.state] || event.state}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          (current)
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        Created: {formatDate(event.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ----- Cancellation Info (if cancelled) ----- */}
            {event.state === 'CANCELLED' && event.cancelled_at && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-800 dark:text-red-300">
                    <XCircle className="w-4 h-4" />
                    Cancelled
                  </div>
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {formatDate(event.cancelled_at)}
                  </p>
                  {event.cancellation_reason && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                      {event.cancellation_reason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </span>
      <span className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right truncate max-w-[55%]">
        {value || '-'}
      </span>
    </div>
  );
}
