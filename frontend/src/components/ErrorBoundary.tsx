'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Ban } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800" role="alert">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-red-600 dark:text-red-300 mb-4 text-center max-w-md">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Fetch error display with retry
interface FetchErrorProps {
  error: string | Error;
  onRetry?: () => void;
  className?: string;
}

export function FetchError({ error, onRetry, className = '' }: FetchErrorProps): JSX.Element {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className={`flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`} role="alert">
      <Ban className="w-10 h-10 text-gray-400 mb-3" aria-hidden="true" />
      <h4 className="text-md font-medium text-gray-700 dark:text-gray-200 mb-1">
        Failed to load data
      </h4>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
        {errorMessage}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
