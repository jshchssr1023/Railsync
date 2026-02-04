'use client';

import { FileText, Car, Calendar, ChevronRight, DollarSign } from 'lucide-react';

interface MasterLease {
  id: string;
  lease_id: string;
  customer_id: string;
  customer_name: string;
  lease_name?: string;
  start_date: string;
  end_date: string;
  status: string;
  rider_count: number;
  car_count: number;
  monthly_revenue: number;
}

interface LeaseCardProps {
  lease: MasterLease;
  onClick: (lease: MasterLease) => void;
  isSelected?: boolean;
}

export default function LeaseCard({ lease, onClick, isSelected }: LeaseCardProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statusColors: Record<string, string> = {
    Active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    Expired: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    Terminated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div
      onClick={() => onClick(lease)}
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 p-4 cursor-pointer
        transition-all duration-200 hover:shadow-md
        ${isSelected
          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {lease.lease_name || lease.lease_id}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {lease.lease_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lease.status] || statusColors.Active}`}>
            {lease.status}
          </span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(lease.start_date)} - {formatDate(lease.end_date)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="flex items-center justify-center gap-1">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {lease.rider_count}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Riders</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="flex items-center justify-center gap-1">
            <Car className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {lease.car_count}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cars</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="flex items-center justify-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(lease.monthly_revenue || 0)}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">/mo</p>
        </div>
      </div>
    </div>
  );
}
