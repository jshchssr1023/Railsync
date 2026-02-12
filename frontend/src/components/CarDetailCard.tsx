'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Calendar, User, MapPin, Wrench, AlertTriangle, CheckCircle, Clock, FileText, Droplets, Shield } from 'lucide-react';
import { buildShopCarURL } from '@/lib/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface CarDetails {
  car_number: string;
  car_mark: string;
  car_id: string;
  car_type: string;
  product_code: string;
  material_type: string;
  stencil_class: string;
  // Lessee/Contract
  lessee_name: string;
  lessee_code: string;
  fms_lessee_number: string;
  contract_number: string;
  contract_expiration: string;
  portfolio_status: string;
  // Commodity/Physical
  commodity: string;
  commodity_cin: string;
  is_jacketed: boolean;
  is_lined: boolean;
  lining_type: string;
  car_age: number;
  has_asbestos: boolean;
  asbestos_abatement_required: boolean;
  nitrogen_pad_stage: number;
  // Qualification Years
  min_no_lining_year: number;
  min_lining_year: number;
  interior_lining_year: number;
  rule_88b_year: number;
  safety_relief_year: number;
  service_equipment_year: number;
  stub_sill_year: number;
  tank_thickness_year: number;
  tank_qual_year: number;
  qual_exp_date: string;
  // Contacts
  csr_name: string;
  csl_name: string;
  commercial_contact: string;
  // Region
  past_region: string;
  current_region: string;
  // Status
  current_status: string;
  full_partial_qual: string;
  reason_shopped: string;
  perform_tank_qual: boolean;
  // Shop
  assigned_shop_code: string;
  assigned_shop_name: string;
  assigned_date: string;
  last_repair_date: string;
  last_repair_shop: string;
  last_repair_shop_name: string;
  // Calculated
  qual_status: string;
  contract_status: string;
}

interface CarDetailCardProps {
  carNumber: string;
  onClose: () => void;
  onShopNow?: (carNumber: string) => void;
}

export default function CarDetailCard({ carNumber, onClose, onShopNow }: CarDetailCardProps) {
  const router = useRouter();
  const [car, setCar] = useState<CarDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'qualification' | 'history'>('overview');

  useEffect(() => {
    async function fetchCarDetails() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/cars/${encodeURIComponent(carNumber)}/details`);
        if (!res.ok) throw new Error('Failed to fetch car details');
        const json = await res.json();
        setCar(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load car details');
      } finally {
        setLoading(false);
      }
    }
    fetchCarDetails();
  }, [carNumber]);

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      'Complete': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'Arrived': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'Enroute': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'To Be Routed': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'Planned Shopping': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'Overdue': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Due Next Year': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'Current': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'Expired': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Expiring Soon': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'Active': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const currentYear = new Date().getFullYear();

  const getYearStatus = (year: number | null) => {
    if (!year) return { color: 'text-gray-400', icon: null };
    if (year <= currentYear) return { color: 'text-red-600 dark:text-red-400 font-semibold', icon: <AlertTriangle className="w-4 h-4 text-red-500" /> };
    if (year === currentYear + 1) return { color: 'text-amber-600 dark:text-amber-400', icon: <Clock className="w-4 h-4 text-amber-500" /> };
    return { color: 'text-green-600 dark:text-green-400', icon: <CheckCircle className="w-4 h-4 text-green-500" /> };
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-semibold text-red-600">Error</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-400">{error || 'Car not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{car.car_number}</h2>
              {getStatusBadge(car.current_status)}
              {getStatusBadge(car.qual_status)}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {car.car_type} • {car.lessee_name || 'Unassigned'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onShopNow
                ? onShopNow(car.car_number)
                : router.push(buildShopCarURL(car.car_number))
              }
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              Shop Now
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-4">
            {(['overview', 'qualification', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lessee & Contract */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Lessee & Contract
                </h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Lessee</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{car.lessee_name || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">FMS #</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.fms_lessee_number || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Contract</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.contract_number || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Expiration</dt>
                    <dd className="flex items-center gap-2">
                      <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(car.contract_expiration)}</span>
                      {getStatusBadge(car.contract_status)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Portfolio</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.portfolio_status || 'N/A'}</dd>
                  </div>
                </dl>
              </div>

              {/* Physical Attributes */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Droplets className="w-4 h-4" />
                  Physical Attributes
                </h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Car Type</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{car.car_type || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Commodity</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.commodity || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Car Age</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.car_age ? `${car.car_age} years` : 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Jacketed</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.is_jacketed ? 'Yes' : 'No'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Lined</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {car.is_lined ? (car.lining_type || 'Yes') : 'No'}
                    </dd>
                  </div>
                  {car.has_asbestos && (
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Asbestos</dt>
                      <dd>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          car.asbestos_abatement_required
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {car.asbestos_abatement_required ? 'Abatement Required' : 'Present'}
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Contacts */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contacts
                </h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">CSR</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.csr_name || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">CSL</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.csl_name || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Commercial</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.commercial_contact || 'N/A'}</dd>
                  </div>
                </dl>
              </div>

              {/* Region & Status */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Region & Status
                </h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Current Region</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.current_region || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Past Region</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{car.past_region || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
                    <dd>{getStatusBadge(car.current_status)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {activeTab === 'qualification' && (
            <div className="space-y-6">
              {/* Qualification Summary */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Qualification Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Full/Partial</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{car.full_partial_qual || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reason Shopped</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{car.reason_shopped || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Perform Tank Qual</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{car.perform_tank_qual ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              {/* Qualification Due Years */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Qualification Due Years
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Tank Qualification', year: car.tank_qual_year },
                    { label: 'Rule 88B', year: car.rule_88b_year },
                    { label: 'Safety Relief', year: car.safety_relief_year },
                    { label: 'Service Equipment', year: car.service_equipment_year },
                    { label: 'Stub Sill', year: car.stub_sill_year },
                    { label: 'Tank Thickness', year: car.tank_thickness_year },
                    { label: 'Interior Lining', year: car.interior_lining_year },
                    { label: 'Min (No Lining)', year: car.min_no_lining_year },
                    { label: 'Min (w/ Lining)', year: car.min_lining_year },
                  ].map((item) => {
                    const status = getYearStatus(item.year);
                    return (
                      <div key={item.label} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                          <p className={`text-lg font-semibold ${status.color}`}>
                            {item.year || 'N/A'}
                          </p>
                        </div>
                        {status.icon}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Current Assignment */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Current Assignment
                </h3>
                {car.assigned_shop_code ? (
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Assigned Shop</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {car.assigned_shop_name || car.assigned_shop_code}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Assigned Date</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">{formatDate(car.assigned_date)}</dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
                      <dd>{getStatusBadge(car.current_status)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No current assignment</p>
                )}
              </div>

              {/* Last Repair */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                  Last Repair
                </h3>
                {car.last_repair_date ? (
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Shop</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {car.last_repair_shop_name || car.last_repair_shop || 'N/A'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Date</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">{formatDate(car.last_repair_date)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No repair history available</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
