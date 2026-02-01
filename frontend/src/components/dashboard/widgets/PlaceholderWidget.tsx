'use client';

interface PlaceholderWidgetProps {
  widgetId: string;
  message?: string;
}

export default function PlaceholderWidget({ widgetId, message }: PlaceholderWidgetProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
      <span className="text-xs">{message || `Widget: ${widgetId}`}</span>
    </div>
  );
}
