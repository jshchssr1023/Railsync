'use client';

import { useState, useEffect } from 'react';
import { FileBarChart, X } from 'lucide-react';

const EVENT_TYPE_OPTIONS = [
  { value: 'Qualification', label: 'Qualification' },
  { value: 'Assignment', label: 'Assignment' },
  { value: 'Return', label: 'Return' },
  { value: 'Running Repair', label: 'Running Repair' },
];

const PRIORITY_OPTIONS = [
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const PROJECT_TYPE_TO_EVENT: Record<string, string> = {
  qualification: 'Qualification',
  assignment: 'Assignment',
  release: 'Return',
  lining: 'Running Repair',
};

interface ProjectContext {
  project_number: string;
  project_name: string;
  project_type: string;
  lessee_code: string | null;
  lessee_name: string | null;
  total_cars: number;
  unplanned_cars: number;
}

export interface CreateDemandFormData {
  name: string;
  event_type: string;
  fiscal_year: number;
  target_month: string;
  car_count: number;
  priority: string;
  car_type?: string;
  max_cost_per_car?: number;
  description?: string;
}

interface CreateDemandDialogProps {
  open: boolean;
  onConfirm: (data: CreateDemandFormData) => void;
  onCancel: () => void;
  project: ProjectContext | null;
  loading?: boolean;
}

export default function CreateDemandDialog({
  open,
  onConfirm,
  onCancel,
  project,
  loading = false,
}: CreateDemandDialogProps) {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState('');
  const [carCount, setCarCount] = useState(0);
  const [priority, setPriority] = useState('Medium');
  const [carType, setCarType] = useState('');
  const [maxCost, setMaxCost] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open && project) {
      setName(`${project.project_name} - Demand`);
      setEventType(PROJECT_TYPE_TO_EVENT[project.project_type] || 'Qualification');
      setFiscalYear(new Date().getFullYear());
      setTargetMonth('');
      setCarCount(project.unplanned_cars);
      setPriority('Medium');
      setCarType('');
      setMaxCost('');
      setDescription('');
    }
  }, [open, project]);

  if (!open || !project) return null;

  const isValid = name.trim() && eventType && targetMonth && carCount > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <FileBarChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Create Demand from Project
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Feed unplanned cars into the allocation engine
                  </p>
                </div>
              </div>
              <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Project context (read-only) */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Project</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{project.project_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Name</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{project.project_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Type</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{project.project_type}</span>
              </div>
              {project.lessee_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Lessee</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{project.lessee_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Cars</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{project.total_cars} total, {project.unplanned_cars} unplanned</span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Demand Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type *</label>
                  <select
                    value={eventType}
                    onChange={e => setEventType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  >
                    <option value="">Select...</option>
                    {EVENT_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  >
                    {PRIORITY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fiscal Year *</label>
                  <input
                    type="number"
                    value={fiscalYear}
                    onChange={e => setFiscalYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Month *</label>
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={e => setTargetMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Car Count *</label>
                  <input
                    type="number"
                    value={carCount}
                    onChange={e => setCarCount(parseInt(e.target.value, 10) || 0)}
                    min={1}
                    max={project.unplanned_cars}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Car Type</label>
                  <input
                    type="text"
                    value={carType}
                    onChange={e => setCarType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                    placeholder="e.g. Tank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Cost / Car</label>
                  <input
                    type="number"
                    value={maxCost}
                    onChange={e => setMaxCost(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  placeholder="Optional notes for the allocation engine..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm({
                  name: name.trim(),
                  event_type: eventType,
                  fiscal_year: fiscalYear,
                  target_month: targetMonth,
                  car_count: carCount,
                  priority,
                  car_type: carType || undefined,
                  max_cost_per_car: maxCost ? parseFloat(maxCost) : undefined,
                  description: description.trim() || undefined,
                })}
                disabled={loading || !isValid}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Demand'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
