'use client';

import { useState, useCallback, useMemo, ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sticky?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (row: T, index: number) => ReactNode;
  getValue?: (row: T) => string | number;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  key: string | null;
  direction: SortDirection;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  /** Enable row selection with checkboxes */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (selectedKeys: Set<string>) => void;
  /** Sticky header for scrollable tables */
  stickyHeader?: boolean;
  /** Max height for scrollable body */
  maxHeight?: string;
  /** Pagination */
  pageSize?: number;
  /** Empty state */
  emptyMessage?: string;
  emptyNode?: ReactNode;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Custom className */
  className?: string;
  /** Caption for accessibility */
  caption?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  stickyHeader = false,
  maxHeight,
  pageSize,
  emptyMessage = 'No data available',
  emptyNode,
  onRowClick,
  className = '',
  caption,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>({ key: null, direction: null });
  const [page, setPage] = useState(1);

  // Sorting
  const handleSort = useCallback((key: string) => {
    setSort(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sort.key || !sort.direction) return data;

    const col = columns.find(c => c.key === sort.key);
    return [...data].sort((a, b) => {
      const aVal = col?.getValue ? col.getValue(a) : a[sort.key!];
      const bVal = col?.getValue ? col.getValue(b) : b[sort.key!];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }, [data, sort, columns]);

  // Pagination
  const totalPages = pageSize ? Math.ceil(sortedData.length / pageSize) : 1;
  const paginatedData = pageSize
    ? sortedData.slice((page - 1) * pageSize, page * pageSize)
    : sortedData;

  // Selection
  const allSelected = selectable && paginatedData.length > 0 && paginatedData.every(row => selectedKeys?.has(row[keyField]));
  const someSelected = selectable && paginatedData.some(row => selectedKeys?.has(row[keyField])) && !allSelected;

  const toggleSelectAll = () => {
    if (!onSelectionChange || !selectedKeys) return;
    const newSet = new Set(selectedKeys);
    if (allSelected) {
      paginatedData.forEach(row => newSet.delete(row[keyField]));
    } else {
      paginatedData.forEach(row => newSet.add(row[keyField]));
    }
    onSelectionChange(newSet);
  };

  const toggleRow = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const newSet = new Set(selectedKeys);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    onSelectionChange(newSet);
  };

  const getSortIcon = (key: string) => {
    if (sort.key !== key) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    if (sort.direction === 'asc') return <ArrowUp className="w-3.5 h-3.5 text-primary-500" />;
    return <ArrowDown className="w-3.5 h-3.5 text-primary-500" />;
  };

  const alignClass = (align?: string) => {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  if (data.length === 0) {
    return emptyNode || (
      <div className="py-8 text-center text-sm text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={`overflow-x-auto ${maxHeight ? 'overflow-y-auto' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" role="grid">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-3 bg-gray-50 dark:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 ${alignClass(col.align)} ${
                    col.sortable ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''
                  }`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={sort.key === col.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  scope="col"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && getSortIcon(col.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {paginatedData.map((row, rowIndex) => {
              const rowKey = row[keyField];
              const isSelected = selectedKeys?.has(rowKey);
              return (
                <tr
                  key={rowKey}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/10'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  aria-selected={selectable ? isSelected : undefined}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected || false}
                        onChange={() => toggleRow(rowKey)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                        aria-label={`Select row ${rowKey}`}
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${alignClass(col.align)}`}
                    >
                      {col.render ? col.render(row, rowIndex) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sortedData.length)} of {sortedData.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
