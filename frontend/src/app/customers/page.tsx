'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { Loader2, Search, ChevronDown, ChevronRight, Building2, FileText, Train, Users } from 'lucide-react';

interface Customer {
  id: string;
  customer_code: string;
  customer_name: string;
  is_active: boolean;
  active_leases: number;
  total_riders: number;
  total_cars: number;
}

interface Lease {
  id: string;
  lease_id: string;
  customer_id: string;
  customer_name: string;
  lease_name: string;
  start_date: string;
  end_date: string;
  status: string;
  rider_count: number;
  car_count: number;
  monthly_revenue: number;
}

interface Rider {
  id: string;
  rider_id: string;
  rider_name: string;
  effective_date: string;
  expiration_date: string;
  status: string;
  car_count: number;
  amendment_count: number;
  has_pending_amendments: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function CustomersPage() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Drill-down state
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [customerLeases, setCustomerLeases] = useState<Record<string, Lease[]>>({});
  const [expandedLease, setExpandedLease] = useState<string | null>(null);
  const [leaseRiders, setLeaseRiders] = useState<Record<string, Rider[]>>({});
  const [loadingLeases, setLoadingLeases] = useState<string | null>(null);
  const [loadingRiders, setLoadingRiders] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('railsync_access_token');

  const fetchWithAuth = async (url: string) => {
    const res = await fetch(`${API_URL}${url}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return res.json();
  };

  useEffect(() => {
    if (isAuthenticated) loadCustomers();
  }, [isAuthenticated, showInactive]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth(`/customers?active=${!showInactive}`);
      if (data.success) setCustomers(data.data);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomer = async (customerId: string) => {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null);
      return;
    }
    setExpandedCustomer(customerId);
    setExpandedLease(null);

    if (!customerLeases[customerId]) {
      setLoadingLeases(customerId);
      try {
        const data = await fetchWithAuth(`/customers/${customerId}/leases`);
        if (data.success) {
          setCustomerLeases((prev) => ({ ...prev, [customerId]: data.data }));
        }
      } catch {
        toast.error('Failed to load leases');
      } finally {
        setLoadingLeases(null);
      }
    }
  };

  const toggleLease = async (leaseId: string) => {
    if (expandedLease === leaseId) {
      setExpandedLease(null);
      return;
    }
    setExpandedLease(leaseId);

    if (!leaseRiders[leaseId]) {
      setLoadingRiders(leaseId);
      try {
        const data = await fetchWithAuth(`/leases/${leaseId}/riders`);
        if (data.success) {
          setLeaseRiders((prev) => ({ ...prev, [leaseId]: data.data }));
        }
      } catch {
        toast.error('Failed to load riders');
      } finally {
        setLoadingRiders(null);
      }
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.customer_code.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalCars = customers.reduce((sum, c) => sum + (c.total_cars || 0), 0);
  const totalLeases = customers.reduce((sum, c) => sum + (c.active_leases || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customers</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Customer &rarr; Lease &rarr; Rider hierarchy with drill-down navigation
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Users className="w-4 h-4" /> Customers
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{customers.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <FileText className="w-4 h-4" /> Active Leases
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalLeases}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Train className="w-4 h-4" /> Total Cars
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{totalCars}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Building2 className="w-4 h-4" /> Active
          </div>
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {customers.filter((c) => c.is_active).length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-primary-600"
          />
          Show Inactive
        </label>
      </div>

      {/* Customer list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{search ? 'No customers match your search' : 'No customers found'}</p>
          </div>
        ) : (
          filtered.map((customer) => (
            <div key={customer.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {/* Customer row */}
              <button
                onClick={() => toggleCustomer(customer.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  {expandedCustomer === customer.id ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-400 font-bold text-sm flex-shrink-0">
                    {customer.customer_code.slice(0, 3)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{customer.customer_name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Code: {customer.customer_code}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                  <span>{customer.active_leases} leases</span>
                  <span>{customer.total_riders} riders</span>
                  <span>{customer.total_cars} cars</span>
                  {!customer.is_active && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">Inactive</span>
                  )}
                </div>
              </button>

              {/* Leases drill-down */}
              {expandedCustomer === customer.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  {loadingLeases === customer.id ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                    </div>
                  ) : (customerLeases[customer.id] || []).length === 0 ? (
                    <div className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No leases found for this customer
                    </div>
                  ) : (
                    (customerLeases[customer.id] || []).map((lease) => (
                      <div key={lease.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
                        <button
                          onClick={() => toggleLease(lease.id)}
                          className="w-full px-6 py-3 pl-16 flex items-center justify-between hover:bg-gray-100/50 dark:hover:bg-gray-700/20 transition-colors"
                        >
                          <div className="flex items-center gap-3 text-left">
                            {expandedLease === lease.id ? (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            )}
                            <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{lease.lease_name || lease.lease_id}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(lease.start_date).toLocaleDateString()} - {new Date(lease.end_date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                              lease.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}>{lease.status}</span>
                            <span>{lease.rider_count} riders</span>
                            <span>{lease.car_count} cars</span>
                            {lease.monthly_revenue > 0 && (
                              <span className="font-medium">${lease.monthly_revenue.toLocaleString()}/mo</span>
                            )}
                          </div>
                        </button>

                        {/* Riders drill-down */}
                        {expandedLease === lease.id && (
                          <div className="bg-gray-50 dark:bg-gray-900/30 px-6 py-2 pl-24">
                            {loadingRiders === lease.id ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                              </div>
                            ) : (leaseRiders[lease.id] || []).length === 0 ? (
                              <div className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">No riders</div>
                            ) : (
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 dark:text-gray-400">
                                    <th className="text-left py-1 pr-3 font-medium">Rider</th>
                                    <th className="text-left py-1 pr-3 font-medium">Status</th>
                                    <th className="text-left py-1 pr-3 font-medium">Effective</th>
                                    <th className="text-left py-1 pr-3 font-medium">Expires</th>
                                    <th className="text-center py-1 pr-3 font-medium">Cars</th>
                                    <th className="text-center py-1 font-medium">Amendments</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(leaseRiders[lease.id] || []).map((rider) => (
                                    <tr key={rider.id} className="text-gray-700 dark:text-gray-300 border-t border-gray-200/50 dark:border-gray-700/50">
                                      <td className="py-1.5 pr-3 font-medium">{rider.rider_name || rider.rider_id}</td>
                                      <td className="py-1.5 pr-3">
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                                          rider.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}>{rider.status}</span>
                                      </td>
                                      <td className="py-1.5 pr-3">{rider.effective_date ? new Date(rider.effective_date).toLocaleDateString() : '-'}</td>
                                      <td className="py-1.5 pr-3">{rider.expiration_date ? new Date(rider.expiration_date).toLocaleDateString() : '-'}</td>
                                      <td className="py-1.5 pr-3 text-center">{rider.car_count}</td>
                                      <td className="py-1.5 text-center">
                                        {rider.amendment_count > 0 ? (
                                          <span className={rider.has_pending_amendments ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                                            {rider.amendment_count}{rider.has_pending_amendments ? ' (pending)' : ''}
                                          </span>
                                        ) : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
