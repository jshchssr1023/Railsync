'use client';

import { LayoutDashboard } from 'lucide-react';

interface PlaceholderWidgetProps {
  widgetId: string;
  message?: string;
}

export default function PlaceholderWidget({ widgetId, message }: PlaceholderWidgetProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
      <LayoutDashboard className="w-8 h-8 mb-2" strokeWidth={1.5} aria-hidden="true" />
      <span className="text-xs">{message || `Widget: ${widgetId}`}</span>
    </div>
  );
}
