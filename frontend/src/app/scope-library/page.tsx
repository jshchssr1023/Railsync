'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { listScopeTemplates, getScopeTemplate } from '@/lib/api';
import { ScopeLibraryTemplate } from '@/types';

// ---------------------------------------------------------------------------
// Source badge color mapping
// ---------------------------------------------------------------------------
const SOURCE_COLORS: Record<string, string> = {
  library: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ccm: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  manual: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  engineering: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

// ---------------------------------------------------------------------------
// Top-level page component with Suspense boundary
// ---------------------------------------------------------------------------
export default function ScopeLibraryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading...</div>}>
      <ScopeLibraryContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Inner content component (uses useSearchParams)
// ---------------------------------------------------------------------------
function ScopeLibraryContent() {
  const searchParams = useSearchParams();

  // --- Data state ---
  const [templates, setTemplates] = useState<ScopeLibraryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter state ---
  const [searchText, setSearchText] = useState(searchParams.get('search') || '');
  const [carTypeFilter, setCarTypeFilter] = useState(searchParams.get('car_type') || '');
  const [shoppingTypeFilter, setShoppingTypeFilter] = useState(searchParams.get('shopping_type') || '');
  const [shoppingReasonFilter, setShoppingReasonFilter] = useState(searchParams.get('shopping_reason') || '');

  // --- Expanded template state ---
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<ScopeLibraryTemplate | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch templates list
  // -------------------------------------------------------------------------
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listScopeTemplates({
        search: searchText.trim() || undefined,
        car_type: carTypeFilter.trim() || undefined,
        shopping_type: shoppingTypeFilter.trim() || undefined,
        shopping_reason: shoppingReasonFilter.trim() || undefined,
      });
      setTemplates(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scope templates');
    } finally {
      setLoading(false);
    }
  }, [searchText, carTypeFilter, shoppingTypeFilter, shoppingReasonFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // -------------------------------------------------------------------------
  // Expand / collapse template detail
  // -------------------------------------------------------------------------
  const handleToggleExpand = async (templateId: string) => {
    if (expandedId === templateId) {
      // Collapse
      setExpandedId(null);
      setExpandedTemplate(null);
      return;
    }

    setExpandedId(templateId);
    setExpandedLoading(true);
    setExpandedTemplate(null);
    try {
      const detail = await getScopeTemplate(templateId);
      setExpandedTemplate(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template detail');
      setExpandedId(null);
    } finally {
      setExpandedLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Format date helper
  // -------------------------------------------------------------------------
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                             */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Scope of Work Library
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Reusable SOW templates that build organically from operations
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Search / Filter Bar                                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Search by Name
            </label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search templates..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Car Type
            </label>
            <input
              type="text"
              value={carTypeFilter}
              onChange={(e) => setCarTypeFilter(e.target.value)}
              placeholder="Filter by car type..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Shopping Type
            </label>
            <input
              type="text"
              value={shoppingTypeFilter}
              onChange={(e) => setShoppingTypeFilter(e.target.value)}
              placeholder="Filter by shopping type..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Shopping Reason
            </label>
            <input
              type="text"
              value={shoppingReasonFilter}
              onChange={(e) => setShoppingReasonFilter(e.target.value)}
              placeholder="Filter by shopping reason..."
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Error state                                                        */}
      {/* ----------------------------------------------------------------- */}
      {error && (
        <div className="card p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => { setError(null); fetchTemplates(); }}
              className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Loading skeleton                                                   */}
      {/* ----------------------------------------------------------------- */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-4 animate-pulse space-y-3">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="flex gap-2">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Empty state                                                        */}
      {/* ----------------------------------------------------------------- */}
      {!loading && !error && templates.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>No scope templates found</p>
          <p className="text-sm mt-1">Adjust your filters or check back later</p>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Template grid                                                      */}
      {/* ----------------------------------------------------------------- */}
      {!loading && !error && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div key={template.id}>
              {/* Template card */}
              <div
                onClick={() => handleToggleExpand(template.id)}
                className={`card p-4 cursor-pointer transition-shadow hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  expandedId === template.id
                    ? 'ring-2 ring-primary-600 dark:ring-primary-400'
                    : ''
                }`}
              >
                {/* Name and status */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">
                    {template.name}
                  </h3>
                  <span
                    className={`ml-2 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      template.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {template.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Description (truncated) */}
                {template.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {template.car_type && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      {template.car_type}
                    </span>
                  )}
                  {template.shopping_type && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                      {template.shopping_type}
                    </span>
                  )}
                  {template.shopping_reason && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      {template.shopping_reason}
                    </span>
                  )}
                </div>

                {/* Usage count and last used */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="flex items-center gap-1">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Used {template.usage_count} time{template.usage_count !== 1 ? 's' : ''}
                  </span>
                  {template.last_used_at && (
                    <span>Last used {formatDate(template.last_used_at)}</span>
                  )}
                </div>
              </div>

              {/* -------------------------------------------------------------- */}
              {/* Expanded detail panel                                           */}
              {/* -------------------------------------------------------------- */}
              {expandedId === template.id && (
                <div className="card mt-2 p-5 space-y-4 border-t-2 border-primary-600 dark:border-primary-400">
                  {/* Loading spinner for detail */}
                  {expandedLoading && (
                    <div className="flex items-center justify-center py-8">
                      <svg
                        className="animate-spin h-6 w-6 text-primary-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Detail content */}
                  {!expandedLoading && expandedTemplate && (
                    <>
                      {/* Header with close */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {expandedTemplate.name}
                          </h3>
                          {expandedTemplate.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {expandedTemplate.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(null);
                            setExpandedTemplate(null);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Used {expandedTemplate.usage_count} time{expandedTemplate.usage_count !== 1 ? 's' : ''}
                        </span>
                        {expandedTemplate.last_used_at && (
                          <span>Last used: {formatDate(expandedTemplate.last_used_at)}</span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            expandedTemplate.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {expandedTemplate.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Scope library items table */}
                      {expandedTemplate.items && expandedTemplate.items.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                                  Line
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Instruction
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                                  Source
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Job Codes
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                              {expandedTemplate.items.map((item) => (
                                <tr
                                  key={item.id}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono">
                                    {item.line_number}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                                    {item.instruction_text}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                        SOURCE_COLORS[item.source] || SOURCE_COLORS.manual
                                      }`}
                                    >
                                      {item.source}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    {item.job_codes && item.job_codes.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {item.job_codes.map((jc) => (
                                          <span
                                            key={jc.id}
                                            title={`${jc.description}${jc.is_expected ? ' (Expected)' : ''}`}
                                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono ${
                                              jc.is_expected
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                            }`}
                                          >
                                            {jc.code}
                                            {jc.is_expected && (
                                              <svg
                                                className="w-3 h-3 ml-0.5"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                              >
                                                <path
                                                  fillRule="evenodd"
                                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                  clipRule="evenodd"
                                                />
                                              </svg>
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400 dark:text-gray-500">
                                        -
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                          No scope items defined for this template
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
