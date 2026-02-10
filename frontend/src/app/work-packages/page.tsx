'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search, X, Loader2, Plus, ChevronLeft, ChevronRight,
  Package, FileText, Eye,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import WorkPackageDetail from '@/components/work-packages/WorkPackageDetail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WorkPackage {
  id: string;
  package_number: string;
  version: number;
  car_number: string;
  shop_code: string;
  project_id: string | null;
  project_number: string | null;
  project_name: string | null;
  lessee_name: string | null;
  status: string;
  document_count: number;
  special_instructions: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkPackageSummary {
  total: number;
  draft: number;
  assembled: number;
  issued: number;
  superseded: number;
}

interface ActiveProject {
  id: string;
  project_number: string;
  project_name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const PAGE_SIZE = 50;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  assembled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  issued: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  superseded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const STATUS_OPTIONS = ['all', 'draft', 'assembled', 'issued', 'superseded'] as const;

// ---------------------------------------------------------------------------
// Suspense wrapper (matches project page pattern)
// ---------------------------------------------------------------------------
export default function WorkPackagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      }
    >
      <WorkPackagesContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Main content component
// ---------------------------------------------------------------------------
function WorkPackagesContent() {
  const { getAccessToken } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();

  // Data
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [summary, setSummary] = useState<WorkPackageSummary | null>(null);
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [shopCodeFilter, setShopCodeFilter] = useState('');
  const [offset, setOffset] = useState(0);

  // Detail slide-over
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Composer modal
  const [showComposer, setShowComposer] = useState(false);
  const [composerForm, setComposerForm] = useState({
    project_id: '',
    car_number: '',
    shop_code: '',
    special_instructions: '',
  });
  const [composerLoading, setComposerLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch helpers
  // -------------------------------------------------------------------------
  const fetchWorkPackages = useCallback(async () => {
    try {
      const token = getAccessToken();
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (projectFilter) params.append('project_id', projectFilter);
      if (shopCodeFilter.trim()) params.append('shop_code', shopCodeFilter.trim());
      params.append('limit', String(PAGE_SIZE));
      params.append('offset', String(offset));

      const res = await fetch(`${API_URL}/work-packages?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setWorkPackages(data.data);
        setTotal(data.meta?.total ?? data.data.length);
      }
    } catch (err) {
      console.error('Failed to fetch work packages:', err);
    }
  }, [getAccessToken, statusFilter, searchTerm, projectFilter, shopCodeFilter, offset]);

  const fetchSummary = useCallback(async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/work-packages/summary`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } catch (err) {
      console.error('Failed to fetch work-packages summary:', err);
    }
  }, [getAccessToken]);

  const fetchActiveProjects = useCallback(async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/projects?status=active`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setActiveProjects(data.data);
    } catch (err) {
      console.error('Failed to fetch active projects:', err);
    }
  }, [getAccessToken]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchWorkPackages(), fetchSummary(), fetchActiveProjects()]);
    setLoading(false);
  }, [fetchWorkPackages, fetchSummary, fetchActiveProjects]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch when filters change (reset offset)
  useEffect(() => {
    setOffset(0);
  }, [statusFilter, searchTerm, projectFilter, shopCodeFilter]);

  // -------------------------------------------------------------------------
  // Composer: create draft work package
  // -------------------------------------------------------------------------
  const handleCreateDraft = async () => {
    if (!composerForm.car_number.trim() || !composerForm.shop_code.trim()) return;
    setComposerLoading(true);
    try {
      const token = getAccessToken();
      const body: Record<string, string> = {
        car_number: composerForm.car_number.trim(),
        shop_code: composerForm.shop_code.trim(),
      };
      if (composerForm.project_id) body.project_id = composerForm.project_id;
      if (composerForm.special_instructions.trim()) {
        body.special_instructions = composerForm.special_instructions.trim();
      }

      const res = await fetch(`${API_URL}/work-packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Work package created', `Draft ${data.data?.package_number ?? ''} created`);
        setShowComposer(false);
        setComposerForm({ project_id: '', car_number: '', shop_code: '', special_instructions: '' });
        fetchData();
      } else {
        toast.error('Failed to create work package', data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to create work package:', err);
      toast.error('Failed to create work package');
    } finally {
      setComposerLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      { label: 'Total', value: summary.total, color: 'text-gray-900 dark:text-gray-100', filterValue: 'all' },
      { label: 'Draft', value: summary.draft, color: 'text-gray-600 dark:text-gray-400', filterValue: 'draft' },
      { label: 'Assembled', value: summary.assembled, color: 'text-blue-600 dark:text-blue-400', filterValue: 'assembled' },
      { label: 'Issued', value: summary.issued, color: 'text-green-600 dark:text-green-400', filterValue: 'issued' },
    ];
  }, [summary]);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, total);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mt-4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Work Packages
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Deliverable packages sent to shops
            </p>
          </div>
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Work Package
          </button>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Summary Cards                                                     */}
        {/* ----------------------------------------------------------------- */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                onClick={() => setStatusFilter(card.filterValue)}
                className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all border ${statusFilter === card.filterValue ? 'border-primary-500 ring-1 ring-primary-500' : 'border-transparent'}`}
              >
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {card.label}
                </div>
                <div className={`mt-1 text-2xl font-bold ${card.color}`}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Filter Bar                                                        */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow space-y-4">
          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Search + Project + Shop Code */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-md">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Search
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Package number, car number..."
                  className="w-full pl-9 pr-8 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                  >
                    <X className="w-3 h-3 text-gray-400" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Project dropdown */}
            <div className="min-w-[180px]">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Project
              </label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="">All Projects</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_number} - {p.project_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shop code */}
            <div className="min-w-[140px]">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Shop Code
              </label>
              <input
                type="text"
                value={shopCodeFilter}
                onChange={(e) => setShopCodeFilter(e.target.value)}
                placeholder="e.g. HAYS"
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Count */}
            <div className="ml-auto text-sm text-gray-500 dark:text-gray-400 self-end pb-1">
              {total} package{total !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Data Table (desktop)                                              */}
        {/* ----------------------------------------------------------------- */}
        <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Package #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Car
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Shop
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Lessee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Documents
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Issued Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {workPackages.map((wp) => (
                  <tr
                    key={wp.id}
                    onClick={() => setSelectedId(wp.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedId === wp.id
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {wp.package_number}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      v{wp.version}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {wp.car_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {wp.shop_code}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {wp.project_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {wp.lessee_name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLORS[wp.status] || STATUS_COLORS.draft
                        }`}
                      >
                        {wp.status.charAt(0).toUpperCase() + wp.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                        {wp.document_count}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(wp.issued_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(wp.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
                {workPackages.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                        <p className="text-sm">
                          {searchTerm || statusFilter !== 'all' || projectFilter || shopCodeFilter
                            ? 'No work packages match your filters'
                            : 'No work packages found'}
                        </p>
                        {!searchTerm && statusFilter === 'all' && !projectFilter && !shopCodeFilter && (
                          <button
                            onClick={() => setShowComposer(true)}
                            className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            Create your first work package
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {showingFrom} to {showingTo} of {total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Mobile Cards                                                      */}
        {/* ----------------------------------------------------------------- */}
        <div className="md:hidden space-y-3">
          {workPackages.map((wp) => (
            <div
              key={wp.id}
              onClick={() => setSelectedId(wp.id)}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer transition-colors ${
                selectedId === wp.id
                  ? 'ring-2 ring-primary-500'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {wp.package_number}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    v{wp.version}
                  </div>
                </div>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    STATUS_COLORS[wp.status] || STATUS_COLORS.draft
                  }`}
                >
                  {wp.status.charAt(0).toUpperCase() + wp.status.slice(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Car: </span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {wp.car_number}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Shop: </span>
                  <span className="text-gray-900 dark:text-gray-100">{wp.shop_code}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Project: </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {wp.project_number || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Lessee: </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {wp.lessee_name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Docs: </span>
                  <span className="text-gray-900 dark:text-gray-100">{wp.document_count}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Issued: </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {formatDate(wp.issued_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {workPackages.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" aria-hidden="true" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm || statusFilter !== 'all' || projectFilter || shopCodeFilter
                  ? 'No work packages match your filters'
                  : 'No work packages found'}
              </p>
            </div>
          )}

          {/* Mobile pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {showingFrom}-{showingTo} of {total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Detail Slide-over                                                 */}
        {/* ----------------------------------------------------------------- */}
        {selectedId && (
          <WorkPackageDetail
            id={selectedId}
            onClose={() => setSelectedId(null)}
            onUpdate={fetchData}
          />
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Composer Modal                                                    */}
        {/* ----------------------------------------------------------------- */}
        {showComposer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowComposer(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                New Work Package
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create a new draft work package for a car at a shop.
              </p>

              {/* Project (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project
                </label>
                <select
                  value={composerForm.project_id}
                  onChange={(e) =>
                    setComposerForm({ ...composerForm, project_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                >
                  <option value="">No project (standalone)</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_number} - {p.project_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Car number (required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Car Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={composerForm.car_number}
                  onChange={(e) =>
                    setComposerForm({ ...composerForm, car_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 font-mono"
                  placeholder="e.g. ACFX072050"
                />
              </div>

              {/* Shop code (required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Shop Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={composerForm.shop_code}
                  onChange={(e) =>
                    setComposerForm({ ...composerForm, shop_code: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  placeholder="e.g. HAYS"
                />
              </div>

              {/* Special instructions (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Special Instructions
                </label>
                <textarea
                  value={composerForm.special_instructions}
                  onChange={(e) =>
                    setComposerForm({
                      ...composerForm,
                      special_instructions: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  placeholder="Any special handling or notes for the shop..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowComposer(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDraft}
                  disabled={
                    composerLoading ||
                    !composerForm.car_number.trim() ||
                    !composerForm.shop_code.trim()
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {composerLoading && (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  )}
                  Create Draft
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
