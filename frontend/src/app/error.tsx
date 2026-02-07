'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Route error:', error);
    }
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Something went wrong
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 font-medium tracking-wide uppercase">
          Railsync Shop Loading Tool
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          An unexpected error occurred while loading this page. You can try
          again or return to the home page.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors w-full sm:w-auto justify-center"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto justify-center"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-gray-400 dark:text-gray-500 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
