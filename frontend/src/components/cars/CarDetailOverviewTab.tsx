'use client';

import { useState, useEffect } from 'react';
import {
  Train, Layers, Shield, Wrench, FileText, MapPin,
  ClipboardList, Loader2, ExternalLink,
} from 'lucide-react';
import UmlerSpecSection from '@/components/UmlerSpecSection';
import { QualBadge, QualStatusBadge } from './CarBadges';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Card({ title, icon: Icon, children, className }: {
  title: string; icon: typeof Train; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 ${className || ''}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <Icon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right max-w-[60%] truncate">
        {value ?? '-'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------
export default function CarDetailOverviewTab({
  car,
  leaseInfo,
  activeShoppingEvent,
  carNumber,
}: {
  car: Record<string, any>;
  leaseInfo: {
    lease_id: string; lease_name: string; lease_status: string; customer_name: string; customer_code: string;
    rider_id?: string; rider_code?: string; rider_name?: string; rate_per_car?: number;
    is_on_rent?: boolean; added_date?: string;
  } | null;
  activeShoppingEvent: { id: string; event_number: string; state: string; shop_code: string } | null;
  carNumber: string;
}) {
  // Lazy-loaded data
  const [qualRecords, setQualRecords] = useState<QualRecord[]>([]);
  const [qualLoading, setQualLoading] = useState(false);
  const [qualLoaded, setQualLoaded] = useState(false);

  const [umlerData, setUmlerData] = useState<Record<string, any> | null>(null);
  const [umlerLoading, setUmlerLoading] = useState(false);
  const [umlerLoaded, setUmlerLoaded] = useState(false);

  const [clmLocation, setClmLocation] = useState<Record<string, any> | null>(null);
  const [clmLoading, setClmLoading] = useState(false);
  const [clmLoaded, setClmLoaded] = useState(false);

  // Load quals on mount
  useEffect(() => {
    if (car?.car_id && !qualLoaded) {
      setQualLoading(true);
      apiFetch<{ data: QualRecord[] }>(`/cars/${car.car_id}/qualifications`)
        .then(res => { setQualRecords(res.data || []); setQualLoaded(true); })
        .catch(() => { setQualRecords([]); setQualLoaded(true); })
        .finally(() => setQualLoading(false));
    }
  }, [car?.car_id, qualLoaded]);

  // Load location on mount
  useEffect(() => {
    if (!clmLoaded) {
      setClmLoading(true);
      apiFetch<{ data: Record<string, any> | null }>(`/car-locations/${carNumber}`)
        .then(res => { setClmLocation(res.data); setClmLoaded(true); })
        .catch(() => { setClmLocation(null); setClmLoaded(true); })
        .finally(() => setClmLoading(false));
    }
  }, [carNumber, clmLoaded]);

  // Load UMLER on mount
  useEffect(() => {
    if (!umlerLoaded) {
      setUmlerLoading(true);
      apiFetch<{ data: Record<string, any> | null }>(`/cars/${carNumber}/umler`)
        .then(res => { setUmlerData(res.data); setUmlerLoaded(true); })
        .catch(() => { setUmlerData(null); setUmlerLoaded(true); })
        .finally(() => setUmlerLoading(false));
    }
  }, [carNumber, umlerLoaded]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Column */}
      <div className="space-y-4">
        {/* Identity & General Info */}
        <Card title="Identity & General Information" icon={Train}>
          <Field label="Car Number" value={car.car_number} />
          <Field label="Car Mark" value={car.car_mark} />
          <Field label="Car ID" value={car.car_id} />
          <Field label="Car Type" value={car.car_type} />
          <Field label="Product Code" value={car.product_code} />
          <Field label="Portfolio Status" value={car.portfolio_status} />
          <Field label="Lessee" value={car.lessee_name} />
          <Field label="Lessee Code" value={car.lessee_code} />
          <Field label="FMS Lessee #" value={car.fms_lessee_number} />
          <Field label="CSR" value={car.csr_name} />
          <Field label="CSL" value={car.csl_name} />
          <Field label="Commercial Contact" value={car.commercial_contact} />
        </Card>

        {/* Specifications */}
        <Card title="Specifications" icon={Layers}>
          <Field label="Commodity" value={car.commodity} />
          <Field label="Material Type" value={car.material_type} />
          <Field label="Stencil Class" value={car.stencil_class} />
          <Field label="Car Age" value={car.car_age ? `${car.car_age} years` : null} />
          <Field label="Jacketed" value={car.is_jacketed ? 'Yes' : 'No'} />
          <Field label="Lined" value={car.is_lined ? 'Yes' : 'No'} />
          <Field label="Lining Type" value={car.lining_type} />
          <Field label="Has Asbestos" value={car.has_asbestos ? 'Yes' : 'No'} />
          <Field label="Nitrogen Pad Stage" value={car.nitrogen_pad_stage} />
        </Card>

        {/* Qualifications & Due Dates */}
        <Card title="Qualifications & Due Dates" icon={Shield}>
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
              <div key={item.label} className="flex justify-between py-1.5 items-center border-b border-gray-50 dark:border-gray-800 last:border-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                <QualBadge year={item.value} />
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Field label="Full/Partial Qual" value={car.full_partial_qual} />
            <Field label="Perform Tank Qual" value={car.perform_tank_qual ? 'Yes' : 'No'} />
            <Field label="Qual Expiration" value={car.qual_exp_date?.slice(0, 10)} />
          </div>

          {/* Compliance Records */}
          {qualLoading ? (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary-500 inline-block" />
            </div>
          ) : qualRecords.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 mb-2 tracking-wider">Compliance Records</p>
              <div className="space-y-1">
                {qualRecords.map(qr => (
                  <div key={qr.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{qr.type_name}</span>
                      <span className="text-[10px] text-gray-400 ml-1">({qr.regulatory_body})</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {qr.next_due_date && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{qr.next_due_date}</span>
                      )}
                      <QualStatusBadge status={qr.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Right Column */}
      <div className="space-y-4">
        {/* Lease & Contract */}
        <Card title="Lease & Contract" icon={FileText}>
          <Field label="Contract #" value={car.contract_number} />
          <Field label="Contract Expiration" value={car.contract_expiration?.slice(0, 10)} />
          {leaseInfo ? (
            <>
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <Field label="Customer" value={leaseInfo.customer_name} />
                <Field label="Customer Code" value={leaseInfo.customer_code} />
                <Field label="Lease ID" value={leaseInfo.lease_id} />
                <Field label="Lease Name" value={leaseInfo.lease_name} />
                <Field label="Lease Status" value={leaseInfo.lease_status} />
              </div>
              {leaseInfo.rider_id && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Field label="Rider" value={leaseInfo.rider_code || leaseInfo.rider_name || '-'} />
                  {leaseInfo.rate_per_car != null && (
                    <Field label="Rate / Car" value={`$${Number(leaseInfo.rate_per_car).toFixed(2)}/mo`} />
                  )}
                  <div className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <span className="text-xs text-gray-500 dark:text-gray-400">On-Rent</span>
                    <span className={`text-xs font-medium ${leaseInfo.is_on_rent ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                      {leaseInfo.is_on_rent ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">No active lease information</p>
          )}
        </Card>

        {/* Location */}
        <Card title="Location" icon={MapPin}>
          <Field label="Current Region" value={car.current_region} />
          <Field label="Past Region" value={car.past_region} />
          {clmLoading ? (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary-500 inline-block" />
            </div>
          ) : clmLoaded && clmLocation ? (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 mb-1 tracking-wider">CLM Location</p>
              <Field label="Railroad" value={clmLocation.railroad} />
              <Field label="City" value={clmLocation.city} />
              <Field label="State" value={clmLocation.state} />
              <Field label="Location Type" value={clmLocation.location_type} />
              <Field label="Last Reported" value={clmLocation.reported_at?.slice(0, 16)?.replace('T', ' ')} />
            </div>
          ) : clmLoaded ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">No CLM location data available</p>
          ) : null}
        </Card>

        {/* Maintenance & Status */}
        <Card title="Maintenance & Status" icon={Wrench}>
          <Field label="Current Status" value={car.current_status} />
          <Field label="Adjusted Status" value={car.adjusted_status} />
          <Field label="Plan Status" value={car.plan_status} />
          <Field label="Scheduled Status" value={car.scheduled_status} />
          <Field label="Reason Shopped" value={car.reason_shopped} />
          <Field label="Assigned Shop" value={car.assigned_shop_code} />
          <Field label="Assigned Date" value={car.assigned_date?.slice(0, 10)} />
          <Field label="Last Repair Date" value={car.last_repair_date?.slice(0, 10)} />
          <Field label="Last Repair Shop" value={car.last_repair_shop} />
          {activeShoppingEvent && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs text-gray-500">Active Event</span>
                <a
                  href={`/shopping/${activeShoppingEvent.id}`}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                >
                  {activeShoppingEvent.event_number}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <Field label="State" value={activeShoppingEvent.state} />
              <Field label="Shop" value={activeShoppingEvent.shop_code} />
            </div>
          )}
        </Card>

        {/* UMLER Specifications */}
        <Card title="UMLER Specifications" icon={ClipboardList}>
          <UmlerSpecSection data={umlerData} loading={umlerLoading} />
        </Card>
      </div>
    </div>
  );
}
