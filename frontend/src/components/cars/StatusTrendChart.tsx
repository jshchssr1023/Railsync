'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface StatusTrendChartProps {
  weeks: Record<string, any>[];
  statuses: string[];
}

/** Color-coded to match StatusBadge from CarBadges.tsx */
const STATUS_COLORS: Record<string, string> = {
  'Complete': '#10b981',     // green
  'Healthy': '#10b981',      // green
  'Released': '#3b82f6',     // blue
  'Enroute': '#f59e0b',      // amber
  'Unknown': '#9ca3af',      // gray
  'Pipeline': '#8b5cf6',     // purple
  'Active': '#8b5cf6',       // purple
  'InShop': '#f97316',       // orange
  'In Shop': '#f97316',      // orange
  'Backlog': '#ef4444',      // red
  'Arrived': '#a855f7',      // purple variant
  'To Be Routed': '#f97316', // orange
  'To Be Scrapped': '#ef4444', // red
  'Scrapped': '#6b7280',     // gray
  'Upmarketed': '#06b6d4',   // cyan
  'Scheduled': '#6366f1',    // indigo
  'Planned': '#14b8a6',      // teal
};

const FALLBACK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

function getStatusColor(status: string, index: number): string {
  return STATUS_COLORS[status] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function formatWeek(weekStr: string): string {
  if (!weekStr) return '';
  const parts = weekStr.split('-');
  if (parts.length < 3) return weekStr;
  return `${parts[1]}/${parts[2]}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm max-w-[200px]">
      <p className="font-medium text-gray-900 dark:text-gray-100 mb-1 text-xs">
        Week of {label}
      </p>
      {payload
        .filter((p: any) => p.value > 0)
        .sort((a: any, b: any) => b.value - a.value)
        .map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">{p.dataKey}</span>
            </div>
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100 tabular-nums">
              {p.value}
            </span>
          </div>
        ))}
    </div>
  );
}

export default function StatusTrendChart({ weeks, statuses }: StatusTrendChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Status Trend (90 Days)
      </h3>
      {weeks.length === 0 || statuses.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          No trend data available
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeks} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatWeek}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px' }}
              />
              {statuses.map((status, index) => (
                <Line
                  key={status}
                  type="monotone"
                  dataKey={status}
                  stroke={getStatusColor(status, index)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
