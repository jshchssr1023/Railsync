'use client';

import { useState } from 'react';
import { Clock, Lock, RefreshCw, XCircle, MessageSquare, Link, Zap } from 'lucide-react';
import type { ProjectPlanAuditEvent } from '@/types';

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  plan_created: { icon: <Clock className="w-3.5 h-3.5" />, color: 'text-blue-600 dark:text-blue-400', label: 'Plan Created' },
  plan_updated: { icon: <RefreshCw className="w-3.5 h-3.5" />, color: 'text-gray-600 dark:text-gray-400', label: 'Plan Updated' },
  plan_locked: { icon: <Lock className="w-3.5 h-3.5" />, color: 'text-indigo-600 dark:text-indigo-400', label: 'Locked' },
  plan_relocked: { icon: <RefreshCw className="w-3.5 h-3.5" />, color: 'text-amber-600 dark:text-amber-400', label: 'Relocked' },
  plan_cancelled: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-red-600 dark:text-red-400', label: 'Cancelled' },
  plan_superseded: { icon: <RefreshCw className="w-3.5 h-3.5" />, color: 'text-gray-500 dark:text-gray-400', label: 'Superseded' },
  communication_logged: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-green-600 dark:text-green-400', label: 'Communication' },
  bundled_opportunistic: { icon: <Zap className="w-3.5 h-3.5" />, color: 'text-emerald-600 dark:text-emerald-400', label: 'Bundled' },
  assignment_synced: { icon: <Link className="w-3.5 h-3.5" />, color: 'text-purple-600 dark:text-purple-400', label: 'Assignment Synced' },
};

interface PlanHistoryTimelineProps {
  events: ProjectPlanAuditEvent[];
  total: number;
  loading: boolean;
  carFilter: string;
  onCarFilterChange: (car: string) => void;
}

export default function PlanHistoryTimeline({
  events,
  total,
  loading,
  carFilter,
  onCarFilterChange,
}: PlanHistoryTimelineProps) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={carFilter}
          onChange={e => onCarFilterChange(e.target.value)}
          placeholder="Filter by car number..."
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm w-48"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">{total} events</span>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No audit events found
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-3">
            {events.map(event => {
              const config = ACTION_CONFIG[event.action] || {
                icon: <Clock className="w-3.5 h-3.5" />,
                color: 'text-gray-500',
                label: event.action,
              };
              const isExpanded = expandedEvent === event.id;

              return (
                <div key={event.id} className="relative pl-10">
                  {/* Dot */}
                  <div className={`absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${config.color} bg-current`} />

                  <div
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600"
                    onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={config.color}>{config.icon}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {config.label}
                        </span>
                        {event.car_number && (
                          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                            {event.car_number}
                          </span>
                        )}
                        {event.before_state && event.after_state && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {event.before_state} → {event.after_state}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {new Date(event.event_timestamp).toLocaleString()}
                      </span>
                    </div>

                    {event.reason && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{event.reason}</p>
                    )}

                    {isExpanded && event.plan_snapshot && (
                      <pre className="mt-2 bg-gray-50 dark:bg-gray-900 rounded p-2 text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-40">
                        {JSON.stringify(event.plan_snapshot, null, 2)}
                      </pre>
                    )}

                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {event.actor_name || event.actor_email || 'System'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
