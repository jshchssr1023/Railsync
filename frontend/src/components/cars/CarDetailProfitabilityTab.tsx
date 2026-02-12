'use client';

import { useState, useEffect } from 'react';
import {
  Loader2, DollarSign, TrendingUp, TrendingDown, BarChart3,
  AlertCircle, Wrench, FileText,
} from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('railsync_access_token');
}

async function apiFetch<T>(endpoint: string): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

interface ProfitabilityData {
  data_available: boolean;
  total_revenue: number;
  rental_revenue: number;
  mileage_revenue: number;
  chargeback_revenue: number;
  total_repair_cost: number;
  total_assignment_cost: number;
  net_margin: number;
  margin_pct: number;
  invoice_count: number;
  shopping_event_count: number;
  earliest_billing_period: string | null;
  latest_billing_period: string | null;
  monthly_trend: { fiscal_year: number; fiscal_month: number; revenue: number }[];
  cost_breakdown: { event_id: string; event_number: string; shop_name: string; approved_cost: number }[];
}

function formatCurrency(amount: number): string {
  if (amount === 0) return '$0';
  const abs = Math.abs(amount);
  const formatted = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toLocaleString()}`;
  return amount < 0 ? `-${formatted}` : formatted;
}

function formatFullCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function CarDetailProfitabilityTab({ carNumber }: { carNumber: string }) {
  const [data, setData] = useState<ProfitabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ data: ProfitabilityData }>(`/cars/${carNumber}/profitability`)
      .then(res => setData(res.data))
      .catch(err => {
        setError(err.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [carNumber]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <DollarSign className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium">Unable to load profitability data</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (!data || !data.data_available) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <DollarSign className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium">No billing data available</p>
        <p className="text-xs mt-1">No invoices or cost records have been recorded for this car.</p>
      </div>
    );
  }

  const marginColor = data.net_margin >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
  const MarginIcon = data.net_margin >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-[10px] uppercase tracking-wider text-green-600 dark:text-green-400">Total Revenue</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatFullCurrency(data.total_revenue)}</p>
          <p className="text-[10px] text-gray-400 mt-1">{data.invoice_count} invoices</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400">Total Cost</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatFullCurrency(data.total_repair_cost + data.total_assignment_cost)}</p>
          <p className="text-[10px] text-gray-400 mt-1">{data.shopping_event_count} repair events</p>
        </div>
        <div className={`rounded-lg p-4 ${data.net_margin >= 0 ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800' : 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'}`}>
          <div className="flex items-center gap-2 mb-1">
            <MarginIcon className={`w-4 h-4 ${marginColor}`} />
            <span className={`text-[10px] uppercase tracking-wider ${marginColor}`}>Net Margin</span>
          </div>
          <p className={`text-xl font-bold ${marginColor}`}>{formatFullCurrency(data.net_margin)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Margin %</span>
          </div>
          <p className={`text-xl font-bold ${marginColor}`}>
            {data.total_revenue > 0 ? `${data.margin_pct.toFixed(1)}%` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          Revenue Breakdown
        </h3>
        <div className="space-y-2">
          {[
            { label: 'Rental Revenue', value: data.rental_revenue, color: 'bg-blue-500' },
            { label: 'Mileage Revenue', value: data.mileage_revenue, color: 'bg-green-500' },
            { label: 'Chargeback Revenue', value: data.chargeback_revenue, color: 'bg-amber-500' },
          ].map(item => {
            const pct = data.total_revenue > 0 ? (item.value / data.total_revenue) * 100 : 0;
            return (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{formatFullCurrency(item.value)}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                  <div className={`${item.color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {data.earliest_billing_period && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">
            Billing data from {data.earliest_billing_period} to {data.latest_billing_period}
          </p>
        )}
      </div>

      {/* Cost Breakdown */}
      {data.cost_breakdown && data.cost_breakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-gray-400" />
            Cost Breakdown by Repair Event
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Event #</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Shop</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Approved Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.cost_breakdown.map((item, i) => (
                  <tr key={item.event_id || i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3">
                      <Link
                        href={`/shopping/${item.event_id}`}
                        className="text-primary-600 dark:text-primary-400 hover:underline font-medium text-xs"
                      >
                        {item.event_number}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-700 dark:text-gray-300">{item.shop_name || '-'}</td>
                    <td className="py-2 px-3 text-right text-xs font-medium text-gray-900 dark:text-gray-100">
                      {formatFullCurrency(item.approved_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      {data.monthly_trend && data.monthly_trend.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            Monthly Revenue Trend
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Period</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly_trend.map((entry, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3 text-xs text-gray-700 dark:text-gray-300">
                      {entry.fiscal_year}-{String(entry.fiscal_month).padStart(2, '0')}
                    </td>
                    <td className="py-2 px-3 text-right text-xs font-medium text-gray-900 dark:text-gray-100">
                      {formatFullCurrency(entry.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
