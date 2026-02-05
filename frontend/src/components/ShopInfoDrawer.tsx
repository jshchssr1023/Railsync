'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, MapPin } from 'lucide-react';
import { ShopWithDistance } from '@/lib/api';

interface ShopBacklogData {
  shop: {
    shop_code: string;
    shop_name: string;
    primary_railroad: string;
    region: string;
    labor_rate: number;
    is_preferred_network: boolean;
  };
  backlog: {
    shop_code: string;
    date: string;
    hours_backlog: number;
    cars_backlog: number;
    cars_en_route_0_6: number;
    cars_en_route_7_14: number;
    cars_en_route_15_plus: number;
  };
  capacity: Array<{
    work_type: string;
    weekly_hours_capacity: number;
    current_utilization_pct: number;
  }>;
  capabilities: Record<string, string[]>;
}

interface ShopInfoDrawerProps {
  shop: ShopWithDistance | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShopInfoDrawer({ shop, isOpen, onClose }: ShopInfoDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shopData, setShopData] = useState<ShopBacklogData | null>(null);

  useEffect(() => {
    if (isOpen && shop) {
      fetchShopDetails(shop.shop_code);
    }
  }, [isOpen, shop]);

  const fetchShopDetails = async (shopCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/shops/${shopCode}/backlog`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setShopData(result.data);
      } else {
        setError(result.error || 'Failed to fetch shop details');
      }
    } catch (err) {
      setError('Failed to fetch shop details');
    } finally {
      setLoading(false);
    }
  };

  if (!shop) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 2:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getDesignationColor = (designation: string) => {
    switch (designation) {
      case 'storage':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400';
      case 'scrap':
        return 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400';
      default:
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400';
    }
  };

  const getCapabilityColor = (type: string) => {
    const colors: Record<string, string> = {
      car_type: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      material: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      lining: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      coating: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      service: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
      compliance: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Shop details for ${shop.shop_name}`}
        className={`fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-gray-900 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{shop.shop_name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{shop.shop_code}</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{shop.region}</span>
              {shop.is_preferred_network && (
                <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">
                  Preferred Network
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Close shop info"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-130px)] px-6 py-4 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12" role="status" aria-label="Loading shop details">
              <Loader2 className="animate-spin h-8 w-8 text-primary-600" aria-hidden="true" />
            </div>
          )}

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTierColor(shop.tier)}`}>
                    Tier {shop.tier}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDesignationColor(shop.shop_designation)}`}>
                    {shop.shop_designation ? shop.shop_designation.charAt(0).toUpperCase() + shop.shop_designation.slice(1) : 'Repair'}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {shop.capacity !== null ? shop.capacity : '-'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Capacity</div>
                </div>
              </div>

              {/* Location & Distance */}
              {shop.distance_miles !== null && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    <span className="text-blue-800 dark:text-blue-300 font-medium">
                      {parseFloat(shop.distance_miles.toString()).toFixed(1)} miles away
                    </span>
                  </div>
                  {shop.latitude && shop.longitude && (
                    <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      Coordinates: {shop.latitude.toFixed(4)}, {shop.longitude.toFixed(4)}
                    </div>
                  )}
                </div>
              )}

              {/* Labor Rate */}
              {shopData?.shop?.labor_rate && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Labor Rate</h3>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(shopData.shop.labor_rate)}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> / hour</span>
                  </div>
                </div>
              )}

              {/* Backlog Metrics */}
              {shopData?.backlog && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Current Backlog</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {Number(shopData.backlog.hours_backlog || 0).toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Hours Backlog</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {shopData.backlog.cars_backlog || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Cars Backlog</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {shopData.backlog.cars_en_route_0_6 || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">En Route 0-6 Days</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {shopData.backlog.cars_en_route_7_14 || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">En Route 7-14 Days</div>
                    </div>
                    <div className="col-span-2 text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {shopData.backlog.cars_en_route_15_plus || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">En Route 15+ Days</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Capacity by Work Type */}
              {shopData?.capacity && shopData.capacity.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Capacity by Work Type</h3>
                  <div className="space-y-3">
                    {shopData.capacity.map((cap) => (
                      <div key={cap.work_type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 dark:text-gray-300 capitalize">{cap.work_type.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{cap.weekly_hours_capacity}h/week</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              cap.current_utilization_pct > 90
                                ? 'bg-red-500'
                                : cap.current_utilization_pct > 70
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(cap.current_utilization_pct, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {cap.current_utilization_pct}% utilized
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Capabilities */}
              {shopData?.capabilities && Object.keys(shopData.capabilities).length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Capabilities</h3>
                  <div className="space-y-4">
                    {Object.entries(shopData.capabilities).map(([type, values]) => (
                      <div key={type}>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          {type.replace(/_/g, ' ')}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {values.map((value) => (
                            <span
                              key={value}
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getCapabilityColor(type)}`}
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No detailed data message */}
              {!shopData && !loading && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Additional shop details are not available.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={() => window.open(`/planning?shop=${shop.shop_code}`, '_blank')}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Open in Quick Shop
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
