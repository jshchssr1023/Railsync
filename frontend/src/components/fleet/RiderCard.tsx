'use client';

import { FileText, Car, Calendar, ChevronRight, AlertTriangle, Bell } from 'lucide-react';

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

interface RiderCardProps {
  rider: LeaseRider;
  onClick: (rider: LeaseRider) => void;
  onAmendmentClick?: (rider: LeaseRider) => void;
  isSelected?: boolean;
}

export default function RiderCard({ rider, onClick, onAmendmentClick, isSelected }: RiderCardProps) {
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const statusColors: Record<string, string> = {
    Active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    Expired: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    Superseded: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };

  const hasIssues = rider.has_pending_amendments || (rider.cars_with_conflicts && rider.cars_with_conflicts > 0);

  return (
    <div
      onClick={() => onClick(rider)}
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 p-4 cursor-pointer
        transition-all duration-200 hover:shadow-md relative
        ${isSelected
          ? 'border-amber-500 ring-2 ring-amber-200 dark:ring-amber-800'
          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${hasIssues ? 'ring-1 ring-amber-300 dark:ring-amber-700' : ''}
      `}
    >
      {/* Updated Terms Badge */}
      {rider.has_pending_amendments && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onAmendmentClick?.(rider);
          }}
          className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-amber-600 transition-colors shadow-md"
        >
          <Bell className="w-3 h-3" />
          Updated Terms
        </div>
      )}

      {/* Conflict Badge */}
      {rider.cars_with_conflicts && rider.cars_with_conflicts > 0 && (
        <div className="absolute -top-2 left-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
          <AlertTriangle className="w-3 h-3" />
          {rider.cars_with_conflicts} Conflict{rider.cars_with_conflicts > 1 ? 's' : ''}
        </div>
      )}

      <div className="flex items-start justify-between mb-3 mt-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {rider.rider_name || rider.rider_id}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {rider.rider_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[rider.status] || statusColors.Active}`}>
            {rider.status}
          </span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>Eff: {formatDate(rider.effective_date)}</span>
        </div>
        {rider.expiration_date && (
          <span className="text-gray-400">Exp: {formatDate(rider.expiration_date)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="flex items-center justify-center gap-1">
            <Car className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {rider.car_count}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cars</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="flex items-center justify-center gap-1">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {rider.amendment_count}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Amendments</p>
        </div>
      </div>
    </div>
  );
}
