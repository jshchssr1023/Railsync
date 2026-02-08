'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  Package,
  FileText,
  ShoppingCart,
  Train,
  Building2,
  ChevronDown,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type SourceType = 'project' | 'shopping_event' | 'standalone';

interface Project {
  id: string;
  project_number: string;
  project_name: string;
  project_type?: string;
  cars?: Array<{
    id: string;
    car_number: string;
    shop_code?: string;
    shop_name?: string;
  }>;
}

interface ShoppingEvent {
  id: string;
  event_number: string;
  car_number: string;
  shop_code: string;
  shop_name?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorkPackageComposerProps {
  onClose: () => void;
  onCreated: (wp: any) => void;
  defaultProjectId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkPackageComposer({
  onClose,
  onCreated,
  defaultProjectId,
}: WorkPackageComposerProps) {
  const { getAccessToken } = useAuth();
  const toast = useToast();

  // Form state
  const [sourceType, setSourceType] = useState<SourceType>(
    defaultProjectId ? 'project' : 'standalone'
  );
  const [projectId, setProjectId] = useState<string>(defaultProjectId || '');
  const [carId, setCarId] = useState<string>('');
  const [shoppingEventId, setShoppingEventId] = useState<string>('');
  const [carNumber, setCarNumber] = useState<string>('');
  const [shopCode, setShopCode] = useState<string>('');
  const [specialInstructions, setSpecialInstructions] = useState<string>('');

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCars, setProjectCars] = useState<Project['cars']>([]);
  const [shoppingEvents, setShoppingEvents] = useState<ShoppingEvent[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingCars, setLoadingCars] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/projects?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setProjects(json.data || []);
      }
    } catch {
      // Non-critical; projects dropdown will be empty
    } finally {
      setLoadingProjects(false);
    }
  }, [getAccessToken]);

  const fetchProjectCars = useCallback(async (projId: string) => {
    if (!projId) {
      setProjectCars([]);
      return;
    }
    setLoadingCars(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/projects/${projId}/cars`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setProjectCars(json.data || []);
      }
    } catch {
      setProjectCars([]);
    } finally {
      setLoadingCars(false);
    }
  }, [getAccessToken]);

  const fetchShoppingEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/shopping?state=WORK_AUTHORIZED,IN_REPAIR&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setShoppingEvents(json.data || []);
      }
    } catch {
      setShoppingEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [getAccessToken]);

  // Load initial data based on source type
  useEffect(() => {
    if (sourceType === 'project') {
      fetchProjects();
    } else if (sourceType === 'shopping_event') {
      fetchShoppingEvents();
    }
  }, [sourceType, fetchProjects, fetchShoppingEvents]);

  // Load project cars when project changes
  useEffect(() => {
    if (sourceType === 'project' && projectId) {
      fetchProjectCars(projectId);
    }
  }, [sourceType, projectId, fetchProjectCars]);

  // -----------------------------------------------------------------------
  // Form validation
  // -----------------------------------------------------------------------

  const isValid = (): boolean => {
    if (sourceType === 'project') {
      return !!projectId && !!carId;
    }
    if (sourceType === 'shopping_event') {
      return !!shoppingEventId;
    }
    // standalone
    return !!carNumber.trim() && !!shopCode.trim();
  };

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const handleSubmit = async () => {
    if (!isValid()) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = getAccessToken();
      let body: Record<string, unknown> = {
        special_instructions: specialInstructions.trim() || undefined,
      };

      if (sourceType === 'project') {
        body.project_car_id = carId;
        body.project_id = projectId;
      } else if (sourceType === 'shopping_event') {
        body.shopping_event_id = shoppingEventId;
      } else {
        body.car_number = carNumber.trim();
        body.shop_code = shopCode.trim();
      }

      const res = await fetch(`${API_BASE}/work-packages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to create work package (${res.status})`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to create work package');
      }

      toast.success('Draft work package created');
      onCreated(json.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create work package';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Keyboard: Escape to close
  // -----------------------------------------------------------------------

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Create Work Package">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 transition-opacity" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Create Work Package
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Error display */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Section 1: Source */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Source
              </h3>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <SourceRadioButton
                  selected={sourceType === 'project'}
                  onClick={() => {
                    setSourceType('project');
                    setShoppingEventId('');
                    setCarNumber('');
                    setShopCode('');
                  }}
                  icon={<FileText className="w-4 h-4" />}
                  label="From Project"
                />
                <SourceRadioButton
                  selected={sourceType === 'shopping_event'}
                  onClick={() => {
                    setSourceType('shopping_event');
                    setProjectId('');
                    setCarId('');
                    setCarNumber('');
                    setShopCode('');
                  }}
                  icon={<ShoppingCart className="w-4 h-4" />}
                  label="Shopping Event"
                />
                <SourceRadioButton
                  selected={sourceType === 'standalone'}
                  onClick={() => {
                    setSourceType('standalone');
                    setProjectId('');
                    setCarId('');
                    setShoppingEventId('');
                  }}
                  icon={<Train className="w-4 h-4" />}
                  label="Standalone"
                />
              </div>

              {/* Project source fields */}
              {sourceType === 'project' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Project <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={projectId}
                        onChange={(e) => {
                          setProjectId(e.target.value);
                          setCarId('');
                        }}
                        disabled={loadingProjects}
                        className="w-full appearance-none px-3 py-2 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">
                          {loadingProjects ? 'Loading projects...' : 'Select a project'}
                        </option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.project_number} - {p.project_name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {projectId && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Car <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={carId}
                          onChange={(e) => setCarId(e.target.value)}
                          disabled={loadingCars}
                          className="w-full appearance-none px-3 py-2 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                        >
                          <option value="">
                            {loadingCars ? 'Loading cars...' : 'Select a car'}
                          </option>
                          {projectCars?.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.car_number}
                              {c.shop_name ? ` (${c.shop_name})` : c.shop_code ? ` (${c.shop_code})` : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                      {projectCars && projectCars.length === 0 && !loadingCars && (
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          No cars found in this project.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Shopping Event source fields */}
              {sourceType === 'shopping_event' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Shopping Event <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={shoppingEventId}
                      onChange={(e) => setShoppingEventId(e.target.value)}
                      disabled={loadingEvents}
                      className="w-full appearance-none px-3 py-2 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                    >
                      <option value="">
                        {loadingEvents ? 'Loading events...' : 'Select an event'}
                      </option>
                      {shoppingEvents.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.event_number} - Car {ev.car_number} @ {ev.shop_name || ev.shop_code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  {shoppingEvents.length === 0 && !loadingEvents && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      No eligible shopping events found (looking for Work Authorized or In Repair states).
                    </p>
                  )}
                </div>
              )}

              {/* Standalone source fields */}
              {sourceType === 'standalone' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Car Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Train className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={carNumber}
                        onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
                        placeholder="e.g., GATX 12345"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Shop Code <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={shopCode}
                        onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                        placeholder="e.g., MIDL"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Section 2: Instructions */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Instructions
              </h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Special Instructions
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Add any special instructions for this work package..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Optional. The SOW, CCM, and document composition happens after creation via the detail panel.
                </p>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !isValid()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Draft Work Package
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SourceRadioButton({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border-2 text-xs font-medium transition-colors ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      <div className={`${selected ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
        {icon}
      </div>
      {label}
    </button>
  );
}
