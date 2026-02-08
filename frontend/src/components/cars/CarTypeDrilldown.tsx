'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Train } from 'lucide-react';

export interface TypeTreeNode {
  name: string;
  count: number;
  children: { name: string; count: number }[];
}

interface CarTypeDrilldownProps {
  tree: TypeTreeNode[];
  selectedType: string | null;
  selectedCommodity: string | null;
  onSelectType: (t: string | null) => void;
  onSelectCommodity: (c: string | null) => void;
  onClear: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function CarTypeDrilldown({
  tree, selectedType, selectedCommodity, onSelectType, onSelectCommodity, onClear, collapsed, onToggleCollapse
}: CarTypeDrilldownProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const totalCars = tree.reduce((sum, n) => sum + n.count, 0);

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center pt-3">
        <button onClick={onToggleCollapse} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Expand tree">
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
        <div className="mt-2 writing-vertical text-xs text-gray-400 dark:text-gray-500 [writing-mode:vertical-lr] rotate-180">
          Car Types
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Car Types</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{totalCars.toLocaleString()} cars</p>
        </div>
        <button onClick={onToggleCollapse} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Collapse">
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* All Cars */}
      <div className="overflow-y-auto flex-1">
        <button
          onClick={onClear}
          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
            !selectedType ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <span>All Cars</span>
          <span className="text-xs tabular-nums bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{totalCars.toLocaleString()}</span>
        </button>

        {tree.map(node => (
          <div key={node.name}>
            {/* Car Type Level */}
            <button
              onClick={() => {
                toggle(node.name);
                onSelectType(node.name);
                onSelectCommodity(null);
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-1 transition-colors ${
                selectedType === node.name && !selectedCommodity
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {expanded.has(node.name) ? (
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              )}
              <Train className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="truncate flex-1">{node.name}</span>
              <span className="text-xs tabular-nums bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded ml-1">{node.count}</span>
            </button>

            {/* Commodity Level */}
            {expanded.has(node.name) && node.children.map(child => (
              <button
                key={child.name}
                onClick={() => {
                  onSelectType(node.name);
                  onSelectCommodity(child.name);
                }}
                className={`w-full text-left pl-10 pr-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                  selectedType === node.name && selectedCommodity === child.name
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="truncate">{child.name}</span>
                <span className="tabular-nums bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded ml-1">{child.count}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
