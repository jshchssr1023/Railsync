'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import {
  Lock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2
} from 'lucide-react';

type ValidationCategory = 'cars' | 'qualifications' | 'contracts' | 'allocations' | 'shopping' | 'invoices' | 'cross_module';
type ValidationStatus = 'pass' | 'warn' | 'fail';

interface ValidationResult {
  check_name: string;
  category: ValidationCategory;
  status: ValidationStatus;
  message: string;
  count: number;
  details?: any[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const categoryLabels: Record<ValidationCategory, string> = {
  cars: 'Cars',
  qualifications: 'Qualifications',
  contracts: 'Contracts',
  allocations: 'Allocations',
  shopping: 'Shopping',
  invoices: 'Invoices',
  cross_module: 'Cross-Module'
};

const categoryColors: Record<ValidationCategory, string> = {
  cars: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  qualifications: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  contracts: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  allocations: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  shopping: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  invoices: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  cross_module: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

export default function DataValidationPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ValidationCategory | 'all'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const getToken = () => localStorage.getItem('railsync_access_token');

  const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  };

  const runValidation = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/admin/data-validation');
      if (data.success) {
        setResults(data.data);
        setLastRun(new Date());
        toast.success('Validation complete');
      } else {
        toast.error('Validation failed', data.error);
      }
    } catch (error) {
      console.error('Failed to run validation:', error);
      toast.error('Failed to run validation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      runValidation();
    }
  }, [isAuthenticated, user]);

  const filteredResults = useMemo(() => {
    if (selectedCategory === 'all') return results;
    return results.filter(r => r.category === selectedCategory);
  }, [results, selectedCategory]);

  const summary = useMemo(() => {
    const total = results.length;
    const passing = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warn').length;
    const failures = results.filter(r => r.status === 'fail').length;
    return { total, passing, warnings, failures };
  }, [results]);

  const toggleRow = (checkName: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(checkName)) {
        next.delete(checkName);
      } else {
        next.add(checkName);
      }
      return next;
    });
  };

  const getStatusIcon = (status: ValidationStatus) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden="true" />;
      case 'warn':
        return <AlertCircle className="w-5 h-5 text-yellow-500" aria-hidden="true" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" aria-hidden="true" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-md mx-auto">
          <Lock className="w-12 h-12 mx-auto text-yellow-500 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">Authentication Required</h3>
          <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            Please sign in to access the data validation dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            You do not have permission to access the data validation dashboard.
            <br />
            Your role: <strong>{user?.role}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Validation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor data integrity across all modules
          </p>
        </div>
        <button
          onClick={runValidation}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Run Full Validation
        </button>
      </div>

      {/* Last Run Timestamp */}
      {lastRun && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Clock className="w-4 h-4" aria-hidden="true" />
          <span>Last run: {lastRun.toLocaleString()}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Checks</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {summary.total}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Passing</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {summary.passing}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Warnings</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
            {summary.warnings}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Failures</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {summary.failures}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {(Object.keys(categoryLabels) as ValidationCategory[]).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600" aria-hidden="true" />
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No validation results available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Check Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredResults.map((result, idx) => (
                  <>
                    <tr
                      key={`${result.check_name}-${idx}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusIcon(result.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {result.check_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[result.category]}`}>
                          {categoryLabels[result.category]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {result.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {result.count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {result.details && result.details.length > 0 && (
                          <button
                            onClick={() => toggleRow(result.check_name)}
                            className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                          >
                            {expandedRows.has(result.check_name) ? (
                              <>
                                <ChevronDown className="w-4 h-4" aria-hidden="true" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                Show
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedRows.has(result.check_name) && result.details && (
                      <tr key={`${result.check_name}-${idx}-details`}>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                          <div className="max-h-64 overflow-y-auto">
                            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
