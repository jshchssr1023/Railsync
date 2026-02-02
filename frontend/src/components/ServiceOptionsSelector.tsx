'use client';

import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Clock, CheckCircle, Wrench, PaintBucket, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface ServiceOption {
  service_type: string;
  service_category: 'qualification' | 'repair' | 'maintenance' | 'inspection';
  description: string;
  due_date?: string;
  reported_date?: string;
  is_required: boolean;
  is_selected: boolean;
  estimated_cost?: number;
  estimated_hours?: number;
  source?: string;
  source_reference_id?: string;
  days_until_due?: number;
  urgency?: 'overdue' | 'urgent' | 'upcoming' | 'optional';
}

interface ServiceOptionsSummary {
  total_options: number;
  selected_count: number;
  required_count: number;
  estimated_total: number;
  estimated_hours: number;
}

interface ServiceOptionsSelectorProps {
  carNumber: string;
  targetDateStr?: string; // Use string to avoid new Date() on every render
  className?: string;
}

export default function ServiceOptionsSelector({
  carNumber,
  targetDateStr,
  className = '',
}: ServiceOptionsSelectorProps) {
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize the date string to use in the effect
  const dateParam = useMemo(() => {
    if (targetDateStr) return targetDateStr;
    return new Date().toISOString().split('T')[0];
  }, [targetDateStr]);

  // Fetch service options when car number changes
  useEffect(() => {
    let cancelled = false;

    async function fetchOptions() {
      if (!carNumber) {
        setOptions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_URL}/cars/${encodeURIComponent(carNumber)}/service-options?target_date=${dateParam}`);

        if (cancelled) return;

        if (!res.ok) {
          throw new Error('Failed to fetch service options');
        }

        const json = await res.json();
        if (!cancelled) {
          setOptions(json.data?.options || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load service options');
          setOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchOptions();

    return () => {
      cancelled = true;
    };
  }, [carNumber, dateParam]);

  // Calculate summary whenever options change
  const summary = useMemo<ServiceOptionsSummary>(() => {
    const selected = options.filter(o => o.is_selected);
    return {
      total_options: options.length,
      selected_count: selected.length,
      required_count: options.filter(o => o.is_required).length,
      estimated_total: selected.reduce((sum, o) => sum + (o.estimated_cost || 0), 0),
      estimated_hours: selected.reduce((sum, o) => sum + (o.estimated_hours || 0), 0),
    };
  }, [options]);

  // Toggle option selection
  const toggleOption = (index: number) => {
    setOptions(prev => {
      const updated = [...prev];
      // Cannot deselect required options
      if (!updated[index].is_required) {
        updated[index] = { ...updated[index], is_selected: !updated[index].is_selected };
      }
      return updated;
    });
  };

  // Group options by category
  const groupedOptions = useMemo(() => {
    const groups: Record<string, (ServiceOption & { _index: number })[]> = {
      qualification: [],
      repair: [],
      maintenance: [],
      inspection: [],
    };

    options.forEach((opt, idx) => {
      const optWithIndex = { ...opt, _index: idx };
      if (groups[opt.service_category]) {
        groups[opt.service_category].push(optWithIndex);
      }
    });

    return groups;
  }, [options]);

  const getUrgencyBadge = (option: ServiceOption) => {
    if (!option.urgency) return null;

    const badges: Record<string, { text: string; className: string }> = {
      overdue: { text: 'OVERDUE', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
      urgent: { text: 'Due Soon', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
      upcoming: { text: 'Upcoming', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
      optional: { text: 'Optional', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
    };

    const badge = badges[option.urgency];
    if (!badge) return null;
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.text}</span>;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'qualification': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'repair': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'maintenance': return <PaintBucket className="w-5 h-5 text-green-500" />;
      case 'inspection': return <Wrench className="w-5 h-5 text-purple-500" />;
      default: return <Wrench className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategoryTitle = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1) + 's';
  };

  if (loading) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg ${className}`}>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className={`p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">No service options available for this car.</p>
      </div>
    );
  }

  const renderOptionGroup = (category: string, categoryOptions: (ServiceOption & { _index: number })[]) => {
    if (categoryOptions.length === 0) return null;

    return (
      <div key={category} className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          {getCategoryIcon(category)}
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            {getCategoryTitle(category)}
          </h4>
        </div>
        <div className="space-y-2">
          {categoryOptions.map((option) => (
            <label
              key={`${category}-${option._index}`}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                option.is_selected
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${option.is_required ? 'ring-1 ring-red-300 dark:ring-red-700' : ''}`}
            >
              <div className="flex items-center h-5 mt-0.5">
                <input
                  type="checkbox"
                  checked={option.is_selected}
                  disabled={option.is_required}
                  onChange={() => toggleOption(option._index)}
                  className="h-4 w-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{option.description}</span>
                  {option.is_required && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
                      Required
                    </span>
                  )}
                  {getUrgencyBadge(option)}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {option.due_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Due: {new Date(option.due_date).toLocaleDateString()}
                      {option.days_until_due !== undefined && (
                        <span className={option.days_until_due <= 0 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                          ({option.days_until_due <= 0 ? 'Overdue' : `${option.days_until_due} days`})
                        </span>
                      )}
                    </span>
                  )}
                  {option.reported_date && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Reported: {new Date(option.reported_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  ${(option.estimated_cost || 0).toLocaleString()}
                </div>
                {option.estimated_hours && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {option.estimated_hours} hrs
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Service Options</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Select the work to be performed at this shop visit</p>
      </div>

      {/* Option Groups */}
      {renderOptionGroup('qualification', groupedOptions.qualification)}
      {renderOptionGroup('repair', groupedOptions.repair)}
      {renderOptionGroup('maintenance', groupedOptions.maintenance)}
      {renderOptionGroup('inspection', groupedOptions.inspection)}

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{summary.selected_count}</span> of {summary.total_options} options selected
            {summary.required_count > 0 && (
              <span className="ml-2 text-red-600 dark:text-red-400">
                ({summary.required_count} required)
              </span>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${summary.estimated_total.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Est. {summary.estimated_hours} hours
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export the summary type for parent components
export type { ServiceOptionsSummary };
