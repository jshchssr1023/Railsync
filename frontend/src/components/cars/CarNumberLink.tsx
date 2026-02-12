'use client';

import { useCarDrawer } from '@/context/CarDrawerContext';

interface CarNumberLinkProps {
  carNumber: string;
  className?: string;
  children?: React.ReactNode;
}

export default function CarNumberLink({ carNumber, className, children }: CarNumberLinkProps) {
  const { openCarDrawer } = useCarDrawer();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); openCarDrawer(carNumber); }}
      className={className || 'text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer'}
    >
      {children || carNumber}
    </button>
  );
}
