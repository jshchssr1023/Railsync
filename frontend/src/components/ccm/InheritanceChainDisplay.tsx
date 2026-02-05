'use client';

import { CCMInheritanceChainItem, CCMScopeLevel } from '@/types';

interface InheritanceChainDisplayProps {
  chain: CCMInheritanceChainItem[];
  compact?: boolean;
}

const SCOPE_LEVEL_LABELS: Record<CCMScopeLevel, string> = {
  customer: 'Customer',
  master_lease: 'Master Lease',
  rider: 'Rider',
  amendment: 'Amendment',
};

const SCOPE_LEVEL_COLORS: Record<CCMScopeLevel, { bg: string; text: string; border: string }> = {
  customer: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  master_lease: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  rider: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  amendment: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
};

export default function InheritanceChainDisplay({
  chain,
  compact = false,
}: InheritanceChainDisplayProps) {
  if (compact) {
    // Compact breadcrumb style
    return (
      <div className="flex items-center gap-1 flex-wrap text-sm">
        {chain.map((item, index) => {
          const colors = SCOPE_LEVEL_COLORS[item.level];
          const hasCCM = item.fields_defined.length > 0;

          return (
            <div key={item.level} className="flex items-center">
              {index > 0 && (
                <svg
                  className="w-4 h-4 text-gray-400 mx-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              <span
                className={`px-2 py-0.5 rounded ${colors.bg} ${colors.text} ${
                  hasCCM ? 'font-medium' : 'opacity-60'
                }`}
                title={
                  hasCCM
                    ? `Defines: ${item.fields_defined.join(', ')}`
                    : 'No CCM at this level'
                }
              >
                {item.name || SCOPE_LEVEL_LABELS[item.level]}
                {hasCCM && (
                  <span className="ml-1 text-xs opacity-75">({item.fields_defined.length})</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Full vertical display
  return (
    <div className="space-y-2">
      {chain.map((item, index) => {
        const colors = SCOPE_LEVEL_COLORS[item.level];
        const hasCCM = item.fields_defined.length > 0;
        const isLast = index === chain.length - 1;

        return (
          <div key={item.level} className="relative">
            {/* Connector line */}
            {!isLast && (
              <div
                className="absolute left-4 top-8 w-0.5 h-full bg-gray-200 dark:bg-gray-700"
                style={{ height: 'calc(100% - 8px)' }}
              />
            )}

            <div
              className={`flex items-start gap-3 p-3 rounded-lg border ${colors.border} ${colors.bg}`}
            >
              {/* Level indicator */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${colors.text} bg-white dark:bg-gray-900 border-2 ${colors.border} flex-shrink-0 z-10`}
              >
                {index + 1}
              </div>

              <div className="flex-1 min-w-0">
                {/* Level label and name */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium ${colors.text}`}>
                    {SCOPE_LEVEL_LABELS[item.level]}
                  </span>
                  {item.name && (
                    <span className="text-gray-900 dark:text-gray-100 font-semibold truncate">
                      {item.name}
                    </span>
                  )}
                  {!item.id && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500">
                      Not linked
                    </span>
                  )}
                </div>

                {/* Fields defined */}
                {hasCCM ? (
                  <div className="mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Defines {item.fields_defined.length} field{item.fields_defined.length !== 1 ? 's' : ''}:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.fields_defined.slice(0, 5).map(field => (
                        <span
                          key={field}
                          className="text-xs px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                        >
                          {field.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {item.fields_defined.length > 5 && (
                        <span className="text-xs px-1.5 py-0.5 text-gray-500">
                          +{item.fields_defined.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    No CCM instructions at this level (inherits from parent)
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
