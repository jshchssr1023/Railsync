'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import {
  Loader2,
  RefreshCw,
  Train,
  Truck,
  Wrench,
  Building2,
  MapPin,
  Warehouse,
  HelpCircle,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { getCarLocations, syncCLMLocations } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CarLocation {
  id: string;
  car_number: string;
  location_type: string;
  railroad: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  last_updated: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LOCATION_TYPES = [
  { value: '', label: 'All' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'at_shop', label: 'At Shop' },
  { value: 'at_customer', label: 'At Customer' },
  { value: 'at_yard', label: 'At Yard' },
  { value: 'storage', label: 'Storage' },
  { value: 'unknown', label: 'Unknown' },
];

const LOCATION_BADGE_STYLES: Record<string, string> = {
  in_transit: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  at_shop: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  at_customer: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  at_yard: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  storage: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  unknown: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const LOCATION_ICONS: Record<string, React.ReactNode> = {
  in_transit: <Truck className="w-4 h-4" />,
  at_shop: <Wrench className="w-4 h-4" />,
  at_customer: <Building2 className="w-4 h-4" />,
  at_yard: <Warehouse className="w-4 h-4" />,
  storage: <MapPin className="w-4 h-4" />,
  unknown: <HelpCircle className="w-4 h-4" />,
};

const formatDate = (d: string | null) => {
  if (!d) return '--';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatLocationType = (type: string) => {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// ---------------------------------------------------------------------------
// Inner Component
// ---------------------------------------------------------------------------
function FleetLocationPageInner() {
  const toast = useToast();

  const [locations, setLocations] = useState<CarLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [locationType, setLocationType] = useState('');
  const [railroad, setRailroad] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { location_type?: string; railroad?: string; state?: string } = {};
      if (locationType) filters.location_type = locationType;
      if (railroad.trim()) filters.railroad = railroad.trim();
      if (stateFilter.trim()) filters.state = stateFilter.trim();
      const data = await getCarLocations(filters);
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load car locations';
      setError(msg);
      toast.error('Load failed', msg);
    } finally {
      setLoading(false);
    }
  }, [locationType, railroad, stateFilter, toast]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncCLMLocations();
      toast.success('CLM Sync started', 'Location data is being refreshed from CLM.');
      // Re-fetch after a short delay to pick up new data
      setTimeout(() => fetchLocations(), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      toast.error('Sync failed', msg);
    } finally {
      setSyncing(false);
    }
  };

  const clearFilters = () => {
    setLocationType('');
    setRailroad('');
    setStateFilter('');
    setSearchQuery('');
  };

  const hasActiveFilters = locationType || railroad.trim() || stateFilter.trim();

  // Compute summary counts from the fetched data
  const summary = {
    total: locations.length,
    in_transit: locations.filter((l) => l.location_type === 'in_transit').length,
    at_shop: locations.filter((l) => l.location_type === 'at_shop').length,
    at_customer: locations.filter((l) => l.location_type === 'at_customer').length,
    at_yard: locations.filter((l) => l.location_type === 'at_yard').length,
  };

  // Apply client-side search on top of server-filtered results
  const filteredLocations = searchQuery.trim()
    ? locations.filter((l) => {
        const q = searchQuery.toLowerCase();
        return (
          l.car_number?.toLowerCase().includes(q) ||
          l.railroad?.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.state?.toLowerCase().includes(q)
        );
      })
    : locations;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fleet Location</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Car locations from CLM integration service
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLocations()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {syncing ? 'Syncing...' : 'Sync CLM'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryCard
          label="Total Tracked"
          value={summary.total}
          icon={<Train className="w-5 h-5" />}
          color="text-gray-600 dark:text-gray-400"
          bgColor="bg-gray-100 dark:bg-gray-800"
        />
        <SummaryCard
          label="In Transit"
          value={summary.in_transit}
          icon={<Truck className="w-5 h-5" />}
          color="text-blue-600 dark:text-blue-400"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
        />
        <SummaryCard
          label="At Shop"
          value={summary.at_shop}
          icon={<Wrench className="w-5 h-5" />}
          color="text-orange-600 dark:text-orange-400"
          bgColor="bg-orange-50 dark:bg-orange-900/20"
        />
        <SummaryCard
          label="At Customer"
          value={summary.at_customer}
          icon={<Building2 className="w-5 h-5" />}
          color="text-green-600 dark:text-green-400"
          bgColor="bg-green-50 dark:bg-green-900/20"
        />
        <SummaryCard
          label="At Yard"
          value={summary.at_yard}
          icon={<Warehouse className="w-5 h-5" />}
          color="text-purple-600 dark:text-purple-400"
          bgColor="bg-purple-50 dark:bg-purple-900/20"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Location Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Location Type
              </label>
              <select
                value={locationType}
                onChange={(e) => setLocationType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {LOCATION_TYPES.map((lt) => (
                  <option key={lt.value} value={lt.value}>
                    {lt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Railroad */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Railroad
              </label>
              <input
                type="text"
                value={railroad}
                onChange={(e) => setRailroad(e.target.value)}
                placeholder="e.g. BNSF, UP"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                State
              </label>
              <input
                type="text"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                placeholder="e.g. TX, CA"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Quick search */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Car #, railroad, city..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm pl-9 pr-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          <button
            onClick={() => fetchLocations()}
            className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {filteredLocations.length} car{filteredLocations.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Car Number
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Location Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Railroad
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  City, State
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Lat, Lng
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Loading car locations...
                    </p>
                  </td>
                </tr>
              ) : filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <MapPin className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      No car locations found
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => (
                  <tr
                    key={loc.id || loc.car_number}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                        {loc.car_number}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          LOCATION_BADGE_STYLES[loc.location_type] ||
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {LOCATION_ICONS[loc.location_type] || <MapPin className="w-3.5 h-3.5" />}
                        {formatLocationType(loc.location_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {loc.railroad || '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {loc.city && loc.state
                        ? `${loc.city}, ${loc.state}`
                        : loc.city || loc.state || '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {loc.latitude != null && loc.longitude != null
                        ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`
                        : '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {formatDate(loc.last_updated)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card Component
// ---------------------------------------------------------------------------
function SummaryCard({
  label,
  value,
  icon,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Export with Suspense
// ---------------------------------------------------------------------------
export default function FleetLocationPage() {
  return (
    <Suspense fallback={<div className="p-6"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <FleetLocationPageInner />
    </Suspense>
  );
}
