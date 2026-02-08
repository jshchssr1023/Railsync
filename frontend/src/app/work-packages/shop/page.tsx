'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Package, Calendar, Eye, Wrench } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import WorkPackageDetail from '@/components/work-packages/WorkPackageDetail';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkPackage {
  id: string;
  package_number: string;
  version: number;
  car_number: string;
  project_name: string;
  project_type: string;
  status: string;
  issued_date: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  issued: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

const AUTO_REFRESH_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('railsync_access_token');
}

function formatDate(iso: string): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShopWorkPackagesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [packages, setPackages] = useState<WorkPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchPackages = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/work-packages/shop`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load work packages');
      }

      setPackages(json.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchPackages();
    }
  }, [isAuthenticated, fetchPackages]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchPackages();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchPackages]);

  // ── Auth guard ───────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Please sign in to view work packages
        </h2>
      </div>
    );
  }

  // ── Detail overlay ──────────────────────────────────────────────────────
  if (selectedId) {
    return (
      <WorkPackageDetail
        id={selectedId}
        onClose={() => setSelectedId(null)}
        readOnly
      />
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchPackages(); }}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────
  const shopName = user?.shop_code ?? 'Shop';
  const activeCount = packages.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Wrench className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Shop Portal
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 ml-10">
          {shopName}
        </p>
      </div>

      {/* ── Summary bar ────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700">
        <Package className="w-4 h-4 text-primary-500" />
        <span className="font-medium">
          {activeCount} active {activeCount === 1 ? 'package' : 'packages'}
        </span>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {activeCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
            No work packages assigned to your shop yet
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Packages will appear here once they are issued to {shopName}.
          </p>
        </div>
      ) : (
        /* ── Card grid ───────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => {
            const statusClasses =
              STATUS_COLORS[pkg.status] ??
              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

            return (
              <div
                key={pkg.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
              >
                {/* Top section */}
                <div>
                  {/* Package number + version badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      {pkg.package_number}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusClasses}`}>
                      v{pkg.version}
                    </span>
                  </div>

                  {/* Car number (prominent) */}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {pkg.car_number}
                  </h3>

                  {/* Project name + type */}
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {pkg.project_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {pkg.project_type}
                  </p>

                  {/* Issued date */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Issued {formatDate(pkg.issued_date)}</span>
                  </div>
                </div>

                {/* View Details button */}
                <button
                  onClick={() => setSelectedId(pkg.id)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors border border-primary-200 dark:border-primary-800"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
