'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 shadow-sm p-8 max-w-md w-full text-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Application Error
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {error.message || 'A critical error occurred. Please try again.'}
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
