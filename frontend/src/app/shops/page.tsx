'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
  Wrench, Warehouse, Trash2, ChevronDown, ChevronRight, ChevronUp,
  Search, Filter, X, MapPin, DollarSign, Activity, Building2,
  Shield, Clock, Factory, Users, Gauge, ExternalLink, Truck,
  Award, AlertCircle, CheckCircle, Loader2
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ShopItem {
  shop_code: string;
  shop_name: string;
  region: string;
  tier: number;
  capacity: number;
  cars_in_shop: number;
  cars_enroute: number;
  labor_rate: number;
  material_markup: number;
  is_preferred_network: boolean;
  load_pct: number;
  load_status: 'green' | 'yellow' | 'red';
  latitude: number | null;
  longitude: number | null;
}

interface NetworkGroup {
  network: string;
  tier: number;
  shops: ShopItem[];
}

interface DesignationMetrics {
  total_shops: number;
  total_capacity: number;
  cars_in_shop: number;
  cars_enroute: number;
  preferred_count: number;
  non_preferred_count: number;
  avg_labor_rate: number;
  avg_material_markup: number;
}

interface DesignationGroup {
  designation: string;
  networks: NetworkGroup[];
  metrics: DesignationMetrics;
}

interface ShopDetail {
  shop: {
    shop_code: string;
    shop_name: string;
    primary_railroad: string;
    region: string;
    city: string;
    state: string;
    tier: number;
    shop_designation: string;
    capacity: number;
    labor_rate: number;
    material_markup: number;
    is_preferred_network: boolean;
    latitude: number | null;
    longitude: number | null;
  };
  backlog: {
    hours_backlog: string;
    cars_backlog: number;
    cars_en_route_0_6: number;
    cars_en_route_7_14: number;
    cars_en_route_15_plus: number;
  } | null;
  capacity: {
    work_type: string;
    weekly_hours_capacity: string;
    current_utilization_pct: string;
    available_hours: string;
  }[];
  capabilities: Record<string, string[]>;
  active_events: number;
  in_progress: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

const DESIGNATION_CONFIG: Record<string, {
  label: string;
  icon: typeof Wrench;
  color: string;
  bgColor: string;
  borderColor: string;
  headerBg: string;
}> = {
  repair: {
    label: 'Repair Shops',
    icon: Wrench,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    headerBg: 'bg-blue-600 dark:bg-blue-700',
  },
  storage: {
    label: 'Storage Facilities',
    icon: Warehouse,
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    headerBg: 'bg-amber-600 dark:bg-amber-700',
  },
  scrap: {
    label: 'Scrap Yards',
    icon: Trash2,
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    headerBg: 'bg-red-600 dark:bg-red-700',
  },
};

function getTierColor(tier: number) {
  switch (tier) {
    case 1: return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-l-green-500' };
    case 2: return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', border: 'border-l-blue-500' };
    default: return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-l-red-500' };
  }
}

function LoadIndicator({ status, pct }: { status: string; pct: number }) {
  const colors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };
  return (
    <div className="flex items-center gap-1.5" title={`${pct}% load`}>
      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colors[status as keyof typeof colors] || 'bg-gray-400'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400 w-7">{pct}%</span>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

// ---------------------------------------------------------------------------
// Metric Banner Component
// ---------------------------------------------------------------------------
function MetricBanner({ designation, metrics }: { designation: string; metrics: DesignationMetrics }) {
  const isRepair = designation === 'repair';
  const isStorage = designation === 'storage';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
      <div className="text-center">
        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {metrics.cars_in_shop}
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400"> / {metrics.cars_enroute} enroute</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {isStorage ? 'Cars in Storage' : designation === 'scrap' ? 'Cars at Scrap' : 'Cars in Shop'}
        </div>
      </div>

      {isRepair ? (
        <>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(metrics.avg_labor_rate)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Avg Labor Rate</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.avg_material_markup}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Avg Material Markup</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              <span className="text-green-600 dark:text-green-400">{metrics.preferred_count}</span>
              <span className="text-gray-400 mx-1">/</span>
              <span className="text-gray-600 dark:text-gray-400">{metrics.non_preferred_count}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Preferred / Non-Preferred</div>
          </div>
        </>
      ) : isStorage ? (
        <>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.total_capacity}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Capacity</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(metrics.avg_labor_rate)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Avg Storage Cost/Day</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.total_capacity - metrics.cars_in_shop}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Available Capacity</div>
          </div>
        </>
      ) : (
        <>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.total_shops}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active Yards</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.total_capacity}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Capacity</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.total_capacity - metrics.cars_in_shop}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Available Slots</div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shop Drawer Component
// ---------------------------------------------------------------------------
function ShopDrawer({ shopCode, onClose }: { shopCode: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'cost', 'capabilities', 'backlog'])
  );

  useEffect(() => {
    setLoading(true);
    apiFetch<{ data: ShopDetail }>(`/shops/browse/detail/${shopCode}`)
      .then(res => setDetail(res.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [shopCode]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const toggleSection = (s: string) =>
    setExpandedSections(prev => { const next = new Set(prev); next.has(s) ? next.delete(s) : next.add(s); return next; });

  const shop = detail?.shop;
  const tierColor = shop ? getTierColor(shop.tier) : getTierColor(1);
  const desigConfig = DESIGNATION_CONFIG[shop?.shop_designation || 'repair'];

  const Section = ({ id, title, icon: Icon, children }: { id: string; title: string; icon: typeof Wrench; children: React.ReactNode }) => (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button onClick={() => toggleSection(id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          <Icon className="w-4 h-4 text-gray-400" />{title}
        </div>
        {expandedSections.has(id) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {expandedSections.has(id) && <div className="px-4 pb-3">{children}</div>}
    </div>
  );

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between py-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right">{value ?? '-'}</span>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[480px] max-w-full bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{shop?.shop_name || shopCode}</h2>
              {shop && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{shop.shop_code}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${tierColor.bg} ${tierColor.text}`}>Tier {shop.tier}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${desigConfig.bgColor} ${desigConfig.color}`}>
                    {desigConfig.label.replace(' Shops', '').replace(' Facilities', '').replace(' Yards', '')}
                  </span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Quick Stats */}
          {shop && (
            <div className="grid grid-cols-4 gap-0 border-t border-gray-200 dark:border-gray-700">
              <div className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{shop.capacity}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Capacity</div>
              </div>
              <div className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{detail?.backlog?.cars_backlog ?? 0}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Cars In</div>
              </div>
              <div className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{detail?.active_events ?? 0}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Active Events</div>
              </div>
              <div className="px-3 py-2 text-center">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{shop.region}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Region</div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : !shop ? (
            <div className="p-4 text-center text-gray-500">Shop not found</div>
          ) : (
            <>
              <Section id="overview" title="Shop Overview" icon={Building2}>
                <Field label="Name" value={shop.shop_name} />
                <Field label="Network" value={shop.primary_railroad} />
                <Field label="Tier" value={`Tier ${shop.tier}`} />
                <Field label="Type" value={shop.shop_designation?.charAt(0).toUpperCase() + shop.shop_designation?.slice(1)} />
                <Field label="Region" value={shop.region} />
                <Field label="City" value={shop.city} />
                <Field label="State" value={shop.state} />
                <Field label="Preferred Network" value={shop.is_preferred_network ? 'Yes' : 'No'} />
                {shop.latitude && <Field label="Coordinates" value={`${shop.latitude.toFixed(4)}, ${shop.longitude?.toFixed(4)}`} />}
              </Section>

              <Section id="cost" title="Cost Principles" icon={DollarSign}>
                <Field label="Labor Rate" value={formatCurrency(shop.labor_rate)} />
                <Field label="Material Markup" value={`${shop.material_markup}%`} />
                <Field label="Preferred Network" value={shop.is_preferred_network ? 'Contracted rates' : 'Standard rates'} />
              </Section>

              <Section id="backlog" title="Current Load & Backlog" icon={Activity}>
                {detail?.backlog ? (
                  <>
                    <Field label="Hours Backlog" value={parseFloat(detail.backlog.hours_backlog || '0').toFixed(0)} />
                    <Field label="Cars Backlog" value={detail.backlog.cars_backlog} />
                    <Field label="En Route 0-6 Days" value={detail.backlog.cars_en_route_0_6} />
                    <Field label="En Route 7-14 Days" value={detail.backlog.cars_en_route_7_14} />
                    <Field label="En Route 15+ Days" value={detail.backlog.cars_en_route_15_plus} />
                    <Field label="Active Shopping Events" value={detail.active_events} />
                    <Field label="In Progress" value={detail.in_progress} />
                  </>
                ) : (
                  <div className="text-xs text-gray-500 dark:text-gray-400 py-2">No backlog data available</div>
                )}
              </Section>

              {detail?.capacity && detail.capacity.length > 0 && (
                <Section id="capacity" title="Capacity by Work Type" icon={Gauge}>
                  <div className="space-y-2">
                    {detail.capacity.map(cap => {
                      const utilPct = parseFloat(cap.current_utilization_pct) || 0;
                      return (
                        <div key={cap.work_type}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-700 dark:text-gray-300 capitalize">{cap.work_type.replace(/_/g, ' ')}</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{parseFloat(cap.weekly_hours_capacity).toFixed(0)}h/wk</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${utilPct > 90 ? 'bg-red-500' : utilPct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(utilPct, 100)}%` }} />
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">{utilPct}% utilized</div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {detail?.capabilities && Object.keys(detail.capabilities).length > 0 && (
                <Section id="capabilities" title="Capabilities" icon={Shield}>
                  <div className="space-y-3">
                    {Object.entries(detail.capabilities).map(([type, values]) => (
                      <div key={type}>
                        <h4 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{type.replace(/_/g, ' ')}</h4>
                        <div className="flex flex-wrap gap-1">
                          {values.map(v => (
                            <span key={v} className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">{v}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {shop && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex gap-2 bg-gray-50 dark:bg-gray-800">
            <a href={`/planning?shop=${shop.shop_code}`} className="flex-1 text-center text-xs px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">Open in Quick Shop</a>
            <a href={`/pipeline?shop=${shop.shop_code}`} className="flex-1 text-center text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Pipeline View</a>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Designation Card Component
// ---------------------------------------------------------------------------
function DesignationCard({
  group,
  expandedNetworks,
  onToggleNetwork,
  onSelectShop,
  selectedShopCode,
  searchTerm,
  tierFilter,
  regionFilter,
  preferredOnly,
}: {
  group: DesignationGroup;
  expandedNetworks: Set<string>;
  onToggleNetwork: (key: string) => void;
  onSelectShop: (code: string) => void;
  selectedShopCode: string | null;
  searchTerm: string;
  tierFilter: string;
  regionFilter: string;
  preferredOnly: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const config = DESIGNATION_CONFIG[group.designation] || DESIGNATION_CONFIG.repair;
  const Icon = config.icon;

  // Filter shops
  const filteredNetworks = group.networks.map(net => {
    const filteredShops = net.shops.filter(shop => {
      if (searchTerm && !shop.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) && !shop.shop_code.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (tierFilter && shop.tier !== parseInt(tierFilter)) return false;
      if (regionFilter && shop.region !== regionFilter) return false;
      if (preferredOnly && !shop.is_preferred_network) return false;
      return true;
    });
    return { ...net, shops: filteredShops };
  }).filter(net => net.shops.length > 0);

  const totalVisible = filteredNetworks.reduce((sum, n) => sum + n.shops.length, 0);
  if (totalVisible === 0 && (searchTerm || tierFilter || regionFilter || preferredOnly)) return null;

  return (
    <div className={`rounded-xl border ${config.borderColor} overflow-hidden bg-white dark:bg-gray-900 shadow-sm`}>
      {/* Card Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between px-4 py-3 ${config.headerBg} text-white`}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" />
          <div className="text-left">
            <span className="font-semibold text-sm">{config.label}</span>
            <span className="text-xs opacity-80 ml-2">{totalVisible} {totalVisible === 1 ? 'shop' : 'shops'}</span>
          </div>
        </div>
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {!collapsed && (
        <>
          {/* Metrics Banner */}
          <MetricBanner designation={group.designation} metrics={group.metrics} />

          {/* Network Hierarchy */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredNetworks.map(net => {
              const key = `${group.designation}-${net.network}`;
              const isExpanded = expandedNetworks.has(key);
              const netTierColor = getTierColor(net.tier);

              return (
                <div key={key}>
                  {/* Network Header */}
                  <button
                    onClick={() => onToggleNetwork(key)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    <span className={`w-2 h-2 rounded-full ${netTierColor.bg.replace('bg-', 'bg-').replace('/30', '')}`}
                      style={{ backgroundColor: net.tier === 1 ? '#22c55e' : net.tier === 2 ? '#3b82f6' : '#ef4444' }} />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{net.network}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${netTierColor.bg} ${netTierColor.text}`}>Tier {net.tier}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{net.shops.length} {net.shops.length === 1 ? 'location' : 'locations'}</span>
                  </button>

                  {/* Shop Rows */}
                  {isExpanded && (
                    <div className="bg-gray-50/50 dark:bg-gray-800/30">
                      {net.shops.map(shop => {
                        const tc = getTierColor(shop.tier);
                        return (
                          <button
                            key={shop.shop_code}
                            onClick={() => onSelectShop(shop.shop_code)}
                            className={`w-full flex items-center gap-3 px-4 pl-10 py-2 text-left border-l-3 ${tc.border} hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${
                              selectedShopCode === shop.shop_code ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{shop.shop_name}</span>
                                {shop.is_preferred_network && (
                                  <span title="Preferred Network">
                                    <Award className="w-3 h-3 text-green-500 flex-shrink-0" />
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-mono">{shop.shop_code}</span>
                                <span>&middot;</span>
                                <span>{shop.region}</span>
                              </div>
                            </div>

                            <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                              <div className="text-right">
                                <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{shop.cars_in_shop}/{shop.capacity}</div>
                                <div className="text-[10px] text-gray-500">load</div>
                              </div>
                              <LoadIndicator status={shop.load_status} pct={shop.load_pct} />
                              {group.designation === 'repair' && (
                                <div className="text-right w-16">
                                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100">${shop.labor_rate}</div>
                                  <div className="text-[10px] text-gray-500">rate</div>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ShopsPage() {
  const [hierarchy, setHierarchy] = useState<DesignationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set());
  const [selectedShopCode, setSelectedShopCode] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Collect all regions for filter dropdown
  const allRegions = Array.from(new Set(hierarchy.flatMap(g => g.networks.flatMap(n => n.shops.map(s => s.region))))).sort();

  // Fetch hierarchy on mount
  useEffect(() => {
    apiFetch<{ data: DesignationGroup[] }>('/shops/browse/hierarchy')
      .then(res => {
        setHierarchy(res.data || []);
        // Auto-expand first network of each group
        const autoExpand = new Set<string>();
        for (const g of (res.data || [])) {
          if (g.networks.length > 0) {
            autoExpand.add(`${g.designation}-${g.networks[0].network}`);
          }
        }
        setExpandedNetworks(autoExpand);
      })
      .catch(() => setHierarchy([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleNetwork = useCallback((key: string) => {
    setExpandedNetworks(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const activeFilterCount = [tierFilter, regionFilter, searchTerm].filter(Boolean).length + (preferredOnly ? 1 : 0);

  const clearFilters = () => {
    setSearchTerm('');
    setTierFilter('');
    setRegionFilter('');
    setPreferredOnly(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shop Directory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Browse repair shops, storage facilities, and scrap yards by network and tier
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search shop name or code..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold bg-primary-500 text-white rounded-full">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tier</label>
            <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <option value="">All Tiers</option>
              <option value="1">Tier 1 (Green)</option>
              <option value="2">Tier 2 (Blue)</option>
              <option value="3">Tier 3 (Red)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Region</label>
            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <option value="">All Regions</option>
              {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-1">
              <input type="checkbox" checked={preferredOnly} onChange={e => setPreferredOnly(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Preferred Only
            </label>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {hierarchy.map(group => (
            <DesignationCard
              key={group.designation}
              group={group}
              expandedNetworks={expandedNetworks}
              onToggleNetwork={toggleNetwork}
              onSelectShop={setSelectedShopCode}
              selectedShopCode={selectedShopCode}
              searchTerm={searchTerm}
              tierFilter={tierFilter}
              regionFilter={regionFilter}
              preferredOnly={preferredOnly}
            />
          ))}
        </div>
      )}

      {/* Side Drawer */}
      {selectedShopCode && (
        <ShopDrawer shopCode={selectedShopCode} onClose={() => setSelectedShopCode(null)} />
      )}
    </div>
  );
}
