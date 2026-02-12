'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Wrench, DollarSign, Building2, BarChart3, ExternalLink } from 'lucide-react';
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

interface ShoppingEvent {
  id: string;
  event_number: string;
  shop_code: string;
  shop_name: string;
  current_state: string;
  shopping_type_name: string;
  shopping_reason_name: string;
  approved_cost: number | null;
  estimate_count: number;
  created_at: string;
}

interface AssetEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  metadata?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// State badge colors
// ---------------------------------------------------------------------------
const STATE_COLORS: Record<string, string> = {
  REQUESTED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  ASSIGNED_TO_SHOP: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_REPAIR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  RELEASED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function CarDetailRepairHistoryTab({ carNumber }: { carNumber: string }) {
  const [shoppingEvents, setShoppingEvents] = useState<ShoppingEvent[]>([]);
  const [assetEvents, setAssetEvents] = useState<AssetEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<{ data: ShoppingEvent[] }>(`/cars/${carNumber}/shopping-history`)
        .then(res => res.data || [])
        .catch(() => []),
      apiFetch<{ data: AssetEvent[] }>(`/cars/${carNumber}/history?limit=50`)
        .then(res => res.data || [])
        .catch(() => []),
    ]).then(([shopping, events]) => {
      setShoppingEvents(shopping);
      setAssetEvents(events);
    }).finally(() => setLoading(false));
  }, [carNumber]);

  // Summary stats
  const stats = useMemo(() => {
    const totalCost = shoppingEvents.reduce((sum, e) => sum + (e.approved_cost || 0), 0);
    const lastShop = shoppingEvents.length > 0 ? shoppingEvents[0].shop_name : null;
    const avgCost = shoppingEvents.length > 0 ? totalCost / shoppingEvents.length : 0;
    return {
      totalEvents: shoppingEvents.length,
      totalCost,
      lastShop,
      avgCost,
    };
  }, [shoppingEvents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (shoppingEvents.length === 0 && assetEvents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Wrench className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium">No repair history</p>
        <p className="text-xs mt-1">This car has no recorded shopping events or asset history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: String(stats.totalEvents), icon: BarChart3, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Total Approved Cost', value: stats.totalCost > 0 ? `$${stats.totalCost.toLocaleString()}` : '-', icon: DollarSign, color: 'text-green-600 dark:text-green-400' },
          { label: 'Last Shop', value: stats.lastShop || '-', icon: Building2, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Avg Cost / Event', value: stats.avgCost > 0 ? `$${Math.round(stats.avgCost).toLocaleString()}` : '-', icon: DollarSign, color: 'text-amber-600 dark:text-amber-400' },
        ].map(card => (
          <div key={card.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">{card.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Shopping Events Table */}
      {shoppingEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Shopping Events</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Event #</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Shop</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">State</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Type / Reason</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Approved Cost</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {shoppingEvents.map(event => (
                  <tr key={event.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/shopping/${event.id}`}
                        className="text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1"
                      >
                        {event.event_number}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{event.shop_name || event.shop_code || '-'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATE_COLORS[event.current_state] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {event.current_state?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
                      {event.shopping_type_name || '-'}
                      {event.shopping_reason_name && (
                        <span className="text-gray-400 dark:text-gray-500"> / {event.shopping_reason_name}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {event.approved_cost != null ? `$${event.approved_cost.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-500 dark:text-gray-400 text-xs">
                      {event.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Asset Event Timeline */}
      {assetEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Asset Event Timeline</h3>
          <div className="relative pl-6 space-y-0">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-1 bottom-1 w-px bg-gray-200 dark:bg-gray-700" />
            {assetEvents.map((event, i) => (
              <div key={event.id || i} className="relative flex items-start gap-3 py-2">
                <div className="absolute left-[-15px] top-3 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 ring-2 ring-white dark:ring-gray-900" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{event.event_type}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{event.created_at?.slice(0, 10)}</span>
                  </div>
                  {event.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{event.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
