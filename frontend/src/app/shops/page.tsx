'use client';

import { useState, useMemo } from 'react';
import ShopFilterPanel from '@/components/ShopFilterPanel';
import { ShopWithDistance } from '@/lib/api';

export default function ShopsPage() {
  const [results, setResults] = useState<ShopWithDistance[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Sort options
  const [sortBy, setSortBy] = useState<'distance' | 'name' | 'tier'>('distance');
  const [sortAsc, setSortAsc] = useState(true);

  const handleResults = (shops: ShopWithDistance[]) => {
    setResults(shops);
    setHasSearched(true);
  };

  // Sort results
  const sortedResults = useMemo(() => {
    const sorted = [...results];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'distance':
          // Null distances go to the end
          if (a.distance_miles === null && b.distance_miles === null) comparison = 0;
          else if (a.distance_miles === null) comparison = 1;
          else if (b.distance_miles === null) comparison = -1;
          else comparison = a.distance_miles - b.distance_miles;
          break;
        case 'name':
          comparison = a.shop_name.localeCompare(b.shop_name);
          break;
        case 'tier':
          comparison = a.tier - b.tier;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
    return sorted;
  }, [results, sortBy, sortAsc]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return null;
    return (
      <svg
        className={`w-4 h-4 inline-block ml-1 transition-transform ${sortAsc ? '' : 'rotate-180'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shop Finder</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Search and filter shops by location, capabilities, tier, and region
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filter Panel */}
        <div className="lg:col-span-1">
          <ShopFilterPanel
            onResults={handleResults}
            onLoading={setLoading}
          />
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3">
          <div className="card">
            <div className="card-body">
              {/* Results Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {hasSearched
                    ? `${results.length} Shop${results.length !== 1 ? 's' : ''} Found`
                    : 'Search Results'}
                </h2>
                {results.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>Sort by:</span>
                    <button
                      onClick={() => toggleSort('distance')}
                      className={`px-2 py-1 rounded ${sortBy === 'distance' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      Distance <SortIcon field="distance" />
                    </button>
                    <button
                      onClick={() => toggleSort('name')}
                      className={`px-2 py-1 rounded ${sortBy === 'name' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      Name <SortIcon field="name" />
                    </button>
                    <button
                      onClick={() => toggleSort('tier')}
                      className={`px-2 py-1 rounded ${sortBy === 'tier' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      Tier <SortIcon field="tier" />
                    </button>
                  </div>
                )}
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <svg
                    className="animate-spin h-8 w-8 text-primary-600"
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
                </div>
              )}

              {/* Empty State */}
              {!loading && !hasSearched && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <svg
                    className="w-12 h-12 mx-auto mb-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p>Use the filters to search for shops</p>
                </div>
              )}

              {/* No Results */}
              {!loading && hasSearched && results.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <svg
                    className="w-12 h-12 mx-auto mb-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p>No shops match your filters</p>
                  <p className="text-sm mt-1">Try adjusting your search criteria</p>
                </div>
              )}

              {/* Results Table */}
              {!loading && results.length > 0 && (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Shop
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Region
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tier
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Network
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Distance
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {sortedResults.map((shop) => (
                        <tr
                          key={shop.shop_code}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {shop.shop_name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {shop.shop_code}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {shop.region}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                shop.tier === 1
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : shop.tier === 2
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              Tier {shop.tier}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {shop.is_preferred_network ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400">
                                Preferred
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                            {shop.distance_miles !== null ? (
                              <span className="font-mono">
                                {parseFloat(shop.distance_miles.toString()).toFixed(1)} mi
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => window.open(`/planning?shop=${shop.shop_code}`, '_blank')}
                              className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
