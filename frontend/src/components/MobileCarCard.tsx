'use client';

import { ChevronRight } from 'lucide-react';

interface MobileCarCardProps {
  carNumber: string;
  shopCode?: string;
  shopName?: string;
  status: string;
  targetMonth?: string;
  estimatedCost?: number;
  carType?: string;
  customer?: string;
  onClick?: () => void;
}

export default function MobileCarCard({
  carNumber,
  shopCode,
  shopName,
  status,
  targetMonth,
  estimatedCost,
  carType,
  customer,
  onClick,
}: MobileCarCardProps) {
  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('complete')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (statusLower.includes('active') || statusLower.includes('in_shop')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    if (statusLower.includes('transit') || statusLower.includes('enroute')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (statusLower.includes('bad') || statusLower.includes('order')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    if (statusLower.includes('plan') || statusLower.includes('schedule')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const formatCurrency = (val?: number) => {
    if (!val) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatMonth = (month?: string) => {
    if (!month) return '-';
    const [year, m] = month.split('-');
    return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `View details for car ${carNumber}` : undefined}
      className={`mobile-card ${onClick ? 'cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900' : ''}`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
            {carNumber}
          </div>
          {carType && (
            <div className="text-sm text-gray-500 dark:text-gray-400">{carType}</div>
          )}
        </div>
        <span className={`mobile-badge ${getStatusColor(status)}`}>
          {status}
        </span>
      </div>

      {/* Shop Info */}
      {(shopCode || shopName) && (
        <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Shop</div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {shopName || shopCode}
          </div>
          {shopName && shopCode && (
            <div className="text-xs text-gray-500 font-mono">{shopCode}</div>
          )}
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {customer && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Customer</div>
            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{customer}</div>
          </div>
        )}
        {targetMonth && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Target</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{formatMonth(targetMonth)}</div>
          </div>
        )}
        {estimatedCost !== undefined && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Est. Cost</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(estimatedCost)}</div>
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
