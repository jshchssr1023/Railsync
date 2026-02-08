'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  listMasterPlans,
  createMasterPlan,
  duplicatePlan,
  transitionPlanStatus,
  getCapacityFit,
  getPlanStats,
  listPlanAllocations,
} from '@/lib/api';
import type {
  MasterPlan,
  PlanLifecycleStatus,
  CapacityFitResult,
  CapacityFitLevel,
  Allocation,
} from '@/types';
import {
  Plus,
  Copy,
  Archive,
  Search,
  X,
  LayoutGrid,
  Lock,
  Send,
  FileCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Package,
  BarChart3,
  Users,
  MapPin,
  Calendar,
  ArrowUpRight,
  Pencil,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_BUCKETS: { key: string; label: string; icon: React.ReactNode; statuses: PlanLifecycleStatus[] }[] = [
  {
    key: 'open',
    label: 'Open Plans',
    icon: <Pencil className="w-4 h-4" />,
    statuses: ['draft', 'soft_plan'],
  },
  {
    key: 'pending',
    label: 'Pending Commitment',
    icon: <Clock className="w-4 h-4" />,
    statuses: ['locked', 'pending_commitment'],
  },
  {
    key: 'committed',
    label: 'Committed Plans',
    icon: <CheckCircle2 className="w-4 h-4" />,
    statuses: ['committed'],
  },
  {
    key: 'archived',
    label: 'Archived Plans',
    icon: <Archive className="w-4 h-4" />,
    statuses: ['archived'],
  },
];

const LIFECYCLE_LABELS: Record<PlanLifecycleStatus, string> = {
  draft: 'Draft',
  soft_plan: 'Soft Plan',
  locked: 'Locked',
  pending_commitment: 'Pending',
  committed: 'Committed',
  archived: 'Archived',
};

const LIFECYCLE_COLORS: Record<PlanLifecycleStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  soft_plan: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  locked: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending_commitment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  committed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

const CAPACITY_FIT_COLORS: Record<CapacityFitLevel, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const CAPACITY_FIT_LABELS: Record<CapacityFitLevel, string> = {
  green: 'Fits',
  yellow: 'Tight',
  red: 'Overloaded',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (val?: number) => {
  if (!val && val !== 0) return '-';
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
};

const formatMonth = (month: string) => {
  if (!month) return '-';
  const [year, m] = month.split('-');
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatRelativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MasterPlansPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();

  // Data
  const [plans, setPlans] = useState<MasterPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBucket, setActiveBucket] = useState('open');
  const [capacityMap, setCapacityMap] = useState<Record<string, CapacityFitResult>>({});

  // Drawer
  const [drawerPlan, setDrawerPlan] = useState<MasterPlan | null>(null);
  const [drawerStats, setDrawerStats] = useState<DrawerStats | null>(null);
  const [drawerAllocations, setDrawerAllocations] = useState<Allocation[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState<MasterPlan | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<MasterPlan | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchPlans = useCallback(async () => {
    try {
      const data = await listMasterPlans();
      setPlans(data);
    } catch {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAuthenticated) fetchPlans();
  }, [isAuthenticated, fetchPlans]);

  // Load capacity fit scores for visible plans
  useEffect(() => {
    if (plans.length === 0) return;
    const activePlans = plans.filter(p => p.status !== 'archived').slice(0, 20);
    const loadCapacity = async () => {
      const results = await Promise.allSettled(
        activePlans.map(p => getCapacityFit(p.id).then(r => ({ planId: p.id, result: r })))
      );
      const newMap: Record<string, CapacityFitResult> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          newMap[r.value.planId] = r.value.result;
        }
      }
      setCapacityMap(prev => ({ ...prev, ...newMap }));
    };
    loadCapacity();
  }, [plans]);

  // Drawer data
  const openDrawer = useCallback(async (plan: MasterPlan) => {
    setDrawerPlan(plan);
    setDrawerLoading(true);
    try {
      const [stats, allocs] = await Promise.all([
        getPlanStats(plan.id),
        listPlanAllocations(plan.id),
      ]);
      setDrawerStats(stats as DrawerStats);
      setDrawerAllocations(allocs);
    } catch {
      // Silent fail
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  const activeBucketConfig = STATUS_BUCKETS.find(b => b.key === activeBucket)!;

  const bucketCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const bucket of STATUS_BUCKETS) {
      counts[bucket.key] = plans.filter(p => bucket.statuses.includes(p.status)).length;
    }
    return counts;
  }, [plans]);

  const filteredPlans = useMemo(() => {
    let result = plans.filter(p => activeBucketConfig.statuses.includes(p.status));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.project_name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [plans, activeBucketConfig, searchQuery]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreatePlan = async (data: { name: string; description?: string; fiscal_year: number; planning_month: string }) => {
    try {
      const plan = await createMasterPlan(data);
      setPlans(prev => [plan, ...prev]);
      setShowCreateModal(false);
      toast.success('Plan created');
      router.push(`/plans/${plan.id}`);
    } catch {
      toast.error('Failed to create plan');
    }
  };

  const handleDuplicate = async (plan: MasterPlan, newName: string) => {
    try {
      const dup = await duplicatePlan(plan.id, newName);
      setPlans(prev => [dup, ...prev]);
      setShowDuplicateModal(null);
      toast.success('Plan duplicated');
    } catch {
      toast.error('Failed to duplicate plan');
    }
  };

  const handleArchive = async () => {
    if (!confirmArchive) return;
    try {
      await transitionPlanStatus(confirmArchive.id, 'archived');
      setPlans(prev => prev.map(p => p.id === confirmArchive.id ? { ...p, status: 'archived' as PlanLifecycleStatus } : p));
      if (drawerPlan?.id === confirmArchive.id) setDrawerPlan(null);
      toast.success('Plan archived');
    } catch {
      toast.error('Failed to archive plan');
    } finally {
      setConfirmArchive(null);
    }
  };

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--color-text-tertiary)]">Please sign in to view master plans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Master Plans</h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Portfolio management for planning cycles &mdash; build, validate, and commit
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      {/* Status Buckets */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_BUCKETS.map(bucket => (
          <button
            key={bucket.key}
            onClick={() => setActiveBucket(bucket.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeBucket === bucket.key
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {bucket.icon}
            {bucket.label}
            <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
              activeBucket === bucket.key ? 'bg-blue-200 dark:bg-blue-800' : 'bg-[var(--color-bg-tertiary)]'
            }`}>
              {bucketCounts[bucket.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search plans by name or project..."
          className="w-full pl-10 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-lg
                     bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]
                     placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Plans Table */}
        <div className={`flex-1 min-w-0 transition-all ${drawerPlan ? 'max-w-[calc(100%-420px)]' : ''}`}>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-[var(--color-text-tertiary)]">Loading plans...</div>
            ) : filteredPlans.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
                <p className="text-[var(--color-text-tertiary)] mb-2">
                  {searchQuery ? 'No plans match your search' : `No ${activeBucketConfig.label.toLowerCase()}`}
                </p>
                {!searchQuery && activeBucket === 'open' && (
                  <button onClick={() => setShowCreateModal(true)} className="text-sm text-blue-600 hover:underline">
                    Create your first plan
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">Plan</th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">Project</th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">Cars</th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">Target Shops</th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">Est. Start</th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">Est. Completion</th>
                      <th className="text-center py-3 px-4 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">Capacity Fit</th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {filteredPlans.map(plan => {
                      const cap = capacityMap[plan.id];
                      const capLevel = cap?.level || plan.capacity_fit_level;
                      const capScore = cap?.overall_score ?? plan.capacity_fit_score;
                      return (
                        <tr
                          key={plan.id}
                          onClick={() => openDrawer(plan)}
                          className={`cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)] ${
                            drawerPlan?.id === plan.id ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-[var(--color-text-primary)]">{plan.name}</div>
                            <div className="text-xs text-[var(--color-text-tertiary)]">
                              {formatMonth(plan.planning_month)} &middot; FY{plan.fiscal_year}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                            {plan.project_name || plan.project_number || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${LIFECYCLE_COLORS[plan.status]}`}>
                              {plan.status === 'locked' && <Lock className="w-3 h-3" />}
                              {plan.status === 'committed' && <CheckCircle2 className="w-3 h-3" />}
                              {LIFECYCLE_LABELS[plan.status]}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-[var(--color-text-primary)]">
                            {plan.current_allocation_count || 0}
                          </td>
                          <td className="py-3 px-4">
                            {plan.target_shops && plan.target_shops.length > 0 ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                                <span className="text-[var(--color-text-secondary)] text-xs">
                                  {plan.target_shops.length > 2
                                    ? `${plan.target_shops.slice(0, 2).join(', ')} +${plan.target_shops.length - 2}`
                                    : plan.target_shops.join(', ')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[var(--color-text-tertiary)] text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[var(--color-text-secondary)]">{formatDate(plan.est_start_date)}</td>
                          <td className="py-3 px-4 text-[var(--color-text-secondary)]">{formatDate(plan.est_completion_date)}</td>
                          <td className="py-3 px-4 text-center">
                            {capLevel ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${CAPACITY_FIT_COLORS[capLevel]}`}>
                                {capLevel === 'green' && <CheckCircle2 className="w-3 h-3" />}
                                {capLevel !== 'green' && <AlertTriangle className="w-3 h-3" />}
                                {CAPACITY_FIT_LABELS[capLevel]}
                                {capScore !== undefined && <span className="ml-0.5">({capScore})</span>}
                              </span>
                            ) : (
                              <span className="text-[var(--color-text-tertiary)] text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => router.push(`/plans/${plan.id}`)}
                                className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                title="Open workspace"
                              >
                                <ArrowUpRight className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setShowDuplicateModal(plan)}
                                className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                                title="Duplicate plan"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              {plan.status !== 'archived' && plan.status !== 'committed' && (
                                <button
                                  onClick={() => setConfirmArchive(plan)}
                                  className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                  title="Archive plan"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Plan Detail Drawer */}
        {drawerPlan && (
          <PlanDetailDrawer
            plan={drawerPlan}
            stats={drawerStats}
            allocations={drawerAllocations}
            loading={drawerLoading}
            capacityFit={capacityMap[drawerPlan.id]}
            onClose={() => setDrawerPlan(null)}
            onOpenWorkspace={() => router.push(`/plans/${drawerPlan.id}`)}
            onDuplicate={() => setShowDuplicateModal(drawerPlan)}
            onTransition={async (status) => {
              try {
                const updated = await transitionPlanStatus(drawerPlan.id, status);
                setPlans(prev => prev.map(p => p.id === drawerPlan.id ? { ...p, ...updated } : p));
                setDrawerPlan(prev => prev ? { ...prev, ...updated } : null);
                toast.success(`Plan ${LIFECYCLE_LABELS[status].toLowerCase()}`);
              } catch {
                toast.error('Failed to transition plan');
              }
            }}
          />
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreatePlanModal onClose={() => setShowCreateModal(false)} onSubmit={handleCreatePlan} />
      )}

      {showDuplicateModal && (
        <DuplicatePlanModal
          plan={showDuplicateModal}
          onClose={() => setShowDuplicateModal(null)}
          onSubmit={(newName) => handleDuplicate(showDuplicateModal, newName)}
        />
      )}

      <ConfirmDialog
        open={!!confirmArchive}
        title="Archive Plan"
        description={`Archive "${confirmArchive?.name}"? Archived plans cannot be edited but can still be viewed.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={handleArchive}
        onCancel={() => setConfirmArchive(null)}
      />
    </div>
  );
}

// ===========================================================================
// Types
// ===========================================================================

interface DrawerStats {
  total_allocations: number;
  assigned: number;
  unassigned: number;
  total_estimated_cost: number;
  planned_cost: number;
  committed_cost: number;
  by_status: { status: string; count: number; cost: number }[];
  by_shop: { shop_code: string; shop_name: string; count: number; cost: number }[];
}

// ===========================================================================
// Plan Detail Drawer
// ===========================================================================

function PlanDetailDrawer({
  plan,
  stats,
  allocations,
  loading,
  capacityFit,
  onClose,
  onOpenWorkspace,
  onDuplicate,
  onTransition,
}: {
  plan: MasterPlan;
  stats: DrawerStats | null;
  allocations: Allocation[];
  loading: boolean;
  capacityFit?: CapacityFitResult;
  onClose: () => void;
  onOpenWorkspace: () => void;
  onDuplicate: () => void;
  onTransition: (status: PlanLifecycleStatus) => void;
}) {
  const shopDistribution = useMemo(() => {
    if (!stats?.by_shop) return [];
    return stats.by_shop.filter(s => s.shop_code !== 'unassigned').sort((a, b) => b.count - a.count).slice(0, 6);
  }, [stats]);

  const timelineGroups = useMemo(() => {
    if (allocations.length === 0) return [];
    const groups: Record<string, { shop: string; count: number }> = {};
    for (const a of allocations) {
      const key = a.shop_code || 'Unassigned';
      if (!groups[key]) groups[key] = { shop: a.shop_name || a.shop_code || 'Unassigned', count: 0 };
      groups[key].count++;
    }
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [allocations]);

  const nextTransitions = useMemo((): { status: PlanLifecycleStatus; label: string; icon: React.ReactNode; variant: string }[] => {
    switch (plan.status) {
      case 'draft':
        return [{ status: 'soft_plan', label: 'Promote to Soft Plan', icon: <FileCheck className="w-4 h-4" />, variant: 'blue' }];
      case 'soft_plan':
        return [{ status: 'locked', label: 'Lock Plan', icon: <Lock className="w-4 h-4" />, variant: 'amber' }];
      case 'locked':
        return [
          { status: 'pending_commitment', label: 'Submit for Commitment', icon: <Send className="w-4 h-4" />, variant: 'orange' },
          { status: 'soft_plan', label: 'Unlock', icon: <Pencil className="w-4 h-4" />, variant: 'gray' },
        ];
      case 'pending_commitment':
        return [
          { status: 'committed', label: 'Commit Plan', icon: <CheckCircle2 className="w-4 h-4" />, variant: 'green' },
          { status: 'locked', label: 'Return to Locked', icon: <Lock className="w-4 h-4" />, variant: 'gray' },
        ];
      default:
        return [];
    }
  }, [plan.status]);

  return (
    <div className="w-[400px] shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center justify-between mb-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${LIFECYCLE_COLORS[plan.status]}`}>
            {plan.status === 'locked' && <Lock className="w-3 h-3" />}
            {plan.status === 'committed' && <CheckCircle2 className="w-3 h-3" />}
            {LIFECYCLE_LABELS[plan.status]}
          </span>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{plan.name}</h2>
        {plan.description && <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{plan.description}</p>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="py-8 text-center text-[var(--color-text-tertiary)]">Loading...</div>
        ) : (
          <>
            {/* Plan Summary */}
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Plan Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                <SummaryItem icon={<Calendar className="w-3.5 h-3.5" />} label="Period" value={`${formatMonth(plan.planning_month)} · FY${plan.fiscal_year}`} />
                <SummaryItem icon={<Users className="w-3.5 h-3.5" />} label="Created by" value={plan.created_by_name || '-'} />
                <SummaryItem icon={<Package className="w-3.5 h-3.5" />} label="Cars" value={String(stats?.total_allocations || plan.current_allocation_count || 0)} />
                <SummaryItem icon={<BarChart3 className="w-3.5 h-3.5" />} label="Est. Cost" value={formatCurrency(stats?.total_estimated_cost || plan.current_estimated_cost)} />
                <SummaryItem icon={<Clock className="w-3.5 h-3.5" />} label="Last Modified" value={formatRelativeTime(plan.updated_at)} />
                {plan.project_name && (
                  <SummaryItem icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Project" value={plan.project_name} />
                )}
              </div>
            </section>

            {/* Timeline Snapshot */}
            {timelineGroups.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Timeline Snapshot</h3>
                <div className="space-y-2">
                  {timelineGroups.slice(0, 5).map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-24 text-xs text-[var(--color-text-secondary)] truncate">{g.shop}</span>
                      <div className="flex-1 h-5 bg-[var(--color-bg-tertiary)] rounded overflow-hidden relative">
                        <div
                          className="h-full rounded bg-blue-500/70 dark:bg-blue-400/50"
                          style={{
                            width: stats?.total_allocations
                              ? `${Math.max(10, (g.count / stats.total_allocations) * 100)}%`
                              : '30%',
                          }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-[var(--color-text-primary)]">
                          {g.count} cars
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Shop Load Snapshot */}
            {shopDistribution.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Shop Load</h3>
                <div className="space-y-2">
                  {shopDistribution.map(s => {
                    const shopCap = capacityFit?.shops?.find(sc => sc.shop_code === s.shop_code);
                    const utilPct = shopCap?.utilization_pct || 0;
                    const barColor = utilPct > 90 ? 'bg-red-500' : utilPct > 70 ? 'bg-amber-500' : 'bg-green-500';
                    return (
                      <div key={s.shop_code} className="flex items-center gap-2">
                        <span className="w-20 text-xs text-[var(--color-text-secondary)] truncate">{s.shop_name || s.shop_code}</span>
                        <div className="flex-1 h-4 bg-[var(--color-bg-tertiary)] rounded overflow-hidden">
                          <div
                            className={`h-full rounded transition-all ${barColor}`}
                            style={{ width: `${Math.min(100, shopCap ? utilPct : (s.count / (stats?.total_allocations || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs text-[var(--color-text-tertiary)]">{s.count} cars</span>
                      </div>
                    );
                  })}
                </div>
                {capacityFit?.warnings && capacityFit.warnings.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {capacityFit.warnings.slice(0, 3).map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Capacity Fit Score */}
            {capacityFit && (
              <section>
                <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Capacity Fit</h3>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${CAPACITY_FIT_COLORS[capacityFit.level]}`}>
                    {capacityFit.overall_score}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">{CAPACITY_FIT_LABELS[capacityFit.level]}</div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">
                      {capacityFit.shops?.length || 0} shops &middot; {capacityFit.conflicts?.length || 0} conflicts
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-[var(--color-border)] space-y-2">
        <button
          onClick={onOpenWorkspace}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <ArrowUpRight className="w-4 h-4" />
          Open Workspace
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onDuplicate}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>
          {nextTransitions.map(t => (
            <button
              key={t.status}
              onClick={() => onTransition(t.status)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                t.variant === 'green' ? 'bg-green-600 text-white hover:bg-green-700'
                : t.variant === 'amber' ? 'bg-amber-600 text-white hover:bg-amber-700'
                : t.variant === 'orange' ? 'bg-orange-600 text-white hover:bg-orange-700'
                : t.variant === 'blue' ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {t.icon}
              <span className="truncate">{t.label.split(' ').slice(0, 2).join(' ')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-[var(--color-bg-secondary)]">
      <span className="text-[var(--color-text-tertiary)] mt-0.5">{icon}</span>
      <div>
        <div className="text-[10px] text-[var(--color-text-tertiary)] uppercase">{label}</div>
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{value}</div>
      </div>
    </div>
  );
}

// ===========================================================================
// Create Plan Modal
// ===========================================================================

function CreatePlanModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; fiscal_year: number; planning_month: string }) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await onSubmit({
        name: formData.get('name') as string,
        description: (formData.get('description') as string) || undefined,
        fiscal_year: parseInt(formData.get('fiscal_year') as string),
        planning_month: formData.get('planning_month') as string,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative rounded-xl shadow-xl max-w-md w-full p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Create Master Plan</h2>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Plan Name</label>
              <input name="name" type="text" required placeholder="e.g., March 2026 S&OP"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Planning Month</label>
                <input name="planning_month" type="month" required
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Fiscal Year</label>
                <input name="fiscal_year" type="number" required defaultValue={new Date().getFullYear()}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
              <textarea name="description" rows={2} placeholder="Optional description..."
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">Cancel</button>
              <button type="submit" disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Duplicate Plan Modal
// ===========================================================================

function DuplicatePlanModal({
  plan,
  onClose,
  onSubmit,
}: {
  plan: MasterPlan;
  onClose: () => void;
  onSubmit: (newName: string) => void;
}) {
  const [name, setName] = useState(`${plan.name} (Copy)`);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(name);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative rounded-xl shadow-xl max-w-md w-full p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Duplicate Plan</h2>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
            Creates a new draft plan with all allocations from &ldquo;{plan.name}&rdquo;.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">New Plan Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">Cancel</button>
              <button type="submit" disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Duplicating...' : 'Duplicate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
