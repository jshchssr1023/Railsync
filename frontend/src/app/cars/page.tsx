'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp, Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import CarDetailCard from '@/components/CarDetailCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Car {
  car_number: string;
  car_mark: string;
  car_type: string;
  lessee_name: string;
  lessee_code: string;
  commodity: string;
  current_status: string;
  tank_qual_year: number;
  car_age: number;
  is_jacketed: boolean;
  is_lined: boolean;
  csr_name: string;
  current_region: string;
  contract_expiration: string;
  portfolio_status: string;
}

interface Filters {
  search: string;
  status: string;
  lessee: string;
  qualYear: string;
  region: string;
  jacketed: string;
  lined: string;
}

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCar, setSelectedCar] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<keyof Car>('car_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: '',
    lessee: '',
    qualYear: '',
    region: '',
    jacketed: '',
    lined: '',
  });

  // Fetch cars
  useEffect(() => {
    async function fetchCars() {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/cars-browse`);
        if (!res.ok) throw new Error('Failed to fetch cars');
        const json = await res.json();
        setCars(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cars');
      } finally {
        setLoading(false);
      }
    }
    fetchCars();
  }, []);

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const lessees = new Set<string>();
    const qualYears = new Set<number>();
    const regions = new Set<string>();

    cars.forEach(car => {
      if (car.current_status) statuses.add(car.current_status);
      if (car.lessee_name) lessees.add(car.lessee_name);
      if (car.tank_qual_year) qualYears.add(car.tank_qual_year);
      if (car.current_region) regions.add(car.current_region);
    });

    return {
      statuses: Array.from(statuses).sort(),
      lessees: Array.from(lessees).sort(),
      qualYears: Array.from(qualYears).sort((a, b) => a - b),
      regions: Array.from(regions).sort(),
    };
  }, [cars]);

  // Filter and sort cars
  const filteredCars = useMemo(() => {
    let result = cars.filter(car => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!car.car_number?.toLowerCase().includes(search) &&
            !car.lessee_name?.toLowerCase().includes(search) &&
            !car.commodity?.toLowerCase().includes(search) &&
            !car.csr_name?.toLowerCase().includes(search)) {
          return false;
        }
      }
      if (filters.status && car.current_status !== filters.status) return false;
      if (filters.lessee && car.lessee_name !== filters.lessee) return false;
      if (filters.qualYear && car.tank_qual_year !== parseInt(filters.qualYear)) return false;
      if (filters.region && car.current_region !== filters.region) return false;
      if (filters.jacketed === 'yes' && !car.is_jacketed) return false;
      if (filters.jacketed === 'no' && car.is_jacketed) return false;
      if (filters.lined === 'yes' && !car.is_lined) return false;
      if (filters.lined === 'no' && car.is_lined) return false;
      return true;
    });

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [cars, filters, sortField, sortDir]);

  // Paginate
  const paginatedCars = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCars.slice(start, start + pageSize);
  }, [filteredCars, page]);

  const totalPages = Math.ceil(filteredCars.length / pageSize);

  const handleSort = useCallback((field: keyof Car) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      lessee: '',
      qualYear: '',
      region: '',
      jacketed: '',
      lined: '',
    });
    setPage(1);
  };

  const currentYear = new Date().getFullYear();

  const getQualBadge = (year: number | null) => {
    if (!year) return null;
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
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fleet Cars</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredCars.length.toLocaleString()} of {cars.length.toLocaleString()} cars
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => { setFilters(prev => ({ ...prev, search: e.target.value })); setPage(1); }}
                placeholder="Search car number, lessee, commodity, CSR..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                activeFilterCount > 0
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-500 text-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => { setFilters(prev => ({ ...prev, status: e.target.value })); setPage(1); }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700"
                >
                  <option value="">All</option>
                  {filterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Lessee</label>
                <select
                  value={filters.lessee}
                  onChange={(e) => { setFilters(prev => ({ ...prev, lessee: e.target.value })); setPage(1); }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700"
                >
                  <option value="">All</option>
                  {filterOptions.lessees.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tank Qual Year</label>
                <select
                  value={filters.qualYear}
                  onChange={(e) => { setFilters(prev => ({ ...prev, qualYear: e.target.value })); setPage(1); }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700"
                >
                  <option value="">All</option>
                  {filterOptions.qualYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Region</label>
                <select
                  value={filters.region}
                  onChange={(e) => { setFilters(prev => ({ ...prev, region: e.target.value })); setPage(1); }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700"
                >
                  <option value="">All</option>
                  {filterOptions.regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Jacketed</label>
                <select
                  value={filters.jacketed}
                  onChange={(e) => { setFilters(prev => ({ ...prev, jacketed: e.target.value })); setPage(1); }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700"
                >
                  <option value="">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Lined</label>
                <select
                  value={filters.lined}
                  onChange={(e) => { setFilters(prev => ({ ...prev, lined: e.target.value })); setPage(1); }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700"
                >
                  <option value="">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  { key: 'car_number', label: 'Car #' },
                  { key: 'lessee_name', label: 'Lessee' },
                  { key: 'commodity', label: 'Commodity' },
                  { key: 'tank_qual_year', label: 'Tank Qual' },
                  { key: 'current_status', label: 'Status' },
                  { key: 'csr_name', label: 'CSR' },
                  { key: 'car_age', label: 'Age' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key as keyof Car)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
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
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedCars.map(car => (
                <tr
                  key={car.car_number}
                  onClick={() => setSelectedCar(car.car_number)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm font-medium text-primary-600 dark:text-primary-400">
                    {car.car_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {car.lessee_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {car.commodity || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {getQualBadge(car.tank_qual_year)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {car.current_status || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {car.csr_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {car.car_age ? `${car.car_age} yr` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Car Detail Modal */}
      {selectedCar && (
        <CarDetailCard
          carNumber={selectedCar}
          onClose={() => setSelectedCar(null)}
        />
      )}
    </div>
  );
}
