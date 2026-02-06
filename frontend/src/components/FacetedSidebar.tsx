'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface FacetedSidebarProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: Partial<FilterState>;
}

export interface FilterState {
  customers: string[];
  leaseIds: string[];
  carTypes: string[];
  materialTypes: string[];
  commodities: string[];
  shopCodes: string[];
  statuses: string[];
}

interface FilterSection {
  key: keyof FilterState;
  label: string;
  options: { value: string; label: string; count?: number }[];
}

export default function FacetedSidebar({ onFilterChange, initialFilters }: FacetedSidebarProps) {
  const [filters, setFilters] = useState<FilterState>({
    customers: [],
    leaseIds: [],
    carTypes: [],
    materialTypes: [],
    commodities: [],
    shopCodes: [],
    statuses: [],
    ...initialFilters,
  });

  const [sections, setSections] = useState<FilterSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['statuses', 'shopCodes']));
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem('auth_token');

  // Fetch filter options
  useEffect(() => {
    const headers = { Authorization: `Bearer ${getToken()}` };

    Promise.all([
      fetch(`${API_URL}/customers?limit=100`, { headers }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_URL}/shops?limit=50`, { headers }).then(r => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([customersData, shopsData]) => {
        const customers = customersData.data || [];
        const shops = shopsData.data || [];

        setSections([
          {
            key: 'statuses',
            label: 'Shop Status',
            options: [
              { value: 'Need Shopping', label: 'Need Shopping' },
              { value: 'Planned Shopping', label: 'Planned Shopping' },
              { value: 'Enroute', label: 'Enroute' },
              { value: 'Arrived', label: 'Arrived' },
              { value: 'Complete', label: 'Complete' },
              { value: 'Released', label: 'Released' },
            ],
          },
          {
            key: 'customers',
            label: 'Customer',
            options: customers.map((c: any) => ({
              value: c.id,
              label: c.customer_name || c.customer_code,
              count: c.total_cars,
            })),
          },
          {
            key: 'shopCodes',
            label: 'Shop Location',
            options: shops.map((s: any) => ({
              value: s.shop_code,
              label: s.shop_name || s.shop_code,
            })),
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => {
      const current = prev[key] as string[];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      const newFilters = { ...prev, [key]: next };
      onFilterChange(newFilters);
      return newFilters;
    });
  };

  const clearFilters = () => {
    const cleared: FilterState = {
      customers: [],
      leaseIds: [],
      carTypes: [],
      materialTypes: [],
      commodities: [],
      shopCodes: [],
      statuses: [],
    };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  const activeCount = Object.values(filters).flat().length;

  if (loading) {
    return (
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
              <div className="space-y-1">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">Filters</h3>
        {activeCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            <X className="w-3 h-3" />
            Clear ({activeCount})
          </button>
        )}
      </div>

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto p-2">
        {sections.map(section => (
          <div key={section.key} className="mb-1">
            <button
              onClick={() => toggleSection(section.key)}
              className="flex items-center justify-between w-full px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
            >
              <span className="flex items-center gap-2">
                {section.label}
                {(filters[section.key] as string[]).length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full">
                    {(filters[section.key] as string[]).length}
                  </span>
                )}
              </span>
              {expandedSections.has(section.key) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {expandedSections.has(section.key) && (
              <div className="ml-2 mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {section.options.map(option => {
                  const isSelected = (filters[section.key] as string[]).includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                        isSelected
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFilter(section.key, option.value)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="flex-1 truncate">{option.label}</span>
                      {option.count !== undefined && (
                        <span className="text-xs text-gray-400">{option.count}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
