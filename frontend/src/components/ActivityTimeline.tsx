'use client';

import { useState } from 'react';
import {
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  ArrowRight,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  description?: string;
  user_email?: string;
  user_name?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  created_at: string;
}

export interface ActivityTimelineProps {
  entries: AuditEntry[];
  compact?: boolean;
  maxHeight?: string;
  loading?: boolean;
  emptyMessage?: string;
}

// ---------------------------------------------------------------------------
// Action classification helpers
// ---------------------------------------------------------------------------

type ActionCategory = 'created' | 'updated' | 'deleted' | 'transitioned';

function classifyAction(action: string): ActionCategory {
  const lower = action.toLowerCase();
  if (lower.includes('create') || lower.includes('insert') || lower === 'create') return 'created';
  if (lower.includes('delete') || lower.includes('remove') || lower === 'delete') return 'deleted';
  if (
    lower.includes('transition') ||
    lower.includes('state_change') ||
    lower.includes('approve') ||
    lower.includes('reject') ||
    lower.includes('revert')
  )
    return 'transitioned';
  return 'updated';
}

const ACTION_STYLES: Record<ActionCategory, { bg: string; dot: string; icon: typeof Plus }> = {
  created: {
    bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    dot: 'bg-green-500 border-green-500',
    icon: Plus,
  },
  updated: {
    bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    dot: 'bg-blue-500 border-blue-500',
    icon: Edit,
  },
  deleted: {
    bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    dot: 'bg-red-500 border-red-500',
    icon: Trash2,
  },
  transitioned: {
    bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    dot: 'bg-amber-500 border-amber-500',
    icon: ArrowRight,
  },
};

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Diff viewer for old/new values
// ---------------------------------------------------------------------------

function DiffViewer({
  oldValues,
  newValues,
}: {
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}) {
  if (!oldValues && !newValues) return null;

  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {}),
  ]);

  if (allKeys.size === 0) return null;

  return (
    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/50">
            <th className="px-3 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">
              Field
            </th>
            <th className="px-3 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">
              Before
            </th>
            <th className="px-3 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">
              After
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {Array.from(allKeys).map((key) => {
            const oldVal = oldValues?.[key];
            const newVal = newValues?.[key];
            const changed =
              JSON.stringify(oldVal) !== JSON.stringify(newVal);
            return (
              <tr
                key={key}
                className={
                  changed
                    ? 'bg-yellow-50/50 dark:bg-yellow-900/10'
                    : ''
                }
              >
                <td className="px-3 py-1.5 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {key.replace(/_/g, ' ')}
                </td>
                <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 font-mono max-w-[200px] truncate">
                  {oldVal !== undefined ? String(oldVal) : '--'}
                </td>
                <td
                  className={`px-3 py-1.5 font-mono max-w-[200px] truncate ${
                    changed
                      ? 'text-blue-700 dark:text-blue-400 font-semibold'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {newVal !== undefined ? String(newVal) : '--'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single timeline entry
// ---------------------------------------------------------------------------

function TimelineEntry({
  entry,
  compact,
  isFirst,
}: {
  entry: AuditEntry;
  compact: boolean;
  isFirst: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const category = classifyAction(entry.action);
  const style = ACTION_STYLES[category];
  const Icon = style.icon;
  const hasDetails =
    !compact &&
    ((entry.old_values && Object.keys(entry.old_values).length > 0) ||
      (entry.new_values && Object.keys(entry.new_values).length > 0));

  const displayName =
    entry.user_name || entry.user_email || 'System';
  const entityLabel =
    entry.entity_type.replace(/_/g, ' ');

  return (
    <div className="relative pl-8">
      {/* Dot on the timeline */}
      <div
        className={`absolute left-1.5 ${
          compact ? 'top-1' : 'top-1.5'
        } w-3 h-3 rounded-full border-2 ${
          isFirst ? style.dot : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
        }`}
      />

      <div
        className={`${
          compact ? 'py-1.5' : 'bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3'
        }`}
      >
        {/* Top row: action badge + entity + description */}
        <div
          className={`flex flex-wrap items-center gap-2 ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg}`}
          >
            <Icon className="w-3 h-3" />
            {category}
          </span>

          <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
            {entityLabel}
          </span>

          {entry.description && (
            <span className="text-gray-600 dark:text-gray-400">
              {entry.description}
            </span>
          )}
        </div>

        {/* Second row: user + timestamp */}
        <div
          className={`flex flex-wrap items-center gap-3 mt-1 ${
            compact ? 'text-[10px]' : 'text-xs'
          } text-gray-500 dark:text-gray-400`}
        >
          <span className="flex items-center gap-1">
            <User className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {displayName}
          </span>
          <span
            className="flex items-center gap-1"
            title={formatFullDate(entry.created_at)}
          >
            <Clock className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {relativeTime(entry.created_at)}
          </span>
        </div>

        {/* Expandable details */}
        {hasDetails && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {expanded ? 'Hide changes' : 'View changes'}
            </button>
            {expanded && (
              <DiffViewer
                oldValues={entry.old_values}
                newValues={entry.new_values}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ActivityTimeline({
  entries,
  compact = false,
  maxHeight = '500px',
  loading = false,
  emptyMessage = 'No activity recorded.',
}: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400 dark:text-gray-500" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading activity...
        </span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-y-auto"
      style={{ maxHeight }}
    >
      {/* Vertical timeline line */}
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

      <div className={compact ? 'space-y-1' : 'space-y-3'}>
        {entries.map((entry, idx) => (
          <TimelineEntry
            key={entry.id}
            entry={entry}
            compact={compact}
            isFirst={idx === 0}
          />
        ))}
      </div>
    </div>
  );
}
