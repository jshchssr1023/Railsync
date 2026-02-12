'use client';

import { Car, AlertTriangle, Bell, ArrowRightLeft, Wrench, Calendar } from 'lucide-react';
import { useCarDrawer } from '@/context/CarDrawerContext';

interface TransitionDetails {
  type: string;
  status: string;
  from_customer: string | null;
  to_customer: string | null;
  target_date: string | null;
}

interface RiderCar {
  car_number: string;
  car_type: string;
  material_type: string;
  lessee_name: string;
  current_status: string;
  rider_id: string;
  rider_name: string;
  required_shop_date: string | null;
  next_service_due: string | null;
  has_pending_amendment: boolean;
  amendment_conflict: boolean;
  conflict_reason: string | null;
  has_active_transition: boolean;
  transition_details: TransitionDetails | null;
  active_assignments: number;
}

interface CarCardProps {
  car: RiderCar;
  onShop: (carNumber: string) => void;
  onAmendmentClick?: (car: RiderCar) => void;
  compact?: boolean;
}

export default function CarCard({ car, onShop, onAmendmentClick, compact }: CarCardProps) {
  const { openCarDrawer } = useCarDrawer();
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const hasIssues = car.has_pending_amendment || car.amendment_conflict || car.has_active_transition;

  if (compact) {
    return (
      <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${car.amendment_conflict ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); openCarDrawer(car.car_number); }} className="font-mono font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">
              {car.car_number}
            </button>
            {car.has_pending_amendment && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onAmendmentClick?.(car);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded text-xs font-medium cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/50"
              >
                <Bell className="w-3 h-3" />
                Updated
              </span>
            )}
            {car.has_active_transition && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs font-medium">
                <ArrowRightLeft className="w-3 h-3" />
                {car.transition_details?.type}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {car.car_type || car.material_type || '-'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {car.lessee_name || '-'}
          {car.has_active_transition && car.transition_details?.to_customer && (
            <span className="block text-xs text-purple-600 dark:text-purple-400">
              → {car.transition_details.to_customer}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          {car.amendment_conflict ? (
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-[150px]" title={car.conflict_reason || ''}>
                {car.conflict_reason || 'Conflict'}
              </span>
            </div>
          ) : car.active_assignments > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {car.active_assignments} Active
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {formatDate(car.next_service_due || car.required_shop_date)}
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShop(car.car_number);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
          >
            <Wrench className="w-4 h-4" />
            Shop
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4
        ${car.amendment_conflict
          ? 'border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-800'
          : hasIssues
          ? 'border-amber-200 dark:border-amber-700'
          : 'border-gray-200 dark:border-gray-700'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${car.amendment_conflict ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <Car className={`w-5 h-5 ${car.amendment_conflict ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`} />
          </div>
          <div>
            <h3 className="font-mono font-semibold text-gray-900 dark:text-gray-100">
              {car.car_number}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {car.car_type || car.material_type}
            </p>
          </div>
        </div>
        <button
          onClick={() => onShop(car.car_number)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          <Wrench className="w-4 h-4" />
          Shop
        </button>
      </div>

      {/* Badges */}
      {hasIssues && (
        <div className="flex flex-wrap gap-2 mb-3">
          {car.has_pending_amendment && (
            <span
              onClick={() => onAmendmentClick?.(car)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs font-medium cursor-pointer hover:bg-amber-200"
            >
              <Bell className="w-3 h-3" />
              Updated Terms
            </span>
          )}
          {car.amendment_conflict && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              Scheduling Conflict
            </span>
          )}
          {car.has_active_transition && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-xs font-medium">
              <ArrowRightLeft className="w-3 h-3" />
              {car.transition_details?.type === 'return' ? 'Returning' : 'Reassigning'}
            </span>
          )}
        </div>
      )}

      {/* Transition Details */}
      {car.has_active_transition && car.transition_details && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 mb-3 text-xs">
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <span>{car.transition_details.from_customer || car.lessee_name}</span>
            <ArrowRightLeft className="w-3 h-3" />
            <span>{car.transition_details.to_customer || 'TBD'}</span>
          </div>
          {car.transition_details.target_date && (
            <p className="text-purple-600 dark:text-purple-400 mt-1">
              Target: {formatDate(car.transition_details.target_date)}
            </p>
          )}
        </div>
      )}

      {/* Conflict Reason */}
      {car.amendment_conflict && car.conflict_reason && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 mb-3 text-xs text-red-700 dark:text-red-300">
          {car.conflict_reason}
        </div>
      )}

      {/* Info */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Lessee</p>
          <p className="text-gray-900 dark:text-gray-100 truncate">{car.lessee_name || '-'}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Service Due</p>
          <p className="text-gray-900 dark:text-gray-100 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {formatDate(car.next_service_due || car.required_shop_date)}
          </p>
        </div>
      </div>
    </div>
  );
}
