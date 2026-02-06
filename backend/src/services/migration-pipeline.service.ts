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
// IMPORT: CUSTOMERS
// =============================================================================

export async function importCustomers(csvContent: string, userId?: string): Promise<MigrationResult> {
  const { rows } = parseCSV(csvContent);
  const runId = await createRun('customer', null, userId);
  const errors: RowError[] = [];
  let imported = 0;
  let skipped = 0;

  await updateRun(runId, { total_rows: rows.length, status: 'importing' });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Validate required fields
    const customerCode = row.customer_code || row.code;
    if (!customerCode) {
      const err: RowError = { row_number: rowNum, field_name: 'customer_code', error_type: 'missing_required', error_message: 'Customer code is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    const customerName = row.customer_name || row.name;
    if (!customerName) {
      const err: RowError = { row_number: rowNum, field_name: 'customer_name', error_type: 'missing_required', error_message: 'Customer name is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    try {
      await query(
        `INSERT INTO customers (customer_code, customer_name, billing_address, city, state, postal_code, contact_phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (customer_code) DO UPDATE SET
           customer_name = COALESCE(EXCLUDED.customer_name, customers.customer_name),
           billing_address = COALESCE(EXCLUDED.billing_address, customers.billing_address),
           city = COALESCE(EXCLUDED.city, customers.city),
           state = COALESCE(EXCLUDED.state, customers.state),
           postal_code = COALESCE(EXCLUDED.postal_code, customers.postal_code),
           contact_phone = COALESCE(EXCLUDED.contact_phone, customers.contact_phone),
           status = COALESCE(EXCLUDED.status, customers.status),
           updated_at = NOW()`,
        [
          customerCode,
          customerName,
          row.billing_address || null,
          row.billing_city || null,
          row.billing_state || null,
          row.billing_zip || null,
          row.phone || null,
          row.customer_type || 'Active',
        ]
      );
      imported++;
    } catch (err) {
      const error: RowError = { row_number: rowNum, field_name: 'customer_code', error_type: 'insert_failed', error_message: (err as Error).message, raw_value: customerCode };
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

  return { run_id: runId, entity_type: 'customer', total_rows: rows.length, imported, skipped, errors: errors.length, error_details: errors.slice(0, 100) };
}

// =============================================================================
// IMPORT: INVOICES
// =============================================================================

export async function importInvoices(csvContent: string, userId?: string): Promise<MigrationResult> {
  const { rows } = parseCSV(csvContent);
  const runId = await createRun('invoice', null, userId);
  const errors: RowError[] = [];
  let imported = 0;
  let skipped = 0;

  await updateRun(runId, { total_rows: rows.length, status: 'importing' });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Validate required fields
    const invoiceNumber = row.invoice_number || row.invoice_no;
    if (!invoiceNumber) {
      const err: RowError = { row_number: rowNum, field_name: 'invoice_number', error_type: 'missing_required', error_message: 'Invoice number is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    const invoiceDate = row.invoice_date || row.date;
    if (!invoiceDate) {
      const err: RowError = { row_number: rowNum, field_name: 'invoice_date', error_type: 'missing_required', error_message: 'Invoice date is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    const invoiceTotal = row.invoice_total || row.total;
    if (!invoiceTotal) {
      const err: RowError = { row_number: rowNum, field_name: 'invoice_total', error_type: 'missing_required', error_message: 'Invoice total is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    // Verify vendor exists or create placeholder shop
    const vendorCode = row.vendor_code || row.vendor;
    if (vendorCode) {
      const shop = await queryOne<{ shop_code: string }>(`SELECT shop_code FROM shops WHERE shop_code = $1`, [vendorCode]);
      if (!shop) {
        // Create placeholder shop with required NOT NULL columns
        try {
          await query(
            `INSERT INTO shops (shop_code, shop_name, primary_railroad, region, is_active)
             VALUES ($1, $2, 'UNK', 'Unknown', FALSE)
             ON CONFLICT (shop_code) DO NOTHING`,
            [vendorCode, `Placeholder – ${vendorCode}`]
          );
        } catch (_) {
          // Ignore if placeholder creation fails due to constraint; still attempt invoice insert
        }
      }
    }

    try {
      // Upsert by invoice_number (no unique constraint, so check-then-insert/update)
      const existing = await queryOne<{ id: string }>(`SELECT id FROM invoices WHERE invoice_number = $1`, [invoiceNumber]);
      if (existing) {
        await query(
          `UPDATE invoices SET
             vendor_code = COALESCE($2, vendor_code),
             shop_code = COALESCE($3, shop_code),
             invoice_date = COALESCE($4::date, invoice_date),
             invoice_total = COALESCE($5::numeric, invoice_total),
             status = COALESCE($6, status),
             updated_at = NOW()
           WHERE id = $7`,
          [
            invoiceNumber,
            vendorCode || null,
            vendorCode || null,
            invoiceDate,
            parseFloat(invoiceTotal),
            row.status || null,
            existing.id,
          ]
        );
      } else {
        await query(
          `INSERT INTO invoices (invoice_number, vendor_code, shop_code, invoice_date, invoice_total, status, original_filename)
           VALUES ($1, $2, $3, $4::date, $5::numeric, $6, $7)`,
          [
            invoiceNumber,
            vendorCode || null,
            vendorCode || null,
            invoiceDate,
            parseFloat(invoiceTotal),
            row.status || 'pending',
            row.description || null,
          ]
        );
      }
      imported++;
    } catch (err) {
      const error: RowError = { row_number: rowNum, field_name: 'invoice_number', error_type: 'insert_failed', error_message: (err as Error).message, raw_value: invoiceNumber };
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

  return { run_id: runId, entity_type: 'invoice', total_rows: rows.length, imported, skipped, errors: errors.length, error_details: errors.slice(0, 100) };
}

// =============================================================================
// IMPORT: ALLOCATIONS
// =============================================================================

export async function importAllocations(csvContent: string, userId?: string): Promise<MigrationResult> {
  const { rows } = parseCSV(csvContent);
  const runId = await createRun('allocation', null, userId);
  const errors: RowError[] = [];
  let imported = 0;
  let skipped = 0;

  await updateRun(runId, { total_rows: rows.length, status: 'importing' });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Validate required fields
    const carNumber = row.car_number || row.car_no;
    if (!carNumber) {
      const err: RowError = { row_number: rowNum, field_name: 'car_number', error_type: 'missing_required', error_message: 'Car number is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    const targetMonth = row.target_month || row.month;
    if (!targetMonth) {
      const err: RowError = { row_number: rowNum, field_name: 'target_month', error_type: 'missing_required', error_message: 'Target month is required' };
      errors.push(err);
      await recordRowError(runId, err);
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

    // Verify shop exists if provided
    const shopCode = row.shop_code || row.shop;
    if (shopCode) {
      const shop = await queryOne<{ shop_code: string }>(`SELECT shop_code FROM shops WHERE shop_code = $1`, [shopCode]);
      if (!shop) {
        const err: RowError = { row_number: rowNum, field_name: 'shop_code', error_type: 'fk_missing', error_message: `Shop ${shopCode} not found`, raw_value: shopCode };
        errors.push(err);
        await recordRowError(runId, err);
        skipped++;
        continue;
      }
    }

    try {
      await query(
        `INSERT INTO allocations (car_id, car_number, shop_code, target_month, estimated_cost, actual_cost, status)
         VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7)
         ON CONFLICT DO NOTHING`,
        [
          carNumber,
          carNumber,
          shopCode || null,
          targetMonth,
          row.estimated_cost || row.est_cost || null,
          row.actual_cost || null,
          row.status || 'Planned Shopping',
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

  return { run_id: runId, entity_type: 'allocation', total_rows: rows.length, imported, skipped, errors: errors.length, error_details: errors.slice(0, 100) };
}

// =============================================================================
// IMPORT: MILEAGE RECORDS
// =============================================================================

export async function importMileageRecords(csvContent: string, userId?: string): Promise<MigrationResult> {
  const { rows } = parseCSV(csvContent);
  const runId = await createRun('mileage', null, userId);
  const errors: RowError[] = [];
  let imported = 0;
  let skipped = 0;

  await updateRun(runId, { total_rows: rows.length, status: 'importing' });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Validate required fields
    const carNumber = row.car_number || row.car_no;
    if (!carNumber) {
      const err: RowError = { row_number: rowNum, field_name: 'car_number', error_type: 'missing_required', error_message: 'Car number is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    const reportingPeriod = row.reporting_period || row.period;
    if (!reportingPeriod) {
      const err: RowError = { row_number: rowNum, field_name: 'reporting_period', error_type: 'missing_required', error_message: 'Reporting period is required' };
      errors.push(err);
      await recordRowError(runId, err);
      continue;
    }

    const totalMiles = row.total_miles || row.miles;
    if (!totalMiles) {
      const err: RowError = { row_number: rowNum, field_name: 'total_miles', error_type: 'missing_required', error_message: 'Total miles is required' };
      errors.push(err);
      await recordRowError(runId, err);
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

    // Resolve customer_id if customer_code provided
    const customerCode = row.customer_code || row.customer;
    let customerId: string | null = null;
    if (customerCode) {
      const customer = await queryOne<{ id: string }>(`SELECT id FROM customers WHERE customer_code = $1`, [customerCode]);
      if (customer) {
        customerId = customer.id;
      }
      // Non-fatal if customer not found — mileage record still valid without customer_id
    }

    try {
      await query(
        `INSERT INTO mileage_records (car_number, customer_id, reporting_period, miles, source, notes)
         VALUES ($1, $2, $3::date, $4::integer, $5, $6)
         ON CONFLICT (car_number, reporting_period) DO UPDATE SET
           customer_id = COALESCE(EXCLUDED.customer_id, mileage_records.customer_id),
           miles = EXCLUDED.miles,
           source = COALESCE(EXCLUDED.source, mileage_records.source),
           notes = COALESCE(EXCLUDED.notes, mileage_records.notes)`,
        [
          carNumber,
          customerId,
          reportingPeriod,
          parseInt(totalMiles, 10),
          'ciprots',
          row.railroad || row.rr || null,
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

  return { run_id: runId, entity_type: 'mileage', total_rows: rows.length, imported, skipped, errors: errors.length, error_details: errors.slice(0, 100) };
}

// =============================================================================
// ORCHESTRATED LOAD
// =============================================================================

/**
 * Orchestrated load in dependency order:
 * customers -> contracts -> cars -> allocations -> shopping -> qualifications -> invoices -> mileage
 *
 * @param fileMap - Record<string, string> mapping entity type to CSV content
 * @param userId  - optional user who initiated the orchestration
 * @returns Array of MigrationResult for each entity that was loaded
 */
export async function runOrchestration(
  fileMap: Record<string, string>,
  userId?: string
): Promise<MigrationResult[]> {
  const orderedEntities: { key: string; importer: (csv: string, uid?: string) => Promise<MigrationResult> }[] = [
    { key: 'customer', importer: importCustomers },
    { key: 'contract', importer: importContracts },
    { key: 'car', importer: importCars },
    { key: 'allocation', importer: importAllocations },
    { key: 'shopping', importer: importShoppingEvents },
    { key: 'qualification', importer: importQualifications },
    { key: 'invoice', importer: importInvoices },
    { key: 'mileage', importer: importMileageRecords },
  ];

  const results: MigrationResult[] = [];

  for (const { key, importer } of orderedEntities) {
    const csvContent = fileMap[key];
    if (!csvContent) continue;

    const result = await importer(csvContent, userId);
    results.push(result);
  }

  return results;
}

// =============================================================================
// ROLLBACK A MIGRATION RUN
// =============================================================================

/**
 * Rollback a migration run by deleting records created during that run's time window.
 * Sets the run status to 'failed' with a rollback note in the errors field
 * (the CHECK constraint does not include 'rolled_back').
 */
export async function rollbackRun(
  runId: string,
  userId?: string
): Promise<{ success: boolean; deleted_count: number }> {
  const run = await queryOne<MigrationRun>(
    `SELECT * FROM migration_runs WHERE id = $1`,
    [runId]
  );

  if (!run) {
    return { success: false, deleted_count: 0 };
  }

  if (!run.started_at || !run.completed_at) {
    return { success: false, deleted_count: 0 };
  }

  // Map entity types to their target tables and timestamp columns
  const entityTableMap: Record<string, { table: string; timestampCol: string }> = {
    car: { table: 'cars', timestampCol: 'created_at' },
    customer: { table: 'customers', timestampCol: 'created_at' },
    contract: { table: 'master_leases', timestampCol: 'created_at' },
    shopping: { table: 'shopping_events', timestampCol: 'created_at' },
    qualification: { table: 'qualifications', timestampCol: 'created_at' },
    invoice: { table: 'invoices', timestampCol: 'created_at' },
    allocation: { table: 'allocations', timestampCol: 'created_at' },
    mileage: { table: 'mileage_records', timestampCol: 'created_at' },
  };

  const mapping = entityTableMap[run.entity_type];
  if (!mapping) {
    return { success: false, deleted_count: 0 };
  }

  try {
    const deleteResult = await queryOne<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM ${mapping.table}
         WHERE ${mapping.timestampCol} >= $1 AND ${mapping.timestampCol} <= $2
         RETURNING 1
       ) SELECT COUNT(*)::text AS count FROM deleted`,
      [run.started_at, run.completed_at]
    );

    const deletedCount = parseInt(deleteResult?.count || '0', 10);

    await updateRun(runId, {
      status: 'failed',
      errors: [
        ...(run.errors || []),
        {
          type: 'rollback',
          message: `Rolled back by ${userId || 'system'}. Deleted ${deletedCount} records.`,
          rolled_back_at: new Date().toISOString(),
        },
      ],
    });

    return { success: true, deleted_count: deletedCount };
  } catch (err) {
    await updateRun(runId, {
      status: 'failed',
      errors: [
        ...(run.errors || []),
        {
          type: 'rollback_failed',
          message: (err as Error).message,
          rolled_back_at: new Date().toISOString(),
        },
      ],
    });
    return { success: false, deleted_count: 0 };
  }
}

// =============================================================================
// DRY-RUN VALIDATION
// =============================================================================

/**
 * Dry-run validation: runs the same parse/validate logic as the importer
 * but does NOT write to production tables. Returns validation summary.
 */
export async function validateOnly(
  entityType: string,
  csvContent: string
): Promise<{ total_rows: number; valid_rows: number; error_rows: number; errors: RowError[] }> {
  const { rows } = parseCSV(csvContent);
  const errors: RowError[] = [];

  // Dispatch validation by entity type
  const validators: Record<string, (rows: Record<string, string>[]) => Promise<RowError[]>> = {
    car: async (rows) => {
      const errs: RowError[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const carNumber = row.car_number || row.car_no || row.carnumber;
        if (!carNumber) {
          errs.push({ row_number: rowNum, field_name: 'car_number', error_type: 'missing_required', error_message: 'Car number is required' });
        }
      }
      return errs;
    },

    customer: async (rows) => {
      const errs: RowError[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        if (!(row.customer_code || row.code)) {
          errs.push({ row_number: rowNum, field_name: 'customer_code', error_type: 'missing_required', error_message: 'Customer code is required' });
        }
        if (!(row.customer_name || row.name)) {
          errs.push({ row_number: rowNum, field_name: 'customer_name', error_type: 'missing_required', error_message: 'Customer name is required' });
        }
      }
      return errs;
    },

    contract: async (rows) => {
      const errs: RowError[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        if (!(row.contract_number || row.contract_no)) {
          errs.push({ row_number: rowNum, field_name: 'contract_number', error_type: 'missing_required', error_message: 'Contract number is required' });
        }
        const customerCode = row.customer_code || row.lessee_code;
        if (customerCode) {
          const customer = await queryOne<{ id: string }>(`SELECT id FROM customers WHERE customer_code = $1`, [customerCode]);
          if (!customer) {
            errs.push({ row_number: rowNum, field_name: 'customer_code', error_type: 'fk_missing', error_message: `Customer ${customerCode} not found`, raw_value: customerCode });
          }
        }
      }
      return errs;
    },

    shopping: async (rows) => {
      const errs: RowError[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const carNumber = row.car_number || row.car_no;
        if (!carNumber) {
          errs.push({ row_number: rowNum, field_name: 'car_number', error_type: 'missing_required', error_message: 'Car number is required' });
        } else {
          const car = await queryOne<{ car_number: string }>(`SELECT car_number FROM cars WHERE car_number = $1`, [carNumber]);
          if (!car) {
            errs.push({ row_number: rowNum, field_name: 'car_number', error_type: 'fk_missing', error_message: `Car ${carNumber} not found`, raw_value: carNumber });
          }
        }
      }
      return errs;
    },

    qualification: async (rows) => {
      const errs: RowError[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const carNumber = row.car_number || row.car_no;
        const qualType = row.qualification_type || row.qual_type || row.type;
        if (!carNumber) {
          errs.push({ row_number: rowNum, field_name: 'car_number', error_type: 'missing_required', error_message: 'Car number is required' });
        } else {
          const car = await queryOne<{ id: string }>(`SELECT id FROM cars WHERE car_number = $1`, [carNumber]);
          if (!car) {
            errs.push({ row_number: rowNum, field_name: 'car_number', error_type: 'fk_missing', error_message: `Car ${carNumber} not found`, raw_value: carNumber });
          }
        }
        if (!qualType) {
          errs.push({ row_number: rowNum, field_name: 'qualification_type', error_type: 'missing_required', error_message: 'Qualification type is required' });
        } else {
          const qt = await queryOne<{ id: string }>(`SELECT id FROM qualification_types WHERE code = $1 OR name ILIKE $1`, [qualType]);
          if (!qt) {
            errs.push({ row_number: rowNum, field_name: 'qualification_type', error_type: 'fk_missing', error_message: `Qualification type '${qualType}' not found`, raw_value: qualType });
          }
        }
      }
      return errs;
    },

    invoice: async (rows) => {
      const errs: RowError[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        if (!(row.invoice_number || row.invoice_no)) {
          errs.push({ row_number: rowNum, field_name: 'invoice_number', error_type: 'missing_required', error_message: 'Invoice number is required' });
        }
        if (!(row.invoice_date || row.date)) {
          errs.push({ row_number: rowNum, field_name: 'invoice_date', error_type: 'missing_required', error_message: 'Invoice date is required' });
        }
        if (!(row.invoice_total || row.total)) {
          errs.push({ row_number: rowNum, field_name: 'invoice_total', error_type: 'missing_required', error_message: 'Invoice total is required' });
        }
      }
      return errs;
    },

    allocation: async (rows) => {
      const errs: RowError[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const carNumber = row.car_number || row.car_no;
        if (!carNumber) {
          errs.push({ row_number: rowNum, field_name: 'car_number', error_type: 'missing_required', error_message: 'Car number is required' });
        } else {
          const car = await queryOne<{ car_number: string }>(`SELECT car_number FROM cars WHERE car_number = $1`, [carNumber]);
          if (!car) {
            errs.push({ row_number: rowNum, field_name: 'car_number', error_type: 'fk_missing', error_message: `Car ${carNumber} not found`, raw_value: carNumber });
          }
        }
        if (!(row.target_month || row.month)) {
          errs.push({ row_number: rowNum, field_name: 'target_month', error_type: 'missing_required', error_message: 'Target month is required' });
        }
        const shopCode = row.shop_code || row.shop;
        if (shopCode) {
          const shop = await queryOne<{ shop_code: string }>(`SELECT shop_code FROM shops WHERE shop_code = $1`, [shopCode]);
          if (!shop) {
            errs.push({ row_number: rowNum, field_name: 'shop_code', error_type: 'fk_missing', error_message: `Shop ${shopCode} not found`, raw_value: shopCode });
          }
        }
      }
      return errs;
    },

    mileage: async (rows) => {
      const errs: RowError[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const carNumber = row.car_number || row.car_no;
        if (!carNumber) {
          errs.push({ row_number: rowNum, field_name: 'car_number', error_type: 'missing_required', error_message: 'Car number is required' });
        } else {
          const car = await queryOne<{ car_number: string }>(`SELECT car_number FROM cars WHERE car_number = $1`, [carNumber]);
          if (!car) {
            errs.push({ row_number: rowNum, field_name: 'car_number', error_type: 'fk_missing', error_message: `Car ${carNumber} not found`, raw_value: carNumber });
          }
        }
        if (!(row.reporting_period || row.period)) {
          errs.push({ row_number: rowNum, field_name: 'reporting_period', error_type: 'missing_required', error_message: 'Reporting period is required' });
        }
        if (!(row.total_miles || row.miles)) {
          errs.push({ row_number: rowNum, field_name: 'total_miles', error_type: 'missing_required', error_message: 'Total miles is required' });
        }
      }
      return errs;
    },
  };

  const validator = validators[entityType];
  if (!validator) {
    return {
      total_rows: rows.length,
      valid_rows: 0,
      error_rows: rows.length,
      errors: [{ row_number: 0, field_name: 'entity_type', error_type: 'unsupported', error_message: `Unknown entity type: ${entityType}` }],
    };
  }

  const validationErrors = await validator(rows);

  // Count unique error rows (a single row may have multiple errors)
  const errorRowNumbers = new Set(validationErrors.map(e => e.row_number));

  return {
    total_rows: rows.length,
    valid_rows: rows.length - errorRowNumbers.size,
    error_rows: errorRowNumbers.size,
    errors: validationErrors.slice(0, 200),
  };
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
    { entity: 'customer', table: 'customers', countCol: 'id' },
    { entity: 'contract', table: 'master_leases', countCol: 'id' },
    { entity: 'shopping', table: 'shopping_events', countCol: 'id' },
    { entity: 'qualification', table: 'qualifications', countCol: 'id' },
    { entity: 'invoice', table: 'invoices', countCol: 'id' },
    { entity: 'allocation', table: 'allocations', countCol: 'id' },
    { entity: 'mileage', table: 'mileage_records', countCol: 'id' },
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

// =============================================================================
// DELTA MIGRATION — incremental sync since last run
// =============================================================================

interface DeltaResult {
  entity_type: string;
  records_checked: number;
  new_records: number;
  updated_records: number;
  errors: number;
  run_id: string;
}

/**
 * Delta migration for cars. Compares CSV records against existing data
 * using car_number as key and updated_at as change indicator.
 * Only processes records modified since the last migration run.
 */
export async function deltaMigrateCars(csvContent: string, userId?: string): Promise<DeltaResult> {
  const { rows } = parseCSV(csvContent);
  const runId = await createRun('delta_car', null, userId);
  let newRecords = 0;
  let updatedRecords = 0;
  let errors = 0;

  await updateRun(runId, { total_rows: rows.length, status: 'importing' });

  // Get timestamp of last complete car migration
  const lastRun = await queryOne<{ completed_at: string }>(
    `SELECT completed_at FROM migration_runs
     WHERE entity_type IN ('car', 'delta_car') AND status = 'complete'
     ORDER BY completed_at DESC LIMIT 1`
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const carNumber = row.car_number || row.car_no || row.carnumber;
    if (!carNumber) { errors++; continue; }

    // Check if record was modified since last run (if we have a modified_at field in CSV)
    const modifiedAt = row.modified_at || row.updated_at || row.last_modified;
    if (lastRun && modifiedAt) {
      const modDate = new Date(modifiedAt);
      const lastDate = new Date(lastRun.completed_at);
      if (modDate <= lastDate) continue; // Skip — not changed since last migration
    }

    try {
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM cars WHERE car_number = $1`, [carNumber]
      );

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

      if (existing) updatedRecords++;
      else newRecords++;
    } catch {
      errors++;
    }
  }

  await updateRun(runId, {
    status: 'complete',
    imported_rows: newRecords + updatedRecords,
    skipped_rows: rows.length - newRecords - updatedRecords - errors,
    error_rows: errors,
    valid_rows: newRecords + updatedRecords,
    completed_at: new Date().toISOString(),
  });

  return { entity_type: 'delta_car', records_checked: rows.length, new_records: newRecords, updated_records: updatedRecords, errors, run_id: runId };
}

/**
 * Delta summary — shows what changed since last full migration per entity type.
 */
export async function getDeltaSummary(): Promise<{
  entity_type: string;
  last_full_migration: string | null;
  last_delta_migration: string | null;
  records_since_last_full: number;
}[]> {
  const entityTypes = ['car', 'contract', 'shopping', 'qualification'];
  const results = [];

  for (const et of entityTypes) {
    const lastFull = await queryOne<{ completed_at: string }>(
      `SELECT completed_at FROM migration_runs WHERE entity_type = $1 AND status = 'complete' ORDER BY completed_at DESC LIMIT 1`,
      [et]
    );
    const lastDelta = await queryOne<{ completed_at: string }>(
      `SELECT completed_at FROM migration_runs WHERE entity_type = $1 AND status = 'complete' ORDER BY completed_at DESC LIMIT 1`,
      [`delta_${et}`]
    );
    const deltaRuns = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(imported_rows), 0)::int AS total FROM migration_runs
       WHERE entity_type = $1 AND status = 'complete'`,
      [`delta_${et}`]
    );

    results.push({
      entity_type: et,
      last_full_migration: lastFull?.completed_at || null,
      last_delta_migration: lastDelta?.completed_at || null,
      records_since_last_full: deltaRuns?.total || 0,
    });
  }

  return results;
}
