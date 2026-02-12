'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, X, Filter, Train } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CarFacetedSidebarProps {
  /** Current filter state from useURLFilters */
  filters: Record<string, string>;
  /** Set a single filter value */
  onSetFilter: (key: string, value: string) => void;
  /** Clear all filters */
  onClearAll: () => void;
  /** Available filter options loaded externally */
  filterOptions: { statuses: string[]; regions: string[]; lessees: string[] };
  /** Car type tree data */
  typeTree: TypeNode[];
  /** Whether sidebar is collapsed */
  collapsed: boolean;
  /** Toggle collapse */
  onToggleCollapse: () => void;
}

export interface TypeNode {
  name: string;
  count: number;
  children: { name: string; count: number }[];
}

interface Section {
  key: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
}

// ---------------------------------------------------------------------------
// Static sections
// ---------------------------------------------------------------------------
const STATUS_GROUP_OPTIONS = [
  { value: 'in_shop', label: 'In Shop' },
  { value: 'idle_storage', label: 'Idle / Storage' },
  { value: 'ready_to_load', label: 'Ready to Load' },
  { value: 'pending', label: 'Pending' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CarFacetedSidebar({
  filters,
  onSetFilter,
  onClearAll,
  filterOptions,
  typeTree,
  collapsed,
  onToggleCollapse,
}: CarFacetedSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['status_group', 'type', 'status'])
  );
  // Track which car types are expanded in the drill-down tree
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() => {
    return filters.type ? new Set([filters.type]) : new Set();
  });

  // Sync expandedTypes when type filter changes externally (e.g. clear all)
  useEffect(() => {
    if (filters.type) {
      setExpandedTypes(prev => {
        if (prev.has(filters.type)) return prev;
        const next = new Set(prev);
        next.add(filters.type);
        return next;
      });
    }
  }, [filters.type]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleTypeExpansion = (typeName: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      next.has(typeName) ? next.delete(typeName) : next.add(typeName);
      return next;
    });
  };

  // Total car count
  const totalCount = useMemo(() => typeTree.reduce((sum, t) => sum + t.count, 0), [typeTree]);

  // Build flat filter sections (excluding type/commodity which are handled as tree)
  const flatSections: Section[] = [
    {
      key: 'status_group',
      label: 'Fleet Status',
      options: STATUS_GROUP_OPTIONS,
    },
    {
      key: 'status',
      label: 'Car Status',
      options: filterOptions.statuses.map(s => ({ value: s, label: s })),
    },
    {
      key: 'region',
      label: 'Region',
      options: filterOptions.regions.map(r => ({ value: r, label: r })),
    },
    {
      key: 'lessee',
      label: 'Lessee',
      options: filterOptions.lessees.map(l => ({ value: l, label: l })),
    },
  ];

  // Count active filters
  const activeCount = ['status_group', 'status', 'type', 'commodity', 'region', 'lessee', 'search']
    .filter(k => filters[k]).length;

  // Handle single-select filter toggle (radio-style for flat filters)
  const handleFilterToggle = (key: string, value: string) => {
    if (filters[key] === value) {
      onSetFilter(key, '');
    } else {
      onSetFilter(key, value);
    }
  };

  // Handle type selection in the drill-down tree
  const handleTypeSelect = (typeName: string) => {
    if (filters.type === typeName) {
      // Deselect type → clear both type and commodity
      onSetFilter('type', '');
      onSetFilter('commodity', '');
      setExpandedTypes(prev => {
        const next = new Set(prev);
        next.delete(typeName);
        return next;
      });
    } else {
      // Select type → set type, clear commodity, expand children
      onSetFilter('type', typeName);
      onSetFilter('commodity', '');
      setExpandedTypes(prev => {
        const next = new Set(prev);
        next.add(typeName);
        return next;
      });
    }
  };

  // Handle commodity selection in the drill-down tree
  const handleCommoditySelect = (typeName: string, commodityName: string) => {
    if (filters.type === typeName && filters.commodity === commodityName) {
      // Deselect commodity only
      onSetFilter('commodity', '');
    } else {
      // Select both type and commodity
      if (filters.type !== typeName) {
        onSetFilter('type', typeName);
      }
      onSetFilter('commodity', commodityName);
    }
  };

  // Handle "All Cars" selection
  const handleAllCars = () => {
    onSetFilter('type', '');
    onSetFilter('commodity', '');
  };

  // Collapsed state: just show an icon strip
  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-3">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 relative"
          title="Show filters"
        >
          <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  const selectedType = filters.type || '';
  const selectedCommodity = filters.commodity || '';
  const typeActive = !!(selectedType || selectedCommodity);

  return (
    <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-0.5 text-[10px] text-primary-600 dark:text-primary-400 hover:underline px-1.5 py-0.5"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Collapse filters"
          >
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* ---------- Flat sections: Fleet Status, Car Status ---------- */}
        {flatSections.slice(0, 2).map(section => (
          <FlatFilterSection
            key={section.key}
            section={section}
            currentValue={filters[section.key] || ''}
            isExpanded={expandedSections.has(section.key)}
            onToggleSection={() => toggleSection(section.key)}
            onToggleFilter={(value) => handleFilterToggle(section.key, value)}
          />
        ))}

        {/* ---------- Car Type / Commodity Tree Section ---------- */}
        <div className="mb-0.5">
          <button
            onClick={() => toggleSection('type')}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              Car Type
              {typeActive && (
                <span className="px-1.5 py-0.5 text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                  {selectedCommodity ? 2 : 1}
                </span>
              )}
            </span>
            {expandedSections.has('type')
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            }
          </button>

          {expandedSections.has('type') && (
            <div className="px-2 pb-1 max-h-72 overflow-y-auto">
              {/* All Cars */}
              <button
                onClick={handleAllCars}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors text-left ${
                  !selectedType
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Train className="w-3 h-3 flex-shrink-0" />
                <span className="flex-1 truncate">All Cars</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{totalCount}</span>
              </button>

              {/* Type tree */}
              {typeTree.map(typeNode => {
                const isTypeSelected = selectedType === typeNode.name;
                const isTypeExpanded = expandedTypes.has(typeNode.name);
                const hasChildren = typeNode.children && typeNode.children.length > 0;

                return (
                  <div key={typeNode.name}>
                    {/* Type row */}
                    <div className="flex items-center">
                      {/* Expand/collapse chevron */}
                      {hasChildren ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTypeExpansion(typeNode.name); }}
                          className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
                        >
                          {isTypeExpanded
                            ? <ChevronDown className="w-3 h-3 text-gray-400" />
                            : <ChevronRight className="w-3 h-3 text-gray-400" />
                          }
                        </button>
                      ) : (
                        <span className="w-4 flex-shrink-0" />
                      )}
                      <button
                        onClick={() => handleTypeSelect(typeNode.name)}
                        className={`flex items-center gap-2 flex-1 min-w-0 px-1 py-1.5 rounded text-xs transition-colors text-left ${
                          isTypeSelected
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
                          isTypeSelected
                            ? 'bg-primary-500 border-primary-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isTypeSelected && (
                            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="flex-1 truncate">{typeNode.name}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{typeNode.count}</span>
                      </button>
                    </div>

                    {/* Commodity children (Level 2) */}
                    {isTypeExpanded && hasChildren && (
                      <div className="ml-4">
                        {typeNode.children
                          .filter(c => c.name)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(commodity => {
                            const isCommoditySelected = isTypeSelected && selectedCommodity === commodity.name;
                            return (
                              <button
                                key={commodity.name}
                                onClick={() => handleCommoditySelect(typeNode.name, commodity.name)}
                                className={`flex items-center gap-2 w-full pl-6 pr-2 py-1 rounded text-xs transition-colors text-left ${
                                  isCommoditySelected
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                              >
                                <div className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                                  isCommoditySelected
                                    ? 'bg-primary-500 border-primary-500'
                                    : 'border-gray-300 dark:border-gray-600'
                                }`}>
                                  {isCommoditySelected && (
                                    <svg className="w-1.5 h-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span className="flex-1 truncate">{commodity.name}</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{commodity.count}</span>
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------- Flat sections: Region, Lessee ---------- */}
        {flatSections.slice(2).map(section => (
          <FlatFilterSection
            key={section.key}
            section={section}
            currentValue={filters[section.key] || ''}
            isExpanded={expandedSections.has(section.key)}
            onToggleSection={() => toggleSection(section.key)}
            onToggleFilter={(value) => handleFilterToggle(section.key, value)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable flat filter section
// ---------------------------------------------------------------------------
function FlatFilterSection({
  section,
  currentValue,
  isExpanded,
  onToggleSection,
  onToggleFilter,
}: {
  section: Section;
  currentValue: string;
  isExpanded: boolean;
  onToggleSection: () => void;
  onToggleFilter: (value: string) => void;
}) {
  if (section.options.length === 0) return null;

  return (
    <div className="mb-0.5">
      <button
        onClick={onToggleSection}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          {section.label}
          {currentValue && (
            <span className="px-1.5 py-0.5 text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
              1
            </span>
          )}
        </span>
        {isExpanded
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        }
      </button>

      {isExpanded && (
        <div className="px-2 pb-1 max-h-52 overflow-y-auto">
          {section.options.map(option => {
            const isSelected = currentValue === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onToggleFilter(option.value)}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors text-left ${
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {isSelected && (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{option.count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
