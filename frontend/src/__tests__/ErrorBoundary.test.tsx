import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, FetchError } from '@/components/ErrorBoundary';

// Component that throws an error
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return <div>Content is fine</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected error boundary logging
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Content is fine')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error view</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom error view')).toBeInTheDocument();
  });

  it('calls onReset when retry is clicked', () => {
    const onReset = jest.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Try Again'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('FetchError', () => {
  it('displays error message string', () => {
    render(<FetchError error="Network request failed" />);
    expect(screen.getByText('Network request failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });

  it('displays error from Error object', () => {
    render(<FetchError error={new Error('Connection timeout')} />);
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('shows retry button when onRetry provided', () => {
    const onRetry = jest.fn();
    render(<FetchError error="Error" onRetry={onRetry} />);
    const retryBtn = screen.getByText('Retry');
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides retry button when no onRetry', () => {
    render(<FetchError error="Error" />);
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });
});
