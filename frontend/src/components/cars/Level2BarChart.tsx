'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Level2BarChartProps {
  data: { name: string; count: number }[];
  carType: string | null;
  onBarClick: (commodityName: string) => void;
}

const BAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  const total = payload[0].payload._total;
  const pct = total > 0 ? ((entry.count / total) * 100).toFixed(1) : '0';
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100">{entry.name}</p>
      <p className="text-gray-600 dark:text-gray-400">
        {entry.count.toLocaleString()} cars ({pct}%)
      </p>
    </div>
  );
}

export default function Level2BarChart({ data, carType, onBarClick }: Level2BarChartProps) {
  if (!carType) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Commodity Breakdown
        </h3>
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
            Select a car type to see commodity breakdown
          </p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const chartData = data.map(d => ({ ...d, _total: total }));
  const chartHeight = Math.max(280, data.length * 36);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Commodity Breakdown
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{carType}</p>
      {data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          No commodity data available
        </div>
      ) : (
        <div style={{ height: `${chartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
              onClick={(state: any) => {
                if (state?.activePayload?.[0]) {
                  onBarClick(state.activePayload[0].payload.name);
                }
              }}
            >
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                className="cursor-pointer"
                barSize={20}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAR_COLORS[index % BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
