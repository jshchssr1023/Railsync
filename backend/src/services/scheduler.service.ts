import cron from 'node-cron';
import { query } from '../config/database';
import {
  createAlertIfNotExists,
  cleanupExpiredAlerts,
  AlertSeverity,
  AlertType,
} from './alerts.service';

// Configuration
const QUAL_DUE_THRESHOLDS = [
  { days: 30, type: 'qual_due_30' as AlertType, severity: 'critical' as AlertSeverity },
  { days: 60, type: 'qual_due_60' as AlertType, severity: 'warning' as AlertSeverity },
  { days: 90, type: 'qual_due_90' as AlertType, severity: 'info' as AlertSeverity },
];

const CAPACITY_THRESHOLDS = {
  warning: 85,
  critical: 95,
};

interface CarWithQualDue {
  car_number: string;
  qual_exp_date: Date;
  days_until_due: number;
  product_code?: string;
  owner_mark?: string;
}

interface ShopCapacityStatus {
  shop_code: string;
  shop_name: string;
  month: string;
  utilization_pct: number;
  allocated_count: number;
  total_capacity: number;
}

// Scan for cars with qualification due soon
async function scanQualificationDue(): Promise<void> {
  console.log('[Scheduler] Running qualification due scan...');

  try {
    for (const threshold of QUAL_DUE_THRESHOLDS) {
      const cars = await query<CarWithQualDue>(
        `SELECT
          car_number,
          qual_exp_date,
          EXTRACT(DAY FROM (qual_exp_date - CURRENT_DATE)) as days_until_due,
          product_code,
          owner_mark
        FROM cars
        WHERE qual_exp_date IS NOT NULL
          AND qual_exp_date BETWEEN CURRENT_DATE AND CURRENT_DATE + make_interval(days => $1)
          AND is_active = TRUE
        ORDER BY qual_exp_date`,
        [threshold.days]
      );

      console.log(`[Scheduler] Found ${cars.length} cars with qual due in ${threshold.days} days`);

      for (const car of cars) {
        await createAlertIfNotExists({
          alert_type: threshold.type,
          severity: threshold.severity,
          title: `Qualification Due: ${car.car_number}`,
          message: `Car ${car.car_number} has qualification expiring in ${Math.round(car.days_until_due)} days (${new Date(car.qual_exp_date).toLocaleDateString()}).`,
          entity_type: 'car',
          entity_id: car.car_number,
          target_role: 'operator',
          expires_at: new Date(car.qual_exp_date),
          metadata: {
            qual_exp_date: car.qual_exp_date,
            days_until_due: car.days_until_due,
            product_code: car.product_code,
            owner_mark: car.owner_mark,
          },
        });
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error in qualification due scan:', error);
  }
}

// Scan for shops approaching capacity limits
async function scanCapacityWarnings(): Promise<void> {
  console.log('[Scheduler] Running capacity warning scan...');

  try {
    // Get current and next 2 months
    const now = new Date();
    const months: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const capacities = await query<ShopCapacityStatus>(
      `SELECT
        smc.shop_code,
        s.shop_name,
        smc.month,
        smc.utilization_pct,
        smc.allocated_count,
        smc.total_capacity
      FROM shop_monthly_capacity smc
      JOIN shops s ON smc.shop_code = s.shop_code
      WHERE smc.month = ANY($1)
        AND smc.utilization_pct >= $2
        AND s.is_active = TRUE
      ORDER BY smc.utilization_pct DESC`,
      [months, CAPACITY_THRESHOLDS.warning]
    );

    console.log(`[Scheduler] Found ${capacities.length} shop-months at risk`);

    for (const capacity of capacities) {
      const isCritical = capacity.utilization_pct >= CAPACITY_THRESHOLDS.critical;
      const alertType: AlertType = isCritical ? 'capacity_critical' : 'capacity_warning';
      const severity: AlertSeverity = isCritical ? 'critical' : 'warning';

      await createAlertIfNotExists({
        alert_type: alertType,
        severity,
        title: `${isCritical ? 'Critical' : 'Warning'}: ${capacity.shop_name} capacity for ${capacity.month}`,
        message: `Shop ${capacity.shop_name} (${capacity.shop_code}) is at ${capacity.utilization_pct.toFixed(1)}% capacity for ${capacity.month} (${capacity.allocated_count}/${capacity.total_capacity} allocated).`,
        entity_type: 'shop',
        entity_id: `${capacity.shop_code}-${capacity.month}`,
        target_role: 'operator',
        metadata: {
          shop_code: capacity.shop_code,
          month: capacity.month,
          utilization_pct: capacity.utilization_pct,
          allocated_count: capacity.allocated_count,
          total_capacity: capacity.total_capacity,
        },
      });
    }
  } catch (error) {
    console.error('[Scheduler] Error in capacity warning scan:', error);
  }
}

// Cleanup expired alerts
async function runCleanup(): Promise<void> {
  console.log('[Scheduler] Running alert cleanup...');
  try {
    const deleted = await cleanupExpiredAlerts();
    if (deleted > 0) {
      console.log(`[Scheduler] Cleaned up ${deleted} expired alerts`);
    }
  } catch (error) {
    console.error('[Scheduler] Error in cleanup:', error);
  }
}

// Initialize scheduler
export function initScheduler(): void {
  console.log('[Scheduler] Initializing scheduled jobs...');

  // Daily at 6:00 AM - Qualification due scan
  cron.schedule('0 6 * * *', async () => {
    await scanQualificationDue();
  });

  // Every 4 hours - Capacity warning scan
  cron.schedule('0 */4 * * *', async () => {
    await scanCapacityWarnings();
  });

  // Daily at midnight - Cleanup expired alerts
  cron.schedule('0 0 * * *', async () => {
    await runCleanup();
  });

  console.log('[Scheduler] Scheduled jobs initialized:');
  console.log('  - Qualification due scan: daily at 6:00 AM');
  console.log('  - Capacity warning scan: every 4 hours');
  console.log('  - Alert cleanup: daily at midnight');
}

// Manual trigger functions (for testing/admin use)
export const manualTriggers = {
  scanQualificationDue,
  scanCapacityWarnings,
  runCleanup,
};
