'use client';

import { useState } from 'react';
import {
  Loader2, ChevronDown, ChevronUp, DollarSign, Car,
  Calendar, Shield, TrendingUp,
} from 'lucide-react';
import { getBillingPreview } from '@/lib/api';

interface PreviewCar {
  car_number: string;
  on_rent_days: number;
  abatement_days: number;
  billable_days: number;
  daily_rate: number;
  line_total: number;
}

interface PreviewRider {
  rider_id: string;
  rider_code: string;
  rider_name: string | null;
  rate_per_car: number;
  cars: PreviewCar[];
  subtotal: number;
}

interface PreviewCustomer {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  riders: PreviewRider[];
  total_cars: number;
  total_on_rent_days: number;
  total_abatement_days: number;
  total_billable_days: number;
  estimated_total: number;
}

interface BillingCalculationPreviewProps {
  fiscalYear: number;
  fiscalMonth: number;
}

export default function BillingCalculationPreview({ fiscalYear, fiscalMonth }: BillingCalculationPreviewProps) {
  const [preview, setPreview] = useState<PreviewCustomer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedRiders, setExpandedRiders] = useState<Set<string>>(new Set());

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingPreview(fiscalYear, fiscalMonth);
      setPreview(data as PreviewCustomer[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomer = (id: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleRider = (id: string) => {
    setExpandedRiders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const monthName = new Date(fiscalYear, fiscalMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Totals
  const grandTotal = preview?.reduce((s, c) => s + c.estimated_total, 0) || 0;
  const totalCars = preview?.reduce((s, c) => s + c.total_cars, 0) || 0;
  const totalAbatement = preview?.reduce((s, c) => s + c.total_abatement_days, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Billing Preview — {monthName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Breakdown of on-rent, abatement, and billable days per car before committing invoices.
          </p>
        </div>
        <button
          onClick={loadPreview}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          {preview ? 'Refresh' : 'Generate Preview'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Computing preview (this may take a moment)...</span>
        </div>
      )}

      {preview && !loading && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Estimated Total</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{fmt(grandTotal)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Car className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Total Cars</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalCars}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Customers</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{preview.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Abatement Days</span>
              </div>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{totalAbatement}</p>
            </div>
          </div>

          {/* Customer list */}
          <div className="space-y-2">
            {preview.map(cust => (
              <div key={cust.customer_id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Customer header */}
                <button
                  onClick={() => toggleCustomer(cust.customer_id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedCustomers.has(cust.customer_id)
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />
                    }
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {cust.customer_name}
                    </span>
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{cust.customer_code}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {cust.total_cars} car{cust.total_cars !== 1 ? 's' : ''}
                    </span>
                    {cust.total_abatement_days > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        {cust.total_abatement_days}d abatement
                      </span>
                    )}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {fmt(cust.estimated_total)}
                    </span>
                  </div>
                </button>

                {/* Expanded: riders */}
                {expandedCustomers.has(cust.customer_id) && (
                  <div className="px-4 pb-3 space-y-2 bg-white dark:bg-gray-900">
                    {cust.riders.map(rider => (
                      <div key={rider.rider_id} className="border border-gray-100 dark:border-gray-700 rounded-lg">
                        <button
                          onClick={() => toggleRider(rider.rider_id)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedRiders.has(rider.rider_id)
                              ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                              : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            }
                            <span className="text-sm text-gray-900 dark:text-gray-100">
                              {rider.rider_name || rider.rider_code}
                            </span>
                            <span className="text-xs text-gray-400">@ {fmt(rider.rate_per_car)}/mo</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {fmt(rider.subtotal)}
                          </span>
                        </button>

                        {/* Car detail table */}
                        {expandedRiders.has(rider.rider_id) && (
                          <div className="px-3 pb-2">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 dark:text-gray-400">
                                  <th className="text-left py-1 font-medium">Car</th>
                                  <th className="text-right py-1 font-medium">On-Rent</th>
                                  <th className="text-right py-1 font-medium">Abatement</th>
                                  <th className="text-right py-1 font-medium">Billable</th>
                                  <th className="text-right py-1 font-medium">Daily Rate</th>
                                  <th className="text-right py-1 font-medium">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {rider.cars.map(car => (
                                  <tr key={car.car_number} className={car.abatement_days > 0 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                                    <td className="py-1.5 font-mono text-gray-900 dark:text-gray-100">{car.car_number}</td>
                                    <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">{car.on_rent_days}d</td>
                                    <td className={`py-1.5 text-right ${car.abatement_days > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-400'}`}>
                                      {car.abatement_days > 0 ? `-${car.abatement_days}d` : '-'}
                                    </td>
                                    <td className="py-1.5 text-right text-gray-900 dark:text-gray-100 font-medium" title="Billing stops when releasing is initiated (R23)">
                                      {car.billable_days}d
                                    </td>
                                    <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">{fmt(car.daily_rate)}</td>
                                    <td className="py-1.5 text-right text-gray-900 dark:text-gray-100 font-medium">{fmt(car.line_total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {preview.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No active riders with billable cars for this period.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
