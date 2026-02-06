'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, FileText, ChevronRight } from 'lucide-react';
import { listShoppingEvents, createShoppingEvent, createBatchShoppingEvents } from '@/lib/api';
import { ShoppingEvent, ShoppingEventState } from '@/types';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// State color mapping
// ---------------------------------------------------------------------------
const STATE_COLORS: Record<string, string> = {
  REQUESTED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  ASSIGNED_TO_SHOP: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  INBOUND: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  INSPECTION: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  ESTIMATE_SUBMITTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ESTIMATE_UNDER_REVIEW: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ESTIMATE_APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CHANGES_REQUIRED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  WORK_AUTHORIZED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  IN_REPAIR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  QA_COMPLETE: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  FINAL_ESTIMATE_SUBMITTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  FINAL_ESTIMATE_APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  READY_FOR_RELEASE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  RELEASED: 'bg-green-200 text-green-900 dark:bg-green-900/50 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

// Friendly display labels for each state
const STATE_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  ASSIGNED_TO_SHOP: 'Assigned to Shop',
  INBOUND: 'Inbound',
  INSPECTION: 'Inspection',
  ESTIMATE_SUBMITTED: 'Estimate Submitted',
  ESTIMATE_UNDER_REVIEW: 'Estimate Under Review',
  ESTIMATE_APPROVED: 'Estimate Approved',
  CHANGES_REQUIRED: 'Changes Required',
  WORK_AUTHORIZED: 'Work Authorized',
  IN_REPAIR: 'In Repair',
  QA_COMPLETE: 'QA Complete',
  FINAL_ESTIMATE_SUBMITTED: 'Final Estimate Submitted',
  FINAL_ESTIMATE_APPROVED: 'Final Estimate Approved',
  READY_FOR_RELEASE: 'Ready for Release',
  RELEASED: 'Released',
  CANCELLED: 'Cancelled',
};

// Filter pill states shown in the filter bar
const FILTER_STATES: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'IN_REPAIR', label: 'In Repair' },
  { value: 'QA_COMPLETE', label: 'QA Complete' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// Page size for pagination
const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Top-level page component with Suspense boundary
// ---------------------------------------------------------------------------
export default function ShoppingPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading...</div>}>
      <ShoppingContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Inner content component (uses useSearchParams)
// ---------------------------------------------------------------------------
function ShoppingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // --- Data state ---
  const [events, setEvents] = useState<ShoppingEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter state ---
  const [stateFilter, setStateFilter] = useState<string>(searchParams.get('state') || '');
  const [shopCodeFilter, setShopCodeFilter] = useState<string>(searchParams.get('shop') || '');
  const [carNumberFilter, setCarNumberFilter] = useState<string>(searchParams.get('car') || '');

  // --- Pagination ---
  const [page, setPage] = useState(1);

  // --- Form visibility ---
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);

  // --- Create form state ---
  const [createCarNumber, setCreateCarNumber] = useState('');
  const [createShopCode, setCreateShopCode] = useState('');
  const [createTypeCode, setCreateTypeCode] = useState('');
  const [createReasonCode, setCreateReasonCode] = useState('');
  const [creating, setCreating] = useState(false);

  // --- Batch form state ---
  const [batchShopCode, setBatchShopCode] = useState('');
  const [batchTypeCode, setBatchTypeCode] = useState('');
  const [batchReasonCode, setBatchReasonCode] = useState('');
  const [batchCarNumbers, setBatchCarNumbers] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [batchCreating, setBatchCreating] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch shopping events
  // -------------------------------------------------------------------------
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listShoppingEvents({
        state: stateFilter || undefined,
        shop_code: shopCodeFilter || undefined,
        car_number: carNumberFilter || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setEvents(result.events);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shopping events');
    } finally {
      setLoading(false);
    }
  }, [stateFilter, shopCodeFilter, carNumberFilter, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [stateFilter, shopCodeFilter, carNumberFilter]);

  // -------------------------------------------------------------------------
  // Stats summary - count events by state groupings
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const inRepair = events.filter(e => e.state === 'IN_REPAIR').length;
    const awaitingQA = events.filter(e =>
      e.state === 'QA_COMPLETE' || e.state === 'FINAL_ESTIMATE_SUBMITTED' || e.state === 'FINAL_ESTIMATE_APPROVED'
    ).length;
    const readyForRelease = events.filter(e => e.state === 'READY_FOR_RELEASE').length;
    const requested = events.filter(e => e.state === 'REQUESTED' || e.state === 'ASSIGNED_TO_SHOP').length;
    const inbound = events.filter(e => e.state === 'INBOUND' || e.state === 'INSPECTION').length;
    const released = events.filter(e => e.state === 'RELEASED').length;

    return [
      { label: 'Total', value: total, color: 'text-gray-900 dark:text-gray-100', bgColor: 'bg-gray-100 dark:bg-gray-700' },
      { label: 'Requested', value: requested, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
      { label: 'Inbound', value: inbound, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20' },
      { label: 'In Repair', value: inRepair, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
      { label: 'Awaiting QA', value: awaitingQA, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-900/20' },
      { label: 'Ready for Release', value: readyForRelease, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' },
      { label: 'Released', value: released, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20' },
    ];
  }, [events, total]);

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // -------------------------------------------------------------------------
  // Create single shopping event
  // -------------------------------------------------------------------------
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createShoppingEvent({
        car_number: createCarNumber.trim(),
        shop_code: createShopCode.trim(),
        shopping_type_code: createTypeCode.trim() || undefined,
        shopping_reason_code: createReasonCode.trim() || undefined,
      });
      // Reset form
      setCreateCarNumber('');
      setCreateShopCode('');
      setCreateTypeCode('');
      setCreateReasonCode('');
      setShowCreateForm(false);
      fetchEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create shopping event');
    } finally {
      setCreating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Create batch shopping events
  // -------------------------------------------------------------------------
  const handleBatchCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchCreating(true);
    try {
      const carNumbers = batchCarNumbers
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      if (carNumbers.length === 0) {
        toast.warning('Please enter at least one car number');
        setBatchCreating(false);
        return;
      }

      await createBatchShoppingEvents({
        shop_code: batchShopCode.trim(),
        shopping_type_code: batchTypeCode.trim() || undefined,
        shopping_reason_code: batchReasonCode.trim() || undefined,
        car_numbers: carNumbers,
        notes: batchNotes.trim() || undefined,
      });
      // Reset form
      setBatchShopCode('');
      setBatchTypeCode('');
      setBatchReasonCode('');
      setBatchCarNumbers('');
      setBatchNotes('');
      setShowBatchForm(false);
      fetchEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create batch shopping events');
    } finally {
      setBatchCreating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                             */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shopping Events</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage car shopping events through the repair lifecycle
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/shopping/new')}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
          >
            + New Shopping Request
          </button>
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setShowBatchForm(false); }}
            className="px-4 py-2 border border-primary-600 text-primary-600 dark:text-primary-400 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 text-sm font-medium"
          >
            Quick Event
          </button>
          <button
            onClick={() => { setShowBatchForm(!showBatchForm); setShowCreateForm(false); }}
            className="px-4 py-2 bg-primary-700 text-white rounded-md hover:bg-primary-800 text-sm font-medium"
          >
            Batch Shop
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Create Form (inline)                                               */}
      {/* ----------------------------------------------------------------- */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="card p-4 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Shopping Event</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Car Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={createCarNumber}
                onChange={(e) => setCreateCarNumber(e.target.value)}
                placeholder="e.g. GATX 12345"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shop Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={createShopCode}
                onChange={(e) => setCreateShopCode(e.target.value)}
                placeholder="e.g. SHOP-001"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shopping Type Code
              </label>
              <input
                type="text"
                value={createTypeCode}
                onChange={(e) => setCreateTypeCode(e.target.value)}
                placeholder="Optional"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shopping Reason Code
              </label>
              <input
                type="text"
                value={createReasonCode}
                onChange={(e) => setCreateReasonCode(e.target.value)}
                placeholder="Optional"
                className="input w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
            >
              {creating ? 'Creating...' : 'Create Shopping Event'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Batch Form (inline)                                                */}
      {/* ----------------------------------------------------------------- */}
      {showBatchForm && (
        <form onSubmit={handleBatchCreate} className="card p-4 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Batch Shopping Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shop Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={batchShopCode}
                onChange={(e) => setBatchShopCode(e.target.value)}
                placeholder="e.g. SHOP-001"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shopping Type Code
              </label>
              <input
                type="text"
                value={batchTypeCode}
                onChange={(e) => setBatchTypeCode(e.target.value)}
                placeholder="Optional"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shopping Reason Code
              </label>
              <input
                type="text"
                value={batchReasonCode}
                onChange={(e) => setBatchReasonCode(e.target.value)}
                placeholder="Optional"
                className="input w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Car Numbers <span className="text-red-500">*</span>
              <span className="font-normal text-gray-500 dark:text-gray-400 ml-1">(one per line)</span>
            </label>
            <textarea
              required
              rows={5}
              value={batchCarNumbers}
              onChange={(e) => setBatchCarNumbers(e.target.value)}
              placeholder={"GATX 12345\nGATX 12346\nGATX 12347"}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              placeholder="Optional notes for this batch"
              className="input w-full"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={batchCreating}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
            >
              {batchCreating ? 'Creating...' : 'Create Batch'}
            </button>
            <button
              type="button"
              onClick={() => setShowBatchForm(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Filter Bar                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="card p-4 space-y-4">
        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2">
          {FILTER_STATES.map((fs) => (
            <button
              key={fs.value}
              onClick={() => setStateFilter(fs.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                stateFilter === fs.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {fs.label}
            </button>
          ))}
        </div>

        {/* Text filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Shop Code</label>
            <input
              type="text"
              value={shopCodeFilter}
              onChange={(e) => setShopCodeFilter(e.target.value)}
              placeholder="Filter by shop code..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Car Number</label>
            <input
              type="text"
              value={carNumberFilter}
              onChange={(e) => setCarNumberFilter(e.target.value)}
              placeholder="Filter by car number..."
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Stats Summary                                                      */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bgColor} rounded-lg p-3 text-center`}
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Error state                                                        */}
      {/* ----------------------------------------------------------------- */}
      {error && (
        <div className="card p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={fetchEvents}
              className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Loading state                                                      */}
      {/* ----------------------------------------------------------------- */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin h-8 w-8 text-primary-600" aria-hidden="true" />
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Empty state                                                        */}
      {/* ----------------------------------------------------------------- */}
      {!loading && !error && events.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
          <p>No shopping events found</p>
          <p className="text-sm mt-1">Create one using the button above, or adjust your filters</p>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Shopping Events List                                               */}
      {/* ----------------------------------------------------------------- */}
      {!loading && !error && events.length > 0 && (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              onClick={() => router.push(`/shopping/${event.id}`)}
              className="card p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <div className="flex items-start justify-between">
                {/* Left side: event details */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                      {event.event_number}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATE_COLORS[event.state] || 'bg-gray-100 text-gray-800'}`}>
                      {STATE_LABELS[event.state] || event.state}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Car:</span>{' '}
                      {event.car_number}
                    </span>
                    <span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Shop:</span>{' '}
                      {event.shop_name || event.shop_code}
                    </span>
                    {event.batch_number && (
                      <span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Batch:</span>{' '}
                        {event.batch_number}
                      </span>
                    )}
                  </div>

                  {/* Type and reason codes */}
                  {(event.shopping_type_code || event.shopping_reason_code) && (
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {event.shopping_type_code && (
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          Type: {event.shopping_type_code}
                        </span>
                      )}
                      {event.shopping_reason_code && (
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          Reason: {event.shopping_reason_code}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side: date and chevron */}
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(event.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400" aria-hidden="true" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Pagination                                                         */}
      {/* ----------------------------------------------------------------- */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total} events
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
