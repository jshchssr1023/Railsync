'use client';

import { ReactNode } from 'react';
import {
  CheckCircle2, AlertCircle, Inbox, Search, FileX, Plus
} from 'lucide-react';

type EmptyStateVariant = 'success' | 'action-needed' | 'neutral' | 'search' | 'error';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}

const variantConfig: Record<EmptyStateVariant, {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
}> = {
  success: {
    icon: <CheckCircle2 className="w-8 h-8" />,
    iconBg: 'bg-green-50 dark:bg-green-900/20',
    iconColor: 'text-green-500 dark:text-green-400',
  },
  'action-needed': {
    icon: <AlertCircle className="w-8 h-8" />,
    iconBg: 'bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-500 dark:text-amber-400',
  },
  neutral: {
    icon: <Inbox className="w-8 h-8" />,
    iconBg: 'bg-gray-50 dark:bg-gray-800',
    iconColor: 'text-gray-400 dark:text-gray-500',
  },
  search: {
    icon: <Search className="w-8 h-8" />,
    iconBg: 'bg-blue-50 dark:bg-blue-900/20',
    iconColor: 'text-blue-400 dark:text-blue-500',
  },
  error: {
    icon: <FileX className="w-8 h-8" />,
    iconBg: 'bg-red-50 dark:bg-red-900/20',
    iconColor: 'text-red-400 dark:text-red-500',
  },
};

export default function EmptyState({
  variant = 'neutral',
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className = '',
}: EmptyStateProps) {
  const config = variantConfig[variant];

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      <div className={`w-16 h-16 rounded-full ${config.iconBg} ${config.iconColor} flex items-center justify-center mb-4`}>
        {icon || config.icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
