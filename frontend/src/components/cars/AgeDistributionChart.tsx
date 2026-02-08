'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface AgeDistributionChartProps {
  data: { bucket: string; count: number }[];
}

const BUCKET_COLORS: Record<string, string> = {
  '0-5': '#10b981',    // green
  '6-10': '#3b82f6',   // blue
  '11-20': '#f59e0b',  // amber
  '20+': '#ef4444',    // red
  'Unknown': '#9ca3af', // gray
};

function getBarColor(bucket: string): string {
  return BUCKET_COLORS[bucket] || '#9ca3af';
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100">{entry.bucket} years</p>
      <p className="text-gray-600 dark:text-gray-400">
        {entry.count.toLocaleString()} cars
      </p>
    </div>
  );
}

export default function AgeDistributionChart({ data }: AgeDistributionChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Fleet Age Distribution
      </h3>
      {data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          No age data available
        </div>
      ) : (
        <>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: string) => value === 'Unknown' ? '?' : `${value}y`}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.bucket)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 justify-center">
            {Object.entries(BUCKET_COLORS).map(([bucket, color]) => (
              <div key={bucket} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  {bucket === 'Unknown' ? 'Unknown' : `${bucket} yrs`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
