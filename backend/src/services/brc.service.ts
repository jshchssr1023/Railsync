import { query, queryOne } from '../config/database';
import { BRCRecord, BRCImportResult, Allocation } from '../types';
import * as assignmentService from './assignment.service';

// ============================================================================
// BRC PARSER (AAR 500-Byte Format)
// ============================================================================

/**
 * Parse Julian date (YYYYDDD) to JavaScript Date
 */
function parseJulianDate(julian: string): Date {
  const year = parseInt(julian.substring(0, 4));
  const dayOfYear = parseInt(julian.substring(4, 7));
  const date = new Date(year, 0, 1);
  date.setDate(dayOfYear);
  return date;
}

/**
 * Parse job codes from the record segment
 */
function parseJobCodes(segment: string): { code: string; amount: number }[] {
  const codes: { code: string; amount: number }[] = [];
  const JOB_LENGTH = 11; // 3 chars code + 8 chars amount

  for (let i = 0; i < 10; i++) {
    const start = i * JOB_LENGTH;
    if (start + JOB_LENGTH > segment.length) break;

    const job = segment.substring(start, start + JOB_LENGTH);
    const code = job.substring(0, 3).trim();
    const amountStr = job.substring(3, 11).trim();
    const amount = parseInt(amountStr) / 100; // Convert cents to dollars

    if (code && amount > 0) {
      codes.push({ code, amount });
    }
  }

  return codes;
}

/**
 * Parse a single BRC record (500-byte fixed-width format)
 */
export function parseBRCRecord(record: string): BRCRecord {
  const car_mark = record.substring(0, 4).trim();
  const car_number = record.substring(4, 10).trim();

  return {
    car_mark,
    car_number,
    car_id: `${car_mark}${car_number}`,
    billing_date: parseJulianDate(record.substring(10, 17)),
    completion_date: parseJulianDate(record.substring(17, 24)),
    shop_code: record.substring(24, 28).trim(),
    card_type: record.substring(28, 30).trim(),
    why_made_code: record.substring(30, 32).trim(),
    labor_amount: parseInt(record.substring(32, 40)) / 100,
    material_amount: parseInt(record.substring(40, 48)) / 100,
    total_amount: parseInt(record.substring(48, 56)) / 100,
    labor_hours: parseInt(record.substring(56, 63)) / 100,
    job_codes: parseJobCodes(record.substring(63, 173)),
    raw_record: record,
  };
}

/**
 * Parse a BRC file (multiple 500-byte records)
 */
export function parseBRCFile(content: string | Buffer): BRCRecord[] {
  const RECORD_LENGTH = 500;
  const records: BRCRecord[] = [];

  const text = typeof content === 'string' ? content : content.toString('ascii');

  // Handle both newline-separated and continuous format
  if (text.includes('\n')) {
    // Line-separated records
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length >= 60) {
        // Minimum viable record length
        records.push(parseBRCRecord(trimmed.padEnd(500)));
      }
    }
  } else {
    // Continuous 500-byte records
    const recordCount = Math.floor(text.length / RECORD_LENGTH);
    for (let i = 0; i < recordCount; i++) {
      const record = text.substring(i * RECORD_LENGTH, (i + 1) * RECORD_LENGTH);
      records.push(parseBRCRecord(record));
    }
  }

  return records;
}

// ============================================================================
// BRC IMPORT SERVICE
// ============================================================================

/**
 * Import BRC file and match to allocations
 */
export async function importBRCFile(
  content: string | Buffer,
  filename: string,
  userId?: string
): Promise<BRCImportResult> {
  const brcRecords = parseBRCFile(content);

  const result: BRCImportResult = {
    id: '',
    filename,
    total: brcRecords.length,
    matched_to_allocation: 0,
    created_running_repair: 0,
    errors: [],
  };

  for (const brc of brcRecords) {
    try {
      // Try to match to existing allocation
      const allocation = await queryOne<Allocation>(
        `SELECT id, estimated_cost, demand_id
         FROM allocations
         WHERE (car_mark_number = $1 OR car_number = $2)
           AND status IN ('Planned Shopping', 'Enroute', 'Arrived')
         ORDER BY created_at DESC
         LIMIT 1`,
        [brc.car_id, brc.car_number]
      );

      if (allocation) {
        // Update existing allocation with actual cost
        await updateAllocationWithBRC(allocation.id, brc);
        result.matched_to_allocation++;
      } else {
        // No allocation found - this is a running repair
        await createRunningRepairAllocation(brc, userId);
        result.created_running_repair++;
      }
    } catch (err: any) {
      result.errors.push(`${brc.car_id}: ${err.message}`);
    }
  }

  // Record the import
  const importRecord = await query<{ id: string }>(
    `INSERT INTO brc_imports (
      filename, file_size, record_count, matched_count,
      running_repair_count, error_count, errors, imported_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      filename,
      typeof content === 'string' ? content.length : content.length,
      result.total,
      result.matched_to_allocation,
      result.created_running_repair,
      result.errors.length,
      JSON.stringify(result.errors),
      userId,
    ]
  );

  result.id = importRecord[0].id;

  // Update running repairs budget actuals
  await updateRunningRepairsActuals(brcRecords);

  return result;
}

/**
 * Update an allocation with BRC actual costs
 */
async function updateAllocationWithBRC(allocationId: string, brc: BRCRecord): Promise<void> {
  await query(
    `UPDATE allocations SET
      actual_cost = $1,
      actual_cost_breakdown = $2,
      brc_number = $3,
      brc_received_at = NOW(),
      actual_completion_date = $4,
      status = 'Complete',
      updated_at = NOW()
    WHERE id = $5`,
    [
      brc.total_amount,
      JSON.stringify({
        labor: brc.labor_amount,
        material: brc.material_amount,
        labor_hours: brc.labor_hours,
        job_codes: brc.job_codes,
      }),
      `${brc.car_id}-${brc.billing_date.toISOString().slice(0, 10)}`,
      brc.completion_date,
      allocationId,
    ]
  );

  // Update shop capacity (move from allocated to completed)
  const alloc = await queryOne<{ shop_code: string; target_month: string }>(
    'SELECT shop_code, target_month FROM allocations WHERE id = $1',
    [allocationId]
  );

  if (alloc) {
    await query(
      `UPDATE shop_monthly_capacity SET
        allocated_count = GREATEST(0, allocated_count - 1),
        completed_count = completed_count + 1,
        updated_at = NOW()
      WHERE shop_code = $1 AND month = $2`,
      [alloc.shop_code, alloc.target_month]
    );
  }
}

/**
 * Create a running repair allocation from a BRC (unplanned work)
 */
async function createRunningRepairAllocation(brc: BRCRecord, userId?: string): Promise<void> {
  const month = brc.completion_date.toISOString().slice(0, 7);
  const fiscalYear = parseInt(month.slice(0, 4));

  // Find or create running repair demand for this month
  let demand = await queryOne<{ id: string }>(
    `SELECT id FROM demands
     WHERE event_type = 'Running Repair'
       AND target_month = $1
     LIMIT 1`,
    [month]
  );

  if (!demand) {
    const newDemand = await query<{ id: string }>(
      `INSERT INTO demands (name, fiscal_year, target_month, car_count, event_type, status)
       VALUES ($1, $2, $3, 0, 'Running Repair', 'Allocated')
       RETURNING id`,
      [`Running Repairs - ${month}`, fiscalYear, month]
    );
    demand = newDemand[0];
  }

  // Create allocation with actual = estimated (unplanned)
  await query(
    `INSERT INTO allocations (
      demand_id, car_mark_number, car_number, car_id, shop_code, target_month,
      estimated_cost, actual_cost, actual_cost_breakdown,
      brc_number, brc_received_at, actual_completion_date, status, created_by
    ) VALUES ($1, $2, $3, (SELECT id FROM cars WHERE car_number = $3), $4, $5, $6, $6, $7, $8, NOW(), $9, 'Complete', $10)`,
    [
      demand.id,
      brc.car_id,
      brc.car_number,
      brc.shop_code,
      month,
      brc.total_amount,
      JSON.stringify({
        labor: brc.labor_amount,
        material: brc.material_amount,
        labor_hours: brc.labor_hours,
        job_codes: brc.job_codes,
      }),
      `${brc.car_id}-${brc.billing_date.toISOString().slice(0, 10)}`,
      brc.completion_date,
      userId,
    ]
  );

  // Increment demand car count
  await query(
    `UPDATE demands SET car_count = car_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [demand.id]
  );

  // SSOT: Also write to car_assignments (completed BRC work)
  if (brc.car_number) {
    try {
      const existing = await assignmentService.getActiveAssignment(brc.car_number);
      if (!existing) {
        await assignmentService.createAssignment({
          car_number: brc.car_number,
          shop_code: brc.shop_code,
          target_month: month,
          estimated_cost: brc.total_amount,
          source: 'brc_import',
          source_reference_type: 'brc',
          created_by_id: userId,
        });
        // Mark as complete immediately since BRC = completed work
        const assignment = await assignmentService.getActiveAssignment(brc.car_number);
        if (assignment) {
          await assignmentService.updateStatus(assignment.id, 'Complete', userId);
        }
      }
    } catch (err) {
      console.warn('SSOT write failed for BRC (non-blocking):', err);
    }
  }
}

/**
 * Update running repairs budget with actuals from BRC import
 */
async function updateRunningRepairsActuals(brcRecords: BRCRecord[]): Promise<void> {
  // Group by month
  const byMonth = new Map<string, { cost: number; count: number }>();

  for (const brc of brcRecords) {
    const month = brc.completion_date.toISOString().slice(0, 7);
    const existing = byMonth.get(month) || { cost: 0, count: 0 };
    existing.cost += brc.total_amount;
    existing.count += 1;
    byMonth.set(month, existing);
  }

  // Update running repairs budget
  for (const [month, data] of byMonth) {
    await query(
      `UPDATE running_repairs_budget SET
        actual_spend = actual_spend + $1,
        actual_car_count = actual_car_count + $2,
        remaining_budget = monthly_budget - (actual_spend + $1),
        updated_at = NOW()
      WHERE month = $3`,
      [data.cost, data.count, month]
    );
  }
}

/**
 * Get BRC import history
 */
export async function getBRCHistory(
  startDate?: Date,
  endDate?: Date,
  limit: number = 50
): Promise<
  {
    id: string;
    filename: string;
    record_count: number;
    matched_count: number;
    running_repair_count: number;
    error_count: number;
    imported_at: Date;
  }[]
> {
  let sql = `
    SELECT id, filename, record_count, matched_count, running_repair_count, error_count, imported_at
    FROM brc_imports
  `;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    conditions.push(`imported_at >= $${paramIndex++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`imported_at <= $${paramIndex++}`);
    params.push(endDate);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += ` ORDER BY imported_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  return query(sql, params);
}

/**
 * Get BRC import details
 */
export async function getBRCImportById(
  id: string
): Promise<{
  id: string;
  filename: string;
  file_size: number;
  record_count: number;
  matched_count: number;
  running_repair_count: number;
  error_count: number;
  errors: string[];
  imported_at: Date;
} | null> {
  return queryOne(
    `SELECT * FROM brc_imports WHERE id = $1`,
    [id]
  );
}

export default {
  parseBRCRecord,
  parseBRCFile,
  importBRCFile,
  getBRCHistory,
  getBRCImportById,
};
