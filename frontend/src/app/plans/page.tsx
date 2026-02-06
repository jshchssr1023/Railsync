'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import TypeaheadSearch from '@/components/TypeaheadSearch';
import {
  searchCars,
  getPlanStats,
  listPlanAllocations,
  addCarsToPlan,
  importDemandsIntoPlan,
  removeAllocationFromPlan,
  assignShopToPlanAllocation,
  evaluateShops,
  listDemands,
  listScenarios,
  listPlanDemands,
  createDemandForPlan,
} from '@/lib/api';
import type { Allocation, EvaluationResult, Demand, Scenario } from '@/types';
import {
  Plus,
  Trash2,
  Wrench,
  Package,
  BarChart3,
  GitBranch,
  FileDown,
  X,
  ChevronRight,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MasterPlan {
  id: string;
  name: string;
  description?: string;
  fiscal_year: number;
  planning_month: string;
  status: 'draft' | 'active' | 'archived';
  version_count?: number;
  latest_version?: number;
  current_allocation_count?: number;
  current_estimated_cost?: number;
  created_at: string;
  updated_at: string;
}

interface PlanVersion {
  id: string;
  plan_id: string;
  version_number: number;
  label?: string;
  notes?: string;
  allocation_count: number;
  total_estimated_cost: number;
  allocation_delta?: number;
  cost_delta?: number;
  created_at: string;
}

interface PlanStatsData {
  total_allocations: number;
  assigned: number;
  unassigned: number;
  total_estimated_cost: number;
  planned_cost: number;
  committed_cost: number;
  by_status: { status: string; count: number; cost: number }[];
  by_shop: { shop_code: string; shop_name: string; count: number; cost: number }[];
}

type TabId = 'overview' | 'allocations' | 'demands' | 'versions';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getToken = () => localStorage.getItem('railsync_access_token');

const formatCurrency = (val?: number) => {
  if (!val && val !== 0) return '-';
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
};

const formatMonth = (month: string) => {
  const [year, m] = month.split('-');
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'archived':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MasterPlansPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  // Plan list
  const [plans, setPlans] = useState<MasterPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MasterPlan | null>(null);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Overview
  const [stats, setStats] = useState<PlanStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Allocations
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocsLoading, setAllocsLoading] = useState(false);

  // Versions
  const [versions, setVersions] = useState<PlanVersion[]>([]);

  // Demands
  const [demands, setDemands] = useState<Demand[]>([]);
  const [demandsLoading, setDemandsLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showAddCarsModal, setShowAddCarsModal] = useState(false);
  const [showImportDemandsModal, setShowImportDemandsModal] = useState(false);
  const [showCreateDemandModal, setShowCreateDemandModal] = useState(false);
  const [showAssignShopModal, setShowAssignShopModal] = useState<Allocation | null>(null);

  // Confirm dialog
  const [confirmRemove, setConfirmRemove] = useState<Allocation | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/master-plans`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setPlans(data.data);
    } catch {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchStats = useCallback(async (planId: string) => {
    setStatsLoading(true);
    try {
      const data = await getPlanStats(planId);
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchAllocations = useCallback(async (planId: string) => {
    setAllocsLoading(true);
    try {
      const data = await listPlanAllocations(planId);
      setAllocations(data);
    } catch {
      setAllocations([]);
    } finally {
      setAllocsLoading(false);
    }
  }, []);

  const fetchVersions = useCallback(async (planId: string) => {
    try {
      const res = await fetch(`${API_URL}/master-plans/${planId}/versions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setVersions(data.data);
    } catch {
      console.error('Failed to load versions');
    }
  }, []);

  const fetchDemands = useCallback(async (planId: string) => {
    setDemandsLoading(true);
    try {
      const data = await listPlanDemands(planId);
      setDemands(data);
    } catch {
      setDemands([]);
    } finally {
      setDemandsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchPlans();
  }, [isAuthenticated, fetchPlans]);

  useEffect(() => {
    if (!selectedPlan) return;
    fetchVersions(selectedPlan.id);
    fetchStats(selectedPlan.id);
    fetchAllocations(selectedPlan.id);
    fetchDemands(selectedPlan.id);
  }, [selectedPlan, fetchVersions, fetchStats, fetchAllocations, fetchDemands]);

  // Refresh the current plan's data
  const refreshPlanData = useCallback(() => {
    if (!selectedPlan) return;
    fetchStats(selectedPlan.id);
    fetchAllocations(selectedPlan.id);
    fetchDemands(selectedPlan.id);
    fetchPlans();
  }, [selectedPlan, fetchStats, fetchAllocations, fetchDemands, fetchPlans]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreatePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch(`${API_URL}/master-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description'),
          fiscal_year: parseInt(formData.get('fiscal_year') as string),
          planning_month: formData.get('planning_month'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlans([data.data, ...plans]);
        setSelectedPlan(data.data);
        setShowCreateModal(false);
        toast.success('Plan created');
      }
    } catch {
      toast.error('Failed to create plan');
    }
  };

  const handleCreateVersion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPlan) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch(`${API_URL}/master-plans/${selectedPlan.id}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          label: formData.get('label'),
          notes: formData.get('notes'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVersions([data.data, ...versions]);
        setShowVersionModal(false);
        fetchPlans();
        toast.success('Version snapshot created');
      }
    } catch {
      toast.error('Failed to create version');
    }
  };

  const handleStatusChange = async (planId: string, status: string) => {
    try {
      const res = await fetch(`${API_URL}/master-plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setPlans(plans.map(p => (p.id === planId ? { ...p, status: status as MasterPlan['status'] } : p)));
        if (selectedPlan?.id === planId) {
          setSelectedPlan({ ...selectedPlan, status: status as MasterPlan['status'] });
        }
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleRemoveAllocation = async () => {
    if (!confirmRemove || !selectedPlan) return;
    try {
      await removeAllocationFromPlan(selectedPlan.id, confirmRemove.id);
      toast.success('Allocation removed from plan');
      refreshPlanData();
    } catch {
      toast.error('Failed to remove allocation');
    } finally {
      setConfirmRemove(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--color-text-tertiary)]">Please sign in to view master plans.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Master Plans</h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Build and version monthly planning cycles
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Plan List */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">Planning Cycles</h2>
            </div>
            <div className="divide-y divide-[var(--color-border)] max-h-[calc(100vh-240px)] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-[var(--color-text-tertiary)]">Loading...</div>
              ) : plans.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-tertiary)]" />
                  <p className="text-[var(--color-text-tertiary)]">No plans yet</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-2 text-sm text-blue-600 hover:underline"
                  >
                    Create your first plan
                  </button>
                </div>
              ) : (
                plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full p-4 text-left transition-colors ${
                      selectedPlan?.id === plan.id
                        ? 'bg-blue-50 dark:bg-blue-900/10 border-l-2 border-l-blue-600'
                        : 'hover:bg-[var(--color-bg-secondary)] border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--color-text-primary)] text-sm">
                        {plan.name}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(plan.status)}`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {formatMonth(plan.planning_month)} &middot; FY{plan.fiscal_year}
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {plan.current_allocation_count || 0} cars &middot; {formatCurrency(plan.current_estimated_cost)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Plan Detail */}
        <div className="lg:col-span-2">
          {selectedPlan ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
              {/* Plan Header */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {selectedPlan.name}
                    </h2>
                    <p className="text-sm text-[var(--color-text-tertiary)]">
                      {selectedPlan.description || formatMonth(selectedPlan.planning_month) + ' · FY' + selectedPlan.fiscal_year}
                    </p>
                  </div>
                  <select
                    value={selectedPlan.status}
                    onChange={e => handleStatusChange(selectedPlan.id, e.target.value)}
                    className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-1.5
                               bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-1 mt-4">
                  {([
                    { id: 'overview' as TabId, label: 'Overview', icon: BarChart3 },
                    { id: 'demands' as TabId, label: 'Demands', icon: ClipboardList },
                    { id: 'allocations' as TabId, label: 'Cars & Allocations', icon: Wrench },
                    { id: 'versions' as TabId, label: 'Versions', icon: GitBranch },
                  ]).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-4">
                {activeTab === 'overview' && (
                  <OverviewTab stats={stats} loading={statsLoading} />
                )}
                {activeTab === 'demands' && (
                  <DemandsTab
                    plan={selectedPlan}
                    demands={demands}
                    loading={demandsLoading}
                    onCreateDemand={() => setShowCreateDemandModal(true)}
                    onImportDemands={(demandIds) => {
                      importDemandsIntoPlan(selectedPlan.id, demandIds)
                        .then(result => {
                          toast.success(`${result.imported} allocation(s) generated`);
                          refreshPlanData();
                        })
                        .catch(() => toast.error('Failed to generate allocations'));
                    }}
                  />
                )}
                {activeTab === 'allocations' && (
                  <AllocationsTab
                    plan={selectedPlan}
                    allocations={allocations}
                    loading={allocsLoading}
                    onAddCars={() => setShowAddCarsModal(true)}
                    onImportDemands={() => setShowImportDemandsModal(true)}
                    onAssignShop={alloc => setShowAssignShopModal(alloc)}
                    onRemove={alloc => setConfirmRemove(alloc)}
                  />
                )}
                {activeTab === 'versions' && (
                  <VersionsTab
                    versions={versions}
                    onCreateVersion={() => setShowVersionModal(true)}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm p-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
              <p className="text-[var(--color-text-tertiary)]">
                Select a plan to view details, manage allocations, and track versions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreatePlanModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreatePlan}
        />
      )}

      {showVersionModal && selectedPlan && (
        <CreateVersionModal
          planMonth={selectedPlan.planning_month}
          onClose={() => setShowVersionModal(false)}
          onSubmit={handleCreateVersion}
        />
      )}

      {showAddCarsModal && selectedPlan && (
        <AddCarsModal
          plan={selectedPlan}
          onClose={() => setShowAddCarsModal(false)}
          onAdded={() => {
            setShowAddCarsModal(false);
            refreshPlanData();
          }}
        />
      )}

      {showCreateDemandModal && selectedPlan && (
        <CreateDemandModal
          plan={selectedPlan}
          onClose={() => setShowCreateDemandModal(false)}
          onCreated={() => {
            setShowCreateDemandModal(false);
            refreshPlanData();
          }}
        />
      )}

      {showImportDemandsModal && selectedPlan && (
        <ImportDemandsModal
          plan={selectedPlan}
          onClose={() => setShowImportDemandsModal(false)}
          onImported={() => {
            setShowImportDemandsModal(false);
            refreshPlanData();
          }}
        />
      )}

      {showAssignShopModal && selectedPlan && (
        <AssignShopModal
          plan={selectedPlan}
          allocation={showAssignShopModal}
          onClose={() => setShowAssignShopModal(null)}
          onAssigned={() => {
            setShowAssignShopModal(null);
            refreshPlanData();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove from Plan"
        description={`Remove ${confirmRemove?.car_number || 'this allocation'} from the plan? The allocation will be detached but not deleted.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemoveAllocation}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}

// ===========================================================================
// Overview Tab
// ===========================================================================

function OverviewTab({ stats, loading }: { stats: PlanStatsData | null; loading: boolean }) {
  if (loading) {
    return <div className="py-8 text-center text-[var(--color-text-tertiary)]">Loading stats...</div>;
  }

  if (!stats) {
    return <div className="py-8 text-center text-[var(--color-text-tertiary)]">No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Cars" value={stats.total_allocations} />
        <StatCard label="Assigned" value={stats.assigned} color="green" />
        <StatCard label="Unassigned" value={stats.unassigned} color={stats.unassigned > 0 ? 'amber' : 'green'} />
        <StatCard label="Est. Cost" value={formatCurrency(stats.total_estimated_cost)} />
      </div>

      {/* Budget Impact: Planned vs Committed */}
      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Budget Impact</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
            <div className="text-xs text-amber-700 dark:text-amber-400 mb-1">Planned (No Shop)</div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-400">
              {formatCurrency(stats.planned_cost || 0)}
            </div>
            <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              {stats.unassigned} car{stats.unassigned !== 1 ? 's' : ''} awaiting shop assignment
            </div>
          </div>
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
            <div className="text-xs text-green-700 dark:text-green-400 mb-1">Committed (Shop Assigned)</div>
            <div className="text-xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(stats.committed_cost || 0)}
            </div>
            <div className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
              {stats.assigned} car{stats.assigned !== 1 ? 's' : ''} with shop commitment
            </div>
          </div>
        </div>
      </div>

      {/* By Status */}
      {stats.by_status.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">By Status</h3>
          <div className="space-y-2">
            {stats.by_status.map(s => (
              <div key={s.status} className="flex items-center gap-3">
                <span className="w-32 text-sm text-[var(--color-text-secondary)] truncate">{s.status}</span>
                <div className="flex-1 h-6 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{
                      width: stats.total_allocations > 0
                        ? `${(s.count / stats.total_allocations) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-medium text-[var(--color-text-primary)]">
                  {s.count}
                </span>
                <span className="w-16 text-right text-xs text-[var(--color-text-tertiary)]">
                  {formatCurrency(s.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Shop */}
      {stats.by_shop.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">By Shop</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Shop</th>
                  <th className="text-right py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Cars</th>
                  <th className="text-right py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_shop.map(s => (
                  <tr key={s.shop_code} className="border-b border-[var(--color-border)]">
                    <td className="py-2 px-2 text-[var(--color-text-primary)]">
                      {s.shop_name}
                      {s.shop_code !== 'unassigned' && (
                        <span className="ml-1 text-xs text-[var(--color-text-tertiary)]">({s.shop_code})</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--color-text-primary)]">{s.count}</td>
                    <td className="py-2 px-2 text-right text-[var(--color-text-primary)]">{formatCurrency(s.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorClass = color === 'green'
    ? 'text-green-600 dark:text-green-400'
    : color === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-[var(--color-text-primary)]';

  return (
    <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="text-xs text-[var(--color-text-tertiary)] mb-1">{label}</div>
      <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

// ===========================================================================
// Allocations Tab
// ===========================================================================

function AllocationsTab({
  plan,
  allocations,
  loading,
  onAddCars,
  onImportDemands,
  onAssignShop,
  onRemove,
}: {
  plan: MasterPlan;
  allocations: Allocation[];
  loading: boolean;
  onAddCars: () => void;
  onImportDemands: () => void;
  onAssignShop: (alloc: Allocation) => void;
  onRemove: (alloc: Allocation) => void;
}) {
  if (loading) {
    return <div className="py-8 text-center text-[var(--color-text-tertiary)]">Loading allocations...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAddCars}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Cars
        </button>
        <button
          onClick={onImportDemands}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg
                     text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <FileDown className="w-3.5 h-3.5" />
          Import from Demands
        </button>
      </div>

      {/* Table */}
      {allocations.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
          <p className="text-[var(--color-text-tertiary)]">No cars in this plan yet.</p>
          <button
            onClick={onAddCars}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Add cars to get started
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Car Number</th>
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Customer</th>
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Contract</th>
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Shop</th>
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Target Month</th>
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Status</th>
                <th className="text-right py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Est. Cost</th>
                <th className="text-right py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map(alloc => (
                <tr key={alloc.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
                  <td className="py-2 px-2 font-medium text-[var(--color-text-primary)]">
                    {alloc.car_number || alloc.car_mark_number}
                  </td>
                  <td className="py-2 px-2 text-[var(--color-text-secondary)] text-xs">
                    {alloc.lessee_name || '-'}
                  </td>
                  <td className="py-2 px-2 text-[var(--color-text-secondary)] text-xs">
                    {alloc.contract_number || '-'}
                  </td>
                  <td className="py-2 px-2">
                    {alloc.shop_code ? (
                      <span className="text-[var(--color-text-primary)]">{alloc.shop_code}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertCircle className="w-3 h-3" />
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-[var(--color-text-secondary)]">
                    {alloc.target_month ? formatMonth(alloc.target_month) : '-'}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(
                      alloc.status === 'Need Shopping' ? 'draft' : 'active'
                    )}`}>
                      {alloc.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-primary)]">
                    {formatCurrency(alloc.estimated_cost)}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!alloc.shop_code && (
                        <button
                          onClick={() => onAssignShop(alloc)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          Assign Shop
                        </button>
                      )}
                      <button
                        onClick={() => onRemove(alloc)}
                        className="p-1 text-[var(--color-text-tertiary)] hover:text-red-600 transition-colors"
                        title="Remove from plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Versions Tab
// ===========================================================================

function VersionsTab({
  versions,
  onCreateVersion,
}: {
  versions: PlanVersion[];
  onCreateVersion: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Version History</h3>
        <button
          onClick={onCreateVersion}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Snapshot
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="py-8 text-center text-[var(--color-text-tertiary)]">
          <GitBranch className="w-8 h-8 mx-auto mb-2" />
          <p>No versions yet</p>
          <p className="text-sm mt-1">Create a snapshot to capture current allocations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v, i) => (
            <div
              key={v.id}
              className="p-3 border border-[var(--color-border)] rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-sm font-medium">
                    v{v.version_number}
                  </span>
                  <div>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {v.label || `Version ${v.version_number}`}
                    </span>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {new Date(v.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-[var(--color-text-primary)]">{v.allocation_count} allocations</div>
                  <div className="text-[var(--color-text-tertiary)]">{formatCurrency(v.total_estimated_cost)}</div>
                </div>
              </div>
              {i < versions.length - 1 && (v.allocation_delta !== 0 || v.cost_delta !== 0) && (
                <div className="mt-2 pt-2 border-t border-[var(--color-border)] text-xs">
                  <span className={v.allocation_delta && v.allocation_delta > 0 ? 'text-green-600' : 'text-red-600'}>
                    {v.allocation_delta && v.allocation_delta > 0 ? '+' : ''}
                    {v.allocation_delta} allocations
                  </span>
                  <span className="mx-2 text-[var(--color-text-tertiary)]">|</span>
                  <span className={v.cost_delta && v.cost_delta > 0 ? 'text-green-600' : 'text-red-600'}>
                    {v.cost_delta && v.cost_delta > 0 ? '+' : ''}
                    {formatCurrency(v.cost_delta)} cost
                  </span>
                </div>
              )}
              {v.notes && (
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{v.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Demands Tab
// ===========================================================================

function DemandsTab({
  plan,
  demands,
  loading,
  onCreateDemand,
  onImportDemands,
}: {
  plan: MasterPlan;
  demands: Demand[];
  loading: boolean;
  onCreateDemand: () => void;
  onImportDemands: (demandIds: string[]) => void;
}) {
  if (loading) {
    return <div className="py-8 text-center text-[var(--color-text-tertiary)]">Loading demands...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCreateDemand}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Demand
        </button>
      </div>

      {/* Table */}
      {demands.length === 0 ? (
        <div className="py-12 text-center">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
          <p className="text-[var(--color-text-tertiary)]">No demands in this plan yet.</p>
          <button
            onClick={onCreateDemand}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Create a demand to get started
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Name</th>
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Type</th>
                <th className="text-right py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Cars</th>
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Target Month</th>
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Priority</th>
                <th className="text-left py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Status</th>
                <th className="text-right py-2 px-2 font-medium text-[var(--color-text-tertiary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {demands.map(d => (
                <tr key={d.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
                  <td className="py-2 px-2 font-medium text-[var(--color-text-primary)]">{d.name}</td>
                  <td className="py-2 px-2 text-[var(--color-text-secondary)]">{d.event_type}</td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-primary)]">{d.car_count}</td>
                  <td className="py-2 px-2 text-[var(--color-text-secondary)]">
                    {d.target_month ? formatMonth(d.target_month) : '-'}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      d.priority === 'High' || d.priority === 'Critical'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : d.priority === 'Medium'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {d.priority}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      d.status === 'Allocated' || d.status === 'Complete'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={() => onImportDemands([d.id])}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      Generate Allocations
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Modal: Create Demand for Plan
// ===========================================================================

function CreateDemandModal({
  plan,
  onClose,
  onCreated,
}: {
  plan: MasterPlan;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    setSubmitting(true);
    try {
      await createDemandForPlan(plan.id, {
        name: formData.get('name') as string,
        event_type: formData.get('event_type') as string,
        car_count: parseInt(formData.get('car_count') as string),
        target_month: (formData.get('target_month') as string) || undefined,
        priority: (formData.get('priority') as string) || undefined,
        description: (formData.get('description') as string) || undefined,
        default_lessee_code: (formData.get('default_lessee_code') as string) || undefined,
        required_region: (formData.get('required_region') as string) || undefined,
      });
      toast.success('Demand created');
      onCreated();
    } catch {
      toast.error('Failed to create demand');
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
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Create Demand</h2>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
            Create a demand within this plan. It will use the plan&apos;s fiscal year ({plan.fiscal_year}) and default month ({formatMonth(plan.planning_month)}).
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Demand Name</label>
              <input
                name="name"
                type="text"
                required
                placeholder="e.g., Q1 Tank Car Recerts"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Event Type</label>
                <select
                  name="event_type"
                  required
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                >
                  <option value="Qualification">Qualification</option>
                  <option value="Requalification">Requalification</option>
                  <option value="Modification">Modification</option>
                  <option value="Running Repair">Running Repair</option>
                  <option value="Retirement">Retirement</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Car Count</label>
                <input
                  name="car_count"
                  type="number"
                  required
                  min={1}
                  defaultValue={1}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Target Month</label>
                <input
                  name="target_month"
                  type="month"
                  defaultValue={plan.planning_month}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Priority</label>
                <select
                  name="priority"
                  defaultValue="Medium"
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Customer Code</label>
              <input
                name="default_lessee_code"
                type="text"
                placeholder="e.g., SHQX"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Region</label>
              <input
                name="required_region"
                type="text"
                placeholder="e.g., US-East"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Optional description..."
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Demand'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Modal: Create Plan
// ===========================================================================

function CreatePlanModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
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
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Plan Name</label>
              <input
                name="name"
                type="text"
                required
                placeholder="e.g., March 2026 S&OP"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Planning Month</label>
              <input
                name="planning_month"
                type="month"
                required
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Fiscal Year</label>
              <input
                name="fiscal_year"
                type="number"
                required
                defaultValue={new Date().getFullYear()}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Optional description..."
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Modal: Create Version
// ===========================================================================

function CreateVersionModal({
  planMonth,
  onClose,
  onSubmit,
}: {
  planMonth: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative rounded-xl shadow-xl max-w-md w-full p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Create Version Snapshot</h2>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
            Captures a point-in-time snapshot of all allocations in this plan.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Version Label</label>
              <input
                name="label"
                type="text"
                placeholder="e.g., After Customer Review"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Notes</label>
              <textarea
                name="notes"
                rows={3}
                placeholder="What changed in this version..."
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Snapshot
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Modal: Add Cars
// ===========================================================================

function AddCarsModal({
  plan,
  onClose,
  onAdded,
}: {
  plan: MasterPlan;
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [selectedCars, setSelectedCars] = useState<{ car_number: string; car_type: string; lessee_name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedCars.length === 0) return;
    setSubmitting(true);
    try {
      const result = await addCarsToPlan(
        plan.id,
        selectedCars.map(c => c.car_number),
        plan.planning_month
      );
      const msgs: string[] = [];
      if (result.added > 0) msgs.push(`${result.added} car(s) added`);
      if (result.skipped > 0) msgs.push(`${result.skipped} already in plan`);
      if (result.errors.length > 0) msgs.push(`${result.errors.length} error(s)`);
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
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
            Search for cars by number. Selected cars will be added as unassigned allocations.
          </p>

          <TypeaheadSearch
            placeholder="Type car number (e.g., SHQX0012345)..."
            onSearch={q => searchCars(q)}
            onSelect={car => {
              if (!selectedCars.find(c => c.car_number === car.car_number)) {
                setSelectedCars([...selectedCars, car]);
              }
            }}
            renderItem={(car: { car_number: string; car_mark: string; car_type: string; lessee_name: string }) => (
              <div className="flex items-center justify-between">
                <span className="font-medium">{car.car_number}</span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {car.car_type} &middot; {car.lessee_name || 'No lessee'}
                </span>
              </div>
            )}
            getKey={car => car.car_number}
          />

          {selectedCars.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Selected ({selectedCars.length})
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {selectedCars.map(car => (
                  <div
                    key={car.car_number}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)]"
                  >
                    <div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{car.car_number}</span>
                      <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">{car.car_type}</span>
                    </div>
                    <button
                      onClick={() => setSelectedCars(selectedCars.filter(c => c.car_number !== car.car_number))}
                      className="text-[var(--color-text-tertiary)] hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedCars.length === 0 || submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : `Add ${selectedCars.length} Car(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Modal: Import from Demands
// ===========================================================================

function ImportDemandsModal({
  plan,
  onClose,
  onImported,
}: {
  plan: MasterPlan;
  onClose: () => void;
  onImported: () => void;
}) {
  const toast = useToast();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedDemandIds, setSelectedDemandIds] = useState<Set<string>>(new Set());
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [d, s] = await Promise.all([
          listDemands({ target_month: plan.planning_month }),
          listScenarios(),
        ]);
        setDemands(d);
        setScenarios(s);
      } catch {
        toast.error('Failed to load demands');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [plan.planning_month, toast]);

  const toggleDemand = (id: string) => {
    const next = new Set(selectedDemandIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDemandIds(next);
  };

  const handleImport = async () => {
    if (selectedDemandIds.size === 0) return;
    setSubmitting(true);
    try {
      const result = await importDemandsIntoPlan(
        plan.id,
        Array.from(selectedDemandIds),
        selectedScenarioId || undefined
      );
      const msgs: string[] = [`${result.imported} allocation(s) imported`];
      if (result.warnings.length > 0) {
        msgs.push(`${result.warnings.length} warning(s)`);
      }
      toast.success(msgs.join(', '));
      onImported();
    } catch {
      toast.error('Failed to import demands');
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
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Import from Demands</h2>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
            Select demands for {formatMonth(plan.planning_month)} to auto-generate allocations.
          </p>

          {/* Scenario selector */}
          {scenarios.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Scenario (optional)
              </label>
              <select
                value={selectedScenarioId}
                onChange={e => setSelectedScenarioId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
              >
                <option value="">Default</option>
                {scenarios.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Demands list */}
          {loading ? (
            <div className="py-8 text-center text-[var(--color-text-tertiary)]">Loading demands...</div>
          ) : demands.length === 0 ? (
            <div className="py-8 text-center text-[var(--color-text-tertiary)]">
              No demands found for {formatMonth(plan.planning_month)}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {demands.map(d => (
                <label
                  key={d.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedDemandIds.has(d.id)
                      ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800'
                      : 'bg-[var(--color-bg-secondary)] border border-transparent hover:border-[var(--color-border)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDemandIds.has(d.id)}
                    onChange={() => toggleDemand(d.id)}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{d.name}</div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">
                      {d.car_count} car(s) &middot; {d.status}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedDemandIds.size === 0 || submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Importing...' : `Import ${selectedDemandIds.size} Demand(s)`}
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

function AssignShopModal({
  plan,
  allocation,
  onClose,
  onAssigned,
}: {
  plan: MasterPlan;
  allocation: Allocation;
  onClose: () => void;
  onAssigned: () => void;
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

  const filteredResults = filter
    ? results.filter(r =>
        r.shop.shop_code.toLowerCase().includes(filter.toLowerCase()) ||
        r.shop.shop_name.toLowerCase().includes(filter.toLowerCase())
      )
    : results;

  const eligibleResults = filteredResults.filter(r => r.is_eligible);

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
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Car: {allocation.car_number || allocation.car_mark_number}
              </p>
            </div>
            <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter input */}
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter shops by name or code..."
            className="w-full px-3 py-2 mb-4 border border-[var(--color-border)] rounded-lg
                       bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]
                       placeholder:text-[var(--color-text-tertiary)]"
          />

          {/* Results */}
          {loading ? (
            <div className="py-8 text-center text-[var(--color-text-tertiary)]">Evaluating shops...</div>
          ) : eligibleResults.length === 0 ? (
            <div className="py-8 text-center text-[var(--color-text-tertiary)]">
              No eligible shops found{filter ? ' matching filter' : ''}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {eligibleResults.map(r => (
                <div
                  key={r.shop.shop_code}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {r.shop.shop_name}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        ({r.shop.shop_code})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-text-tertiary)]">
                      <span>Cost: {formatCurrency(r.cost_breakdown.total_cost)}</span>
                      <span>Backlog: {r.backlog.cars_backlog} cars</span>
                      {r.capacity.length > 0 && (
                        <span>
                          Utilization: {r.capacity[0].current_utilization_pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssign(r.shop.shop_code)}
                    disabled={assigning === r.shop.shop_code}
                    className="ml-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    {assigning === r.shop.shop_code ? 'Assigning...' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
