import {
  LayoutDashboard, ShoppingCart, Truck, FileText, Train,
  Settings, ChevronRight, ChevronDown,
  User, AlertTriangle, BarChart3, BookOpen, Shield, ClipboardList,
  Factory, Calendar, Network, Zap, Package, Clock, AlertCircle,
  History, Building2, ScrollText, Layers, DollarSign, Wifi,
  TrendingUp, Award, Database, GitCompare, Rocket, MessageSquare,
  MapPin, Bell, Tag, Wrench, Trash2, ListFilter,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  adminOnly?: boolean;
}

export interface NavCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: NavItem[];
  adminOnly?: boolean;
}

export interface NavPillar {
  id: string;
  label: string;
  icon: React.ReactNode;
  categories: NavCategory[];
}

export interface NavStandalone {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

export interface NavContext {
  pillarLabel: string;
  pillarId: string;
  categoryLabel: string;
  categoryId: string;
  itemLabel: string;
}

// ---------------------------------------------------------------------------
// Dashboard (standalone, above pillars)
// ---------------------------------------------------------------------------
export const NAV_STANDALONE: NavStandalone = {
  id: 'dashboard',
  label: 'Dashboard',
  href: '/dashboard',
  icon: <LayoutDashboard className="w-5 h-5" />,
};

// ---------------------------------------------------------------------------
// 4-Pillar Navigation Config
// ---------------------------------------------------------------------------
export const NAV_PILLARS: NavPillar[] = [
  {
    id: 'assets',
    label: 'ASSETS',
    icon: <Train className="w-5 h-5" />,
    categories: [
      {
        id: 'fleet',
        label: 'Fleet',
        icon: <Train className="w-4 h-4" />,
        children: [
          { label: 'Fleet Overview', href: '/cars', icon: <Train className="w-4 h-4" /> },
          { label: 'Components', href: '/components-registry', icon: <Settings className="w-4 h-4" /> },
          { label: 'Fleet Location', href: '/fleet-location', icon: <MapPin className="w-4 h-4" /> },
          { label: 'Assignments', href: '/assignments', icon: <ClipboardList className="w-4 h-4" /> },
          { label: 'In Shop', href: '/cars?status=Arrived', icon: <Wrench className="w-4 h-4" /> },
          { label: 'Enroute', href: '/cars?status=Enroute', icon: <Truck className="w-4 h-4" /> },
          { label: 'Overdue', href: '/cars?status=Overdue', icon: <AlertCircle className="w-4 h-4" /> },
          { label: 'Service Due', href: '/cars?status=To+Be+Routed', icon: <Clock className="w-4 h-4" /> },
          { label: 'Pending Triage', href: '/triage', icon: <ListFilter className="w-4 h-4" /> },
          { label: 'Scrap Review', href: '/scrap-review', icon: <Trash2 className="w-4 h-4" /> },
        ],
      },
      {
        id: 'contracts',
        label: 'Contracts',
        icon: <FileText className="w-4 h-4" />,
        children: [
          { label: 'Customers', href: '/customers', icon: <User className="w-4 h-4" /> },
          { label: 'Contracts', href: '/contracts', icon: <Building2 className="w-4 h-4" /> },
          { label: 'Riders', href: '/riders', icon: <ScrollText className="w-4 h-4" /> },
          { label: 'Transfers', href: '/transfers', icon: <Network className="w-4 h-4" /> },
          { label: 'Care Manuals', href: '/ccm', icon: <ScrollText className="w-4 h-4" /> },
        ],
      },
      {
        id: 'car-health',
        label: 'Car Health',
        icon: <Shield className="w-4 h-4" />,
        children: [
          { label: 'Car Qualifications', href: '/qualifications', icon: <Shield className="w-4 h-4" /> },
        ],
      },
      {
        id: 'shopping',
        label: 'Shopping',
        icon: <ShoppingCart className="w-4 h-4" />,
        children: [
          { label: 'Shopping Events', href: '/shopping', icon: <ClipboardList className="w-4 h-4" /> },
          { label: 'Quick Shop', href: '/planning', icon: <Zap className="w-4 h-4" /> },
          { label: 'Bad Orders', href: '/bad-orders', icon: <AlertTriangle className="w-4 h-4" /> },
          { label: 'Service Events', href: '/service-events', icon: <Calendar className="w-4 h-4" /> },
          { label: 'Releases', href: '/releases', icon: <Package className="w-4 h-4" /> },
        ],
      },
    ],
  },
  {
    id: 'network',
    label: 'NETWORK',
    icon: <Network className="w-5 h-5" />,
    categories: [
      {
        id: 'shops',
        label: 'Shops',
        icon: <Factory className="w-4 h-4" />,
        children: [
          { label: 'Shop Finder', href: '/shops', icon: <Factory className="w-4 h-4" /> },
          { label: 'Shop Performance', href: '/shop-performance', icon: <Award className="w-4 h-4" /> },
        ],
      },
      {
        id: 'pipelines',
        label: 'Pipelines',
        icon: <Truck className="w-4 h-4" />,
        children: [
          { label: 'Pipeline', href: '/pipeline', icon: <Truck className="w-4 h-4" /> },
          { label: 'Monthly Load', href: '/planning?tab=monthly-load', icon: <Calendar className="w-4 h-4" /> },
          { label: 'Network View', href: '/planning?tab=network-view', icon: <Network className="w-4 h-4" /> },
          { label: 'Master Plans', href: '/plans', icon: <ScrollText className="w-4 h-4" /> },
        ],
      },
    ],
  },
  {
    id: 'operations',
    label: 'OPERATIONS',
    icon: <BarChart3 className="w-5 h-5" />,
    categories: [
      {
        id: 'reporting',
        label: 'Reporting',
        icon: <BarChart3 className="w-4 h-4" />,
        children: [
          { label: 'Reports', href: '/reports', icon: <ClipboardList className="w-4 h-4" /> },
          { label: 'Analytics', href: '/analytics', icon: <Layers className="w-4 h-4" /> },
          { label: 'Cost Analytics', href: '/cost-analytics', icon: <TrendingUp className="w-4 h-4" /> },
          { label: 'Budget & Forecasts', href: '/budget', icon: <BarChart3 className="w-4 h-4" /> },
        ],
      },
      {
        id: 'billing',
        label: 'Billing',
        icon: <DollarSign className="w-4 h-4" />,
        children: [
          { label: 'Billing Overview', href: '/billing', icon: <DollarSign className="w-4 h-4" /> },
          { label: 'Invoices', href: '/invoices', icon: <FileText className="w-4 h-4" /> },
          { label: 'Case Queue', href: '/invoice-cases', icon: <ClipboardList className="w-4 h-4" /> },
          { label: 'Estimates', href: '/estimates', icon: <DollarSign className="w-4 h-4" /> },
          { label: 'Billable Items', href: '/billable-items', icon: <ClipboardList className="w-4 h-4" /> },
          { label: 'Freight Calculator', href: '/freight', icon: <Truck className="w-4 h-4" /> },
        ],
      },
      {
        id: 'data-management',
        label: 'Data Management',
        icon: <Database className="w-4 h-4" />,
        children: [
          { label: 'Data Migration', href: '/migration', icon: <Database className="w-4 h-4" /> },
          { label: 'Data Validation', href: '/admin/data-validation', icon: <Shield className="w-4 h-4" />, adminOnly: true },
          { label: 'Data Reconciliation', href: '/admin/data-reconciliation', icon: <GitCompare className="w-4 h-4" />, adminOnly: true },
          { label: 'Audit Logs', href: '/audit', icon: <History className="w-4 h-4" /> },
        ],
      },
      {
        id: 'admin-settings',
        label: 'Admin / Settings',
        icon: <Settings className="w-4 h-4" />,
        adminOnly: true,
        children: [
          { label: 'User Management', href: '/admin/users', icon: <User className="w-4 h-4" /> },
          { label: 'Settings', href: '/settings', icon: <Settings className="w-4 h-4" /> },
          { label: 'Integrations', href: '/integrations', icon: <Wifi className="w-4 h-4" /> },
          { label: 'Notifications', href: '/notifications', icon: <Bell className="w-4 h-4" /> },
          { label: 'Rules', href: '/rules', icon: <Shield className="w-4 h-4" /> },
          { label: 'Monitoring', href: '/admin/monitoring', icon: <BarChart3 className="w-4 h-4" /> },
          { label: 'Shopping Types', href: '/admin/shopping-types', icon: <Tag className="w-4 h-4" /> },
          { label: 'Shopping Reasons', href: '/admin/shopping-reasons', icon: <Tag className="w-4 h-4" /> },
          { label: 'Service Plans', href: '/admin/service-plans', icon: <FileText className="w-4 h-4" /> },
          { label: 'Commodity Cleaning', href: '/admin/commodity-cleaning', icon: <Layers className="w-4 h-4" /> },
          { label: 'Storage Commodities', href: '/admin/storage-commodities', icon: <Package className="w-4 h-4" /> },
          { label: 'Work Hours', href: '/admin/work-hours', icon: <Clock className="w-4 h-4" /> },
          { label: 'Alerts', href: '/admin/alerts', icon: <AlertCircle className="w-4 h-4" /> },
          { label: 'Shop Designations', href: '/admin/shop-designations', icon: <Factory className="w-4 h-4" /> },
          { label: 'Parallel Run', href: '/parallel-run', icon: <GitCompare className="w-4 h-4" /> },
          { label: 'Go-Live', href: '/go-live', icon: <Rocket className="w-4 h-4" /> },
          { label: 'Feedback', href: '/feedback', icon: <MessageSquare className="w-4 h-4" /> },
        ],
      },
    ],
  },
  {
    id: 'documentation',
    label: 'DOCUMENTATION',
    icon: <BookOpen className="w-5 h-5" />,
    categories: [
      {
        id: 'doc-library',
        label: 'Library',
        icon: <BookOpen className="w-4 h-4" />,
        children: [
          { label: 'Projects', href: '/projects', icon: <Package className="w-4 h-4" /> },
          { label: 'Work Packages', href: '/work-packages', icon: <ClipboardList className="w-4 h-4" /> },
          { label: 'SOW Library', href: '/scope-library', icon: <BookOpen className="w-4 h-4" /> },
          { label: 'Commodities', href: '/commodities', icon: <Layers className="w-4 h-4" /> },
          { label: 'Training', href: '/training', icon: <BookOpen className="w-4 h-4" /> },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Route Labels (single source of truth — merged from Breadcrumbs + GlobalCommandBar)
// ---------------------------------------------------------------------------
export const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  shopping: 'Shopping Events',
  shops: 'Shop Finder',
  cars: 'Fleet Overview',
  planning: 'Quick Shop',
  pipeline: 'Pipeline',
  plans: 'Master Plans',
  contracts: 'Contracts',
  projects: 'Projects',
  invoices: 'Invoices',
  'invoice-cases': 'Case Queue',
  budget: 'Budget & Forecasts',
  analytics: 'Analytics',
  'cost-analytics': 'Cost Analytics',
  'shop-performance': 'Shop Performance',
  migration: 'Data Migration',
  'parallel-run': 'Parallel Run',
  'go-live': 'Go-Live Command Center',
  feedback: 'Feedback',
  reports: 'Report Builder',
  audit: 'Audit Log',
  admin: 'Admin',
  settings: 'Settings',
  rules: 'Rules',
  ccm: 'Care Manuals',
  'scope-library': 'SOW Library',
  'bad-orders': 'Bad Orders',
  qualifications: 'Qualifications',
  billing: 'Billing',
  integrations: 'Integrations',
  'fleet-location': 'Fleet Location',
  monitoring: 'System Monitoring',
  'commodity-cleaning': 'Commodity Cleaning',
  'data-validation': 'Data Validation',
  'data-reconciliation': 'Data Reconciliation',
  releases: 'Release Management',
  transfers: 'Contract Transfers',
  training: 'Training Center',
  'sap-validation': 'SAP Validation',
  'components-registry': 'Components',
  riders: 'Contract Riders',
  'service-events': 'Service Events',
  estimates: 'Estimate Review',
  commodities: 'Commodities',
  'billable-items': 'Billable Items',
  notifications: 'Notifications',
  'shop-designations': 'Shop Designations',
  users: 'User Management',
  'shopping-types': 'Shopping Types',
  'shopping-reasons': 'Shopping Reasons',
  'service-plans': 'Service Plans',
  'storage-commodities': 'Storage Commodities',
  'work-hours': 'Work Hours',
  alerts: 'Alerts',
  customers: 'Customers',
  freight: 'Freight Calculator',
  new: 'New Shopping Request',
  assignments: 'Assignments',
  'work-packages': 'Work Packages',
  triage: 'Pending Triage',
  'scrap-review': 'Scrap Review',
};

// ---------------------------------------------------------------------------
// Navigation Context Map (reverse lookup: href -> pillar/category/item)
// ---------------------------------------------------------------------------
function buildNavContextMap(pillars: NavPillar[]): Map<string, NavContext> {
  const map = new Map<string, NavContext>();
  for (const pillar of pillars) {
    for (const cat of pillar.categories) {
      if (cat.href) {
        map.set(cat.href.split('?')[0], {
          pillarLabel: pillar.label,
          pillarId: pillar.id,
          categoryLabel: cat.label,
          categoryId: cat.id,
          itemLabel: cat.label,
        });
      }
      for (const item of cat.children ?? []) {
        map.set(item.href.split('?')[0], {
          pillarLabel: pillar.label,
          pillarId: pillar.id,
          categoryLabel: cat.label,
          categoryId: cat.id,
          itemLabel: item.label,
        });
      }
    }
  }
  return map;
}

export const NAV_CONTEXT_MAP = buildNavContextMap(NAV_PILLARS);

// ---------------------------------------------------------------------------
// Shop Portal Navigation (simplified nav for shop-role users)
// ---------------------------------------------------------------------------
export const NAV_SHOP: NavStandalone[] = [
  {
    id: 'shop-packages',
    label: 'My Work Packages',
    href: '/work-packages/shop',
    icon: <Package className="w-5 h-5" />,
  },
];

// Re-export icons used by Sidebar rendering
export {
  LayoutDashboard, ShoppingCart, Truck, FileText, Train,
  Settings, ChevronRight, ChevronDown,
  User, AlertTriangle, BarChart3, BookOpen, Shield, ClipboardList,
  Factory, Calendar, Network, Zap, Package, Clock, AlertCircle,
  History, Building2, ScrollText, Layers, DollarSign, Wifi,
  TrendingUp, Award, Database, GitCompare, Rocket, MessageSquare,
  MapPin, Bell, Tag, Wrench, Trash2, ListFilter,
} from 'lucide-react';
