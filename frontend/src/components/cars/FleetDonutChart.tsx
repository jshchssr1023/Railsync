'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface FleetDonutChartProps {
  data: { name: string; count: number }[];
  total: number;
  activeType?: string | null;
  onSliceClick: (typeName: string) => void;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, count, percent } = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100">{name}</p>
      <p className="text-gray-600 dark:text-gray-400">
        {count.toLocaleString()} cars ({percent}%)
      </p>
    </div>
  );
}

export default function FleetDonutChart({ data, total, activeType, onSliceClick }: FleetDonutChartProps) {
  const chartData = data.map(d => ({
    ...d,
    percent: total > 0 ? ((d.count / total) * 100).toFixed(1) : '0',
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Fleet Composition
      </h3>
      {chartData.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          No data available
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                dataKey="count"
                nameKey="name"
                onClick={(entry: any) => onSliceClick(entry.name)}
                className="cursor-pointer"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    opacity={activeType && activeType !== entry.name ? 0.3 : 1}
                    className="transition-opacity duration-200"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {/* Center label */}
              <text
                x="50%"
                y="46%"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-gray-900 dark:fill-gray-100 text-2xl font-bold"
                style={{ fontSize: '1.5rem', fontWeight: 700 }}
              >
                {total.toLocaleString()}
              </text>
              <text
                x="50%"
                y="56%"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-gray-500 dark:fill-gray-400 text-xs"
                style={{ fontSize: '0.75rem' }}
              >
                Total Cars
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {chartData.slice(0, 6).map((entry, index) => (
          <button
            key={entry.name}
            onClick={() => onSliceClick(entry.name)}
            className={`flex items-center gap-1.5 text-xs transition-opacity ${
              activeType && activeType !== entry.name ? 'opacity-40' : 'opacity-100'
            } hover:opacity-100`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
              {entry.name}
            </span>
            <span className="text-gray-400 dark:text-gray-500 tabular-nums">
              {entry.count}
            </span>
          </button>
        ))}
        {chartData.length > 6 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            +{chartData.length - 6} more
          </span>
        )}
      </div>
    </div>
  );
}
