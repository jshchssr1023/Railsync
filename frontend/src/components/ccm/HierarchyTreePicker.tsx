'use client';

import { useState, useEffect, useMemo } from 'react';
import { CCMHierarchyNode, CCMScopeLevel, CCMInstructionScope } from '@/types';

interface HierarchyTreePickerProps {
  nodes: CCMHierarchyNode[];
  value: CCMInstructionScope | null;
  onChange: (scope: CCMInstructionScope | null) => void;
  loading?: boolean;
  searchFilter?: string;
}

const SCOPE_LEVEL_LABELS: Record<CCMScopeLevel, string> = {
  customer: 'Customer',
  master_lease: 'Master Lease',
  rider: 'Rider',
  amendment: 'Amendment',
};

const SCOPE_LEVEL_COLORS: Record<CCMScopeLevel, string> = {
  customer: 'text-blue-600 dark:text-blue-400',
  master_lease: 'text-purple-600 dark:text-purple-400',
  rider: 'text-green-600 dark:text-green-400',
  amendment: 'text-amber-600 dark:text-amber-400',
};

export default function HierarchyTreePicker({
  nodes,
  value,
  onChange,
  loading = false,
  searchFilter = '',
}: HierarchyTreePickerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Auto-expand nodes that match search or have CCM
  useEffect(() => {
    if (searchFilter) {
      const matchingIds = new Set<string>();
      const findMatches = (nodes: CCMHierarchyNode[], parentIds: string[] = []) => {
        for (const node of nodes) {
          const matches = node.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
            (node.code?.toLowerCase().includes(searchFilter.toLowerCase()));
          if (matches) {
            parentIds.forEach(id => matchingIds.add(id));
            matchingIds.add(node.id);
          }
          if (node.children) {
            findMatches(node.children, [...parentIds, node.id]);
          }
        }
      };
      findMatches(nodes);
      setExpandedNodes(matchingIds);
    }
  }, [searchFilter, nodes]);

  // Auto-expand to show selected value
  useEffect(() => {
    if (value) {
      const findParents = (nodes: CCMHierarchyNode[], parentIds: string[] = []): string[] | null => {
        for (const node of nodes) {
          if (node.id === value.id && node.type === value.type) {
            return parentIds;
          }
          if (node.children) {
            const result = findParents(node.children, [...parentIds, node.id]);
            if (result) return result;
          }
        }
        return null;
      };
      const parents = findParents(nodes);
      if (parents) {
        setExpandedNodes(prev => new Set([...prev, ...parents]));
      }
    }
  }, [value, nodes]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSelect = (node: CCMHierarchyNode) => {
    if (value?.id === node.id && value?.type === node.type) {
      onChange(null);
    } else {
      onChange({ type: node.type, id: node.id });
    }
  };

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!searchFilter) return nodes;

    const filterTree = (nodes: CCMHierarchyNode[]): CCMHierarchyNode[] => {
      return nodes.reduce<CCMHierarchyNode[]>((acc, node) => {
        const matches = node.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
          (node.code?.toLowerCase().includes(searchFilter.toLowerCase()));
        const filteredChildren = node.children ? filterTree(node.children) : [];

        if (matches || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children,
          });
        }
        return acc;
      }, []);
    };

    return filterTree(nodes);
  }, [nodes, searchFilter]);

  const renderNode = (node: CCMHierarchyNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = value?.id === node.id && value?.type === node.type;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={`${node.type}-${node.id}`}>
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors ${
            isSelected
              ? 'bg-primary-100 dark:bg-primary-900/40 border border-primary-500'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* Expand/Collapse Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.id);
            }}
            className={`w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ${
              !hasChildren ? 'invisible' : ''
            }`}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Node Content */}
          <div
            className="flex-1 flex items-center gap-2 min-w-0"
            onClick={() => handleSelect(node)}
          >
            {/* CCM Indicator */}
            {node.hasCCM && (
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Has CCM" />
            )}

            {/* Name */}
            <span className={`truncate font-medium ${SCOPE_LEVEL_COLORS[node.type]}`}>
              {node.name}
            </span>

            {/* Code Badge */}
            {node.code && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex-shrink-0">
                {node.code}
              </span>
            )}

            {/* Level Badge */}
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {SCOPE_LEVEL_LABELS[node.type]}
            </span>

            {/* Inactive Indicator */}
            {!node.isActive && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 flex-shrink-0">
                Inactive
              </span>
            )}
          </div>

          {/* Selection Indicator */}
          {isSelected && (
            <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 p-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  if (filteredNodes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {searchFilter ? 'No matching items found' : 'No hierarchy data available'}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {filteredNodes.map(node => renderNode(node))}
    </div>
  );
}
