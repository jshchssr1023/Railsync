'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Wrench, Package, CheckCircle,
  ClipboardList, ArrowLeftRight, Undo2, Trash2, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import CarTypeIcon from '@/components/cars/CarTypeIcon';
import { QualBadge, StatusBadge } from '@/components/cars/CarBadges';
import CarDetailOverviewTab from '@/components/cars/CarDetailOverviewTab';
import CarDetailRepairHistoryTab from '@/components/cars/CarDetailRepairHistoryTab';
import CarDetailProjectHistoryTab from '@/components/cars/CarDetailProjectHistoryTab';
import CarDetailCustomerHistoryTab from '@/components/cars/CarDetailCustomerHistoryTab';
import CarDetailProfitabilityTab from '@/components/cars/CarDetailProfitabilityTab';

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

// ---------------------------------------------------------------------------
// Status group config (shared with CarDrawer)
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

type TabKey = 'overview' | 'repair-history' | 'project-history' | 'customer-history' | 'profitability';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'repair-history', label: 'Repair History' },
  { key: 'project-history', label: 'Project History' },
  { key: 'customer-history', label: 'Customer History' },
  { key: 'profitability', label: 'Profitability' },
];

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------
export default function CarDetailPageWrapper() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Please sign in to view car details
        </h2>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    }>
      <CarDetailPage />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function CarDetailPage() {
  const params = useParams();
  const carNumber = decodeURIComponent(params.carNumber as string);

  const [detail, setDetail] = useState<CarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ data: CarDetail }>(`/contracts-browse/car/${carNumber}`)
      .then(res => setDetail(res.data))
      .catch(err => setError(err.message || 'Failed to load car details'))
      .finally(() => setLoading(false));
  }, [carNumber]);

  const car = detail?.car;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Link href="/cars" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Fleet
        </Link>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">{error || `Car "${carNumber}" not found`}</p>
        </div>
      </div>
    );
  }

  const statusGroup = car.operational_status_group;
  const groupConfig = statusGroup ? STATUS_GROUP_CONFIG[statusGroup] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Breadcrumb */}
      <Link href="/cars" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        <ArrowLeft className="w-4 h-4" /> Back to Fleet
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <CarTypeIcon type={car.car_type} size="lg" className="text-gray-600 dark:text-gray-300" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{carNumber}</h1>
                {groupConfig && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${groupConfig.color}`}>
                    <groupConfig.icon className="w-3.5 h-3.5" />
                    {groupConfig.label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {car.car_type || 'Unknown Type'}
                {car.commodity && <> &middot; {car.commodity}</>}
                {car.lessee_name && <> &middot; {car.lessee_name}</>}
              </p>
            </div>
            {detail?.active_shopping_event && (
              <Link
                href={`/shopping/${detail.active_shopping_event.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/50 text-sm font-medium"
              >
                <Wrench className="w-4 h-4" />
                {detail.active_shopping_event.event_number} — {detail.active_shopping_event.state}
                <ExternalLink className="w-3 h-3 ml-1" />
              </Link>
            )}
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-0 border-t border-gray-200 dark:border-gray-700">
          {[
            { label: 'Age', value: car.car_age != null ? `${car.car_age}y` : '-' },
            { label: 'Tank Qual', value: null, badge: <QualBadge year={car.tank_qual_year} /> },
            { label: 'Status', value: null, badge: <StatusBadge status={car.current_status} /> },
            { label: 'Region', value: car.current_region || '-' },
            { label: 'Contract', value: car.contract_number || '-' },
            { label: 'Shopping Events', value: String(detail?.shopping_events_count ?? 0) },
          ].map((stat, i) => (
            <div key={stat.label} className={`px-4 py-3 text-center ${i < 5 ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">{stat.label}</div>
              {stat.badge ? (
                <div className="text-sm">{stat.badge}</div>
              ) : (
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{stat.value}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <nav className="flex gap-0 px-2 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === 'overview' && (
            <CarDetailOverviewTab
              car={car}
              leaseInfo={detail?.lease_info || null}
              activeShoppingEvent={detail?.active_shopping_event || null}
              carNumber={carNumber}
            />
          )}
          {activeTab === 'repair-history' && (
            <CarDetailRepairHistoryTab carNumber={carNumber} />
          )}
          {activeTab === 'project-history' && (
            <CarDetailProjectHistoryTab carNumber={carNumber} />
          )}
          {activeTab === 'customer-history' && (
            <CarDetailCustomerHistoryTab carNumber={carNumber} />
          )}
          {activeTab === 'profitability' && (
            <CarDetailProfitabilityTab carNumber={carNumber} />
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3">
        <div className="flex flex-wrap gap-2">
          {/* Context-aware primary actions */}
          {statusGroup === 'idle_storage' && (
            <Link
              href={`/cars?action=set_ready&car=${encodeURIComponent(carNumber)}`}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
            >
              <CheckCircle className="w-4 h-4" /> Set Ready to Load
            </Link>
          )}
          {statusGroup === 'ready_to_load' && (
            <>
              <Link
                href={`/cars?action=assign_rider&car=${encodeURIComponent(carNumber)}`}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
              >
                <ArrowLeftRight className="w-4 h-4" /> Assign to Customer
              </Link>
              <Link
                href={`/assignments?car_number=${encodeURIComponent(carNumber)}&source=lease_prep`}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                <Wrench className="w-4 h-4" /> Send to Shop
              </Link>
              <Link
                href={`/cars?action=revert_idle&car=${encodeURIComponent(carNumber)}`}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Undo2 className="w-4 h-4" /> Revert to Idle
              </Link>
            </>
          )}
          {statusGroup === 'pending' && (
            <>
              <Link
                href={`/assignments?car_number=${encodeURIComponent(carNumber)}&source=triage`}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                <ClipboardList className="w-4 h-4" /> Assign
              </Link>
              <Link
                href={`/releases?car_number=${encodeURIComponent(carNumber)}`}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
              >
                <Package className="w-4 h-4" /> Release
              </Link>
              <Link
                href={`/scrap-review?car=${encodeURIComponent(carNumber)}`}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
              >
                <Trash2 className="w-4 h-4" /> Scrap
              </Link>
            </>
          )}
          {(!statusGroup || statusGroup === 'in_shop') && (
            <Link
              href={`/shopping?shopCar=${encodeURIComponent(carNumber)}`}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
            >
              <Wrench className="w-4 h-4" />
              {detail?.active_shopping_event ? 'View Shopping Event' : 'Shop this Car'}
            </Link>
          )}

          {/* Secondary actions (always available) */}
          <div className="flex-1" />
          <Link
            href={`/shopping?car=${encodeURIComponent(carNumber)}`}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Shopping History
          </Link>
          <Link
            href="/contracts"
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Contracts
          </Link>
        </div>
      </div>
    </div>
  );
}
