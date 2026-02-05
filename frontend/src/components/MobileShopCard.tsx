'use client';

import { ChevronRight } from 'lucide-react';

interface MobileShopCardProps {
  shopCode: string;
  shopName: string;
  region?: string;
  tier?: number;
  designation?: string;
  capacity?: number | null;
  distanceMiles?: number | null;
  isPreferredNetwork?: boolean;
  onClick?: () => void;
}

export default function MobileShopCard({
  shopCode,
  shopName,
  region,
  tier,
  designation,
  capacity,
  distanceMiles,
  isPreferredNetwork,
  onClick,
}: MobileShopCardProps) {
  const getTierColor = (tier?: number) => {
    switch (tier) {
      case 1:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 2:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getDesignationColor = (des?: string) => {
    switch (des) {
      case 'storage':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'scrap':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`mobile-card ${onClick ? 'cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {shopName}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
            {shopCode}
          </div>
        </div>
        {isPreferredNetwork && (
          <span className="ml-2 flex-shrink-0 mobile-badge bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Preferred
          </span>
        )}
      </div>

      {/* Badges Row */}
      <div className="flex flex-wrap gap-2 mb-3">
        {tier && (
          <span className={`mobile-badge ${getTierColor(tier)}`}>
            Tier {tier}
          </span>
        )}
        {designation && (
          <span className={`mobile-badge ${getDesignationColor(designation)}`}>
            {designation.charAt(0).toUpperCase() + designation.slice(1)}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        {region && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Region</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{region}</div>
          </div>
        )}
        {capacity !== undefined && capacity !== null && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Capacity</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{capacity}</div>
          </div>
        )}
        {distanceMiles !== undefined && distanceMiles !== null && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Distance</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {parseFloat(distanceMiles.toString()).toFixed(1)} mi
            </div>
          </div>
        )}
      </div>

      {/* Action hint */}
      {onClick && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end text-sm text-primary-600 dark:text-primary-400">
          <span>View Details</span>
          <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
