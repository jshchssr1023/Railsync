'use client';

import { useState, useEffect } from 'react';

interface ResponsiveDataViewProps<T> {
  data: T[];
  renderTable: () => React.ReactNode;
  renderCard: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  breakpoint?: number; // Default 768 (md)
}

export default function ResponsiveDataView<T>({
  data,
  renderTable,
  renderCard,
  emptyMessage = 'No data available',
  loading = false,
  breakpoint = 768,
}: ResponsiveDataViewProps<T>) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Initial check
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Mobile: Card layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index}>{renderCard(item, index)}</div>
        ))}
      </div>
    );
  }

  // Desktop: Table layout
  return <>{renderTable()}</>;
}
