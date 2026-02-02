import { query, queryOne } from '../config/database';

// ============================================================================
// SHOP IMPORT SERVICE
// Handles CSV/Excel data imports for shop attributes and capacity
// ============================================================================

interface ShopAttributeRow {
  shop_code: string;
  shop_name: string;
  primary_railroad: string;
  region: string;
  city?: string;
  state?: string;
  labor_rate: number;
  material_multiplier: number;
  latitude?: number;
  longitude?: number;
  contact_email?: string;
  contact_phone?: string;
}

interface ShopCapabilityRow {
  shop_code: string;
  capability_type: string;
  capability_value: string;
  certified_date?: string;
  expiration_date?: string;
}

interface MonthlyCapacityRow {
  shop_code: string;
  month: string;
  total_capacity: number;
  confirmed_railcars?: number;
  planned_railcars?: number;
  notes?: string;
}

interface WorkCapacityRow {
  shop_code: string;
  work_type: string;
  weekly_hours_capacity: number;
  current_utilization_pct: number;
  effective_date: string;
}

interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  errors: string[];
}

/**
 * Import shop attributes from CSV data
 */
export async function importShopAttributes(rows: ShopAttributeRow[]): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, errors: [] };

  for (const row of rows) {
    try {
      // Skip instruction rows
      if (!row.shop_code || row.shop_code.startsWith('INSTRUCTIONS') || row.shop_code === 'shop_code') {
        continue;
      }

      const existing = await queryOne(
        'SELECT shop_code FROM shops WHERE shop_code = $1',
        [row.shop_code]
      );

      if (existing) {
        // Update existing shop
        await query(`
          UPDATE shops SET
            shop_name = $2,
            primary_railroad = $3,
            region = $4,
            city = $5,
            state = $6,
            labor_rate = $7,
            material_multiplier = $8,
            latitude = $9,
            longitude = $10,
            updated_at = NOW()
          WHERE shop_code = $1
        `, [
          row.shop_code,
          row.shop_name,
          row.primary_railroad,
          row.region,
          row.city || null,
          row.state || null,
          row.labor_rate || 0,
          row.material_multiplier || 1.0,
          row.latitude || null,
          row.longitude || null,
        ]);
        result.updated++;
      } else {
        // Insert new shop
        await query(`
          INSERT INTO shops (shop_code, shop_name, primary_railroad, region, city, state, labor_rate, material_multiplier, latitude, longitude, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
        `, [
          row.shop_code,
          row.shop_name,
          row.primary_railroad,
          row.region,
          row.city || null,
          row.state || null,
          row.labor_rate || 0,
          row.material_multiplier || 1.0,
          row.latitude || null,
          row.longitude || null,
        ]);
        result.inserted++;
      }
    } catch (error) {
      result.errors.push(`Row ${row.shop_code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Import shop capabilities from CSV data
 */
export async function importShopCapabilities(rows: ShopCapabilityRow[]): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, errors: [] };

  for (const row of rows) {
    try {
      // Skip instruction rows
      if (!row.shop_code || row.shop_code.startsWith('INSTRUCTIONS') || row.shop_code === 'shop_code') {
        continue;
      }

      // Validate shop exists
      const shop = await queryOne('SELECT shop_code FROM shops WHERE shop_code = $1', [row.shop_code]);
      if (!shop) {
        result.errors.push(`Shop ${row.shop_code} not found - import shop attributes first`);
        continue;
      }

      // Upsert capability
      const sql = `
        INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date, expiration_date, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (shop_code, capability_type, capability_value) DO UPDATE SET
          certified_date = EXCLUDED.certified_date,
          expiration_date = EXCLUDED.expiration_date,
          is_active = TRUE,
          updated_at = NOW()
      `;

      await query(sql, [
        row.shop_code,
        row.capability_type,
        row.capability_value,
        row.certified_date || null,
        row.expiration_date || null,
      ]);
      result.inserted++;
    } catch (error) {
      result.errors.push(`Capability ${row.shop_code}/${row.capability_type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Import monthly capacity from CSV data
 */
export async function importMonthlyCapacity(rows: MonthlyCapacityRow[]): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, errors: [] };

  for (const row of rows) {
    try {
      // Skip instruction rows
      if (!row.shop_code || row.shop_code.startsWith('INSTRUCTIONS') || row.shop_code === 'shop_code') {
        continue;
      }

      // Validate shop exists
      const shop = await queryOne('SELECT shop_code FROM shops WHERE shop_code = $1', [row.shop_code]);
      if (!shop) {
        result.errors.push(`Shop ${row.shop_code} not found - import shop attributes first`);
        continue;
      }

      // Upsert monthly capacity
      const sql = `
        INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity, confirmed_railcars, planned_railcars)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (shop_code, month) DO UPDATE SET
          total_capacity = EXCLUDED.total_capacity,
          confirmed_railcars = EXCLUDED.confirmed_railcars,
          planned_railcars = EXCLUDED.planned_railcars,
          updated_at = NOW(),
          version = shop_monthly_capacity.version + 1
      `;

      await query(sql, [
        row.shop_code,
        row.month,
        row.total_capacity || 0,
        row.confirmed_railcars || 0,
        row.planned_railcars || 0,
      ]);
      result.inserted++;
    } catch (error) {
      result.errors.push(`Capacity ${row.shop_code}/${row.month}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Import work type capacity from CSV data
 */
export async function importWorkCapacity(rows: WorkCapacityRow[]): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, errors: [] };

  for (const row of rows) {
    try {
      // Skip instruction rows
      if (!row.shop_code || row.shop_code.startsWith('INSTRUCTIONS') || row.shop_code === 'shop_code') {
        continue;
      }

      // Validate shop exists
      const shop = await queryOne('SELECT shop_code FROM shops WHERE shop_code = $1', [row.shop_code]);
      if (!shop) {
        result.errors.push(`Shop ${row.shop_code} not found - import shop attributes first`);
        continue;
      }

      // Upsert work capacity
      const sql = `
        INSERT INTO shop_capacity (shop_code, work_type, weekly_hours_capacity, current_utilization_pct, effective_date)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (shop_code, work_type, effective_date) DO UPDATE SET
          weekly_hours_capacity = EXCLUDED.weekly_hours_capacity,
          current_utilization_pct = EXCLUDED.current_utilization_pct,
          updated_at = NOW()
      `;

      await query(sql, [
        row.shop_code,
        row.work_type,
        row.weekly_hours_capacity || 0,
        row.current_utilization_pct || 0,
        row.effective_date,
      ]);
      result.inserted++;
    } catch (error) {
      result.errors.push(`Work capacity ${row.shop_code}/${row.work_type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

export default {
  importShopAttributes,
  importShopCapabilities,
  importMonthlyCapacity,
  importWorkCapacity,
};
