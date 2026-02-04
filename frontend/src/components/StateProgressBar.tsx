'use client';

import { useMemo } from 'react';
import type { ShoppingEventState } from '@/types';

// --------------------------------------------------------------------------
// State machine: ordered "happy path" states
// --------------------------------------------------------------------------
const HAPPY_PATH_STATES: ShoppingEventState[] = [
  'REQUESTED',
  'ASSIGNED_TO_SHOP',
  'INBOUND',
  'INSPECTION',
  'ESTIMATE_SUBMITTED',
  'ESTIMATE_UNDER_REVIEW',
  'ESTIMATE_APPROVED',
  'WORK_AUTHORIZED',
  'IN_REPAIR',
  'QA_COMPLETE',
  'FINAL_ESTIMATE_SUBMITTED',
  'FINAL_ESTIMATE_APPROVED',
  'READY_FOR_RELEASE',
  'RELEASED',
];

// Abbreviated labels shown underneath each dot
const STATE_LABELS: Record<ShoppingEventState, string> = {
  REQUESTED: 'REQ',
  ASSIGNED_TO_SHOP: 'ASGN',
  INBOUND: 'INBD',
  INSPECTION: 'INSP',
  ESTIMATE_SUBMITTED: 'EST',
  ESTIMATE_UNDER_REVIEW: 'REV',
  ESTIMATE_APPROVED: 'APPR',
  WORK_AUTHORIZED: 'AUTH',
  IN_REPAIR: 'REPR',
  QA_COMPLETE: 'QA',
  FINAL_ESTIMATE_SUBMITTED: 'FNLE',
  FINAL_ESTIMATE_APPROVED: 'FNAL',
  READY_FOR_RELEASE: 'RDY',
  RELEASED: 'REL',
  // Special states -- not shown on the bar directly
  CANCELLED: 'CXL',
  CHANGES_REQUIRED: 'CHG',
};

// Full human-readable names for tooltips
const STATE_FULL_NAMES: Record<ShoppingEventState, string> = {
  REQUESTED: 'Requested',
  ASSIGNED_TO_SHOP: 'Assigned to Shop',
  INBOUND: 'Inbound',
  INSPECTION: 'Inspection',
  ESTIMATE_SUBMITTED: 'Estimate Submitted',
  ESTIMATE_UNDER_REVIEW: 'Estimate Under Review',
  ESTIMATE_APPROVED: 'Estimate Approved',
  WORK_AUTHORIZED: 'Work Authorized',
  IN_REPAIR: 'In Repair',
  QA_COMPLETE: 'QA Complete',
  FINAL_ESTIMATE_SUBMITTED: 'Final Estimate Submitted',
  FINAL_ESTIMATE_APPROVED: 'Final Estimate Approved',
  READY_FOR_RELEASE: 'Ready for Release',
  RELEASED: 'Released',
  CANCELLED: 'Cancelled',
  CHANGES_REQUIRED: 'Changes Required',
};

// On small screens we only show a meaningful subset of key milestones
// to keep the bar legible. These indices reference HAPPY_PATH_STATES.
const KEY_STATE_INDICES = [0, 2, 4, 8, 10, 13]; // REQ, INBD, EST, REPR, FNLE, REL

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------
interface StateProgressBarProps {
  currentState: string;
  className?: string;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export default function StateProgressBar({ currentState, className }: StateProgressBarProps) {
  const state = currentState as ShoppingEventState;
  const isCancelled = state === 'CANCELLED';
  const isChangesRequired = state === 'CHANGES_REQUIRED';

  // Determine where the current state falls on the happy path.
  // CHANGES_REQUIRED loops back to ESTIMATE_SUBMITTED conceptually,
  // so we treat it as sitting at ESTIMATE_UNDER_REVIEW's position.
  const currentIndex = useMemo(() => {
    if (isCancelled) return -1;
    if (isChangesRequired) {
      return HAPPY_PATH_STATES.indexOf('ESTIMATE_UNDER_REVIEW');
    }
    const idx = HAPPY_PATH_STATES.indexOf(state);
    return idx >= 0 ? idx : -1;
  }, [state, isCancelled, isChangesRequired]);

  // -----------------------------------------------------------------------
  // Cancelled overlay
  // -----------------------------------------------------------------------
  if (isCancelled) {
    return (
      <div className={`relative w-full ${className ?? ''}`}>
        {/* Dimmed bar behind */}
        <div className="flex items-center w-full">
          {HAPPY_PATH_STATES.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-initial">
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
              {i < HAPPY_PATH_STATES.length - 1 && (
                <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600" />
              )}
            </div>
          ))}
        </div>
        {/* Cancelled banner */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-white bg-danger-500 rounded-full shadow-md">
            Cancelled
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className ?? ''}`}>
      {/* Changes Required callout */}
      {isChangesRequired && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-warning-500 animate-pulse" />
          <span className="text-xs font-medium text-warning-700 dark:text-warning-500">
            Changes Required — returned to estimate review
          </span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* FULL BAR — visible on lg screens and up                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="hidden lg:block">
        <div className="flex items-center w-full">
          {HAPPY_PATH_STATES.map((s, i) => {
            const isCompleted = currentIndex >= 0 && i < currentIndex;
            const isCurrent = i === currentIndex;
            const isFuture = currentIndex >= 0 && i > currentIndex;

            return (
              <div key={s} className="flex items-center flex-1 last:flex-initial">
                {/* Dot */}
                <div className="relative group flex-shrink-0">
                  <div
                    className={[
                      'w-3.5 h-3.5 rounded-full transition-colors',
                      isCompleted
                        ? 'bg-primary-600 dark:bg-primary-500'
                        : isCurrent
                          ? 'bg-primary-600 dark:bg-primary-500 ring-4 ring-primary-200 dark:ring-primary-800 animate-pulse'
                          : 'bg-gray-300 dark:bg-gray-600',
                    ].join(' ')}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                    {STATE_FULL_NAMES[s]}
                  </div>
                  {/* Label */}
                  <span
                    className={[
                      'absolute top-full left-1/2 -translate-x-1/2 mt-1.5 text-[10px] font-medium whitespace-nowrap select-none',
                      isCompleted
                        ? 'text-primary-600 dark:text-primary-400'
                        : isCurrent
                          ? 'text-primary-700 dark:text-primary-300 font-bold'
                          : 'text-gray-400 dark:text-gray-500',
                    ].join(' ')}
                  >
                    {STATE_LABELS[s]}
                  </span>
                </div>

                {/* Connector line */}
                {i < HAPPY_PATH_STATES.length - 1 && (
                  <div
                    className={[
                      'flex-1 h-0.5 transition-colors',
                      isCompleted
                        ? 'bg-primary-600 dark:bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-600',
                    ].join(' ')}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MEDIUM BAR — visible on md screens (hidden on lg+, hidden on sm) */}
      {/* Shows every other state to reduce clutter                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="hidden md:block lg:hidden">
        <div className="flex items-center w-full">
          {HAPPY_PATH_STATES.map((s, i) => {
            const isCompleted = currentIndex >= 0 && i < currentIndex;
            const isCurrent = i === currentIndex;
            // Show label only for even indices + last state + current state
            const showLabel = i % 2 === 0 || i === HAPPY_PATH_STATES.length - 1 || isCurrent;

            return (
              <div key={s} className="flex items-center flex-1 last:flex-initial">
                <div className="relative group flex-shrink-0">
                  <div
                    className={[
                      'w-3 h-3 rounded-full transition-colors',
                      isCompleted
                        ? 'bg-primary-600 dark:bg-primary-500'
                        : isCurrent
                          ? 'bg-primary-600 dark:bg-primary-500 ring-4 ring-primary-200 dark:ring-primary-800 animate-pulse'
                          : 'bg-gray-300 dark:bg-gray-600',
                    ].join(' ')}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                    {STATE_FULL_NAMES[s]}
                  </div>
                  {showLabel && (
                    <span
                      className={[
                        'absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[9px] font-medium whitespace-nowrap select-none',
                        isCompleted
                          ? 'text-primary-600 dark:text-primary-400'
                          : isCurrent
                            ? 'text-primary-700 dark:text-primary-300 font-bold'
                            : 'text-gray-400 dark:text-gray-500',
                      ].join(' ')}
                    >
                      {STATE_LABELS[s]}
                    </span>
                  )}
                </div>

                {i < HAPPY_PATH_STATES.length - 1 && (
                  <div
                    className={[
                      'flex-1 h-0.5 transition-colors',
                      isCompleted
                        ? 'bg-primary-600 dark:bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-600',
                    ].join(' ')}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* COMPACT BAR — visible on small screens only (below md)            */}
      {/* Shows only key milestone states                                    */}
      {/* ----------------------------------------------------------------- */}
      <div className="block md:hidden">
        {/* Fraction indicator */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {currentIndex >= 0
              ? STATE_FULL_NAMES[HAPPY_PATH_STATES[currentIndex]]
              : STATE_FULL_NAMES[state] ?? state}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {currentIndex >= 0 ? currentIndex + 1 : '?'} / {HAPPY_PATH_STATES.length}
          </span>
        </div>

        <div className="flex items-center w-full">
          {KEY_STATE_INDICES.map((stateIdx, posIdx) => {
            const s = HAPPY_PATH_STATES[stateIdx];
            const isCompleted = currentIndex >= 0 && stateIdx < currentIndex;
            const isCurrent = currentIndex >= 0 && stateIdx <= currentIndex && (
              posIdx === KEY_STATE_INDICES.length - 1 ||
              currentIndex < KEY_STATE_INDICES[posIdx + 1]
            );
            // isCurrent means the current state falls within this milestone segment
            const isExactCurrent = stateIdx === currentIndex;

            return (
              <div key={s} className="flex items-center flex-1 last:flex-initial">
                <div className="relative flex-shrink-0">
                  <div
                    className={[
                      'w-3 h-3 rounded-full transition-colors',
                      isCompleted
                        ? 'bg-primary-600 dark:bg-primary-500'
                        : isExactCurrent || (isCurrent && !isCompleted)
                          ? 'bg-primary-600 dark:bg-primary-500 ring-3 ring-primary-200 dark:ring-primary-800 animate-pulse'
                          : 'bg-gray-300 dark:bg-gray-600',
                    ].join(' ')}
                  />
                  <span
                    className={[
                      'absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[9px] font-medium whitespace-nowrap select-none',
                      isCompleted
                        ? 'text-primary-600 dark:text-primary-400'
                        : isCurrent
                          ? 'text-primary-700 dark:text-primary-300 font-bold'
                          : 'text-gray-400 dark:text-gray-500',
                    ].join(' ')}
                  >
                    {STATE_LABELS[s]}
                  </span>
                </div>

                {posIdx < KEY_STATE_INDICES.length - 1 && (
                  <div
                    className={[
                      'flex-1 h-0.5 transition-colors',
                      isCompleted
                        ? 'bg-primary-600 dark:bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-600',
                    ].join(' ')}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom spacing so labels don't clip */}
      <div className="h-5" />
    </div>
  );
}
