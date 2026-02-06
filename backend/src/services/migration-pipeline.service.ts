/**
 * CIPROTS Data Migration Pipeline
 *
 * Processes CSV exports from CIPROTS and imports them into RailSync.
 * Each entity type has: parse → validate → transform → upsert.
 * Results tracked in migration_runs and migration_row_errors tables.
 */

import { query, queryOne, transaction } from '../config/database';
import { PoolClient } from 'pg';

// =============================================================================
// TYPES
// =============================================================================

interface MigrationRun {
  id: string;
  entity_type: string;
  source_file: string | null;
  status: string;
  total_rows: number;
  valid_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  errors: any[];
  warnings: any[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface RowError {
  row_number: number;
  field_name: string;
  error_type: string;
  error_message: string;
  raw_value?: string;
}

interface MigrationResult {
  run_id: string;
  entity_type: string;
  total_rows: number;
  imported: number;
  skipped: number;
  errors: number;
  error_details: RowError[];
}

// =============================================================================
// CSV PARSER
// =============================================================================

function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }

  return { headers, rows };
}

// =============================================================================
// MIGRATION RUN TRACKING
// =============================================================================

async function createRun(entityType: string, sourceFile: string | null, userId?: string): Promise<string> {
  const result = await queryOne<{ id: string }>(
    `INSERT INTO migration_runs (entity_type, source_file, status, initiated_by, started_at)
     VALUES ($1, $2, 'validating', $3, NOW()) RETURNING id`,
    [entityType, sourceFile, userId || null]
  );
  return result!.id;
}

async function updateRun(runId: string, updates: Partial<MigrationRun>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.status) { fields.push(`status = $${idx++}`); values.push(updates.status); }
  if (updates.total_rows !== undefined) { fields.push(`total_rows = $${idx++}`); values.push(updates.total_rows); }
  if (updates.valid_rows !== undefined) { fields.push(`valid_rows = $${idx++}`); values.push(updates.valid_rows); }
  if (updates.imported_rows !== undefined) { fields.push(`imported_rows = $${idx++}`); values.push(updates.imported_rows); }
  if (updates.skipped_rows !== undefined) { fields.push(`skipped_rows = $${idx++}`); values.push(updates.skipped_rows); }
  if (updates.error_rows !== undefined) { fields.push(`error_rows = $${idx++}`); values.push(updates.error_rows); }
  if (updates.errors) { fields.push(`errors = $${idx++}`); values.push(JSON.stringify(updates.errors)); }
  if (updates.completed_at) { fields.push(`completed_at = $${idx++}`); values.push(updates.completed_at); }

  fields.push(`updated_at = NOW()`);
  values.push(runId);

  await query(`UPDATE migration_runs SET ${fields.join(', ')} WHERE id = $${idx}`, values);
}

async function recordRowError(runId: string, error: RowError): Promise<void> {
  await query(
    `INSERT INTO migration_row_errors (migration_run_id, row_number, field_name, error_type, error_message, raw_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [runId, error.row_number, error.field_name, error.error_type, error.error_message, error.raw_value || null]
  );
}

// =============================================================================
// IMPORT: CARS
// =============================================================================

export async function importCars(csvContent: string, userId?: string): Promise<MigrationResult> {
  const { rows } = parseCSV(csvContent);
  const runId = await createRun('car', null, userId);
  const errors: RowError[] = [];
  let imported = 0;
  let skipped = 0;

  await updateRun(runId, { total_rows: rows.length, status: 'importing' });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Validate required fields
    const carNumber = row.car_number || row.car_no || row.carnumber;
    if (!carNumber) {
      const err: RowError = { row_number: rowNum, field_name: 'car_number', error_type: 'missing_required', error_message: 'Car number is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    try {
      await query(
        `INSERT INTO cars (car_number, car_mark, car_type, lessee_name, lessee_code, commodity, current_status, current_region)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (car_number) DO UPDATE SET
           car_mark = COALESCE(EXCLUDED.car_mark, cars.car_mark),
           car_type = COALESCE(EXCLUDED.car_type, cars.car_type),
           lessee_name = COALESCE(EXCLUDED.lessee_name, cars.lessee_name),
           lessee_code = COALESCE(EXCLUDED.lessee_code, cars.lessee_code),
           commodity = COALESCE(EXCLUDED.commodity, cars.commodity),
           current_status = COALESCE(EXCLUDED.current_status, cars.current_status),
           current_region = COALESCE(EXCLUDED.current_region, cars.current_region),
           updated_at = NOW()`,
        [
          carNumber,
          row.car_mark || row.mark || null,
          row.car_type || row.type || null,
          row.lessee_name || row.lessee || null,
          row.lessee_code || null,
          row.commodity || null,
          row.current_status || row.status || null,
          row.current_region || row.region || null,
        ]
      );
      imported++;
    } catch (err) {
      const error: RowError = { row_number: rowNum, field_name: 'car_number', error_type: 'insert_failed', error_message: (err as Error).message, raw_value: carNumber };
      errors.push(error);
      await recordRowError(runId, error);
    }
  }

  await updateRun(runId, {
    status: 'complete',
    imported_rows: imported,
    skipped_rows: skipped,
    error_rows: errors.length,
    valid_rows: rows.length - errors.length,
    completed_at: new Date().toISOString(),
  });

  return { run_id: runId, entity_type: 'car', total_rows: rows.length, imported, skipped, errors: errors.length, error_details: errors.slice(0, 100) };
}

// =============================================================================
// IMPORT: CONTRACTS
// =============================================================================

export async function importContracts(csvContent: string, userId?: string): Promise<MigrationResult> {
  const { rows } = parseCSV(csvContent);
  const runId = await createRun('contract', null, userId);
  const errors: RowError[] = [];
  let imported = 0;
  let skipped = 0;

  await updateRun(runId, { total_rows: rows.length, status: 'importing' });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const contractNumber = row.contract_number || row.contract_no;
    const customerCode = row.customer_code || row.lessee_code;

    if (!contractNumber) {
      const err: RowError = { row_number: rowNum, field_name: 'contract_number', error_type: 'missing_required', error_message: 'Contract number is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    // Check customer exists
    if (customerCode) {
      const customer = await queryOne<{ id: string }>(`SELECT id FROM customers WHERE customer_code = $1`, [customerCode]);
      if (!customer) {
        const err: RowError = { row_number: rowNum, field_name: 'customer_code', error_type: 'fk_missing', error_message: `Customer ${customerCode} not found`, raw_value: customerCode };
        errors.push(err);
        await recordRowError(runId, err);
        skipped++;
        continue;
      }
    }

    try {
      // Upsert into master_leases by contract_number (approximate mapping)
      const existing = await queryOne<{ id: string }>(`SELECT id FROM master_leases WHERE lease_number = $1`, [contractNumber]);
      if (existing) {
        skipped++;
      } else {
        // Create a placeholder lease
        await query(
          `INSERT INTO master_leases (lease_number, lease_name, status, lease_type, start_date, end_date, customer_id)
           SELECT $1, $2, $3, $4, $5::date, $6::date, c.id
           FROM customers c WHERE c.customer_code = $7
           LIMIT 1`,
          [
            contractNumber,
            row.contract_name || contractNumber,
            row.status || 'active',
            row.lease_type || 'full_service',
            row.start_date || null,
            row.end_date || null,
            customerCode || 'UNKNOWN',
          ]
        );
        imported++;
      }
    } catch (err) {
      const error: RowError = { row_number: rowNum, field_name: 'contract_number', error_type: 'insert_failed', error_message: (err as Error).message, raw_value: contractNumber };
      errors.push(error);
      await recordRowError(runId, error);
    }
  }

  await updateRun(runId, {
    status: 'complete',
    imported_rows: imported,
    skipped_rows: skipped,
    error_rows: errors.length,
    valid_rows: rows.length - errors.length,
    completed_at: new Date().toISOString(),
  });

  return { run_id: runId, entity_type: 'contract', total_rows: rows.length, imported, skipped, errors: errors.length, error_details: errors.slice(0, 100) };
}

// =============================================================================
// IMPORT: SHOPPING EVENTS
// =============================================================================

export async function importShoppingEvents(csvContent: string, userId?: string): Promise<MigrationResult> {
  const { rows } = parseCSV(csvContent);
  const runId = await createRun('shopping', null, userId);
  const errors: RowError[] = [];
  let imported = 0;
  let skipped = 0;

  await updateRun(runId, { total_rows: rows.length, status: 'importing' });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const carNumber = row.car_number || row.car_no;
    if (!carNumber) {
      errors.push({ row_number: rowNum, field_name: 'car_number', error_type: 'missing_required', error_message: 'Car number is required' });
      continue;
    }

    // Verify car exists
    const car = await queryOne<{ car_number: string }>(`SELECT car_number FROM cars WHERE car_number = $1`, [carNumber]);
    if (!car) {
      const err: RowError = { row_number: rowNum, field_name: 'car_number', error_type: 'fk_missing', error_message: `Car ${carNumber} not found`, raw_value: carNumber };
      errors.push(err);
      await recordRowError(runId, err);
      skipped++;
      continue;
    }

    try {
      await query(
        `INSERT INTO shopping_events (car_number, event_type, state, shop_code, reason_shopped, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamp, NOW()))
         ON CONFLICT DO NOTHING`,
        [
          carNumber,
          row.event_type || row.type || 'qualification',
          row.state || row.status || 'Closed',
          row.shop_code || row.shop || null,
          row.reason_shopped || row.reason || null,
          row.created_date || row.date || null,
        ]
      );
      imported++;
    } catch (err) {
      const error: RowError = { row_number: rowNum, field_name: 'car_number', error_type: 'insert_failed', error_message: (err as Error).message };
      errors.push(error);
      await recordRowError(runId, error);
    }
  }

  await updateRun(runId, {
    status: 'complete',
    imported_rows: imported,
    skipped_rows: skipped,
    error_rows: errors.length,
    valid_rows: rows.length - errors.length,
    completed_at: new Date().toISOString(),
  });

  return { run_id: runId, entity_type: 'shopping', total_rows: rows.length, imported, skipped, errors: errors.length, error_details: errors.slice(0, 100) };
}

// =============================================================================
// IMPORT: QUALIFICATIONS
// =============================================================================

export async function importQualifications(csvContent: string, userId?: string): Promise<MigrationResult> {
  const { rows } = parseCSV(csvContent);
  const runId = await createRun('qualification', null, userId);
  const errors: RowError[] = [];
  let imported = 0;
  let skipped = 0;

  await updateRun(runId, { total_rows: rows.length, status: 'importing' });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const carNumber = row.car_number || row.car_no;
    const qualType = row.qualification_type || row.qual_type || row.type;

    if (!carNumber || !qualType) {
      errors.push({ row_number: rowNum, field_name: !carNumber ? 'car_number' : 'qualification_type', error_type: 'missing_required', error_message: `${!carNumber ? 'Car number' : 'Qualification type'} is required` });
      continue;
    }

    // Look up car_id
    const car = await queryOne<{ id: string }>(`SELECT id FROM cars WHERE car_number = $1`, [carNumber]);
    if (!car) {
      const err: RowError = { row_number: rowNum, field_name: 'car_number', error_type: 'fk_missing', error_message: `Car ${carNumber} not found`, raw_value: carNumber };
      errors.push(err);
      await recordRowError(runId, err);
      skipped++;
      continue;
    }

    // Look up qualification_type_id
    const qt = await queryOne<{ id: string }>(`SELECT id FROM qualification_types WHERE code = $1 OR name ILIKE $1`, [qualType]);
    if (!qt) {
      const err: RowError = { row_number: rowNum, field_name: 'qualification_type', error_type: 'fk_missing', error_message: `Qualification type '${qualType}' not found`, raw_value: qualType };
      errors.push(err);
      await recordRowError(runId, err);
      skipped++;
      continue;
    }

    try {
      await query(
        `INSERT INTO qualifications (car_id, qualification_type_id, status, next_due_date, last_completed_date)
         VALUES ($1, $2, $3, $4::date, $5::date)
         ON CONFLICT (car_id, qualification_type_id) DO UPDATE SET
           status = EXCLUDED.status,
           next_due_date = COALESCE(EXCLUDED.next_due_date, qualifications.next_due_date),
           last_completed_date = COALESCE(EXCLUDED.last_completed_date, qualifications.last_completed_date),
           updated_at = NOW()`,
        [
          car.id,
          qt.id,
          row.status || 'current',
          row.next_due_date || row.due_date || null,
          row.last_completed_date || row.completed_date || null,
        ]
      );
      imported++;
    } catch (err) {
      const error: RowError = { row_number: rowNum, field_name: 'qualification', error_type: 'insert_failed', error_message: (err as Error).message };
      errors.push(error);
      await recordRowError(runId, error);
    }
  }

  await updateRun(runId, {
    status: 'complete',
    imported_rows: imported,
    skipped_rows: skipped,
    error_rows: errors.length,
    valid_rows: rows.length - errors.length,
    completed_at: new Date().toISOString(),
  });

  return { run_id: runId, entity_type: 'qualification', total_rows: rows.length, imported, skipped, errors: errors.length, error_details: errors.slice(0, 100) };
}

// =============================================================================
// GET MIGRATION HISTORY
// =============================================================================

export async function getMigrationRuns(limit: number = 50): Promise<MigrationRun[]> {
  return query<MigrationRun>(
    `SELECT * FROM migration_runs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function getMigrationRun(runId: string): Promise<MigrationRun | null> {
  return queryOne<MigrationRun>(
    `SELECT * FROM migration_runs WHERE id = $1`,
    [runId]
  );
}

export async function getMigrationErrors(runId: string, limit: number = 200): Promise<RowError[]> {
  return query<RowError>(
    `SELECT row_number, field_name, error_type, error_message, raw_value
     FROM migration_row_errors
     WHERE migration_run_id = $1
     ORDER BY row_number
     LIMIT $2`,
    [runId, limit]
  );
}

/**
 * Reconciliation summary — counts per entity type in RailSync vs expected.
 */
export async function getReconciliationSummary(): Promise<{
  entity: string;
  railsync_count: number;
  last_migration_count: number;
  last_migration_date: string | null;
}[]> {
  const entities = [
    { entity: 'car', table: 'cars', countCol: 'car_number' },
    { entity: 'contract', table: 'master_leases', countCol: 'id' },
    { entity: 'shopping', table: 'shopping_events', countCol: 'id' },
    { entity: 'qualification', table: 'qualifications', countCol: 'id' },
  ];

  const results = [];
  for (const e of entities) {
    const countResult = await queryOne<{ count: string }>(`SELECT COUNT(${e.countCol}) as count FROM ${e.table}`);
    const lastRun = await queryOne<{ imported_rows: number; created_at: string }>(
      `SELECT imported_rows, created_at FROM migration_runs WHERE entity_type = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1`,
      [e.entity]
    );
    results.push({
      entity: e.entity,
      railsync_count: parseInt(countResult?.count || '0'),
      last_migration_count: lastRun?.imported_rows || 0,
      last_migration_date: lastRun?.created_at || null,
    });
  }

  return results;
}
