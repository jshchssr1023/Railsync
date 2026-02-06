'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search, Filter, X, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  AlertTriangle, CheckCircle, Clock, Train, Droplets, Shield, Wrench,
  FileText, MapPin, Calendar, User, Building2, ExternalLink, Layers, ClipboardList
} from 'lucide-react';
import UmlerSpecSection from '@/components/UmlerSpecSection';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Car {
  car_number: string;
  car_mark: string;
  car_type: string;
  lessee_name: string;
  commodity: string;
  current_status: string;
  current_region: string;
  car_age: number;
  is_jacketed: boolean;
  is_lined: boolean;
  tank_qual_year: number;
  contract_number: string;
  plan_status: string;
}

interface TypeTreeNode {
  name: string;
  count: number;
  children: { name: string; count: number }[];
}

interface CarDetail {
  car: Record<string, any>;
  shopping_events_count: number;
  active_shopping_event: { id: string; event_number: string; state: string; shop_code: string } | null;
  lease_info: { lease_id: string; lease_name: string; lease_status: string; customer_name: string; customer_code: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('railsync_access_token');
}

async function apiFetch<T>(endpoint: string): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

const currentYear = new Date().getFullYear();

function QualBadge({ year }: { year: number | null }) {
  if (!year) return <span className="text-gray-400 dark:text-gray-600">-</span>;
  if (year <= currentYear) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
        <AlertTriangle className="w-3 h-3" /> Overdue
      </span>
    );
  }
  if (year === currentYear + 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        <Clock className="w-3 h-3" /> {year}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle className="w-3 h-3" /> {year}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400">-</span>;
  const colors: Record<string, string> = {
    'Complete': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'Released': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'Arrived': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    'Enroute': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    'To Be Routed': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    'To Be Scrapped': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'Scrapped': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    'Upmarketed': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tree Panel Component
// ---------------------------------------------------------------------------
function TypeTree({
  tree, selectedType, selectedCommodity, onSelectType, onSelectCommodity, onClear, collapsed, onToggleCollapse
}: {
  tree: TypeTreeNode[];
  selectedType: string | null;
  selectedCommodity: string | null;
  onSelectType: (t: string | null) => void;
  onSelectCommodity: (c: string | null) => void;
  onClear: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const totalCars = tree.reduce((sum, n) => sum + n.count, 0);

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center pt-3">
        <button onClick={onToggleCollapse} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Expand tree">
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
        <div className="mt-2 writing-vertical text-xs text-gray-400 dark:text-gray-500 [writing-mode:vertical-lr] rotate-180">
          Car Types
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Car Types</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{totalCars.toLocaleString()} cars</p>
        </div>
        <button onClick={onToggleCollapse} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Collapse">
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* All Cars */}
      <div className="overflow-y-auto flex-1">
        <button
          onClick={onClear}
          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
            !selectedType ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <span>All Cars</span>
          <span className="text-xs tabular-nums bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{totalCars.toLocaleString()}</span>
        </button>

        {tree.map(node => (
          <div key={node.name}>
            {/* Car Type Level */}
            <button
              onClick={() => {
                toggle(node.name);
                onSelectType(node.name);
                onSelectCommodity(null);
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-1 transition-colors ${
                selectedType === node.name && !selectedCommodity
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {expanded.has(node.name) ? (
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              )}
              <Train className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="truncate flex-1">{node.name}</span>
              <span className="text-xs tabular-nums bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded ml-1">{node.count}</span>
            </button>

            {/* Commodity Level */}
            {expanded.has(node.name) && node.children.map(child => (
              <button
                key={child.name}
                onClick={() => {
                  onSelectType(node.name);
                  onSelectCommodity(child.name);
                }}
                className={`w-full text-left pl-10 pr-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                  selectedType === node.name && selectedCommodity === child.name
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="truncate">{child.name}</span>
                <span className="tabular-nums bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded ml-1">{child.count}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side Drawer Component
// ---------------------------------------------------------------------------
interface QualRecord {
  id: string;
  type_name: string;
  type_code: string;
  status: string;
  next_due_date: string | null;
  last_completed_date: string | null;
  regulatory_body: string;
  is_exempt: boolean;
}

function QualStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    overdue:  { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Overdue' },
    due:      { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'Due' },
    due_soon: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Due Soon' },
    current:  { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Current' },
    exempt:   { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: 'Exempt' },
    unknown:  { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-500', label: 'Unknown' },
  };
  const c = config[status] || config.unknown;
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}

function CarDrawer({ carNumber, onClose }: { carNumber: string; onClose: () => void }) {
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
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setUmlerData(null);
    setUmlerLoaded(false);
    setQualRecords([]);
    setQualRecordsLoaded(false);
    apiFetch<{ data: CarDetail }>(`/contracts-browse/car/${carNumber}`)
      .then(res => {
        setDetail(res.data);
        // Auto-load qualification records if section is expanded
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
    // Lazy-load UMLER data on first expand
    if (s === 'umler' && !umlerLoaded) {
      setUmlerLoading(true);
      apiFetch<{ data: Record<string, any> | null }>(`/cars/${carNumber}/umler`)
        .then(res => { setUmlerData(res.data); setUmlerLoaded(true); })
        .catch(() => { setUmlerData(null); setUmlerLoaded(true); })
        .finally(() => setUmlerLoading(false));
    }
    // Lazy-load qualification records on first expand
    if (s === 'qualifications' && !qualRecordsLoaded && car?.car_id) {
      setQualRecordsLoading(true);
      apiFetch<{ data: QualRecord[] }>(`/cars/${car.car_id}/qualifications`)
        .then(res => { setQualRecords(res.data || []); setQualRecordsLoaded(true); })
        .catch(() => { setQualRecords([]); setQualRecordsLoaded(true); })
        .finally(() => setQualRecordsLoading(false));
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
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{carNumber}</h2>
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
              <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
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
                    <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full inline-block" />
                  </div>
                ) : qualRecords.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 mb-1 tracking-wider">Compliance Records</p>
                    {qualRecords.map(qr => (
                      <div key={qr.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <div>
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{qr.type_name}</span>
                          <span className="text-[10px] text-gray-400 ml-1">({qr.regulatory_body})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {qr.next_due_date && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">{qr.next_due_date}</span>
                          )}
                          <QualStatusBadge status={qr.status} />
                        </div>
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

              {/* UMLER Engineering Specifications — lazy loaded */}
              <Section id="umler" title="UMLER Specifications" icon={ClipboardList}>
                <UmlerSpecSection data={umlerData} loading={umlerLoading} />
              </Section>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {car && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex gap-2 bg-gray-50 dark:bg-gray-800">
            <a
              href={`/shopping?search=${carNumber}`}
              className="flex-1 text-center text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              View History
            </a>
            <a
              href={`/contracts`}
              className="flex-1 text-center text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Contracts View
            </a>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function CarsPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    }>
      <CarsPage />
    </Suspense>
  );
}

function CarsPage() {
  const searchParams = useSearchParams();

  // Tree data
  const [tree, setTree] = useState<TypeTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeCollapsed, setTreeCollapsed] = useState(false);

  // Initialize filters from URL query params
  const [selectedType, setSelectedType] = useState<string | null>(searchParams.get('type'));
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(searchParams.get('commodity'));
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [regionFilter, setRegionFilter] = useState(searchParams.get('region') || '');
  const [lesseeFilter, setLesseeFilter] = useState(searchParams.get('lessee') || '');
  const [showFilters, setShowFilters] = useState(!!(searchParams.get('status') || searchParams.get('region') || searchParams.get('lessee')));

  // Sort & pagination
  const [sortField, setSortField] = useState('car_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Data
  const [cars, setCars] = useState<Car[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [carsLoading, setCarsLoading] = useState(true);

  // Drawer
  const [selectedCar, setSelectedCar] = useState<string | null>(null);

  // Distinct values for filter dropdowns
  const [filterOptions, setFilterOptions] = useState<{ statuses: string[]; regions: string[]; lessees: string[] }>({ statuses: [], regions: [], lessees: [] });

  // Fetch tree and filter options on mount
  useEffect(() => {
    apiFetch<{ data: TypeTreeNode[] }>('/contracts-browse/types')
      .then(res => setTree(res.data || []))
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false));

    apiFetch<{ data: { statuses: string[]; regions: string[]; lessees: string[] } }>('/contracts-browse/filters')
      .then(res => setFilterOptions(res.data))
      .catch(() => {});
  }, []);

  // Fetch cars whenever filters/sort/page change
  useEffect(() => {
    setCarsLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(pageSize));
    params.set('sort', sortField);
    params.set('order', sortDir);
    if (selectedType) params.set('car_type', selectedType);
    if (selectedCommodity) params.set('commodity', selectedCommodity);
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (regionFilter) params.set('region', regionFilter);
    if (lesseeFilter) params.set('lessee', lesseeFilter);

    apiFetch<{ data: Car[]; pagination: Pagination }>(`/contracts-browse/cars?${params}`)
      .then(res => {
        setCars(res.data || []);
        setPagination(res.pagination || null);
      })
      .catch(() => { setCars([]); setPagination(null); })
      .finally(() => setCarsLoading(false));
  }, [page, pageSize, sortField, sortDir, selectedType, selectedCommodity, search, statusFilter, regionFilter, lesseeFilter]);

  // Reset page on filter change
  const handleFilterChange = useCallback(() => setPage(1), []);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortField]);

  const handleTypeSelect = (t: string | null) => { setSelectedType(t); setPage(1); };
  const handleCommoditySelect = (c: string | null) => { setSelectedCommodity(c); setPage(1); };
  const handleClearTree = () => { setSelectedType(null); setSelectedCommodity(null); setPage(1); };

  const activeFilterCount = [statusFilter, regionFilter, lesseeFilter, search].filter(Boolean).length
    + (selectedType ? 1 : 0) + (selectedCommodity ? 1 : 0);

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('');
    setRegionFilter('');
    setLesseeFilter('');
    setSelectedType(null);
    setSelectedCommodity(null);
    setPage(1);
  };

  // Debounced search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setPage(1), 300);
  };

  const columns = [
    { key: 'car_number', label: 'Car #', width: 'w-28' },
    { key: 'car_type', label: 'Type', width: 'w-40' },
    { key: 'lessee_name', label: 'Lessee', width: 'w-44' },
    { key: 'commodity', label: 'Commodity', width: 'w-44' },
    { key: 'current_status', label: 'Status', width: 'w-28' },
    { key: 'current_region', label: 'Region', width: 'w-24' },
    { key: 'tank_qual_year', label: 'Tank Qual', width: 'w-24' },
    { key: 'car_age', label: 'Age', width: 'w-16' },
  ];

  return (
    <div className="flex h-[calc(100vh-5rem)] md:h-[calc(100vh-2rem)] overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-6">
      {/* Left Panel: Car Type Tree (hidden on mobile) */}
      <div className="hidden md:block">
        {treeLoading ? (
          <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center h-full">
            <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <TypeTree
            tree={tree}
            selectedType={selectedType}
            selectedCommodity={selectedCommodity}
            onSelectType={handleTypeSelect}
            onSelectCommodity={handleCommoditySelect}
            onClear={handleClearTree}
            collapsed={treeCollapsed}
            onToggleCollapse={() => setTreeCollapsed(!treeCollapsed)}
          />
        )}
      </div>

      {/* Main Panel: Car List */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        {/* Header Bar */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Cars</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {pagination ? `${pagination.total.toLocaleString()} cars` : '...'}
                {selectedType && ` in ${selectedType}`}
                {selectedCommodity && ` / ${selectedCommodity}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search car number..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md transition-colors ${
                showFilters || statusFilter || regionFilter
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {(statusFilter || regionFilter) && (
                <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold bg-primary-500 text-white rounded-full">
                  {[statusFilter, regionFilter].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Filter Row */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All</option>
                  {filterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Region</label>
                <select
                  value={regionFilter}
                  onChange={(e) => { setRegionFilter(e.target.value); setPage(1); }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All</option>
                  {filterOptions.regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Lessee</label>
                <select
                  value={lesseeFilter}
                  onChange={(e) => { setLesseeFilter(e.target.value); setPage(1); }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All</option>
                  {filterOptions.lessees.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none ${col.width}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortField === col.key && (
                        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
              {carsLoading ? (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center">
                    <div className="inline-block animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                  </td>
                </tr>
              ) : cars.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
                    No cars match the current filters.
                  </td>
                </tr>
              ) : (
                cars.map(car => (
                  <tr
                    key={car.car_number}
                    onClick={() => setSelectedCar(car.car_number)}
                    className={`cursor-pointer transition-colors ${
                      selectedCar === car.car_number
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-sm font-medium text-primary-600 dark:text-primary-400 whitespace-nowrap">
                      {car.car_number}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
                      {car.car_type || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[176px]">
                      {car.lessee_name || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[176px]">
                      {car.commodity || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                      <StatusBadge status={car.current_status} />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {car.current_region || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                      <QualBadge year={car.tank_qual_year} />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {car.car_age ? `${car.car_age}y` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Page {pagination.page} of {pagination.totalPages} &middot; {pagination.total.toLocaleString()} cars
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                First
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Prev
              </button>
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const startPage = Math.max(1, Math.min(page - 2, pagination.totalPages - 4));
                const p = startPage + i;
                if (p > pagination.totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2 py-1 text-xs border rounded ${
                      p === page
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Next
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={page === pagination.totalPages}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Side Drawer */}
      {selectedCar && (
        <CarDrawer carNumber={selectedCar} onClose={() => setSelectedCar(null)} />
      )}
    </div>
  );
}
