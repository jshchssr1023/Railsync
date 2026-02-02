'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import {
  Search, ChevronLeft, ChevronRight, Car, Wrench, CheckCircle, AlertCircle,
  Building2, FileText, ArrowLeft, Bell, AlertTriangle, RefreshCw, X
} from 'lucide-react';
import CustomerCard from '@/components/fleet/CustomerCard';
import LeaseCard from '@/components/fleet/LeaseCard';
import RiderCard from '@/components/fleet/RiderCard';
import CarCard from '@/components/fleet/CarCard';
import AmendmentModal from '@/components/fleet/AmendmentModal';
import FleetHealthDashboard from '@/components/FleetHealthDashboard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Types
interface Customer {
  id: string;
  customer_code: string;
  customer_name: string;
  is_active: boolean;
  active_leases: number;
  total_riders: number;
  total_cars: number;
}

interface MasterLease {
  id: string;
  lease_id: string;
  customer_id: string;
  customer_name: string;
  lease_name?: string;
  start_date: string;
  end_date: string;
  status: string;
  rider_count: number;
  car_count: number;
  monthly_revenue: number;
}

interface LeaseRider {
  id: string;
  rider_id: string;
  master_lease_id: string;
  lease_id: string;
  customer_name: string;
  rider_name?: string;
  effective_date: string;
  expiration_date?: string;
  status: string;
  car_count: number;
  amendment_count: number;
  has_pending_amendments?: boolean;
  cars_with_conflicts?: number;
}

interface RiderCar {
  car_number: string;
  car_type: string;
  material_type: string;
  lessee_name: string;
  current_status: string;
  rider_id: string;
  rider_name: string;
  required_shop_date: string | null;
  next_service_due: string | null;
  has_pending_amendment: boolean;
  amendment_conflict: boolean;
  conflict_reason: string | null;
  has_active_transition: boolean;
  transition_details: any;
  active_assignments: number;
}

interface Amendment {
  amendment_id: string;
  amendment_code: string;
  rider_id: string;
  rider_name: string;
  lease_id: string;
  customer_name: string;
  amendment_type: string;
  effective_date: string;
  change_summary: string;
  status: string;
  is_latest_version: boolean;
  required_shop_date: string | null;
  previous_shop_date: string | null;
  service_interval_days: number | null;
  previous_service_interval: number | null;
  cars_impacted: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  days_until_effective: number;
  total_cars_affected: number | null;
  cars_with_conflicts: number | null;
  cars_needing_resync: number | null;
  comparison?: any[];
}

// Fetchers
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  return json.data || [];
};

// Navigation levels
type NavigationLevel = 'customers' | 'leases' | 'riders' | 'cars';

export default function FleetPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Navigation state
  const [level, setLevel] = useState<NavigationLevel>('customers');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedLease, setSelectedLease] = useState<MasterLease | null>(null);
  const [selectedRider, setSelectedRider] = useState<LeaseRider | null>(null);

  // Modal state
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [selectedAmendment, setSelectedAmendment] = useState<Amendment | null>(null);

  // Shop validation state
  const [showShopConfirmModal, setShowShopConfirmModal] = useState(false);
  const [pendingShopCar, setPendingShopCar] = useState<string | null>(null);
  const [shopValidation, setShopValidation] = useState<{
    hasOutdatedTerms: boolean;
    amendment?: Amendment;
    comparison?: { field: string; before: string | number | null; after: string | number | null }[];
    warnings: string[];
  } | null>(null);
  const [validatingShop, setValidatingShop] = useState(false);

  // Fetch customers
  const { data: customers, error: customersError, isLoading: customersLoading } = useSWR<Customer[]>(
    level === 'customers' ? `${API_URL}/customers` : null,
    fetcher
  );

  // Fetch leases for selected customer
  const { data: leases, isLoading: leasesLoading } = useSWR<MasterLease[]>(
    level === 'leases' && selectedCustomer ? `${API_URL}/customers/${selectedCustomer.id}/leases` : null,
    fetcher
  );

  // Fetch riders for selected lease
  const { data: riders, isLoading: ridersLoading } = useSWR<LeaseRider[]>(
    level === 'riders' && selectedLease ? `${API_URL}/leases/${selectedLease.id}/riders` : null,
    fetcher
  );

  // Fetch cars for selected rider
  const { data: cars, isLoading: carsLoading } = useSWR<RiderCar[]>(
    level === 'cars' && selectedRider ? `${API_URL}/riders/${selectedRider.id}/cars` : null,
    fetcher
  );

  // Fetch amendments for selected rider
  const { data: amendments } = useSWR<Amendment[]>(
    selectedRider ? `${API_URL}/riders/${selectedRider.id}/amendments` : null,
    fetcher
  );

  // Navigation handlers
  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setLevel('leases');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleLeaseClick = (lease: MasterLease) => {
    setSelectedLease(lease);
    setLevel('riders');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleRiderClick = (rider: LeaseRider) => {
    setSelectedRider(rider);
    setLevel('cars');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleBack = () => {
    if (level === 'leases') {
      setSelectedCustomer(null);
      setLevel('customers');
    } else if (level === 'riders') {
      setSelectedLease(null);
      setLevel('leases');
    } else if (level === 'cars') {
      setSelectedRider(null);
      setLevel('riders');
    }
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleAmendmentClick = async (rider: LeaseRider) => {
    // Get the first pending amendment
    const pendingAmendment = amendments?.find(a => a.status === 'Pending');
    if (pendingAmendment) {
      setSelectedAmendment(pendingAmendment);
      setShowAmendmentModal(true);
    }
  };

  const handleResync = async (riderId: string) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}/riders/${riderId}/resync-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to resync');
    }
  };

  const handleShopCar = async (carNumber: string) => {
    setValidatingShop(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/cars/${encodeURIComponent(carNumber)}/validate-shopping`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();

      if (data.success && data.data.hasOutdatedTerms) {
        // Show confirmation modal
        setPendingShopCar(carNumber);
        setShopValidation(data.data);
        setShowShopConfirmModal(true);
      } else {
        // No conflicts, proceed to planning
        router.push(`/planning?car=${encodeURIComponent(carNumber)}`);
      }
    } catch (error) {
      console.error('Error validating car for shopping:', error);
      // On error, allow shopping anyway
      router.push(`/planning?car=${encodeURIComponent(carNumber)}`);
    } finally {
      setValidatingShop(false);
    }
  };

  const confirmShop = () => {
    if (pendingShopCar) {
      router.push(`/planning?car=${encodeURIComponent(pendingShopCar)}`);
    }
    setShowShopConfirmModal(false);
    setPendingShopCar(null);
    setShopValidation(null);
  };

  const cancelShop = () => {
    setShowShopConfirmModal(false);
    setPendingShopCar(null);
    setShopValidation(null);
  };

  // Filter data based on search
  const filteredCustomers = useMemo(() => {
    if (!customers || !searchQuery) return customers || [];
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      c.customer_name.toLowerCase().includes(q) ||
      c.customer_code.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const filteredLeases = useMemo(() => {
    if (!leases || !searchQuery) return leases || [];
    const q = searchQuery.toLowerCase();
    return leases.filter(l =>
      l.lease_id.toLowerCase().includes(q) ||
      (l.lease_name?.toLowerCase().includes(q))
    );
  }, [leases, searchQuery]);

  const filteredRiders = useMemo(() => {
    if (!riders || !searchQuery) return riders || [];
    const q = searchQuery.toLowerCase();
    return riders.filter(r =>
      r.rider_id.toLowerCase().includes(q) ||
      (r.rider_name?.toLowerCase().includes(q))
    );
  }, [riders, searchQuery]);

  const filteredCars = useMemo(() => {
    if (!cars || !searchQuery) return cars || [];
    const q = searchQuery.toLowerCase();
    return cars.filter(c =>
      c.car_number.toLowerCase().includes(q) ||
      c.lessee_name?.toLowerCase().includes(q) ||
      c.material_type?.toLowerCase().includes(q)
    );
  }, [cars, searchQuery]);

  // Pagination
  const paginatedCars = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCars.slice(start, start + pageSize);
  }, [filteredCars, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredCars.length / pageSize);

  // Stats for current level
  const stats = useMemo(() => {
    if (level === 'customers' && customers) {
      const totalCars = customers.reduce((sum, c) => sum + c.total_cars, 0);
      return { total: customers.length, label: 'Customers', cars: totalCars };
    }
    if (level === 'leases' && leases) {
      const totalCars = leases.reduce((sum, l) => sum + l.car_count, 0);
      return { total: leases.length, label: 'Leases', cars: totalCars };
    }
    if (level === 'riders' && riders) {
      const totalCars = riders.reduce((sum, r) => sum + r.car_count, 0);
      const withAmendments = riders.filter(r => r.has_pending_amendments).length;
      const withConflicts = riders.reduce((sum, r) => sum + (r.cars_with_conflicts || 0), 0);
      return { total: riders.length, label: 'Riders', cars: totalCars, withAmendments, withConflicts };
    }
    if (level === 'cars' && cars) {
      const withAmendments = cars.filter(c => c.has_pending_amendment).length;
      const withConflicts = cars.filter(c => c.amendment_conflict).length;
      const inTransition = cars.filter(c => c.has_active_transition).length;
      return { total: cars.length, label: 'Cars', withAmendments, withConflicts, inTransition };
    }
    return { total: 0, label: '', cars: 0 };
  }, [level, customers, leases, riders, cars]);

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const items = [{ label: 'Customers', onClick: () => { setLevel('customers'); setSelectedCustomer(null); setSelectedLease(null); setSelectedRider(null); } }];
    if (selectedCustomer) {
      items.push({ label: selectedCustomer.customer_name, onClick: () => { setLevel('leases'); setSelectedLease(null); setSelectedRider(null); } });
    }
    if (selectedLease) {
      items.push({ label: selectedLease.lease_id, onClick: () => { setLevel('riders'); setSelectedRider(null); } });
    }
    if (selectedRider) {
      items.push({ label: selectedRider.rider_id, onClick: () => {} });
    }
    return items;
  }, [selectedCustomer, selectedLease, selectedRider]);

  const isLoading = customersLoading || leasesLoading || ridersLoading || carsLoading;

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fleet Overview</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Navigate through customers, leases, riders, and cars
            </p>
          </div>
        </div>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mt-4 text-sm">
          {breadcrumb.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
              <button
                onClick={item.onClick}
                className={`hover:text-primary-600 dark:hover:text-primary-400 ${
                  i === breadcrumb.length - 1
                    ? 'font-medium text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {item.label}
              </button>
            </div>
          ))}
        </nav>
      </div>

      {/* Fleet Health Dashboard */}
      {level === 'customers' && (
        <div className="mb-6">
          <FleetHealthDashboard />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              {level === 'customers' ? <Building2 className="w-5 h-5 text-primary-600" /> :
               level === 'leases' ? <FileText className="w-5 h-5 text-primary-600" /> :
               level === 'riders' ? <FileText className="w-5 h-5 text-primary-600" /> :
               <Car className="w-5 h-5 text-primary-600" />}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total {stats.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
            </div>
          </div>
        </div>

        {level === 'cars' && stats.withAmendments !== undefined && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Updated Terms</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.withAmendments}</p>
              </div>
            </div>
          </div>
        )}

        {level === 'cars' && stats.withConflicts !== undefined && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Conflicts</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.withConflicts}</p>
              </div>
            </div>
          </div>
        )}

        {level === 'cars' && stats.inTransition !== undefined && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <RefreshCw className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">In Transition</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.inTransition}</p>
              </div>
            </div>
          </div>
        )}

        {(level !== 'cars' && stats.cars !== undefined) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Car className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Cars</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.cars}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search and Back */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            {level !== 'customers' && (
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${stats.label.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              {/* Customers Grid */}
              {level === 'customers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCustomers.map((customer) => (
                    <CustomerCard
                      key={customer.id}
                      customer={customer}
                      onClick={handleCustomerClick}
                    />
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No customers found
                    </div>
                  )}
                </div>
              )}

              {/* Leases Grid */}
              {level === 'leases' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLeases.map((lease) => (
                    <LeaseCard
                      key={lease.id}
                      lease={lease}
                      onClick={handleLeaseClick}
                    />
                  ))}
                  {filteredLeases.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No leases found for this customer
                    </div>
                  )}
                </div>
              )}

              {/* Riders Grid */}
              {level === 'riders' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRiders.map((rider) => (
                    <RiderCard
                      key={rider.id}
                      rider={rider}
                      onClick={handleRiderClick}
                      onAmendmentClick={handleAmendmentClick}
                    />
                  ))}
                  {filteredRiders.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No riders found for this lease
                    </div>
                  )}
                </div>
              )}

              {/* Cars Table */}
              {level === 'cars' && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Car Number
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Lessee
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Service Due
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {paginatedCars.map((car) => (
                          <CarCard
                            key={car.car_number}
                            car={car}
                            onShop={handleShopCar}
                            onAmendmentClick={(c) => {
                              const pending = amendments?.find(a => a.status === 'Pending');
                              if (pending) {
                                setSelectedAmendment(pending);
                                setShowAmendmentModal(true);
                              }
                            }}
                            compact
                          />
                        ))}
                        {paginatedCars.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                              No cars found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredCars.length)} of {filteredCars.length} cars
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Amendment Modal */}
      {showAmendmentModal && selectedAmendment && (
        <AmendmentModal
          amendment={selectedAmendment}
          onClose={() => {
            setShowAmendmentModal(false);
            setSelectedAmendment(null);
          }}
          onResync={handleResync}
        />
      )}

      {/* Shop Confirmation Modal - Shows when car has outdated terms */}
      {showShopConfirmModal && shopValidation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Updated Lease Terms
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Car {pendingShopCar} has pending amendments
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This car has updated lease terms that may affect service requirements.
                Review the changes below before proceeding.
              </p>

              {/* Before vs After Comparison */}
              {shopValidation.comparison && shopValidation.comparison.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Field
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Previous
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Amended
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {shopValidation.comparison.map((comp, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                            {comp.field}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">
                            {String(comp.before) || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-center font-medium text-amber-600 dark:text-amber-400">
                            {String(comp.after) || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Warnings */}
              {shopValidation.warnings && shopValidation.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-4">
                  <ul className="space-y-1">
                    {shopValidation.warnings.map((warning, i) => (
                      <li key={i} className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <button
                onClick={cancelShop}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmShop}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                Proceed to Shop
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
