'use client';

import { useState, useEffect } from 'react';
import { Loader2, Frown } from 'lucide-react';

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
        <Loader2 className="animate-spin h-8 w-8 text-primary-600" aria-hidden="true" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Frown className="w-12 h-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
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
