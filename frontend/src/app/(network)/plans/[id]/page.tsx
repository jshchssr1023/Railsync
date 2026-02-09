'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import TypeaheadSearch from '@/components/TypeaheadSearch';
import {
  getMasterPlan,
  getPlanStats,
  listPlanAllocations,
  listPlanVersions,
  addCarsToPlan,
  removeAllocationFromPlan,
  assignShopToPlanAllocation,
  bulkAssignShop,
  transitionPlanStatus,
  getCapacityFit,
  getPlanConflicts,
  getNetworkLoadForecast,
  evaluateShops,
  searchCars,
  generatePlanSummary,
  importDemandsIntoPlan,
  listDemands,
  listScenarios,
  listPlanDemands,
  createDemandForPlan,
} from '@/lib/api';
import type {
  MasterPlan,
  PlanLifecycleStatus,
  Allocation,
  PlanVersion,
  CapacityFitResult,
  PlanConflict,
  NetworkLoadForecast,
  EvaluationResult,
  Demand,
  Scenario,
} from '@/types';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Wrench,
  Package,
  BarChart3,
  GitBranch,
  FileDown,
  X,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Send,
  FileCheck,
  Pencil,
  Calendar,
  ClipboardList,
  LayoutGrid,
  TrendingUp,
  Users,
  MapPin,
  Layers,
  GripVertical,
  Copy,
  Eye,
  Download,
  MessageSquare,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const LIFECYCLE_LABELS: Record<PlanLifecycleStatus, string> = {
  draft: 'Draft', soft_plan: 'Soft Plan', locked: 'Locked',
  pending_commitment: 'Pending Commitment', committed: 'Committed', archived: 'Archived',
};

const LIFECYCLE_COLORS: Record<PlanLifecycleStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  soft_plan: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  locked: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending_commitment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  committed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': case 'Planned Shopping': case 'Enroute': case 'Arrived':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'archived': case 'Complete': case 'Released':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
};

const isEditable = (status: PlanLifecycleStatus) => status === 'draft' || status === 'soft_plan';

// ---------------------------------------------------------------------------
// Color palette for Gantt bars
// ---------------------------------------------------------------------------
const GANTT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

// ---------------------------------------------------------------------------
// Main Workspace Page
// ---------------------------------------------------------------------------

export default function PlanWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const planId = params.id as string;

  // Plan data
  const [plan, setPlan] = useState<MasterPlan | null>(null);
  const [loading, setLoading] = useState(true);

  // Section data
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocsLoading, setAllocsLoading] = useState(false);
  const [stats, setStats] = useState<DrawerStats | null>(null);
  const [capacityFit, setCapacityFit] = useState<CapacityFitResult | null>(null);
  const [conflicts, setConflicts] = useState<PlanConflict[]>([]);
  const [networkLoad, setNetworkLoad] = useState<NetworkLoadForecast | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);

  // UI state
  const [activeSection, setActiveSection] = useState<'allocations' | 'timeline' | 'forecast'>('allocations');
  const [selectedAllocations, setSelectedAllocations] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'car_type' | 'shop' | 'status'>('car_type');
  const [showAddCarsModal, setShowAddCarsModal] = useState(false);
  const [showAssignShopModal, setShowAssignShopModal] = useState<Allocation | null>(null);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showConflictsPanel, setShowConflictsPanel] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Allocation | null>(null);

  // Forecast filters
  const [forecastShopFilter, setForecastShopFilter] = useState('');

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchPlan = useCallback(async () => {
    try {
      const data = await getMasterPlan(planId);
      setPlan(data);
    } catch {
      toast.error('Failed to load plan');
      router.push('/plans');
    } finally {
      setLoading(false);
    }
  }, [planId, toast, router]);

  const fetchAllocations = useCallback(async () => {
    setAllocsLoading(true);
    try {
      const data = await listPlanAllocations(planId);
      setAllocations(data);
    } catch {
      setAllocations([]);
    } finally {
      setAllocsLoading(false);
    }
  }, [planId]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getPlanStats(planId);
      setStats(data as DrawerStats);
    } catch { /* */ }
  }, [planId]);

  const fetchCapacity = useCallback(async () => {
    try {
      const [cap, conf] = await Promise.all([
        getCapacityFit(planId),
        getPlanConflicts(planId),
      ]);
      setCapacityFit(cap);
      setConflicts(conf);
    } catch { /* */ }
  }, [planId]);

  const fetchNetworkLoad = useCallback(async () => {
    try {
      const data = await getNetworkLoadForecast(planId, {
        shop_code: forecastShopFilter || undefined,
      });
      setNetworkLoad(data);
    } catch { /* */ }
  }, [planId, forecastShopFilter]);

  const fetchVersions = useCallback(async () => {
    try {
      const data = await listPlanVersions(planId);
      setVersions(data);
    } catch { /* */ }
  }, [planId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlan();
      fetchAllocations();
      fetchStats();
      fetchCapacity();
      fetchVersions();
    }
  }, [isAuthenticated, fetchPlan, fetchAllocations, fetchStats, fetchCapacity, fetchVersions]);

  useEffect(() => {
    if (activeSection === 'forecast') fetchNetworkLoad();
  }, [activeSection, fetchNetworkLoad]);

  const refreshAll = useCallback(() => {
    fetchAllocations();
    fetchStats();
    fetchCapacity();
  }, [fetchAllocations, fetchStats, fetchCapacity]);

  // ---------------------------------------------------------------------------
  // Grouped allocations
  // ---------------------------------------------------------------------------

  const groupedAllocations = useMemo(() => {
    const groups: Record<string, { label: string; allocations: Allocation[]; totalCost: number }> = {};
    for (const a of allocations) {
      let key: string;
      let label: string;
      switch (groupBy) {
        case 'shop':
          key = a.shop_code || 'unassigned';
          label = a.shop_name || a.shop_code || 'Unassigned';
          break;
        case 'status':
          key = a.status;
          label = a.status;
          break;
        default: // car_type
          key = a.car_type || 'Unknown';
          label = a.car_type || 'Unknown Type';
      }
      if (!groups[key]) groups[key] = { label, allocations: [], totalCost: 0 };
      groups[key].allocations.push(a);
      groups[key].totalCost += a.estimated_cost || 0;
    }
    return Object.entries(groups).sort((a, b) => b[1].allocations.length - a[1].allocations.length);
  }, [allocations, groupBy]);

  // ---------------------------------------------------------------------------
  // Gantt data
  // ---------------------------------------------------------------------------

  const ganttData = useMemo(() => {
    const groups: Record<string, { shop: string; count: number; color: string; startMonth?: string; endMonth?: string }> = {};
    let colorIdx = 0;
    for (const a of allocations) {
      const key = a.shop_code || 'Unassigned';
      if (!groups[key]) {
        groups[key] = { shop: a.shop_name || a.shop_code || 'Unassigned', count: 0, color: GANTT_COLORS[colorIdx++ % GANTT_COLORS.length] };
      }
      groups[key].count++;
      if (a.target_month) {
        if (!groups[key].startMonth || a.target_month < groups[key].startMonth!) {
          groups[key].startMonth = a.target_month;
        }
        if (!groups[key].endMonth || a.target_month > groups[key].endMonth!) {
          groups[key].endMonth = a.target_month;
        }
      }
    }
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [allocations]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRemoveAllocation = async () => {
    if (!confirmRemove || !plan) return;
    try {
      await removeAllocationFromPlan(plan.id, confirmRemove.id);
      toast.success('Allocation removed');
      refreshAll();
    } catch {
      toast.error('Failed to remove allocation');
    } finally {
      setConfirmRemove(null);
    }
  };

  const handleTransition = async (status: PlanLifecycleStatus) => {
    if (!plan) return;
    try {
      const updated = await transitionPlanStatus(plan.id, status);
      setPlan(prev => prev ? { ...prev, ...updated } : null);
      toast.success(`Plan ${LIFECYCLE_LABELS[status].toLowerCase()}`);
    } catch {
      toast.error('Failed to transition plan');
    }
  };

  const handleCreateVersion = async (label: string, notes: string) => {
    if (!plan) return;
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('railsync_access_token');
      const res = await fetch(`${API_URL}/master-plans/${plan.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label, notes }),
      });
      const data = await res.json();
      if (data.success) {
        setVersions(prev => [data.data, ...prev]);
        setShowVersionModal(false);
        toast.success('Version snapshot created');
      }
    } catch {
      toast.error('Failed to create version');
    }
  };

  const handleGenerateSummary = async () => {
    if (!plan) return;
    try {
      await generatePlanSummary(plan.id);
      toast.success('Plan summary generated');
    } catch {
      toast.error('Failed to generate summary');
    }
  };

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------

  if (!isAuthenticated) {
    return <div className="flex items-center justify-center py-20"><p className="text-[var(--color-text-tertiary)]">Please sign in.</p></div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-[var(--color-text-tertiary)]">Loading plan...</p></div>;
  }

  if (!plan) {
    return <div className="flex items-center justify-center py-20"><p className="text-[var(--color-text-tertiary)]">Plan not found.</p></div>;
  }

  const editable = isEditable(plan.status);

  return (
    <div className="space-y-4">
      {/* Workspace Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/plans')}
            className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{plan.name}</h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${LIFECYCLE_COLORS[plan.status]}`}>
                {plan.status === 'locked' && <Lock className="w-3 h-3" />}
                {plan.status === 'committed' && <CheckCircle2 className="w-3 h-3" />}
                {LIFECYCLE_LABELS[plan.status]}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              {formatMonth(plan.planning_month)} &middot; FY{plan.fiscal_year}
              {stats && <> &middot; {stats.total_allocations} cars &middot; {formatCurrency(stats.total_estimated_cost)}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Conflicts badge */}
          {conflicts.length > 0 && (
            <button
              onClick={() => setShowConflictsPanel(!showConflictsPanel)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''}
            </button>
          )}
          {/* Capacity fit badge */}
          {capacityFit && (
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg ${
              capacityFit.level === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : capacityFit.level === 'yellow' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {capacityFit.level === 'green' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {capacityFit.level !== 'green' && <AlertTriangle className="w-3.5 h-3.5" />}
              Capacity: {capacityFit.overall_score}/100
            </span>
          )}
          {/* Lifecycle actions */}
          {plan.status === 'draft' && (
            <button onClick={() => handleTransition('soft_plan')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              <FileCheck className="w-3.5 h-3.5" /> Promote
            </button>
          )}
          {plan.status === 'soft_plan' && (
            <button onClick={() => handleTransition('locked')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors">
              <Lock className="w-3.5 h-3.5" /> Lock
            </button>
          )}
          {plan.status === 'locked' && (
            <button onClick={() => handleTransition('pending_commitment')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors">
              <Send className="w-3.5 h-3.5" /> Submit
            </button>
          )}
          {plan.status === 'pending_commitment' && (
            <button onClick={() => handleTransition('committed')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" /> Commit
            </button>
          )}
          {/* Version snapshot */}
          <button onClick={() => setShowVersionModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors">
            <GitBranch className="w-3.5 h-3.5" /> v{versions.length + 1}
          </button>
          {/* Customer communication */}
          <button onClick={handleGenerateSummary} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors">
            <MessageSquare className="w-3.5 h-3.5" /> Share
          </button>
        </div>
      </div>

      {/* Conflicts Panel */}
      {showConflictsPanel && conflicts.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Multi-Plan Conflicts</h3>
            <button onClick={() => setShowConflictsPanel(false)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${c.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
                <div>
                  <span className="text-[var(--color-text-primary)]">{c.message}</span>
                  {c.plan_name && <span className="text-xs text-[var(--color-text-tertiary)]"> ({c.plan_name})</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        {([
          { id: 'allocations' as const, label: 'Car Grouping & Allocation', icon: <LayoutGrid className="w-4 h-4" /> },
          { id: 'timeline' as const, label: 'Timeline (Gantt)', icon: <Calendar className="w-4 h-4" /> },
          { id: 'forecast' as const, label: 'Network Load Forecast', icon: <TrendingUp className="w-4 h-4" /> },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeSection === tab.id
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Section 1: Car Grouping & Allocation Table */}
      {activeSection === 'allocations' && (
        <AllocationSection
          plan={plan}
          allocations={allocations}
          loading={allocsLoading}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          groupedAllocations={groupedAllocations}
          selectedAllocations={selectedAllocations}
          setSelectedAllocations={setSelectedAllocations}
          editable={editable}
          onAddCars={() => setShowAddCarsModal(true)}
          onAssignShop={(a) => setShowAssignShopModal(a)}
          onBulkAssign={() => setShowBulkAssignModal(true)}
          onRemove={(a) => setConfirmRemove(a)}
          onRefresh={refreshAll}
        />
      )}

      {/* Section 2: Timeline (Gantt) */}
      {activeSection === 'timeline' && (
        <GanttSection
          ganttData={ganttData}
          allocations={allocations}
          totalAllocations={stats?.total_allocations || allocations.length}
        />
      )}

      {/* Section 3: Network Load Forecast */}
      {activeSection === 'forecast' && (
        <ForecastSection
          networkLoad={networkLoad}
          capacityFit={capacityFit}
          shopFilter={forecastShopFilter}
          onShopFilterChange={setForecastShopFilter}
        />
      )}

      {/* Modals */}
      {showAddCarsModal && plan && (
        <AddCarsModal
          plan={plan}
          onClose={() => setShowAddCarsModal(false)}
          onAdded={() => { setShowAddCarsModal(false); refreshAll(); }}
        />
      )}

      {showAssignShopModal && plan && (
        <AssignShopModal
          plan={plan}
          allocation={showAssignShopModal}
          onClose={() => setShowAssignShopModal(null)}
          onAssigned={() => { setShowAssignShopModal(null); refreshAll(); }}
        />
      )}

      {showBulkAssignModal && plan && (
        <BulkAssignModal
          plan={plan}
          selectedIds={Array.from(selectedAllocations)}
          onClose={() => setShowBulkAssignModal(false)}
          onAssigned={() => { setShowBulkAssignModal(false); setSelectedAllocations(new Set()); refreshAll(); }}
        />
      )}

      {showVersionModal && (
        <VersionModal
          onClose={() => setShowVersionModal(false)}
          onSubmit={handleCreateVersion}
        />
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove from Plan"
        description={`Remove ${confirmRemove?.car_number || 'this allocation'} from the plan?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemoveAllocation}
        onCancel={() => setConfirmRemove(null)}
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
// Section 1: Car Grouping & Allocation
// ===========================================================================

function AllocationSection({
  plan, allocations, loading, groupBy, setGroupBy, groupedAllocations,
  selectedAllocations, setSelectedAllocations, editable,
  onAddCars, onAssignShop, onBulkAssign, onRemove, onRefresh,
}: {
  plan: MasterPlan;
  allocations: Allocation[];
  loading: boolean;
  groupBy: string;
  setGroupBy: (g: 'car_type' | 'shop' | 'status') => void;
  groupedAllocations: [string, { label: string; allocations: Allocation[]; totalCost: number }][];
  selectedAllocations: Set<string>;
  setSelectedAllocations: (s: Set<string>) => void;
  editable: boolean;
  onAddCars: () => void;
  onAssignShop: (a: Allocation) => void;
  onBulkAssign: () => void;
  onRemove: (a: Allocation) => void;
  onRefresh: () => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  const toggleSelectAll = () => {
    if (selectedAllocations.size === allocations.length) {
      setSelectedAllocations(new Set());
    } else {
      setSelectedAllocations(new Set(allocations.map(a => a.id)));
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-[var(--color-text-tertiary)]">Loading allocations...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {editable && (
            <>
              <button onClick={onAddCars} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Cars
              </button>
              {selectedAllocations.size > 0 && (
                <button onClick={onBulkAssign} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  <Wrench className="w-3.5 h-3.5" /> Assign {selectedAllocations.size} to Shop
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-tertiary)]">Group by:</span>
          {(['car_type', 'shop', 'status'] as const).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-2 py-1 text-xs rounded ${groupBy === g ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}>
              {g === 'car_type' ? 'Car Type' : g === 'shop' ? 'Shop' : 'Status'}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped table */}
      {allocations.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <Package className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
          <p className="text-[var(--color-text-tertiary)]">No cars in this plan yet.</p>
          {editable && (
            <button onClick={onAddCars} className="mt-2 text-sm text-blue-600 hover:underline">Add cars to get started</button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm overflow-hidden">
          {/* Select all header */}
          {editable && (
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <input type="checkbox" checked={selectedAllocations.size === allocations.length && allocations.length > 0} onChange={toggleSelectAll} className="rounded" />
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {selectedAllocations.size > 0 ? `${selectedAllocations.size} selected` : `${allocations.length} cars total`}
              </span>
            </div>
          )}

          {groupedAllocations.map(([key, group]) => (
            <div key={key}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(key)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedGroups.has(key) ? <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />}
                  <span className="font-medium text-sm text-[var(--color-text-primary)]">{group.label}</span>
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
                    {group.allocations.length}
                  </span>
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)]">{formatCurrency(group.totalCost)}</span>
              </button>

              {/* Group rows */}
              {expandedGroups.has(key) && (
                <div className="divide-y divide-[var(--color-border)]">
                  {group.allocations.map(alloc => (
                    <div key={alloc.id} className="flex items-center px-4 py-2 hover:bg-[var(--color-bg-secondary)] transition-colors">
                      {editable && (
                        <input
                          type="checkbox"
                          checked={selectedAllocations.has(alloc.id)}
                          onChange={() => {
                            const next = new Set(selectedAllocations);
                            if (next.has(alloc.id)) next.delete(alloc.id);
                            else next.add(alloc.id);
                            setSelectedAllocations(next);
                          }}
                          className="rounded mr-3"
                        />
                      )}
                      <div className="flex-1 grid grid-cols-7 gap-2 items-center text-sm">
                        <span className="font-medium text-[var(--color-text-primary)]">{alloc.car_number || alloc.car_mark_number}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{alloc.lessee_name || '-'}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{alloc.car_type || '-'}</span>
                        <span>
                          {alloc.shop_code ? (
                            <span className="text-[var(--color-text-primary)] text-xs">{alloc.shop_code}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              <AlertCircle className="w-3 h-3" /> Unassigned
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{alloc.target_month ? formatMonth(alloc.target_month) : '-'}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full w-fit ${getStatusColor(alloc.status)}`}>{alloc.status}</span>
                        <span className="text-xs text-right text-[var(--color-text-primary)]">{formatCurrency(alloc.estimated_cost)}</span>
                      </div>
                      {editable && (
                        <div className="flex items-center gap-1 ml-2">
                          {!alloc.shop_code && (
                            <button onClick={() => onAssignShop(alloc)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 transition-colors">
                              Assign
                            </button>
                          )}
                          <button onClick={() => onRemove(alloc)} className="p-1 text-[var(--color-text-tertiary)] hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Section 2: Gantt Timeline
// ===========================================================================

function GanttSection({
  ganttData,
  allocations,
  totalAllocations,
}: {
  ganttData: { shop: string; count: number; color: string; startMonth?: string; endMonth?: string }[];
  allocations: Allocation[];
  totalAllocations: number;
}) {
  if (ganttData.length === 0) {
    return (
      <div className="py-12 text-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <Calendar className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
        <p className="text-[var(--color-text-tertiary)]">Add allocations to see the timeline.</p>
      </div>
    );
  }

  // Build a mini-Gantt chart data for recharts
  const chartData = ganttData.map(g => ({
    name: g.shop,
    cars: g.count,
    fill: g.color,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Allocation Flow by Shop/Network</h3>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
          Each bar represents a group allocation. Longer bars indicate more cars assigned to that shop.
        </p>

        {/* Gantt-style horizontal bars */}
        <div className="space-y-3">
          {ganttData.map((g, i) => {
            const widthPct = totalAllocations > 0 ? Math.max(8, (g.count / totalAllocations) * 100) : 20;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-32 text-sm text-[var(--color-text-secondary)] truncate text-right">{g.shop}</span>
                <div className="flex-1 relative">
                  <div className="h-8 bg-[var(--color-bg-tertiary)] rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center px-3 transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: g.color + '90' }}
                    >
                      <span className="text-xs font-medium text-white whitespace-nowrap">
                        {g.count} car{g.count > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  {/* Date range label */}
                  {g.startMonth && (
                    <div className="absolute -top-4 left-0 text-[10px] text-[var(--color-text-tertiary)]">
                      {formatMonth(g.startMonth)}
                      {g.endMonth && g.endMonth !== g.startMonth && <> &rarr; {formatMonth(g.endMonth)}</>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Overlap warnings */}
        {ganttData.length > 1 && (
          <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
            <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Distribution Summary</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="cars" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <rect key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Section 3: Network Load Forecast
// ===========================================================================

function ForecastSection({
  networkLoad,
  capacityFit,
  shopFilter,
  onShopFilterChange,
}: {
  networkLoad: NetworkLoadForecast | null;
  capacityFit: CapacityFitResult | null;
  shopFilter: string;
  onShopFilterChange: (v: string) => void;
}) {
  if (!networkLoad && !capacityFit) {
    return (
      <div className="py-12 text-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
        <p className="text-[var(--color-text-tertiary)]">Forecast data is being computed...</p>
      </div>
    );
  }

  // Build chart data from networkLoad
  const arrivalData = networkLoad?.dates?.map((d, i) => ({
    date: d,
    arrivals: networkLoad.arrivals_per_week?.[i] || 0,
    completions: networkLoad.completions_per_week?.[i] || 0,
    backlog: networkLoad.backlog_trend?.[i] || 0,
  })) || [];

  // Shop capacity data
  const shopData = capacityFit?.shops?.map(s => ({
    name: s.shop_name || s.shop_code,
    capacity: s.total_capacity,
    planned: s.allocated_from_plan,
    otherPlans: s.allocated_from_other_plans,
    backlog: s.current_backlog,
    utilization: s.utilization_pct,
    level: s.level,
  })) || [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="text"
            value={shopFilter}
            onChange={e => onShopFilterChange(e.target.value)}
            placeholder="Filter by shop..."
            className="pl-3 pr-8 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
          />
          {shopFilter && (
            <button onClick={() => onShopFilterChange('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
            </button>
          )}
        </div>
      </div>

      {/* Arrivals & Completions Chart */}
      {arrivalData.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Arrivals & Completions per Week</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={arrivalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend />
              <Area type="monotone" dataKey="arrivals" stackId="1" stroke="#3b82f6" fill="#3b82f680" name="Arrivals" />
              <Area type="monotone" dataKey="completions" stackId="2" stroke="#10b981" fill="#10b98180" name="Completions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Backlog Trend */}
      {arrivalData.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Backlog Trendline</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={arrivalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="backlog" stroke="#f59e0b" strokeWidth={2} dot={false} name="Backlog" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Shop Capacity vs Planned Load */}
      {shopData.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Shop Capacity vs Planned Load</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, shopData.length * 40)}>
            <BarChart data={shopData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend />
              <Bar dataKey="capacity" fill="#e5e7eb" name="Capacity" radius={[0, 4, 4, 0]} />
              <Bar dataKey="planned" fill="#3b82f6" name="This Plan" radius={[0, 4, 4, 0]} />
              <Bar dataKey="otherPlans" fill="#f59e0b" name="Other Plans" radius={[0, 4, 4, 0]} />
              <Bar dataKey="backlog" fill="#ef4444" name="Current Backlog" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Warnings */}
          <div className="mt-4 space-y-2">
            {shopData.filter(s => s.level === 'red').map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{s.name}</strong> is overloaded ({s.utilization.toFixed(0)}% utilization)</span>
              </div>
            ))}
            {shopData.filter(s => s.level === 'yellow').map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{s.name}</strong> is at tight capacity ({s.utilization.toFixed(0)}%)</span>
              </div>
            ))}
            {shopData.filter(s => s.level === 'green' && s.utilization < 30).map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{s.name}</strong> is underutilized ({s.utilization.toFixed(0)}%) &mdash; consider more load</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Modal: Add Cars
// ===========================================================================

function AddCarsModal({ plan, onClose, onAdded }: { plan: MasterPlan; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [selectedCars, setSelectedCars] = useState<{ car_number: string; car_type: string; lessee_name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedCars.length === 0) return;
    setSubmitting(true);
    try {
      const result = await addCarsToPlan(plan.id, selectedCars.map(c => c.car_number), plan.planning_month);
      const msgs: string[] = [];
      if (result.added > 0) msgs.push(`${result.added} added`);
      if (result.skipped > 0) msgs.push(`${result.skipped} skipped`);
      toast.success(msgs.join(', '));
      onAdded();
    } catch {
      toast.error('Failed to add cars');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative rounded-xl shadow-xl max-w-lg w-full p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Add Cars to Plan</h2>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">Search for cars by number. Selected cars will be added as unassigned allocations.</p>
          <TypeaheadSearch
            placeholder="Type car number (e.g., SHQX0012345)..."
            onSearch={q => searchCars(q)}
            onSelect={(car: { car_number: string; car_type: string; lessee_name: string }) => {
              if (!selectedCars.find(c => c.car_number === car.car_number)) {
                setSelectedCars([...selectedCars, car]);
              }
            }}
            renderItem={(car: { car_number: string; car_type: string; lessee_name: string }) => (
              <div className="flex items-center justify-between">
                <span className="font-medium">{car.car_number}</span>
                <span className="text-xs text-[var(--color-text-tertiary)]">{car.car_type} &middot; {car.lessee_name || 'No lessee'}</span>
              </div>
            )}
            getKey={(car: { car_number: string }) => car.car_number}
          />
          {selectedCars.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Selected ({selectedCars.length})</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {selectedCars.map(car => (
                  <div key={car.car_number} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)]">
                    <div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{car.car_number}</span>
                      <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">{car.car_type}</span>
                    </div>
                    <button onClick={() => setSelectedCars(selectedCars.filter(c => c.car_number !== car.car_number))} className="text-[var(--color-text-tertiary)] hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">Cancel</button>
            <button onClick={handleSubmit} disabled={selectedCars.length === 0 || submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Adding...' : `Add ${selectedCars.length} Car(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Modal: Assign Shop
// ===========================================================================

function AssignShopModal({ plan, allocation, onClose, onAssigned }: {
  plan: MasterPlan; allocation: Allocation; onClose: () => void; onAssigned: () => void;
}) {
  const toast = useToast();
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const carNumber = allocation.car_number || allocation.car_mark_number || '';
        if (!carNumber) return;
        const data = await evaluateShops(carNumber);
        setResults(data);
      } catch {
        toast.error('Failed to evaluate shops');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [allocation, toast]);

  const filtered = filter
    ? results.filter(r => r.shop.shop_code.toLowerCase().includes(filter.toLowerCase()) || r.shop.shop_name.toLowerCase().includes(filter.toLowerCase()))
    : results;
  const eligible = filtered.filter(r => r.is_eligible);

  const handleAssign = async (shopCode: string) => {
    setAssigning(shopCode);
    try {
      await assignShopToPlanAllocation(plan.id, allocation.id, shopCode, plan.planning_month);
      toast.success(`Assigned to ${shopCode}`);
      onAssigned();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign shop');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative rounded-xl shadow-xl max-w-2xl w-full p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Assign Shop</h2>
              <p className="text-sm text-[var(--color-text-tertiary)]">Car: {allocation.car_number || allocation.car_mark_number}</p>
            </div>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
          </div>
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter shops..."
            className="w-full px-3 py-2 mb-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]" />
          {loading ? (
            <div className="py-8 text-center text-[var(--color-text-tertiary)]">Evaluating shops...</div>
          ) : eligible.length === 0 ? (
            <div className="py-8 text-center text-[var(--color-text-tertiary)]">No eligible shops found</div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {eligible.map(r => (
                <div key={r.shop.shop_code} className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)]">{r.shop.shop_name}</span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">({r.shop.shop_code})</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-text-tertiary)]">
                      <span>Cost: {formatCurrency(r.cost_breakdown.total_cost)}</span>
                      <span>Backlog: {r.backlog.cars_backlog} cars</span>
                      {r.capacity.length > 0 && <span>Utilization: {r.capacity[0].current_utilization_pct.toFixed(0)}%</span>}
                    </div>
                  </div>
                  <button onClick={() => handleAssign(r.shop.shop_code)} disabled={assigning === r.shop.shop_code}
                    className="ml-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5" />
                    {assigning === r.shop.shop_code ? 'Assigning...' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Modal: Bulk Assign Shop
// ===========================================================================

function BulkAssignModal({ plan, selectedIds, onClose, onAssigned }: {
  plan: MasterPlan; selectedIds: string[]; onClose: () => void; onAssigned: () => void;
}) {
  const toast = useToast();
  const [shopCode, setShopCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopCode) return;
    setSubmitting(true);
    try {
      const result = await bulkAssignShop(plan.id, selectedIds, shopCode, plan.planning_month);
      toast.success(`${result.updated} allocation(s) assigned to ${shopCode}`);
      onAssigned();
    } catch {
      toast.error('Failed to bulk assign');
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
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Bulk Assign to Shop</h2>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
            Assign {selectedIds.length} selected allocation(s) to a single shop.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Shop Code</label>
              <input type="text" value={shopCode} onChange={e => setShopCode(e.target.value)} required placeholder="e.g., ABC"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">Cancel</button>
              <button type="submit" disabled={submitting || !shopCode}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Assigning...' : `Assign ${selectedIds.length}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Modal: Version Snapshot
// ===========================================================================

function VersionModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (label: string, notes: string) => void }) {
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative rounded-xl shadow-xl max-w-md w-full p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Create Version Snapshot</h2>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Label</label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g., After Customer Review"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="What changed..."
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">Cancel</button>
              <button onClick={() => onSubmit(label, notes)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Snapshot</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
