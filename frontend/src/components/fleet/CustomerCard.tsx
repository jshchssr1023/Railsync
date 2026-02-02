'use client';

import { Building2, FileText, Car, ChevronRight } from 'lucide-react';

interface Customer {
  id: string;
  customer_code: string;
  customer_name: string;
  is_active: boolean;
  active_leases: number;
  total_riders: number;
  total_cars: number;
}

interface CustomerCardProps {
  customer: Customer;
  onClick: (customer: Customer) => void;
  isSelected?: boolean;
}

export default function CustomerCard({ customer, onClick, isSelected }: CustomerCardProps) {
  return (
    <div
      onClick={() => onClick(customer)}
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 p-4 cursor-pointer
        transition-all duration-200 hover:shadow-md
        ${isSelected
          ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {customer.customer_name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {customer.customer_code}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="flex items-center justify-center gap-1">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {customer.active_leases}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Leases</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="flex items-center justify-center gap-1">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {customer.total_riders}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Riders</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="flex items-center justify-center gap-1">
            <Car className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {customer.total_cars}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cars</p>
        </div>
      </div>
    </div>
  );
}
