/**
 * Reusable page-level skeleton loaders for route transitions.
 * Used in loading.tsx files across the app.
 */

// Skeleton for dashboard-style pages with stat cards and tables
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-label="Loading dashboard">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Skeleton for list/table pages
export function ListSkeleton() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading list">
      <div className="flex justify-between items-center">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="h-12 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" />
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="h-14 border-b border-gray-100 dark:border-gray-800 px-4 flex items-center gap-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton for detail pages
export function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-label="Loading details">
      <div className="flex items-center gap-3">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Skeleton for form/settings pages
export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-6 max-w-2xl" role="status" aria-label="Loading form">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-6" />
      </div>
    </div>
  );
}
