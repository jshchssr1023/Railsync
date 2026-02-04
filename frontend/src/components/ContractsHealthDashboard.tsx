'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface HealthMetrics {
  shopping: {
    inShop: number;
    enroute: number;
    overdue: number;
    total: number;
  };
  utilization: {
    assigned: number;
    unassigned: number;
    total: number;
    percentage: number;
  };
  risk: {
    ridersExpiring90Days: number;
    pendingAmendments: number;
  };
}

function StoplightCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; status: 'green' | 'yellow' | 'red' | 'gray' }[];
}) {
  const statusColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${statusColors[item.status]}`} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UtilizationCard({ assigned, unassigned, percentage }: { assigned: number; unassigned: number; percentage: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Utilization</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${percentage * 1.76} 176`}
              className={percentage >= 80 ? 'text-green-500' : percentage >= 50 ? 'text-yellow-500' : 'text-red-500'}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{percentage}%</span>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Assigned</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{assigned}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Unassigned</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{unassigned}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContractsHealthDashboard() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/allocations?limit=1000`).then(r => r.json()),
      fetch(`${API_URL}/cars?limit=1000`).then(r => r.json()),
      fetch(`${API_URL}/riders?limit=500`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_URL}/amendments?limit=500`).then(r => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([allocData, carsData, ridersData, amendmentsData]) => {
        const allocations = allocData.data || [];
        const cars = carsData.data || [];
        const riders = ridersData.data || [];
        const amendments = amendmentsData.data || [];

        // Shopping health
        const inShop = allocations.filter((a: any) => a.status === 'Arrived').length;
        const enroute = allocations.filter((a: any) => a.status === 'Enroute').length;
        const overdue = allocations.filter((a: any) => {
          if (!a.planned_arrival_date) return false;
          return new Date(a.planned_arrival_date) < new Date() &&
                 !['Complete', 'Released'].includes(a.status);
        }).length;

        // Utilization
        const assigned = allocations.filter((a: any) =>
          ['Planned Shopping', 'Enroute', 'Arrived', 'Complete'].includes(a.status)
        ).length;
        const totalCars = cars.length || 100;
        const unassigned = totalCars - assigned;

        // Risk
        const now = new Date();
        const days90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        const ridersExpiring = riders.filter((r: any) => {
          if (!r.end_date) return false;
          const endDate = new Date(r.end_date);
          return endDate > now && endDate <= days90;
        }).length;
        const pendingAmendments = amendments.filter((a: any) =>
          a.status === 'pending' || a.status === 'draft'
        ).length;

        setMetrics({
          shopping: {
            inShop,
            enroute,
            overdue,
            total: allocations.length,
          },
          utilization: {
            assigned,
            unassigned,
            total: totalCars,
            percentage: Math.round((assigned / Math.max(totalCars, 1)) * 100),
          },
          risk: {
            ridersExpiring90Days: ridersExpiring,
            pendingAmendments,
          },
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-32 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StoplightCard
        title="Shopping Health"
        items={[
          { label: 'In Shop', value: metrics.shopping.inShop, status: 'green' },
          { label: 'Enroute', value: metrics.shopping.enroute, status: 'yellow' },
          { label: 'Overdue', value: metrics.shopping.overdue, status: metrics.shopping.overdue > 0 ? 'red' : 'green' },
        ]}
      />
      <UtilizationCard
        assigned={metrics.utilization.assigned}
        unassigned={metrics.utilization.unassigned}
        percentage={metrics.utilization.percentage}
      />
      <StoplightCard
        title="Contractual Risk"
        items={[
          {
            label: 'Riders Expiring <90d',
            value: metrics.risk.ridersExpiring90Days,
            status: metrics.risk.ridersExpiring90Days > 5 ? 'red' : metrics.risk.ridersExpiring90Days > 0 ? 'yellow' : 'green'
          },
          {
            label: 'Pending Amendments',
            value: metrics.risk.pendingAmendments,
            status: metrics.risk.pendingAmendments > 3 ? 'yellow' : 'green'
          },
        ]}
      />
    </div>
  );
}
