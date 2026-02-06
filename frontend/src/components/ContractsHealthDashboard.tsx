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

  const getToken = () => localStorage.getItem('railsync_access_token');

  useEffect(() => {
    const headers = { Authorization: `Bearer ${getToken()}` };

    Promise.all([
      fetch(`${API_URL}/dashboard/contracts-readiness`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/customers`, { headers }).then(r => r.json()),
    ])
      .then(([readinessData, customersData]) => {
        const readiness = readinessData.data || {};
        const customers = customersData.data || [];

        // Shopping health from contracts-readiness (uses real allocations table)
        const inShop = Number(readiness.arrived || 0);
        const enroute = Number(readiness.enroute || 0);
        const needShopping = Number(readiness.need_shopping || 0);
        const total = Number(readiness.total_cars || 0);

        // Utilization from contracts-readiness
        const inPipeline = Number(readiness.in_pipeline || 0);
        const available = Number(readiness.available || 0);

        // Aggregate rider/car counts from customers
        const totalRiders = customers.reduce((sum: number, c: any) => sum + Number(c.total_riders || 0), 0);
        const totalCars = customers.reduce((sum: number, c: any) => sum + Number(c.total_cars || 0), 0);

        setMetrics({
          shopping: {
            inShop,
            enroute,
            overdue: needShopping,
            total,
          },
          utilization: {
            assigned: inPipeline,
            unassigned: Math.max(0, (totalCars || total) - inPipeline),
            total: totalCars || total,
            percentage: Number(readiness.availability_pct || 0),
          },
          risk: {
            ridersExpiring90Days: totalRiders,
            pendingAmendments: 0,
          },
        });
      })
      .catch(err => {
        console.error('Failed to fetch contracts health:', err);
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
        title="Contract Coverage"
        items={[
          {
            label: 'Active Riders',
            value: metrics.risk.ridersExpiring90Days,
            status: metrics.risk.ridersExpiring90Days > 0 ? 'green' : 'gray'
          },
          {
            label: 'Need Shopping',
            value: metrics.shopping.overdue,
            status: metrics.shopping.overdue > 10 ? 'red' : metrics.shopping.overdue > 0 ? 'yellow' : 'green'
          },
        ]}
      />
    </div>
  );
}
