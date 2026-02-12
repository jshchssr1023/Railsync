import {
  Wrench, Package, CheckCircle, ClipboardList, Trash2, ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Operational Disposition (V2 — derived from v_car_fleet_status)
// ============================================================================

export const DISPOSITION_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  IN_SHOP: {
    label: 'In Shop',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Wrench,
  },
  IDLE: {
    label: 'Idle / Storage',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    icon: Package,
  },
  SCRAP_WORKFLOW: {
    label: 'Scrap Workflow',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: Trash2,
  },
};

// ============================================================================
// Legacy Status Group (backward compat during migration)
// ============================================================================

export const STATUS_GROUP_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  in_shop: { label: 'In Shop', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Wrench },
  idle_storage: { label: 'Idle / Storage', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: Package },
  ready_to_load: { label: 'Ready to Load', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: ClipboardList },
};

// ============================================================================
// Rider Car Lifecycle Status
// ============================================================================

export const RIDER_CAR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  decided: { label: 'Decided', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  prep_required: { label: 'Prep Required', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  on_rent: { label: 'On Rent', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  releasing: { label: 'Releasing', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  off_rent: { label: 'Off Rent', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};
