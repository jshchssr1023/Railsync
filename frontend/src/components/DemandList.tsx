'use client';

import { useState, useEffect, useCallback } from 'react';
import { Demand, DemandStatus, DemandPriority, EventType } from '@/types';
import { listDemands, createDemand, updateDemand, deleteDemand } from '@/lib/api';

interface DemandListProps {
  fiscalYear?: number;
  onSelect?: (demand: Demand) => void;
}

const STATUS_COLORS: Record<DemandStatus, string> = {
  Forecast: 'badge-info',
  Confirmed: 'badge-warning',
  Allocating: 'badge-warning',
  Allocated: 'badge-success',
  Complete: 'badge-success',
};

const PRIORITY_COLORS: Record<DemandPriority, string> = {
  Critical: 'text-danger-600 dark:text-danger-400',
  High: 'text-warning-600 dark:text-warning-400',
  Medium: 'text-gray-600 dark:text-gray-400',
  Low: 'text-gray-400 dark:text-gray-500',
};

export default function DemandList({ fiscalYear, onSelect }: DemandListProps) {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');

  const currentYear = fiscalYear || new Date().getFullYear();

  const fetchDemands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDemands({
        fiscal_year: currentYear,
        target_month: filterMonth || undefined,
        status: filterStatus || undefined,
      });
      setDemands(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demands');
    } finally {
      setLoading(false);
    }
  }, [currentYear, filterMonth, filterStatus]);

  useEffect(() => {
    fetchDemands();
  }, [fetchDemands]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this demand?')) return;
    try {
      await deleteDemand(id);
      fetchDemands();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete demand');
    }
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const totalCars = demands.reduce((sum, d) => sum + d.car_count, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Demand Forecasts
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {demands.length} demands, {totalCars.toLocaleString()} cars total
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="">All Status</option>
            <option value="Forecast">Forecast</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Allocated">Allocated</option>
            <option value="Complete">Complete</option>
          </select>
          <button
            onClick={() => {
              setEditingDemand(null);
              setShowForm(true);
            }}
            className="btn btn-primary text-sm py-1.5"
          >
            + New Demand
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading demands...</div>
        ) : demands.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No demands found for FY{currentYear}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Month</th>
                  <th>Type</th>
                  <th className="text-right">Cars</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {demands.map((demand) => (
                  <tr
                    key={demand.id}
                    onClick={() => onSelect?.(demand)}
                    className={onSelect ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
                  >
                    <td>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {demand.name}
                      </div>
                      {demand.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {demand.description}
                        </div>
                      )}
                    </td>
                    <td>{formatMonth(demand.target_month)}</td>
                    <td>{demand.event_type}</td>
                    <td className="text-right font-medium">
                      {demand.car_count.toLocaleString()}
                    </td>
                    <td>
                      <span className={PRIORITY_COLORS[demand.priority]}>
                        {demand.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[demand.status]}`}>
                        {demand.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDemand(demand);
                            setShowForm(true);
                          }}
                          className="p-1 text-gray-500 hover:text-primary-600"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(demand.id);
                          }}
                          className="p-1 text-gray-500 hover:text-danger-600"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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

      {/* Form Modal */}
      {showForm && (
        <DemandFormModal
          demand={editingDemand}
          fiscalYear={currentYear}
          onClose={() => {
            setShowForm(false);
            setEditingDemand(null);
          }}
          onSave={() => {
            setShowForm(false);
            setEditingDemand(null);
            fetchDemands();
          }}
        />
      )}
    </div>
  );
}

interface DemandFormModalProps {
  demand: Demand | null;
  fiscalYear: number;
  onClose: () => void;
  onSave: () => void;
}

function DemandFormModal({ demand, fiscalYear, onClose, onSave }: DemandFormModalProps) {
  const [formData, setFormData] = useState({
    name: demand?.name || '',
    description: demand?.description || '',
    target_month: demand?.target_month || `${fiscalYear}-01`,
    car_count: demand?.car_count || 0,
    event_type: demand?.event_type || 'Qualification' as EventType,
    car_type: demand?.car_type || '',
    priority: demand?.priority || 'Medium' as DemandPriority,
    required_network: demand?.required_network || '',
    status: demand?.status || 'Forecast' as DemandStatus,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (demand) {
        await updateDemand(demand.id, formData);
      } else {
        await createDemand({
          ...formData,
          fiscal_year: fiscalYear,
        } as Omit<Demand, 'id' | 'created_at' | 'updated_at'>);
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save demand');
    } finally {
      setSaving(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = (i + 1).toString().padStart(2, '0');
    return `${fiscalYear}-${month}`;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {demand ? 'Edit Demand' : 'New Demand'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
              placeholder="e.g., Q2 2026 Tank Qualifications"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Target Month *</label>
              <select
                value={formData.target_month}
                onChange={(e) => setFormData({ ...formData, target_month: e.target.value })}
                className="input"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Car Count *</label>
              <input
                type="number"
                value={formData.car_count}
                onChange={(e) => setFormData({ ...formData, car_count: parseInt(e.target.value) || 0 })}
                className="input"
                min="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Event Type</label>
              <select
                value={formData.event_type}
                onChange={(e) => setFormData({ ...formData, event_type: e.target.value as EventType })}
                className="input"
              >
                <option value="Qualification">Qualification</option>
                <option value="Assignment">Assignment</option>
                <option value="Return">Return</option>
                <option value="Running Repair">Running Repair</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as DemandPriority })}
                className="input"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Car Type</label>
            <input
              type="text"
              value={formData.car_type}
              onChange={(e) => setFormData({ ...formData, car_type: e.target.value })}
              className="input"
              placeholder="e.g., General Service Tank"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : demand ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
