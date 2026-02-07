'use client';

import { useState, useEffect } from 'react';
import { Loader2, Award, Clock, Target, DollarSign, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ShopScore {
  shop_code: string;
  shop_name: string;
  region: string;
  overall_score: number;
  cycle_time_score: number;
  otd_score: number;
  cost_efficiency_score: number;
  defect_rate_score: number;
  avg_dwell_days: number;
  otd_pct: number;
  avg_cost_per_car: number;
  defect_rate_pct: number;
  car_count: number;
  completed_count: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface ShopTrend {
  month: string;
  avg_dwell_days: number;
  completed_count: number;
  avg_cost: number;
  otd_pct: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
  if (trend === 'declining') return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-16 text-right">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-8 text-right ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

export default function ShopPerformancePage() {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<ShopScore[]>([]);
  const [expandedShop, setExpandedShop] = useState<string | null>(null);
  const [shopTrend, setShopTrend] = useState<ShopTrend[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [sortField, setSortField] = useState<'overall_score' | 'avg_dwell_days' | 'otd_pct' | 'avg_cost_per_car' | 'defect_rate_pct'>('overall_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('railsync_access_token') : null;

  const fetchWithAuth = (endpoint: string) =>
    fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());

  useEffect(() => {
    setLoading(true);
    fetchWithAuth('/analytics/shop-performance/scores?limit=50')
      .then(res => setShops(res.data || []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  function toggleShop(shopCode: string) {
    if (expandedShop === shopCode) {
      setExpandedShop(null);
      return;
    }
    setExpandedShop(shopCode);
    setTrendLoading(true);
    fetchWithAuth(`/analytics/shop-performance/${shopCode}/trend?months=6`)
      .then(res => setShopTrend(res.data || []))
      .catch(() => setShopTrend([]))
      .finally(() => setTrendLoading(false));
  }

  const sorted = [...shops].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    return sortDir === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
  });

  // Summary
  const avgScore = shops.length > 0 ? Math.round(shops.reduce((s, sh) => s + sh.overall_score, 0) / shops.length) : 0;
  const avgDwell = shops.length > 0 ? (shops.reduce((s, sh) => s + sh.avg_dwell_days, 0) / shops.length).toFixed(1) : '0';
  const avgOTD = shops.length > 0 ? Math.round(shops.reduce((s, sh) => s + sh.otd_pct, 0) / shops.length) : 0;
  const totalCompleted = shops.reduce((s, sh) => s + sh.completed_count, 0);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shop Performance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Scorecards, cycle time, OTD, and cost efficiency (180-day window)</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1"><Award className="w-4 h-4" /> Fleet Avg Score</div>
          <div className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore}/100</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1"><Clock className="w-4 h-4" /> Avg Dwell</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{avgDwell} days</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1"><Target className="w-4 h-4" /> Avg OTD</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{avgOTD}%</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1"><DollarSign className="w-4 h-4" /> Completed (180d)</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCompleted}</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-8" />
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Shop</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Region</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('overall_score')}>
                  Score {sortField === 'overall_score' && (sortDir === 'desc' ? '\u25BC' : '\u25B2')}
                </th>
                <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('avg_dwell_days')}>
                  Dwell {sortField === 'avg_dwell_days' && (sortDir === 'desc' ? '\u25BC' : '\u25B2')}
                </th>
                <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('otd_pct')}>
                  OTD % {sortField === 'otd_pct' && (sortDir === 'desc' ? '\u25BC' : '\u25B2')}
                </th>
                <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('avg_cost_per_car')}>
                  Avg Cost {sortField === 'avg_cost_per_car' && (sortDir === 'desc' ? '\u25BC' : '\u25B2')}
                </th>
                <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('defect_rate_pct')}>
                  Defects {sortField === 'defect_rate_pct' && (sortDir === 'desc' ? '\u25BC' : '\u25B2')}
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Cars</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map(shop => (
                <>
                  <tr
                    key={shop.shop_code}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => toggleShop(shop.shop_code)}
                  >
                    <td className="px-4 py-2">
                      {expandedShop === shop.shop_code ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{shop.shop_name}</div>
                      <div className="text-xs text-gray-400">{shop.shop_code}</div>
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-500">{shop.region}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${scoreBg(shop.overall_score)} ${scoreColor(shop.overall_score)}`}>
                        {shop.overall_score}
                      </span>
                    </td>
                    <td className="text-right px-2 py-2 text-gray-700 dark:text-gray-300">{shop.avg_dwell_days}d</td>
                    <td className="text-right px-2 py-2 text-gray-700 dark:text-gray-300">{shop.otd_pct}%</td>
                    <td className="text-right px-2 py-2 text-gray-700 dark:text-gray-300">${shop.avg_cost_per_car.toLocaleString()}</td>
                    <td className="text-right px-2 py-2 text-gray-700 dark:text-gray-300">{shop.defect_rate_pct}%</td>
                    <td className="text-right px-4 py-2 text-gray-700 dark:text-gray-300">{shop.car_count}</td>
                    <td className="px-2 py-2 text-center"><TrendIcon trend={shop.trend} /></td>
                  </tr>
                  {expandedShop === shop.shop_code && (
                    <tr key={`${shop.shop_code}-detail`}>
                      <td colSpan={10} className="bg-gray-50 dark:bg-gray-800/30 px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Score Breakdown */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Score Breakdown</h4>
                            <div className="space-y-1.5">
                              <ScoreBar score={shop.cycle_time_score} label="Cycle Time" />
                              <ScoreBar score={shop.otd_score} label="OTD" />
                              <ScoreBar score={shop.cost_efficiency_score} label="Cost Eff." />
                              <ScoreBar score={shop.defect_rate_score} label="Quality" />
                            </div>
                          </div>
                          {/* Monthly Trend */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Monthly Trend</h4>
                            {trendLoading ? (
                              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                            ) : shopTrend.length > 0 ? (
                              <div className="space-y-1">
                                {shopTrend.map(t => (
                                  <div key={t.month} className="grid grid-cols-[70px_1fr_1fr_1fr_1fr] gap-1 text-[10px] items-center">
                                    <span className="text-gray-400">{t.month}</span>
                                    <span className="text-gray-600 dark:text-gray-400">{t.avg_dwell_days}d dwell</span>
                                    <span className="text-gray-600 dark:text-gray-400">{t.completed_count} done</span>
                                    <span className="text-gray-600 dark:text-gray-400">${t.avg_cost.toLocaleString()}</span>
                                    <span className="text-gray-600 dark:text-gray-400">{t.otd_pct}% OTD</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">No trend data</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {shops.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No shop performance data available</p>
          )}
        </div>
      )}
    </div>
  );
}
