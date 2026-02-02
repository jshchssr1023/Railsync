'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, Car, Wrench, CheckCircle, AlertCircle } from 'lucide-react';
// AuthHeader and DashboardWithWrapper are in layout.tsx - don't duplicate

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Car {
  car_number: string;
  car_id?: string;
  car_mark?: string;
  product_code?: string;
  material_type?: string;
  lessee_name?: string;
  lessee_code?: string;
  commodity?: string;
  car_type?: string;
  portfolio_status?: string;
  last_repair_date?: string;
  last_repair_shop?: string;
}

interface CarWithAssignment extends Car {
  has_active_assignment?: boolean;
  assignment_shop?: string;
  assignment_month?: string;
  assignment_status?: string;
}

interface CarsResponse {
  cars: Car[];
  total: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  // API returns { success: true, data: [...cars...] }
  // Convert to expected format { cars: [...], total: number }
  const cars = json.data || [];
  return { cars, total: cars.length } as CarsResponse;
};

const assignmentFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return { assignments: [], total: 0 };
  const json = await res.json();
  return { assignments: json.data || [], total: json.total || 0 };
};

const PAGE_SIZES = [25, 50, 100, 200];

export default function FleetPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Fetch all cars
  const { data: carsData, error: carsError, isLoading: carsLoading } = useSWR<CarsResponse>(
    `${API_URL}/cars-master?limit=500`,
    fetcher
  );

  // Fetch all active assignments
  const { data: assignmentsData } = useSWR(
    `${API_URL}/assignments?limit=500`,
    assignmentFetcher
  );

  // Create a map of car_number -> assignment
  const assignmentMap = useMemo(() => {
    const map = new Map<string, { shop_code: string; target_month: string; status: string }>();
    if (assignmentsData?.assignments) {
      for (const a of assignmentsData.assignments) {
        if (a.status !== 'Complete' && a.status !== 'Cancelled') {
          map.set(a.car_number, {
            shop_code: a.shop_code,
            target_month: a.target_month,
            status: a.status,
          });
        }
      }
    }
    return map;
  }, [assignmentsData]);

  // Combine cars with assignment info
  const carsWithAssignments: CarWithAssignment[] = useMemo(() => {
    if (!carsData?.cars) return [];
    return carsData.cars.map((car) => {
      const assignment = assignmentMap.get(car.car_number);
      return {
        ...car,
        has_active_assignment: !!assignment,
        assignment_shop: assignment?.shop_code,
        assignment_month: assignment?.target_month,
        assignment_status: assignment?.status,
      };
    });
  }, [carsData, assignmentMap]);

  // Filter and search
  const filteredCars = useMemo(() => {
    let result = carsWithAssignments;

    // Filter by assignment status
    if (filterStatus === 'assigned') {
      result = result.filter((c) => c.has_active_assignment);
    } else if (filterStatus === 'unassigned') {
      result = result.filter((c) => !c.has_active_assignment);
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.car_number?.toLowerCase().includes(query) ||
          c.product_code?.toLowerCase().includes(query) ||
          c.lessee_name?.toLowerCase().includes(query) ||
          c.commodity?.toLowerCase().includes(query) ||
          c.assignment_shop?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [carsWithAssignments, filterStatus, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredCars.length / pageSize);
  const paginatedCars = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCars.slice(start, start + pageSize);
  }, [filteredCars, currentPage, pageSize]);

  const handleShopCar = (carNumber: string) => {
    router.push(`/planning?car=${encodeURIComponent(carNumber)}`);
  };

  // Stats
  const totalCars = carsWithAssignments.length;
  const assignedCars = carsWithAssignments.filter((c) => c.has_active_assignment).length;
  const unassignedCars = totalCars - assignedCars;

  if (carsError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">Failed to load fleet data. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fleet Overview</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View and manage all cars in the system
        </p>
      </div>

      {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border-2 transition-colors ${
              filterStatus === 'all' ? 'border-primary-500' : 'border-transparent hover:border-gray-300'
            }`}
            onClick={() => { setFilterStatus('all'); setCurrentPage(1); }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Car className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Fleet</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCars}</p>
              </div>
            </div>
          </div>

          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border-2 transition-colors ${
              filterStatus === 'assigned' ? 'border-green-500' : 'border-transparent hover:border-gray-300'
            }`}
            onClick={() => { setFilterStatus('assigned'); setCurrentPage(1); }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">With Assignments</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{assignedCars}</p>
              </div>
            </div>
          </div>

          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border-2 transition-colors ${
              filterStatus === 'unassigned' ? 'border-amber-500' : 'border-transparent hover:border-gray-300'
            }`}
            onClick={() => { setFilterStatus('unassigned'); setCurrentPage(1); }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No Assignment</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{unassignedCars}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by car number, product code, lessee, commodity..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {carsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
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
                      Material
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Lessee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Assignment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedCars.map((car) => (
                    <tr key={car.car_number} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                          {car.car_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {car.product_code || car.car_type || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {car.material_type || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {car.lessee_name || car.lessee_code || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {car.has_active_assignment ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              {car.assignment_status}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {car.assignment_shop} ({car.assignment_month})
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            No assignment
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleShopCar(car.car_number)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        >
                          <Wrench className="w-4 h-4" />
                          Shop
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedCars.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        {searchQuery ? 'No cars match your search' : 'No cars found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
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
        </div>
    </>
  );
}
