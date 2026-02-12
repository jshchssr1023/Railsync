'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, ChevronDown, ChevronRight, Train, Layers, Shield, Wrench,
  FileText, MapPin, ExternalLink, ClipboardList, Loader2,
  Package, Trash2, CheckCircle, ArrowLeftRight, Undo2,
  Calendar, History, Save,
} from 'lucide-react';
import Link from 'next/link';
import UmlerSpecSection from '@/components/UmlerSpecSection';
import { QualBadge, StatusBadge, QualStatusBadge } from './CarBadges';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('railsync_access_token');
}

async function apiFetch<T>(endpoint: string, opts?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, { ...opts, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

// ---------------------------------------------------------------------------
// Operational Status Group display config
// ---------------------------------------------------------------------------
const STATUS_GROUP_CONFIG: Record<string, { label: string; color: string; icon: typeof Wrench }> = {
  in_shop: { label: 'In Shop', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Wrench },
  idle_storage: { label: 'Idle / Storage', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: Package },
  ready_to_load: { label: 'Ready to Load', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: ClipboardList },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CarDetail {
  car: Record<string, any>;
  shopping_events_count: number;
  active_shopping_event: { id: string; event_number: string; state: string; shop_code: string } | null;
  lease_info: { lease_id: string; lease_name: string; lease_status: string; customer_name: string; customer_code: string } | null;
}

interface QualRecord {
  id: string;
  type_name: string;
  type_code: string;
  status: string;
  next_due_date: string | null;
  last_completed_date: string | null;
  regulatory_body: string;
  is_exempt: boolean;
  interval_months: number | null;
  completion_shop_code: string | null;
  certificate_number: string | null;
}

interface QualHistoryEntry {
  id: string;
  action: string;
  performed_date: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// CarDrawer Component
// ---------------------------------------------------------------------------
export default function CarDrawer({ carNumber, onClose }: { carNumber: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['general', 'specifications', 'qualifications', 'lease'])
  );
  const [umlerData, setUmlerData] = useState<Record<string, any> | null>(null);
  const [umlerLoading, setUmlerLoading] = useState(false);
  const [umlerLoaded, setUmlerLoaded] = useState(false);
  const [qualRecords, setQualRecords] = useState<QualRecord[]>([]);
  const [qualRecordsLoading, setQualRecordsLoading] = useState(false);
  const [qualRecordsLoaded, setQualRecordsLoaded] = useState(false);
  const [clmLocation, setClmLocation] = useState<Record<string, any> | null>(null);
  const [clmLocationLoading, setClmLocationLoading] = useState(false);
  const [clmLocationLoaded, setClmLocationLoaded] = useState(false);
  // Qualification completion form state
  const [completingQualId, setCompletingQualId] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState({ completed_date: '', completion_shop_code: '', certificate_number: '', notes: '' });
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  // Qualification history state
  const [historyQualId, setHistoryQualId] = useState<string | null>(null);
  const [qualHistory, setQualHistory] = useState<QualHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setUmlerData(null);
    setUmlerLoaded(false);
    setQualRecords([]);
    setQualRecordsLoaded(false);
    setClmLocation(null);
    setClmLocationLoaded(false);
    apiFetch<{ data: CarDetail }>(`/contracts-browse/car/${carNumber}`)
      .then(res => {
        setDetail(res.data);
        if (res.data?.car?.car_id && expandedSections.has('qualifications')) {
          setQualRecordsLoading(true);
          apiFetch<{ data: QualRecord[] }>(`/cars/${res.data.car.car_id}/qualifications`)
            .then(qRes => { setQualRecords(qRes.data || []); setQualRecordsLoaded(true); })
            .catch(() => { setQualRecords([]); setQualRecordsLoaded(true); })
            .finally(() => setQualRecordsLoading(false));
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carNumber]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const car = detail?.car;

  const toggleSection = (s: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
    if (s === 'umler' && !umlerLoaded) {
      setUmlerLoading(true);
      apiFetch<{ data: Record<string, any> | null }>(`/cars/${carNumber}/umler`)
        .then(res => { setUmlerData(res.data); setUmlerLoaded(true); })
        .catch(() => { setUmlerData(null); setUmlerLoaded(true); })
        .finally(() => setUmlerLoading(false));
    }
    if (s === 'qualifications' && !qualRecordsLoaded && car?.car_id) {
      setQualRecordsLoading(true);
      apiFetch<{ data: QualRecord[] }>(`/cars/${car.car_id}/qualifications`)
        .then(res => { setQualRecords(res.data || []); setQualRecordsLoaded(true); })
        .catch(() => { setQualRecords([]); setQualRecordsLoaded(true); })
        .finally(() => setQualRecordsLoading(false));
    }
    if (s === 'location' && !clmLocationLoaded) {
      setClmLocationLoading(true);
      apiFetch<{ data: Record<string, any> | null }>(`/car-locations/${carNumber}`)
        .then(res => { setClmLocation(res.data); setClmLocationLoaded(true); })
        .catch(() => { setClmLocation(null); setClmLocationLoaded(true); })
        .finally(() => setClmLocationLoading(false));
    }
  };

  const handleCompleteQualification = async (qualId: string) => {
    if (!completeForm.completed_date) { setCompleteError('Completion date is required'); return; }
    setCompleteSubmitting(true);
    setCompleteError(null);
    try {
      await apiFetch(`/qualifications/${qualId}/complete`, {
        method: 'POST',
        body: JSON.stringify(completeForm),
      });
      // Refresh qualification records
      if (car?.car_id) {
        const qRes = await apiFetch<{ data: QualRecord[] }>(`/cars/${car.car_id}/qualifications`);
        setQualRecords(qRes.data || []);
      }
      setCompletingQualId(null);
      setCompleteForm({ completed_date: '', completion_shop_code: '', certificate_number: '', notes: '' });
    } catch (err: any) {
      setCompleteError(err.message || 'Failed to complete qualification');
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const loadQualHistory = async (qualId: string) => {
    if (historyQualId === qualId) { setHistoryQualId(null); return; } // Toggle off
    setHistoryQualId(qualId);
    setHistoryLoading(true);
    try {
      const res = await apiFetch<{ data: QualHistoryEntry[] }>(`/qualifications/${qualId}/history`);
      setQualHistory(res.data || []);
    } catch {
      setQualHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const Section = ({ id, title, icon: Icon, children }: {
    id: string; title: string; icon: typeof Train; children: React.ReactNode;
  }) => (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          <Icon className="w-4 h-4 text-gray-400" />
          {title}
        </div>
        {expandedSections.has(id) ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {expandedSections.has(id) && (
        <div className="px-4 pb-3">{children}</div>
      )}
    </div>
  );

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between py-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right max-w-[60%] truncate">
        {value ?? '-'}
      </span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full w-[480px] max-w-full bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col animate-slide-in-right"
      >
        {/* Sticky Header */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{carNumber}</h2>
                {car?.operational_status_group && STATUS_GROUP_CONFIG[car.operational_status_group] && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_GROUP_CONFIG[car.operational_status_group].color}`}>
                    {STATUS_GROUP_CONFIG[car.operational_status_group].label}
                  </span>
                )}
              </div>
              {car && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {car.car_type || 'Unknown Type'} &middot; {car.commodity || 'No Commodity'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {detail?.active_shopping_event && (
                <a
                  href={`/shopping/${detail.active_shopping_event.id}`}
                  className="text-xs px-2 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/50 flex items-center gap-1"
                >
                  <Wrench className="w-3 h-3" />
                  {detail.active_shopping_event.state}
                </a>
              )}
              <Link
                href={`/cars/${encodeURIComponent(carNumber)}`}
                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Full Detail
              </Link>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Quick Stats Row */}
          {car && (
            <div className="grid grid-cols-4 gap-0 border-t border-gray-200 dark:border-gray-700">
              <div className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400">Age</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{car.car_age ?? '-'}</div>
              </div>
              <div className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400">Tank Qual</div>
                <div className="text-sm font-semibold"><QualBadge year={car.tank_qual_year} /></div>
              </div>
              <div className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
                <div className="text-sm"><StatusBadge status={car.current_status} /></div>
              </div>
              <div className="px-3 py-2 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Events</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{detail?.shopping_events_count ?? 0}</div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : !car ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">Car not found</div>
          ) : (
            <>
              {/* General Info */}
              <Section id="general" title="General Information" icon={Train}>
                <Field label="Car Number" value={car.car_number} />
                <Field label="Car Mark" value={car.car_mark} />
                <Field label="Car ID" value={car.car_id} />
                <Field label="Car Type" value={car.car_type} />
                <Field label="Lessee" value={car.lessee_name} />
                <Field label="Lessee Code" value={car.lessee_code} />
                <Field label="FMS Lessee #" value={car.fms_lessee_number} />
                <Field label="CSR" value={car.csr_name} />
                <Field label="CSL" value={car.csl_name} />
                <Field label="Commercial" value={car.commercial_contact} />
                <Field label="Portfolio" value={car.portfolio_status} />
              </Section>

              {/* Specifications */}
              <Section id="specifications" title="Specifications" icon={Layers}>
                <Field label="Commodity" value={car.commodity} />
                <Field label="Jacketed" value={car.is_jacketed ? 'Yes' : 'No'} />
                <Field label="Lined" value={car.is_lined ? 'Yes' : 'No'} />
                <Field label="Lining Type" value={car.lining_type} />
                <Field label="Material Type" value={car.material_type} />
                <Field label="Product Code" value={car.product_code} />
                <Field label="Stencil Class" value={car.stencil_class} />
                <Field label="Car Age" value={car.car_age ? `${car.car_age} years` : null} />
                <Field label="Has Asbestos" value={car.has_asbestos ? 'Yes' : 'No'} />
                <Field label="Nitrogen Pad Stage" value={car.nitrogen_pad_stage} />
              </Section>

              {/* Regulatory / Qualifications */}
              <Section id="qualifications" title="Qualifications & Due Dates" icon={Shield}>
                <div className="space-y-1">
                  {[
                    { label: 'Tank Qualification', value: car.tank_qual_year },
                    { label: 'Min (No Lining)', value: car.min_no_lining_year },
                    { label: 'Min (With Lining)', value: car.min_lining_year },
                    { label: 'Interior Lining', value: car.interior_lining_year },
                    { label: 'Rule 88B', value: car.rule_88b_year },
                    { label: 'Safety Relief', value: car.safety_relief_year },
                    { label: 'Service Equipment', value: car.service_equipment_year },
                    { label: 'Stub Sill', value: car.stub_sill_year },
                    { label: 'Tank Thickness', value: car.tank_thickness_year },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between py-1 items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                      <QualBadge year={item.value} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Field label="Full/Partial Qual" value={car.full_partial_qual} />
                  <Field label="Perform Tank Qual" value={car.perform_tank_qual ? 'Yes' : 'No'} />
                  <Field label="Qual Expiration" value={car.qual_exp_date?.slice(0, 10)} />
                </div>
                {/* Qualification Records from qualifications table */}
                {qualRecordsLoading ? (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary-500 inline-block" />
                  </div>
                ) : qualRecords.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 mb-1 tracking-wider">Compliance Records</p>
                    {qualRecords.map(qr => (
                      <div key={qr.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                        {/* Row: type name, status, action buttons */}
                        <div className="flex items-center justify-between py-1.5">
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{qr.type_name}</span>
                            <span className="text-[10px] text-gray-400 ml-1">({qr.regulatory_body})</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {qr.next_due_date && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">{qr.next_due_date}</span>
                            )}
                            <QualStatusBadge status={qr.status} />
                            {/* History toggle */}
                            <button
                              onClick={() => loadQualHistory(qr.id)}
                              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="View history"
                            >
                              <History className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                            </button>
                            {/* Complete action — only for actionable statuses */}
                            {!qr.is_exempt && qr.status !== 'current' && (
                              <button
                                onClick={() => {
                                  if (completingQualId === qr.id) {
                                    setCompletingQualId(null);
                                  } else {
                                    setCompletingQualId(qr.id);
                                    setCompleteForm({ completed_date: '', completion_shop_code: '', certificate_number: '', notes: '' });
                                    setCompleteError(null);
                                  }
                                }}
                                className="p-0.5 rounded hover:bg-green-50 dark:hover:bg-green-900/30"
                                title="Record completion"
                              >
                                <Calendar className="w-3 h-3 text-green-500 hover:text-green-700 dark:hover:text-green-400" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline completion form */}
                        {completingQualId === qr.id && (
                          <div className="pb-2 pl-2 space-y-1.5">
                            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Record Completion</div>
                            {completeError && (
                              <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">{completeError}</div>
                            )}
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="text-[10px] text-gray-400">Date *</label>
                                <input
                                  type="date"
                                  value={completeForm.completed_date}
                                  onChange={e => setCompleteForm(f => ({ ...f, completed_date: e.target.value }))}
                                  className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-400">Shop Code</label>
                                <input
                                  type="text"
                                  placeholder="e.g. TRIN"
                                  value={completeForm.completion_shop_code}
                                  onChange={e => setCompleteForm(f => ({ ...f, completion_shop_code: e.target.value }))}
                                  className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-400">Certificate #</label>
                                <input
                                  type="text"
                                  placeholder="Optional"
                                  value={completeForm.certificate_number}
                                  onChange={e => setCompleteForm(f => ({ ...f, certificate_number: e.target.value }))}
                                  className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-400">Notes</label>
                                <input
                                  type="text"
                                  placeholder="Optional"
                                  value={completeForm.notes}
                                  onChange={e => setCompleteForm(f => ({ ...f, notes: e.target.value }))}
                                  className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => handleCompleteQualification(qr.id)}
                                disabled={completeSubmitting}
                                className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium"
                              >
                                {completeSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Save
                              </button>
                              <button
                                onClick={() => setCompletingQualId(null)}
                                className="text-[10px] px-2.5 py-1 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Qualification history timeline */}
                        {historyQualId === qr.id && (
                          <div className="pb-2 pl-2">
                            {historyLoading ? (
                              <div className="py-2 text-center">
                                <Loader2 className="w-3 h-3 animate-spin text-primary-500 inline-block" />
                              </div>
                            ) : qualHistory.length === 0 ? (
                              <p className="text-[10px] text-gray-400 italic py-1">No history recorded</p>
                            ) : (
                              <div className="space-y-1">
                                <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">History</div>
                                {qualHistory.map(h => (
                                  <div key={h.id} className="flex items-start gap-2 text-[10px]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-1 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">{h.action}</span>
                                      <span className="text-gray-400 ml-1">{h.performed_date?.slice(0, 10)}</span>
                                      {h.old_status && h.new_status && (
                                        <span className="text-gray-400 ml-1">({h.old_status} &rarr; {h.new_status})</span>
                                      )}
                                      {h.notes && <p className="text-gray-400 truncate">{h.notes}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    <a
                      href="/qualifications"
                      className="block text-center text-[10px] text-primary-600 dark:text-primary-400 hover:underline mt-2"
                    >
                      View All Qualifications
                    </a>
                  </div>
                )}
              </Section>

              {/* Maintenance / Status */}
              <Section id="maintenance" title="Maintenance & Status" icon={Wrench}>
                <Field label="Current Status" value={car.current_status} />
                <Field label="Adjusted Status" value={car.adjusted_status} />
                <Field label="Plan Status" value={car.plan_status} />
                <Field label="Scheduled Status" value={car.scheduled_status} />
                <Field label="Reason Shopped" value={car.reason_shopped} />
                <Field label="Assigned Shop" value={car.assigned_shop_code} />
                <Field label="Assigned Date" value={car.assigned_date?.slice(0, 10)} />
                <Field label="Last Repair Date" value={car.last_repair_date?.slice(0, 10)} />
                <Field label="Last Repair Shop" value={car.last_repair_shop} />
                {detail?.active_shopping_event && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-xs text-gray-500">Active Event</span>
                      <a
                        href={`/shopping/${detail.active_shopping_event.id}`}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                      >
                        {detail.active_shopping_event.event_number}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <Field label="State" value={detail.active_shopping_event.state} />
                    <Field label="Shop" value={detail.active_shopping_event.shop_code} />
                  </div>
                )}
              </Section>

              {/* Location */}
              <Section id="location" title="Location" icon={MapPin}>
                <Field label="Current Region" value={car.current_region} />
                <Field label="Past Region" value={car.past_region} />
                {clmLocationLoading && (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                  </div>
                )}
                {clmLocationLoaded && clmLocation && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">CLM Location Data</div>
                    <Field label="Railroad" value={clmLocation.railroad} />
                    <Field label="City" value={clmLocation.city} />
                    <Field label="State" value={clmLocation.state} />
                    <Field label="Location Type" value={clmLocation.location_type} />
                    <Field label="Last Reported" value={clmLocation.reported_at?.slice(0, 16)?.replace('T', ' ')} />
                  </div>
                )}
                {clmLocationLoaded && !clmLocation && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">No CLM location data available</p>
                  </div>
                )}
              </Section>

              {/* Lease / Contract */}
              <Section id="lease" title="Lease & Contract" icon={FileText}>
                <Field label="Contract #" value={car.contract_number} />
                <Field label="Contract Expiration" value={car.contract_expiration?.slice(0, 10)} />
                {detail?.lease_info && (
                  <>
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <Field label="Customer" value={detail.lease_info.customer_name} />
                      <Field label="Customer Code" value={detail.lease_info.customer_code} />
                      <Field label="Lease ID" value={detail.lease_info.lease_id} />
                      <Field label="Lease Name" value={detail.lease_info.lease_name} />
                      <Field label="Lease Status" value={detail.lease_info.lease_status} />
                    </div>
                  </>
                )}
              </Section>

              {/* UMLER Engineering Specifications */}
              <Section id="umler" title="UMLER Specifications" icon={ClipboardList}>
                <UmlerSpecSection data={umlerData} loading={umlerLoading} />
              </Section>
            </>
          )}
        </div>

        {/* Footer Actions — context-aware based on operational status group */}
        {car && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800 space-y-2">
            {/* Primary row: context-aware actions */}
            <div className="flex gap-2">
              {car.operational_status_group === 'idle_storage' && (
                <Link
                  href={`/cars?action=set_ready&car=${encodeURIComponent(carNumber)}`}
                  className="flex-1 text-center text-xs px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium flex items-center justify-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Set Ready to Load
                </Link>
              )}
              {car.operational_status_group === 'ready_to_load' && (
                <>
                  <Link
                    href={`/cars?action=assign_rider&car=${encodeURIComponent(carNumber)}`}
                    className="flex-1 text-center text-xs px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium flex items-center justify-center gap-1"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Assign to Customer
                  </Link>
                  <Link
                    href={`/assignments?car_number=${encodeURIComponent(carNumber)}&source=lease_prep`}
                    className="flex-1 text-center text-xs px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-1"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Send to Shop
                  </Link>
                  <Link
                    href={`/cars?action=revert_idle&car=${encodeURIComponent(carNumber)}`}
                    className="text-center text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Revert
                  </Link>
                </>
              )}
              {car.operational_status_group === 'pending' && (
                <>
                  <Link
                    href={`/assignments?car_number=${encodeURIComponent(carNumber)}&source=triage`}
                    className="flex-1 text-center text-xs px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-1"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Assign
                  </Link>
                  <Link
                    href={`/releases?car_number=${encodeURIComponent(carNumber)}`}
                    className="flex-1 text-center text-xs px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium flex items-center justify-center gap-1"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Release
                  </Link>
                  <Link
                    href={`/scrap-review?car=${encodeURIComponent(carNumber)}`}
                    className="flex-1 text-center text-xs px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Scrap
                  </Link>
                </>
              )}
              {(!car.operational_status_group || car.operational_status_group === 'in_shop') && (
                <a
                  href={detail?.active_shopping_event
                    ? `/shopping?shopCar=${encodeURIComponent(carNumber)}`
                    : `/shopping?shopCar=${encodeURIComponent(carNumber)}`
                  }
                  className="flex-1 text-center text-xs px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
                >
                  {detail?.active_shopping_event ? 'View Shopping Event' : 'Shop this Car'}
                </a>
              )}
            </div>
            {/* Secondary row: always-available navigation */}
            <div className="flex gap-2">
              <a
                href={`/shopping?car=${encodeURIComponent(carNumber)}`}
                className="flex-1 text-center text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Shopping History
              </a>
              <a
                href="/contracts"
                className="flex-1 text-center text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Contracts
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
