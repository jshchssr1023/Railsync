'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getShopFilterOptions,
  filterShops,
  ShopFilterOptions,
  ShopWithDistance,
  ShopFilterParams,
} from '@/lib/api';

interface ShopFilterPanelProps {
  onResults: (shops: ShopWithDistance[]) => void;
  onLoading?: (loading: boolean) => void;
  className?: string;
}

// Common US city coordinates for quick selection
const PRESET_LOCATIONS = [
  { name: 'Houston, TX', lat: 29.7604, lon: -95.3698 },
  { name: 'Chicago, IL', lat: 41.8781, lon: -87.6298 },
  { name: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437 },
  { name: 'Dallas, TX', lat: 32.7767, lon: -96.7970 },
  { name: 'Atlanta, GA', lat: 33.7490, lon: -84.3880 },
  { name: 'Denver, CO', lat: 39.7392, lon: -104.9903 },
  { name: 'Kansas City, MO', lat: 39.0997, lon: -94.5786 },
  { name: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
];

export default function ShopFilterPanel({
  onResults,
  onLoading,
  className = '',
}: ShopFilterPanelProps) {
  // Filter options from API
  const [filterOptions, setFilterOptions] = useState<ShopFilterOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Filter state
  const [useProximity, setUseProximity] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [radiusMiles, setRadiusMiles] = useState<string>('500');

  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [preferredNetworkOnly, setPreferredNetworkOnly] = useState(false);

  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load filter options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const options = await getShopFilterOptions();
        setFilterOptions(options);
      } catch (err) {
        console.error('Failed to load filter options:', err);
        setError('Failed to load filter options');
      } finally {
        setLoadingOptions(false);
      }
    }
    loadOptions();
  }, []);

  // Handle preset location selection
  const handleLocationSelect = (value: string) => {
    setSelectedLocation(value);
    if (value) {
      const location = PRESET_LOCATIONS.find((l) => l.name === value);
      if (location) {
        setLatitude(location.lat.toString());
        setLongitude(location.lon.toString());
        setUseProximity(true);
      }
    } else {
      setLatitude('');
      setLongitude('');
    }
  };

  // Toggle capability selection
  const toggleCapability = (cap: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  // Execute search
  const handleSearch = useCallback(async () => {
    setSearching(true);
    setError(null);
    onLoading?.(true);

    try {
      const params: ShopFilterParams = {};

      if (useProximity && latitude && longitude) {
        params.latitude = parseFloat(latitude);
        params.longitude = parseFloat(longitude);
        if (radiusMiles) {
          params.radiusMiles = parseFloat(radiusMiles);
        }
      }

      if (selectedCapabilities.length > 0) {
        params.capabilityTypes = selectedCapabilities;
      }

      if (selectedTier) {
        params.tier = parseInt(selectedTier, 10);
      }

      if (selectedRegion) {
        params.region = selectedRegion;
      }

      if (preferredNetworkOnly) {
        params.preferredNetworkOnly = true;
      }

      const results = await filterShops(params);
      onResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      onResults([]);
    } finally {
      setSearching(false);
      onLoading?.(false);
    }
  }, [
    useProximity,
    latitude,
    longitude,
    radiusMiles,
    selectedCapabilities,
    selectedTier,
    selectedRegion,
    preferredNetworkOnly,
    onResults,
    onLoading,
  ]);

  // Clear all filters
  const handleClear = () => {
    setUseProximity(false);
    setSelectedLocation('');
    setLatitude('');
    setLongitude('');
    setRadiusMiles('500');
    setSelectedCapabilities([]);
    setSelectedTier('');
    setSelectedRegion('');
    setPreferredNetworkOnly(false);
    setError(null);
  };

  if (loadingOptions) {
    return (
      <div className={`card ${className}`}>
        <div className="card-body">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <div className="card-body space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Shop Finder
          </h3>
          <button
            onClick={handleClear}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear Filters
          </button>
        </div>

        {error && (
          <div className="text-sm text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 p-2 rounded">
            {error}
          </div>
        )}

        {/* Proximity Filter */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={useProximity}
              onChange={(e) => setUseProximity(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Filter by Proximity
          </label>

          {useProximity && (
            <div className="pl-6 space-y-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Quick Select Location
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => handleLocationSelect(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">Custom coordinates...</option>
                  {PRESET_LOCATIONS.map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => {
                      setLatitude(e.target.value);
                      setSelectedLocation('');
                    }}
                    placeholder="29.7604"
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => {
                      setLongitude(e.target.value);
                      setSelectedLocation('');
                    }}
                    placeholder="-95.3698"
                    className="input text-sm w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Radius (miles)
                </label>
                <input
                  type="number"
                  min="1"
                  max="3000"
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(e.target.value)}
                  className="input text-sm w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Capability Filter */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Capability Types
          </label>
          <div className="flex flex-wrap gap-2">
            {filterOptions?.capabilityTypes.map((cap) => (
              <button
                key={cap.capability_type}
                onClick={() => toggleCapability(cap.capability_type)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                  selectedCapabilities.includes(cap.capability_type)
                    ? 'bg-primary-100 border-primary-300 text-primary-800 dark:bg-primary-900/50 dark:border-primary-700 dark:text-primary-200'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
                title={cap.description || undefined}
              >
                {cap.display_name}
              </button>
            ))}
          </div>
          {selectedCapabilities.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Shops must have ALL selected capabilities
            </p>
          )}
        </div>

        {/* Tier Filter */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Shop Tier
          </label>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="input text-sm w-full"
          >
            <option value="">All Tiers</option>
            {filterOptions?.tiers.map((tier) => (
              <option key={tier} value={tier}>
                Tier {tier}
              </option>
            ))}
          </select>
        </div>

        {/* Region Filter */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Region
          </label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="input text-sm w-full"
          >
            <option value="">All Regions</option>
            {filterOptions?.regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>

        {/* Preferred Network Only */}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={preferredNetworkOnly}
            onChange={(e) => setPreferredNetworkOnly(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Preferred Network Only
        </label>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={searching}
          className="btn btn-primary w-full"
        >
          {searching ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Searching...
            </span>
          ) : (
            'Search Shops'
          )}
        </button>
      </div>
    </div>
  );
}
