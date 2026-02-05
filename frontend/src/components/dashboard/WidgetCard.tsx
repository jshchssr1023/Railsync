'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface WidgetCardProps {
  title: string;
  description?: string;
  category: string;
  children: ReactNode;
  onRemove?: () => void;
  isEditing?: boolean;
}

export default function WidgetCard({
  title,
  description,
  category,
  children,
  onRemove,
  isEditing,
}: WidgetCardProps) {
  const categoryColors: Record<string, string> = {
    Budget: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    Capacity: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    Operations: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    Performance: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
    Planning: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[category] || 'bg-gray-100 text-gray-800'}`}>
              {category}
            </span>
          </div>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
        {isEditing && onRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="Remove widget"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
