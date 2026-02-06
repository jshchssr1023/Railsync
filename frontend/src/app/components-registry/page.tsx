'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Wrench, Search, X, Plus, Filter, RefreshCw,
  CheckCircle, AlertTriangle, Clock, Eye, ChevronUp, Settings,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import {
  listComponents, getComponent, createComponent, getComponentStats,
  recordComponentInspection, getCarComponents,
} from '@/lib/api';
import type {
  RailcarComponent, ComponentWithHistory, ComponentStats,
  ComponentType, ComponentStatus,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COMPONENT_TYPES: { value: ComponentType; label: string }[] = [
  { value: 'valve', label: 'Valve' },
  { value: 'bov', label: 'BOV (Bottom Outlet Valve)' },
  { value: 'fitting', label: 'Fitting' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'relief_device', label: 'Relief Device' },
  { value: 'lining', label: 'Lining' },
  { value: 'coating', label: 'Coating' },
  { value: 'heater', label: 'Heater' },
  { value: 'other', label: 'Other' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  removed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  replaced: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const INSPECTION_STATUS_COLORS: Record<string, string> = {
  overdue: 'text-red-600 dark:text-red-400',
  due_soon: 'text-yellow-600 dark:text-yellow-400',
  current: 'text-green-600 dark:text-green-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatDate = (d: string | null) => {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const capitalize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function getInspectionStatus(nextDue: string | null): { label: string; color: string } {
  if (!nextDue) return { label: 'No Schedule', color: 'text-gray-500' };
  const days = Math.ceil((new Date(nextDue).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `${Math.abs(days)}d Overdue`, color: INSPECTION_STATUS_COLORS.overdue };
  if (days <= 30) return { label: `${days}d`, color: INSPECTION_STATUS_COLORS.due_soon };
  return { label: `${days}d`, color: INSPECTION_STATUS_COLORS.current };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {capitalize(status)}
    </span>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{value.toLocaleString()}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ComponentRegistryPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState<RailcarComponent[]>([]);
  const [stats, setStats] = useState<ComponentStats | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<ComponentWithHistory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [carFilter, setCarFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newComponent, setNewComponent] = useState({
    car_number: '', component_type: 'valve' as ComponentType,
    serial_number: '', manufacturer: '', model: '',
    install_date: '', next_inspection_due: '', notes: '',
  });

  // Inspect modal
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [inspectData, setInspectData] = useState({
    componentId: '', shopCode: '', notes: '', nextInspectionDue: '', workOrderReference: '',
  });

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const loadComponents = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string | number> = { limit: 100 };
      if (carFilter) filters.car_number = carFilter;
      if (typeFilter) filters.component_type = typeFilter;
      if (statusFilter) filters.status = statusFilter;
      const data = await listComponents(filters as any);
      setComponents(Array.isArray(data) ? data : (data as any)?.components || []);
    } catch (err) {
      console.error('Failed to load components:', err);
      toast.error('Failed to load components');
    } finally {
      setLoading(false);
    }
  }, [carFilter, typeFilter, statusFilter, toast]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getComponentStats();
      setStats(data as ComponentStats);
    } catch {
      // Stats are optional, fail silently
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadComponents();
    loadStats();
  }, [isAuthenticated, loadComponents, loadStats]);

  const handleViewDetail = async (id: string) => {
    if (selectedComponent?.id === id) { setSelectedComponent(null); return; }
    setDetailLoading(true);
    try {
      const data = await getComponent(id);
      setSelectedComponent(data as ComponentWithHistory);
    } catch {
      toast.error('Failed to load component details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createComponent({
        car_number: newComponent.car_number,
        component_type: newComponent.component_type,
        serial_number: newComponent.serial_number || undefined,
        manufacturer: newComponent.manufacturer || undefined,
        model: newComponent.model || undefined,
        install_date: newComponent.install_date || undefined,
        next_inspection_due: newComponent.next_inspection_due || undefined,
        notes: newComponent.notes || undefined,
      });
      setShowCreateModal(false);
      setNewComponent({
        car_number: '', component_type: 'valve', serial_number: '',
        manufacturer: '', model: '', install_date: '', next_inspection_due: '', notes: '',
      });
      toast.success('Component created');
      await loadComponents();
      await loadStats();
    } catch (err) {
      console.error('Failed to create component:', err);
      toast.error('Failed to create component');
    }
  };

  const handleRecordInspection = async () => {
    try {
      await recordComponentInspection(inspectData.componentId, {
        shopCode: inspectData.shopCode || undefined,
        notes: inspectData.notes || undefined,
        nextInspectionDue: inspectData.nextInspectionDue || undefined,
        workOrderReference: inspectData.workOrderReference || undefined,
      });
      setShowInspectModal(false);
      setInspectData({ componentId: '', shopCode: '', notes: '', nextInspectionDue: '', workOrderReference: '' });
      toast.success('Inspection recorded');
      await loadComponents();
    } catch (err) {
      console.error('Failed to record inspection:', err);
      toast.error('Failed to record inspection');
    }
  };

  // -------------------------------------------------------------------------
  // Auth gate
  // -------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view components.</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Component Registry</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track valves, BOVs, fittings, and other physical components installed on railcars
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Component
          </button>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Total Components"
              value={stats.total}
              icon={<Settings className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50 dark:bg-blue-900/20"
            />
            <KpiCard
              label="Active"
              value={stats.by_status?.find(s => s.status === 'active')?.count || 0}
              icon={<CheckCircle className="w-5 h-5 text-green-600" />}
              color="bg-green-50 dark:bg-green-900/20"
            />
            <KpiCard
              label="Overdue Inspections"
              value={stats.overdue_inspections || 0}
              icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
              color="bg-red-50 dark:bg-red-900/20"
            />
            <KpiCard
              label="Due Soon (30d)"
              value={stats.due_soon_inspections || 0}
              icon={<Clock className="w-5 h-5 text-yellow-600" />}
              color="bg-yellow-50 dark:bg-yellow-900/20"
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Car Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={carFilter}
                  onChange={(e) => setCarFilter(e.target.value)}
                  placeholder="Search car..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                {carFilter && (
                  <button onClick={() => setCarFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="">All Types</option>
                {COMPONENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="removed">Removed</option>
                <option value="failed">Failed</option>
                <option value="replaced">Replaced</option>
              </select>
            </div>
            <button
              onClick={loadComponents}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700"
            >
              <Filter className="w-4 h-4" />
              Apply
            </button>
            {(carFilter || typeFilter || statusFilter) && (
              <button
                onClick={() => { setCarFilter(''); setTypeFilter(''); setStatusFilter(''); }}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-primary-600" />
          </div>
        )}

        {/* Components Table */}
        {!loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Car #</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Serial #</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Manufacturer</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Installed</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Next Inspection</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {components.map((comp) => {
                    const inspStatus = getInspectionStatus(comp.next_inspection_due);
                    return (
                      <>
                        <tr key={comp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-gray-100">
                            {comp.car_number}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {COMPONENT_TYPES.find(t => t.value === comp.component_type)?.label || capitalize(comp.component_type)}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-100">
                            {comp.serial_number || '--'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {comp.manufacturer || '--'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={comp.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {formatDate(comp.install_date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${inspStatus.color}`}>
                              {comp.next_inspection_due ? formatDate(comp.next_inspection_due) : '--'}
                            </span>
                            {comp.next_inspection_due && (
                              <span className={`ml-1 text-xs ${inspStatus.color}`}>({inspStatus.label})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleViewDetail(comp.id)}
                                className="p-1 text-gray-400 hover:text-primary-600"
                                title="View details"
                              >
                                {selectedComponent?.id === comp.id ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              {comp.status === 'active' && (
                                <button
                                  onClick={() => {
                                    setInspectData({ ...inspectData, componentId: comp.id });
                                    setShowInspectModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                  title="Record inspection"
                                >
                                  <Wrench className="w-3 h-3" />
                                  Inspect
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Detail row */}
                        {selectedComponent?.id === comp.id && (
                          <tr key={`${comp.id}-detail`}>
                            <td colSpan={8} className="px-4 py-4 bg-gray-50 dark:bg-gray-900/50">
                              {detailLoading ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Model</p>
                                      <p className="text-sm text-gray-900 dark:text-gray-100">{selectedComponent.model || '--'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Specification</p>
                                      <p className="text-sm text-gray-900 dark:text-gray-100">{selectedComponent.specification || '--'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Last Inspection</p>
                                      <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedComponent.last_inspection_date)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
                                      <p className="text-sm text-gray-900 dark:text-gray-100">{selectedComponent.notes || '--'}</p>
                                    </div>
                                  </div>
                                  {selectedComponent.history && selectedComponent.history.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">History</h4>
                                      <div className="space-y-2">
                                        {selectedComponent.history.slice(0, 10).map((h) => (
                                          <div key={h.id} className="flex items-center gap-3 text-xs">
                                            <span className="w-20 text-gray-500 dark:text-gray-400">{formatDate(h.performed_at)}</span>
                                            <StatusBadge status={h.action} />
                                            {h.shop_code && <span className="text-gray-500 dark:text-gray-400">@ {h.shop_code}</span>}
                                            {h.work_order_reference && <span className="font-mono text-gray-500 dark:text-gray-400">WO: {h.work_order_reference}</span>}
                                            {h.notes && <span className="text-gray-600 dark:text-gray-400 truncate">{h.notes}</span>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {components.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                          <Settings className="w-10 h-10" strokeWidth={1.5} />
                          <p className="mt-3 text-sm">No components found. Add one to get started.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Component Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Component</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Car Number *</label>
                    <input
                      type="text"
                      value={newComponent.car_number}
                      onChange={(e) => setNewComponent({ ...newComponent, car_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., UTLX 12345"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
                    <select
                      value={newComponent.component_type}
                      onChange={(e) => setNewComponent({ ...newComponent, component_type: e.target.value as ComponentType })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {COMPONENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial Number</label>
                    <input
                      type="text"
                      value={newComponent.serial_number}
                      onChange={(e) => setNewComponent({ ...newComponent, serial_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={newComponent.manufacturer}
                      onChange={(e) => setNewComponent({ ...newComponent, manufacturer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
                    <input
                      type="text"
                      value={newComponent.model}
                      onChange={(e) => setNewComponent({ ...newComponent, model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Install Date</label>
                    <input
                      type="date"
                      value={newComponent.install_date}
                      onChange={(e) => setNewComponent({ ...newComponent, install_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Inspection Due</label>
                  <input
                    type="date"
                    value={newComponent.next_inspection_due}
                    onChange={(e) => setNewComponent({ ...newComponent, next_inspection_due: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    value={newComponent.notes}
                    onChange={(e) => setNewComponent({ ...newComponent, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!newComponent.car_number}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Record Inspection Modal */}
        {showInspectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Record Inspection</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shop Code</label>
                  <input
                    type="text"
                    value={inspectData.shopCode}
                    onChange={(e) => setInspectData({ ...inspectData, shopCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="e.g., SHOP01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Work Order Reference</label>
                  <input
                    type="text"
                    value={inspectData.workOrderReference}
                    onChange={(e) => setInspectData({ ...inspectData, workOrderReference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Inspection Due</label>
                  <input
                    type="date"
                    value={inspectData.nextInspectionDue}
                    onChange={(e) => setInspectData({ ...inspectData, nextInspectionDue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    value={inspectData.notes}
                    onChange={(e) => setInspectData({ ...inspectData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowInspectModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRecordInspection}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Record Inspection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
