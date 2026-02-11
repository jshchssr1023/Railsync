/**
 * Billing Service
 * Monthly rental invoicing, rate management, mileage billing,
 * chargebacks, adjustments, and billing run orchestration.
 */

import { query, queryOne, transaction } from '../config/database';
import logger from '../config/logger';

// ============================================================================
// Types
// ============================================================================

export type OutboundInvoiceStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'sent'
  | 'sent_to_sap'
  | 'posted'
  | 'paid'
  | 'void'
  | 'credit_applied';

export type InvoiceType = 'rental' | 'mileage' | 'chargeback' | 'combined' | 'credit_memo';

export type LineType = 'rental' | 'mileage' | 'chargeback' | 'adjustment' | 'credit' | 'tax';

export type RateChangeType = 'initial' | 'escalation' | 'abatement' | 'correction' | 'renewal' | 'amendment';

export type MileageFileStatus = 'uploaded' | 'processing' | 'processed' | 'reconciled' | 'error';

export type MileageRecordStatus = 'pending' | 'verified' | 'disputed' | 'billed';

export type AdjustmentType =
  | 'credit'
  | 'debit'
  | 'abatement'
  | 'rate_correction'
  | 'proration'
  | 'release_credit'
  | 'renewal_adjustment'
  | 'shop_credit';

export type AdjustmentStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'void';

export type ChargebackType =
  | 'lessee_responsibility'
  | 'damage'
  | 'excess_wear'
  | 'cleaning'
  | 'modification'
  | 'regulatory'
  | 'other';

export type ChargebackStatus = 'draft' | 'pending_review' | 'approved' | 'invoiced' | 'disputed' | 'resolved' | 'void';

export type BillingRunType = 'rental' | 'mileage' | 'chargeback' | 'full';

export type BillingRunStatus =
  | 'pending'
  | 'preflight'
  | 'generating'
  | 'review'
  | 'approved'
  | 'posting'
  | 'completed'
  | 'failed';

export interface OutboundInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  billing_period_start: string;
  billing_period_end: string;
  fiscal_year: number;
  fiscal_month: number;
  invoice_type: InvoiceType;
  rental_total: number;
  mileage_total: number;
  chargeback_total: number;
  adjustment_total: number;
  tax_total: number;
  invoice_total: number;
  status: OutboundInvoiceStatus;
  sap_document_id: string | null;
  sap_posted_at: string | null;
  sent_to_customer_at: string | null;
  sent_via: string | null;
  payment_due_date: string | null;
  payment_received_date: string | null;
  payment_reference: string | null;
  generated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  customer_code?: string;
  customer_name?: string;
}

export interface OutboundInvoiceLine {
  id: string;
  invoice_id: string;
  line_number: number;
  line_type: LineType;
  description: string;
  rider_id: string | null;
  car_number: string | null;
  quantity: number;
  unit_rate: number | null;
  line_total: number;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface RateHistory {
  id: string;
  rider_id: string;
  previous_rate: number | null;
  new_rate: number;
  effective_date: string;
  change_type: RateChangeType;
  change_reason: string | null;
  changed_by: string | null;
  created_at: string;
  // Joined fields
  rider_code?: string;
  rider_name?: string;
}

export interface MileageFile {
  id: string;
  filename: string;
  file_type: string;
  reporting_period: string;
  record_count: number;
  processed_count: number;
  error_count: number;
  status: MileageFileStatus;
  uploaded_by: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface MileageRecord {
  id: string;
  mileage_file_id: string | null;
  car_number: string;
  customer_id: string | null;
  rider_id: string | null;
  reporting_period: string;
  miles: number;
  source: string;
  status: MileageRecordStatus;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface BillingAdjustment {
  id: string;
  customer_id: string;
  rider_id: string | null;
  car_number: string | null;
  adjustment_type: AdjustmentType;
  amount: number;
  description: string;
  source_event: string | null;
  source_event_id: string | null;
  status: AdjustmentStatus;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  applied_to_invoice_id: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  customer_code?: string;
  customer_name?: string;
}

export interface Chargeback {
  id: string;
  customer_id: string;
  car_number: string;
  rider_id: string | null;
  allocation_id: string | null;
  chargeback_type: ChargebackType;
  amount: number;
  description: string;
  brc_file_path: string | null;
  brc_500byte_data: string | null;
  status: ChargebackStatus;
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  applied_to_invoice_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  customer_code?: string;
  customer_name?: string;
}

export interface BillingRun {
  id: string;
  fiscal_year: number;
  fiscal_month: number;
  run_type: BillingRunType;
  preflight_passed: boolean;
  preflight_results: Record<string, unknown> | null;
  status: BillingRunStatus;
  invoices_generated: number;
  total_amount: number;
  error_count: number;
  errors: Record<string, unknown> | null;
  initiated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PreflightResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
    details?: unknown;
  }[];
}

export interface MileageSummary {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  reporting_period: string;
  total_records: number;
  total_miles: number;
  verified_records: number;
  pending_records: number;
  disputed_records: number;
}

export interface BillingSummary {
  fiscal_year: number;
  fiscal_month: number;
  total_invoices: number;
  total_rental: number;
  total_mileage: number;
  total_chargebacks: number;
  total_adjustments: number;
  grand_total: number;
  draft_count: number;
  approved_count: number;
  sent_count: number;
  paid_count: number;
}

// ============================================================================
// 1. MONTHLY INVOICE GENERATION
// ============================================================================

/**
 * Run pre-flight checks before generating monthly invoices.
 * Validates: all active riders have rates, no duplicate billing run,
 * and mileage files are reconciled for the period.
 */
export async function runPreflight(
  fiscalYear: number,
  fiscalMonth: number
): Promise<PreflightResult> {
  const checks: PreflightResult['checks'] = [];

  // Check 1: All active riders have rates
  const ridersWithoutRates = await query<{
    rider_id: string;
    rider_code: string;
    rider_name: string;
    customer_code: string;
  }>(
    `SELECT lr.id AS rider_id, lr.rider_id AS rider_code, lr.rider_name,
            c.customer_code
     FROM lease_riders lr
     JOIN master_leases ml ON ml.id = lr.master_lease_id
     JOIN customers c ON c.id = ml.customer_id
     WHERE lr.status = 'Active'
       AND ml.status = 'Active'
       AND (lr.rate_per_car IS NULL OR lr.rate_per_car = 0)`
  );

  checks.push({
    name: 'riders_have_rates',
    passed: ridersWithoutRates.length === 0,
    message: ridersWithoutRates.length === 0
      ? 'All active riders have rates assigned'
      : `${ridersWithoutRates.length} active rider(s) missing rates`,
    details: ridersWithoutRates.length > 0 ? ridersWithoutRates : undefined,
  });

  // Check 2: No duplicate billing run for this period (rental type)
  const existingRun = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM billing_runs
     WHERE fiscal_year = $1 AND fiscal_month = $2 AND run_type IN ('rental', 'full')
       AND status NOT IN ('failed')`,
    [fiscalYear, fiscalMonth]
  );

  checks.push({
    name: 'no_duplicate_run',
    passed: existingRun === null,
    message: existingRun === null
      ? 'No existing billing run for this period'
      : `Billing run already exists (id: ${existingRun.id}, status: ${existingRun.status})`,
    details: existingRun || undefined,
  });

  // Check 3: Mileage files reconciled for the period
  const periodStart = `${fiscalYear}-${String(fiscalMonth).padStart(2, '0')}-01`;
  const unreconciled = await query<{ id: string; filename: string; status: string }>(
    `SELECT id, filename, status FROM mileage_files
     WHERE reporting_period = $1
       AND status NOT IN ('reconciled', 'error')`,
    [periodStart]
  );

  checks.push({
    name: 'mileage_reconciled',
    passed: unreconciled.length === 0,
    message: unreconciled.length === 0
      ? 'All mileage files for the period are reconciled (or none exist)'
      : `${unreconciled.length} mileage file(s) not yet reconciled`,
    details: unreconciled.length > 0 ? unreconciled : undefined,
  });

  // Check 4: No existing rental invoices for this period (prevent double-billing)
  const existingInvoices = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM outbound_invoices
     WHERE fiscal_year = $1 AND fiscal_month = $2
       AND invoice_type = 'rental'
       AND status != 'void'`,
    [fiscalYear, fiscalMonth]
  );
  const invoiceCount = parseInt(existingInvoices?.count || '0', 10);

  checks.push({
    name: 'no_existing_invoices',
    passed: invoiceCount === 0,
    message: invoiceCount === 0
      ? 'No existing rental invoices for this period'
      : `${invoiceCount} rental invoice(s) already exist for this period`,
  });

  const passed = checks.every((c) => c.passed);

  return { passed, checks };
}

/**
 * Generate an invoice number in the format: INV-{CUSTCODE}-{YYYY}{MM}-{SEQ}
 * SEQ is a zero-padded 3-digit sequence number per customer/period.
 */
export async function generateInvoiceNumber(
  customerId: string,
  year: number,
  month: number
): Promise<string> {
  // Look up customer code
  const customer = await queryOne<{ customer_code: string }>(
    'SELECT customer_code FROM customers WHERE id = $1',
    [customerId]
  );
  if (!customer) {
    throw new Error(`Customer not found: ${customerId}`);
  }

  // Count existing invoices for this customer/period to determine sequence
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM outbound_invoices
     WHERE customer_id = $1 AND fiscal_year = $2 AND fiscal_month = $3`,
    [customerId, year, month]
  );
  const seq = parseInt(result?.count || '0', 10) + 1;

  const yearStr = String(year);
  const monthStr = String(month).padStart(2, '0');
  const seqStr = String(seq).padStart(3, '0');

  return `INV-${customer.customer_code}-${yearStr}${monthStr}-${seqStr}`;
}

/**
 * Generate monthly rental invoices for all active customers.
 * Pro-rates by calendar days for mid-month car adds/removes using
 * rider_cars.added_date and rider_cars.removed_date.
 */
export async function generateMonthlyInvoices(
  fiscalYear: number,
  fiscalMonth: number,
  generatedBy: string
): Promise<{ invoices: OutboundInvoice[]; totalAmount: number; errors: string[] }> {
  const errors: string[] = [];
  const generatedInvoices: OutboundInvoice[] = [];

  // Determine billing period boundaries
  const periodStart = new Date(fiscalYear, fiscalMonth - 1, 1);
  const periodEnd = new Date(fiscalYear, fiscalMonth, 0); // last day of month
  const daysInMonth = periodEnd.getDate();

  const periodStartStr = periodStart.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];

  // Get all active customers with active riders
  const customers = await query<{
    customer_id: string;
    customer_code: string;
    customer_name: string;
  }>(
    `SELECT DISTINCT c.id AS customer_id, c.customer_code, c.customer_name
     FROM customers c
     JOIN master_leases ml ON ml.customer_id = c.id AND ml.status = 'Active'
     JOIN lease_riders lr ON lr.master_lease_id = ml.id AND lr.status = 'Active'
     WHERE c.is_active = TRUE
       AND lr.rate_per_car IS NOT NULL
       AND lr.rate_per_car > 0
     ORDER BY c.customer_code`
  );

  for (const cust of customers) {
    try {
      await transaction(async (client) => {
        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(cust.customer_id, fiscalYear, fiscalMonth);

        // Create the invoice header
        const invoiceRows = await client.query(
          `INSERT INTO outbound_invoices (
            invoice_number, customer_id, billing_period_start, billing_period_end,
            fiscal_year, fiscal_month, invoice_type, status, generated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, 'rental', 'draft', $7)
          RETURNING *`,
          [invoiceNumber, cust.customer_id, periodStartStr, periodEndStr, fiscalYear, fiscalMonth, generatedBy]
        );
        const invoice = invoiceRows.rows[0];

        // Get all active riders for this customer with their cars
        const riderCars = await client.query(
          `SELECT
             lr.id AS rider_id,
             lr.rider_id AS rider_code,
             lr.rider_name,
             lr.rate_per_car,
             rc.car_number,
             rc.added_date,
             rc.removed_date
           FROM lease_riders lr
           JOIN master_leases ml ON ml.id = lr.master_lease_id
           JOIN rider_cars rc ON rc.rider_id = lr.id
           WHERE ml.customer_id = $1
             AND lr.status = 'Active'
             AND ml.status = 'Active'
             AND lr.rate_per_car IS NOT NULL
             AND lr.rate_per_car > 0
             AND rc.added_date <= $2
             AND (rc.removed_date IS NULL OR rc.removed_date >= $3)
           ORDER BY lr.rider_id, rc.car_number`,
          [cust.customer_id, periodEndStr, periodStartStr]
        );

        let lineNumber = 0;
        let rentalTotal = 0;

        for (const rc of riderCars.rows) {
          // Calculate pro-rated days
          const carAddedDate = new Date(rc.added_date);
          const carRemovedDate = rc.removed_date ? new Date(rc.removed_date) : null;

          // Billable start: later of period start or car added date
          const billableStart = carAddedDate > periodStart ? carAddedDate : periodStart;
          // Billable end: earlier of period end or car removed date
          const billableEnd = carRemovedDate && carRemovedDate < periodEnd ? carRemovedDate : periodEnd;

          // Calculate billable days (inclusive of both start and end)
          const billableDays = Math.max(
            0,
            Math.floor((billableEnd.getTime() - billableStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          );

          if (billableDays <= 0) continue;

          // Pro-rate: (rate / days_in_month) * billable_days
          const dailyRate = Number(rc.rate_per_car) / daysInMonth;
          const lineTotal = Math.round(dailyRate * billableDays * 100) / 100;

          lineNumber++;
          const isProrated = billableDays < daysInMonth;
          const description = isProrated
            ? `Rental - ${rc.car_number} on ${rc.rider_code} (${billableDays}/${daysInMonth} days)`
            : `Rental - ${rc.car_number} on ${rc.rider_code}`;

          await client.query(
            `INSERT INTO outbound_invoice_lines (
              invoice_id, line_number, line_type, description,
              rider_id, car_number, quantity, unit_rate, line_total
            ) VALUES ($1, $2, 'rental', $3, $4, $5, $6, $7, $8)`,
            [
              invoice.id,
              lineNumber,
              description,
              rc.rider_id,
              rc.car_number,
              billableDays,
              dailyRate,
              lineTotal,
            ]
          );

          rentalTotal += lineTotal;
        }

        // Apply any approved adjustments for this customer
        const adjustments = await client.query(
          `SELECT id, adjustment_type, amount, description, car_number, rider_id
           FROM billing_adjustments
           WHERE customer_id = $1
             AND status = 'approved'
             AND applied_to_invoice_id IS NULL
           ORDER BY created_at`,
          [cust.customer_id]
        );

        let adjustmentTotal = 0;
        for (const adj of adjustments.rows) {
          lineNumber++;
          const adjAmount = Number(adj.amount);
          const lineType: LineType = adjAmount < 0 ? 'credit' : 'adjustment';

          await client.query(
            `INSERT INTO outbound_invoice_lines (
              invoice_id, line_number, line_type, description,
              rider_id, car_number, quantity, unit_rate, line_total, reference_id
            ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $7, $8)`,
            [
              invoice.id,
              lineNumber,
              lineType,
              adj.description,
              adj.rider_id || null,
              adj.car_number || null,
              adjAmount,
              adj.id,
            ]
          );

          // Mark adjustment as applied
          await client.query(
            `UPDATE billing_adjustments
             SET status = 'applied', applied_to_invoice_id = $1, applied_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [invoice.id, adj.id]
          );

          adjustmentTotal += adjAmount;
        }

        // Update invoice totals
        const invoiceTotal = rentalTotal + adjustmentTotal;
        const updatedRows = await client.query(
          `UPDATE outbound_invoices
           SET rental_total = $2,
               adjustment_total = $3,
               invoice_total = $4,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [invoice.id, rentalTotal, adjustmentTotal, invoiceTotal]
        );

        generatedInvoices.push(updatedRows.rows[0]);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Customer ${cust.customer_code}: ${message}`);
    }
  }

  const totalAmount = generatedInvoices.reduce((sum, inv) => sum + Number(inv.invoice_total), 0);

  return { invoices: generatedInvoices, totalAmount, errors };
}

// ============================================================================
// 2. RATE MANAGEMENT
// ============================================================================

/**
 * Get the rate change history for a given rider.
 */
export async function getRateHistory(riderId: string): Promise<RateHistory[]> {
  return query<RateHistory>(
    `SELECT rh.*,
            lr.rider_id AS rider_code,
            lr.rider_name
     FROM rate_history rh
     JOIN lease_riders lr ON lr.id = rh.rider_id
     WHERE rh.rider_id = $1
     ORDER BY rh.effective_date DESC, rh.created_at DESC`,
    [riderId]
  );
}

/**
 * Update a rider's rate. Creates a rate_history record and updates
 * lease_riders.rate_per_car within a single transaction.
 */
export async function updateRate(
  riderId: string,
  newRate: number,
  effectiveDate: string,
  changeType: RateChangeType,
  reason: string,
  changedBy: string
): Promise<RateHistory> {
  return transaction(async (client) => {
    // Get the current rate
    const currentRow = await client.query(
      'SELECT rate_per_car FROM lease_riders WHERE id = $1',
      [riderId]
    );
    if (currentRow.rows.length === 0) {
      throw new Error(`Rider not found: ${riderId}`);
    }
    const previousRate = currentRow.rows[0].rate_per_car;

    // Insert rate history record
    const historyRow = await client.query(
      `INSERT INTO rate_history (
        rider_id, previous_rate, new_rate, effective_date,
        change_type, change_reason, changed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [riderId, previousRate, newRate, effectiveDate, changeType, reason, changedBy]
    );

    // Update the rider's current rate
    await client.query(
      `UPDATE lease_riders
       SET rate_per_car = $2, updated_at = NOW()
       WHERE id = $1`,
      [riderId, newRate]
    );

    return historyRow.rows[0];
  });
}

// ============================================================================
// 3. MILEAGE
// ============================================================================

/**
 * Register a new mileage file upload.
 */
export async function createMileageFile(
  filename: string,
  fileType: string,
  reportingPeriod: string,
  uploadedBy: string
): Promise<MileageFile> {
  const rows = await query<MileageFile>(
    `INSERT INTO mileage_files (filename, file_type, reporting_period, uploaded_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [filename, fileType, reportingPeriod, uploadedBy]
  );
  return rows[0];
}

/**
 * Bulk-insert mileage records for a given file.
 * Updates the file's record_count and status upon completion.
 */
export async function importMileageRecords(
  fileId: string,
  records: {
    car_number: string;
    customer_id?: string;
    rider_id?: string;
    reporting_period: string;
    miles: number;
    source?: string;
    notes?: string;
  }[]
): Promise<{ imported: number; errors: number }> {
  if (records.length === 0) return { imported: 0, errors: 0 };

  // Mark file as processing
  await query(
    `UPDATE mileage_files SET status = 'processing' WHERE id = $1`,
    [fileId]
  );

  let imported = 0;
  let errorCount = 0;

  // Build batch insert for efficiency
  const values: string[] = [];
  const params: (string | number | null)[] = [];
  let paramIndex = 1;

  for (const rec of records) {
    values.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
    );
    params.push(
      fileId,
      rec.car_number,
      rec.customer_id || null,
      rec.rider_id || null,
      rec.reporting_period,
      rec.miles,
      rec.source || 'railinc',
      rec.notes || null
    );
  }

  try {
    await query(
      `INSERT INTO mileage_records (
        mileage_file_id, car_number, customer_id, rider_id,
        reporting_period, miles, source, notes
      ) VALUES ${values.join(', ')}
      ON CONFLICT (car_number, reporting_period) DO UPDATE
        SET miles = EXCLUDED.miles,
            mileage_file_id = EXCLUDED.mileage_file_id,
            customer_id = COALESCE(EXCLUDED.customer_id, mileage_records.customer_id),
            rider_id = COALESCE(EXCLUDED.rider_id, mileage_records.rider_id),
            source = EXCLUDED.source,
            notes = EXCLUDED.notes`,
      params
    );
    imported = records.length;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ fileId, message }, 'Mileage import error');
    errorCount = records.length;
  }

  // Update file stats
  await query(
    `UPDATE mileage_files
     SET record_count = $2,
         processed_count = $3,
         error_count = $4,
         status = CASE WHEN $4 > 0 THEN 'error' ELSE 'processed' END,
         processed_at = NOW()
     WHERE id = $1`,
    [fileId, records.length, imported, errorCount]
  );

  return { imported, errors: errorCount };
}

/**
 * Mark a mileage record as verified.
 */
export async function verifyMileageRecord(
  recordId: string,
  verifiedBy: string
): Promise<MileageRecord | null> {
  const rows = await query<MileageRecord>(
    `UPDATE mileage_records
     SET status = 'verified',
         verified_by = $2,
         verified_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [recordId, verifiedBy]
  );
  return rows[0] || null;
}

/**
 * Get aggregated mileage summary for a customer and period.
 */
export async function getMileageSummary(
  customerId: string,
  period: string
): Promise<MileageSummary | null> {
  return queryOne<MileageSummary>(
    `SELECT
       mr.customer_id,
       c.customer_code,
       c.customer_name,
       mr.reporting_period,
       COUNT(*)::integer AS total_records,
       COALESCE(SUM(mr.miles), 0)::integer AS total_miles,
       COUNT(*) FILTER (WHERE mr.status = 'verified')::integer AS verified_records,
       COUNT(*) FILTER (WHERE mr.status = 'pending')::integer AS pending_records,
       COUNT(*) FILTER (WHERE mr.status = 'disputed')::integer AS disputed_records
     FROM mileage_records mr
     JOIN customers c ON c.id = mr.customer_id
     WHERE mr.customer_id = $1
       AND mr.reporting_period = $2
     GROUP BY mr.customer_id, c.customer_code, c.customer_name, mr.reporting_period`,
    [customerId, period]
  );
}

// ============================================================================
// 4. CHARGEBACKS
// ============================================================================

/**
 * Create a new chargeback.
 */
export async function createChargeback(data: {
  customer_id: string;
  car_number: string;
  rider_id?: string;
  allocation_id?: string;
  chargeback_type: ChargebackType;
  amount: number;
  description: string;
  brc_file_path?: string;
  brc_500byte_data?: string;
  submitted_by?: string;
}): Promise<Chargeback> {
  const rows = await query<Chargeback>(
    `INSERT INTO chargebacks (
      customer_id, car_number, rider_id, allocation_id,
      chargeback_type, amount, description,
      brc_file_path, brc_500byte_data, submitted_by,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
    RETURNING *`,
    [
      data.customer_id,
      data.car_number,
      data.rider_id || null,
      data.allocation_id || null,
      data.chargeback_type,
      data.amount,
      data.description,
      data.brc_file_path || null,
      data.brc_500byte_data || null,
      data.submitted_by || null,
    ]
  );
  return rows[0];
}

/**
 * List chargebacks with optional filters.
 */
export async function listChargebacks(filters: {
  status?: ChargebackStatus;
  customer_id?: string;
  car_number?: string;
  chargeback_type?: ChargebackType;
  limit?: number;
  offset?: number;
}): Promise<{ chargebacks: Chargeback[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`cb.status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.customer_id) {
    conditions.push(`cb.customer_id = $${paramIndex++}`);
    params.push(filters.customer_id);
  }
  if (filters.car_number) {
    conditions.push(`cb.car_number = $${paramIndex++}`);
    params.push(filters.car_number);
  }
  if (filters.chargeback_type) {
    conditions.push(`cb.chargeback_type = $${paramIndex++}`);
    params.push(filters.chargeback_type);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM chargebacks cb ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const chargebacks = await query<Chargeback>(
    `SELECT cb.*,
            c.customer_code,
            c.customer_name
     FROM chargebacks cb
     JOIN customers c ON c.id = cb.customer_id
     ${whereClause}
     ORDER BY
       CASE cb.status
         WHEN 'pending_review' THEN 1
         WHEN 'draft' THEN 2
         WHEN 'approved' THEN 3
         WHEN 'invoiced' THEN 4
         ELSE 5
       END,
       cb.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return { chargebacks, total };
}

/**
 * Review (approve or reject) a chargeback.
 */
export async function reviewChargeback(
  id: string,
  reviewedBy: string,
  approved: boolean,
  notes?: string
): Promise<Chargeback | null> {
  const newStatus: ChargebackStatus = approved ? 'approved' : 'void';
  const rows = await query<Chargeback>(
    `UPDATE chargebacks
     SET status = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         review_notes = $4,
         updated_at = NOW()
     WHERE id = $1
       AND status IN ('draft', 'pending_review')
     RETURNING *`,
    [id, newStatus, reviewedBy, notes || null]
  );
  return rows[0] || null;
}

/**
 * Generate a chargeback invoice from approved chargebacks for a customer.
 */
export async function generateChargebackInvoice(
  customerId: string,
  fiscalYear: number,
  fiscalMonth: number,
  generatedBy: string
): Promise<OutboundInvoice | null> {
  return transaction(async (client) => {
    // Get approved, un-invoiced chargebacks for the customer
    const chargebackRows = await client.query(
      `SELECT id, car_number, chargeback_type, amount, description, rider_id
       FROM chargebacks
       WHERE customer_id = $1
         AND status = 'approved'
         AND applied_to_invoice_id IS NULL
       ORDER BY created_at`,
      [customerId]
    );

    if (chargebackRows.rows.length === 0) return null;

    const periodStart = new Date(fiscalYear, fiscalMonth - 1, 1);
    const periodEnd = new Date(fiscalYear, fiscalMonth, 0);
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(customerId, fiscalYear, fiscalMonth);

    // Create invoice header
    const invoiceRow = await client.query(
      `INSERT INTO outbound_invoices (
        invoice_number, customer_id, billing_period_start, billing_period_end,
        fiscal_year, fiscal_month, invoice_type, status, generated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'chargeback', 'draft', $7)
      RETURNING *`,
      [invoiceNumber, customerId, periodStartStr, periodEndStr, fiscalYear, fiscalMonth, generatedBy]
    );
    const invoice = invoiceRow.rows[0];

    let chargebackTotal = 0;
    let lineNumber = 0;

    for (const cb of chargebackRows.rows) {
      lineNumber++;
      const amount = Number(cb.amount);

      await client.query(
        `INSERT INTO outbound_invoice_lines (
          invoice_id, line_number, line_type, description,
          rider_id, car_number, quantity, unit_rate, line_total, reference_id
        ) VALUES ($1, $2, 'chargeback', $3, $4, $5, 1, $6, $6, $7)`,
        [
          invoice.id,
          lineNumber,
          `${cb.chargeback_type}: ${cb.description}`,
          cb.rider_id || null,
          cb.car_number,
          amount,
          cb.id,
        ]
      );

      // Mark chargeback as invoiced
      await client.query(
        `UPDATE chargebacks
         SET status = 'invoiced', applied_to_invoice_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [invoice.id, cb.id]
      );

      chargebackTotal += amount;
    }

    // Update invoice totals
    const updatedRows = await client.query(
      `UPDATE outbound_invoices
       SET chargeback_total = $2,
           invoice_total = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [invoice.id, chargebackTotal]
    );

    return updatedRows.rows[0];
  });
}

// ============================================================================
// 5. ADJUSTMENTS
// ============================================================================

/**
 * Create a billing adjustment (manual or auto-generated from events).
 */
export async function createAdjustment(data: {
  customer_id: string;
  rider_id?: string;
  car_number?: string;
  adjustment_type: AdjustmentType;
  amount: number;
  description: string;
  source_event?: string;
  source_event_id?: string;
  requested_by?: string;
}): Promise<BillingAdjustment> {
  const rows = await query<BillingAdjustment>(
    `INSERT INTO billing_adjustments (
      customer_id, rider_id, car_number,
      adjustment_type, amount, description,
      source_event, source_event_id, requested_by,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
    RETURNING *`,
    [
      data.customer_id,
      data.rider_id || null,
      data.car_number || null,
      data.adjustment_type,
      data.amount,
      data.description,
      data.source_event || null,
      data.source_event_id || null,
      data.requested_by || null,
    ]
  );
  return rows[0];
}

/**
 * List pending adjustments, optionally filtered by customer.
 */
export async function listPendingAdjustments(
  customerId?: string
): Promise<BillingAdjustment[]> {
  if (customerId) {
    return query<BillingAdjustment>(
      `SELECT ba.*,
              c.customer_code,
              c.customer_name
       FROM billing_adjustments ba
       JOIN customers c ON c.id = ba.customer_id
       WHERE ba.status = 'pending'
         AND ba.customer_id = $1
       ORDER BY ba.created_at`,
      [customerId]
    );
  }

  return query<BillingAdjustment>(
    `SELECT ba.*,
            c.customer_code,
            c.customer_name
     FROM billing_adjustments ba
     JOIN customers c ON c.id = ba.customer_id
     WHERE ba.status = 'pending'
     ORDER BY ba.created_at`
  );
}

/**
 * Approve a pending adjustment.
 */
export async function approveAdjustment(
  id: string,
  approvedBy: string
): Promise<BillingAdjustment | null> {
  const rows = await query<BillingAdjustment>(
    `UPDATE billing_adjustments
     SET status = 'approved',
         approved_by = $2,
         approved_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND status = 'pending'
     RETURNING *`,
    [id, approvedBy]
  );
  return rows[0] || null;
}

/**
 * Reject a pending adjustment.
 */
export async function rejectAdjustment(
  id: string,
  approvedBy: string,
  reason: string
): Promise<BillingAdjustment | null> {
  const rows = await query<BillingAdjustment>(
    `UPDATE billing_adjustments
     SET status = 'rejected',
         approved_by = $2,
         approved_at = NOW(),
         rejection_reason = $3,
         updated_at = NOW()
     WHERE id = $1
       AND status = 'pending'
     RETURNING *`,
    [id, approvedBy, reason]
  );
  return rows[0] || null;
}

// ============================================================================
// 6. BILLING RUNS
// ============================================================================

/**
 * Create and execute a billing run. Orchestrates preflight checks
 * and invoice generation for the given period.
 */
export async function createBillingRun(
  fiscalYear: number,
  fiscalMonth: number,
  runType: BillingRunType,
  initiatedBy: string
): Promise<BillingRun> {
  // Create billing run record
  const runRows = await query<BillingRun>(
    `INSERT INTO billing_runs (
      fiscal_year, fiscal_month, run_type, status, initiated_by
    ) VALUES ($1, $2, $3, 'preflight', $4)
    RETURNING *`,
    [fiscalYear, fiscalMonth, runType, initiatedBy]
  );
  const billingRun = runRows[0];

  try {
    // Run preflight checks
    const preflight = await runPreflight(fiscalYear, fiscalMonth);

    await query(
      `UPDATE billing_runs
       SET preflight_passed = $2,
           preflight_results = $3
       WHERE id = $1`,
      [billingRun.id, preflight.passed, JSON.stringify(preflight)]
    );

    if (!preflight.passed) {
      await query(
        `UPDATE billing_runs
         SET status = 'failed',
             errors = $2
         WHERE id = $1`,
        [billingRun.id, JSON.stringify({ reason: 'Preflight checks failed', checks: preflight.checks })]
      );

      return (await queryOne<BillingRun>('SELECT * FROM billing_runs WHERE id = $1', [billingRun.id]))!;
    }

    // Update status to generating
    await query(
      `UPDATE billing_runs SET status = 'generating' WHERE id = $1`,
      [billingRun.id]
    );

    // Generate invoices based on run type
    let invoiceResult: { invoices: OutboundInvoice[]; totalAmount: number; errors: string[] } | null = null;

    if (runType === 'rental' || runType === 'full') {
      invoiceResult = await generateMonthlyInvoices(fiscalYear, fiscalMonth, initiatedBy);
    }

    // Update billing run with results
    const invoicesGenerated = invoiceResult?.invoices.length || 0;
    const totalAmount = invoiceResult?.totalAmount || 0;
    const runErrors = invoiceResult?.errors || [];

    const finalStatus: BillingRunStatus = runErrors.length > 0 ? 'review' : 'review';

    await query(
      `UPDATE billing_runs
       SET status = $2,
           invoices_generated = $3,
           total_amount = $4,
           error_count = $5,
           errors = $6
       WHERE id = $1`,
      [
        billingRun.id,
        finalStatus,
        invoicesGenerated,
        totalAmount,
        runErrors.length,
        runErrors.length > 0 ? JSON.stringify(runErrors) : null,
      ]
    );

    return (await queryOne<BillingRun>('SELECT * FROM billing_runs WHERE id = $1', [billingRun.id]))!;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    await query(
      `UPDATE billing_runs
       SET status = 'failed',
           errors = $2
       WHERE id = $1`,
      [billingRun.id, JSON.stringify({ error: message })]
    );

    return (await queryOne<BillingRun>('SELECT * FROM billing_runs WHERE id = $1', [billingRun.id]))!;
  }
}

/**
 * Get a billing run by ID with its current status and results.
 */
export async function getBillingRun(id: string): Promise<BillingRun | null> {
  return queryOne<BillingRun>(
    'SELECT * FROM billing_runs WHERE id = $1',
    [id]
  );
}

/**
 * List billing runs with pagination.
 */
export async function listBillingRuns(
  limit: number = 20,
  offset: number = 0
): Promise<{ runs: BillingRun[]; total: number }> {
  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) AS count FROM billing_runs'
  );
  const total = parseInt(countResult?.count || '0', 10);

  const runs = await query<BillingRun>(
    `SELECT * FROM billing_runs
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { runs, total };
}

// ============================================================================
// 7. REPORTING
// ============================================================================

/**
 * Get aggregate billing summary for a fiscal period.
 */
export async function getBillingSummary(
  fiscalYear: number,
  fiscalMonth: number
): Promise<BillingSummary> {
  const result = await queryOne<{
    total_invoices: string;
    total_rental: string;
    total_mileage: string;
    total_chargebacks: string;
    total_adjustments: string;
    grand_total: string;
    draft_count: string;
    approved_count: string;
    sent_count: string;
    paid_count: string;
  }>(
    `SELECT
       COUNT(*)::text AS total_invoices,
       COALESCE(SUM(rental_total), 0)::text AS total_rental,
       COALESCE(SUM(mileage_total), 0)::text AS total_mileage,
       COALESCE(SUM(chargeback_total), 0)::text AS total_chargebacks,
       COALESCE(SUM(adjustment_total), 0)::text AS total_adjustments,
       COALESCE(SUM(invoice_total), 0)::text AS grand_total,
       COUNT(*) FILTER (WHERE status = 'draft')::text AS draft_count,
       COUNT(*) FILTER (WHERE status = 'approved')::text AS approved_count,
       COUNT(*) FILTER (WHERE status IN ('sent', 'sent_to_sap'))::text AS sent_count,
       COUNT(*) FILTER (WHERE status = 'paid')::text AS paid_count
     FROM outbound_invoices
     WHERE fiscal_year = $1
       AND fiscal_month = $2
       AND status != 'void'`,
    [fiscalYear, fiscalMonth]
  );

  return {
    fiscal_year: fiscalYear,
    fiscal_month: fiscalMonth,
    total_invoices: parseInt(result?.total_invoices || '0', 10),
    total_rental: parseFloat(result?.total_rental || '0'),
    total_mileage: parseFloat(result?.total_mileage || '0'),
    total_chargebacks: parseFloat(result?.total_chargebacks || '0'),
    total_adjustments: parseFloat(result?.total_adjustments || '0'),
    grand_total: parseFloat(result?.grand_total || '0'),
    draft_count: parseInt(result?.draft_count || '0', 10),
    approved_count: parseInt(result?.approved_count || '0', 10),
    sent_count: parseInt(result?.sent_count || '0', 10),
    paid_count: parseInt(result?.paid_count || '0', 10),
  };
}

/**
 * Get a customer's invoice history with pagination.
 */
export async function getCustomerInvoiceHistory(
  customerId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ invoices: OutboundInvoice[]; total: number }> {
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM outbound_invoices
     WHERE customer_id = $1`,
    [customerId]
  );
  const total = parseInt(countResult?.count || '0', 10);

  const invoices = await query<OutboundInvoice>(
    `SELECT oi.*,
            c.customer_code,
            c.customer_name
     FROM outbound_invoices oi
     JOIN customers c ON c.id = oi.customer_id
     WHERE oi.customer_id = $1
     ORDER BY oi.fiscal_year DESC, oi.fiscal_month DESC, oi.created_at DESC
     LIMIT $2 OFFSET $3`,
    [customerId, limit, offset]
  );

  return { invoices, total };
}

/**
 * List outbound invoices with optional filters.
 */
export async function listOutboundInvoices(filters: {
  status?: OutboundInvoiceStatus;
  customer_id?: string;
  invoice_type?: InvoiceType;
  fiscal_year?: number;
  fiscal_month?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ invoices: OutboundInvoice[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`oi.status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.customer_id) {
    conditions.push(`oi.customer_id = $${paramIndex++}`);
    params.push(filters.customer_id);
  }
  if (filters.invoice_type) {
    conditions.push(`oi.invoice_type = $${paramIndex++}`);
    params.push(filters.invoice_type);
  }
  if (filters.fiscal_year) {
    conditions.push(`oi.fiscal_year = $${paramIndex++}`);
    params.push(filters.fiscal_year);
  }
  if (filters.fiscal_month) {
    conditions.push(`oi.fiscal_month = $${paramIndex++}`);
    params.push(filters.fiscal_month);
  }
  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    conditions.push(`(
      oi.invoice_number ILIKE $${paramIndex++}
      OR c.customer_code ILIKE $${paramIndex++}
      OR c.customer_name ILIKE $${paramIndex++}
    )`);
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM outbound_invoices oi
     JOIN customers c ON c.id = oi.customer_id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const invoices = await query<OutboundInvoice>(
    `SELECT oi.*,
            c.customer_code,
            c.customer_name
     FROM outbound_invoices oi
     JOIN customers c ON c.id = oi.customer_id
     ${whereClause}
     ORDER BY oi.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return { invoices, total };
}

/**
 * Get a single outbound invoice with its line items.
 */
export async function getOutboundInvoice(
  id: string
): Promise<{ invoice: OutboundInvoice; lines: OutboundInvoiceLine[] } | null> {
  const invoice = await queryOne<OutboundInvoice>(
    `SELECT oi.*,
            c.customer_code,
            c.customer_name
     FROM outbound_invoices oi
     JOIN customers c ON c.id = oi.customer_id
     WHERE oi.id = $1`,
    [id]
  );
  if (!invoice) return null;

  const lines = await query<OutboundInvoiceLine>(
    `SELECT * FROM outbound_invoice_lines
     WHERE invoice_id = $1
     ORDER BY line_number`,
    [id]
  );

  return { invoice, lines };
}

/**
 * Approve an outbound invoice (transition from draft/pending_review to approved).
 */
export async function approveOutboundInvoice(
  id: string,
  approvedBy: string
): Promise<OutboundInvoice | null> {
  const rows = await query<OutboundInvoice>(
    `UPDATE outbound_invoices
     SET status = 'approved',
         approved_by = $2,
         approved_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND status IN ('draft', 'pending_review')
     RETURNING *`,
    [id, approvedBy]
  );
  return rows[0] || null;
}

/**
 * Void an outbound invoice. Records the reason for audit trail.
 */
export async function voidOutboundInvoice(
  id: string,
  reason: string
): Promise<OutboundInvoice | null> {
  const rows = await query<OutboundInvoice>(
    `UPDATE outbound_invoices
     SET status = 'void',
         notes = COALESCE(notes || E'\\n', '') || 'VOIDED: ' || $2,
         updated_at = NOW()
     WHERE id = $1
       AND status NOT IN ('void', 'paid')
     RETURNING *`,
    [id, reason]
  );
  return rows[0] || null;
}

// ============================================================================
// 8. BILLING RUN APPROVAL
// ============================================================================

/**
 * Approve a billing run (transition from review to approved).
 * This marks the billing run as approved for posting to SAP.
 */
export async function approveBillingRun(
  id: string,
  approvedBy: string,
  notes?: string
): Promise<BillingRun | null> {
  const rows = await query<BillingRun>(
    `UPDATE billing_runs
     SET status = 'approved',
         approved_by = $2,
         approved_at = NOW(),
         review_notes = $3,
         current_step = 'approved'
     WHERE id = $1
       AND status = 'review'
     RETURNING *`,
    [id, approvedBy, notes || null]
  );
  return rows[0] || null;
}

/**
 * Complete a billing run (mark as completed after SAP posting or final review).
 */
export async function completeBillingRun(
  id: string
): Promise<BillingRun | null> {
  const rows = await query<BillingRun>(
    `UPDATE billing_runs
     SET status = 'completed',
         completed_at = NOW(),
         current_step = 'completed'
     WHERE id = $1
       AND status IN ('approved', 'posting')
     RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

// ============================================================================
// 9. COST ALLOCATION
// ============================================================================

export interface CostAllocationEntry {
  id: string;
  allocation_id: string;
  customer_id: string;
  car_number: string;
  labor_cost: number;
  material_cost: number;
  freight_cost: number;
  total_cost: number;
  billing_entity: string;
  lessee_share_pct: number;
  owner_share_pct: number;
  lessee_amount: number;
  owner_amount: number;
  applied_to_invoice_id: string | null;
  applied_at: string | null;
  brc_number: string | null;
  shopping_event_id: string | null;
  scope_of_work_id: string | null;
  status: string;
  allocated_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  customer_code?: string;
  customer_name?: string;
}

export interface CostAllocationSummary {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  billing_month: string;
  allocation_count: number;
  total_cost: number;
  labor_total: number;
  material_total: number;
  freight_total: number;
  lessee_billable: number;
  owner_absorbed: number;
  pending_count: number;
  allocated_count: number;
  invoiced_count: number;
}

/**
 * Create a cost allocation entry for a completed allocation.
 */
export async function createCostAllocationEntry(data: {
  allocation_id: string;
  customer_id: string;
  car_number: string;
  labor_cost?: number;
  material_cost?: number;
  freight_cost?: number;
  total_cost: number;
  billing_entity?: string;
  lessee_share_pct?: number;
  brc_number?: string;
  shopping_event_id?: string;
  scope_of_work_id?: string;
  allocated_by?: string;
  notes?: string;
}): Promise<CostAllocationEntry> {
  const ownerPct = 100 - (data.lessee_share_pct || 0);
  const lesseeAmount = Math.round(data.total_cost * (data.lessee_share_pct || 0) / 100 * 100) / 100;
  const ownerAmount = Math.round(data.total_cost * ownerPct / 100 * 100) / 100;

  const rows = await query<CostAllocationEntry>(
    `INSERT INTO cost_allocation_entries (
      allocation_id, customer_id, car_number,
      labor_cost, material_cost, freight_cost, total_cost,
      billing_entity, lessee_share_pct, owner_share_pct,
      lessee_amount, owner_amount,
      brc_number, shopping_event_id, scope_of_work_id,
      status, allocated_by, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'allocated', $16, $17)
    RETURNING *`,
    [
      data.allocation_id,
      data.customer_id,
      data.car_number,
      data.labor_cost || 0,
      data.material_cost || 0,
      data.freight_cost || 0,
      data.total_cost,
      data.billing_entity || 'owner',
      data.lessee_share_pct || 0,
      ownerPct,
      lesseeAmount,
      ownerAmount,
      data.brc_number || null,
      data.shopping_event_id || null,
      data.scope_of_work_id || null,
      data.allocated_by || null,
      data.notes || null,
    ]
  );
  return rows[0];
}

/**
 * Get cost allocation summary by customer for a billing period.
 */
export async function getCostAllocationSummary(
  fiscalYear: number,
  fiscalMonth: number
): Promise<CostAllocationSummary[]> {
  const periodStart = `${fiscalYear}-${String(fiscalMonth).padStart(2, '0')}-01`;
  return query<CostAllocationSummary>(
    `SELECT
       c.id AS customer_id,
       c.customer_code,
       c.customer_name,
       $1::date AS billing_month,
       COUNT(cae.id)::integer AS allocation_count,
       COALESCE(SUM(cae.total_cost), 0)::numeric AS total_cost,
       COALESCE(SUM(cae.labor_cost), 0)::numeric AS labor_total,
       COALESCE(SUM(cae.material_cost), 0)::numeric AS material_total,
       COALESCE(SUM(cae.freight_cost), 0)::numeric AS freight_total,
       COALESCE(SUM(cae.lessee_amount), 0)::numeric AS lessee_billable,
       COALESCE(SUM(cae.owner_amount), 0)::numeric AS owner_absorbed,
       COUNT(CASE WHEN cae.status = 'pending' THEN 1 END)::integer AS pending_count,
       COUNT(CASE WHEN cae.status = 'allocated' THEN 1 END)::integer AS allocated_count,
       COUNT(CASE WHEN cae.status = 'invoiced' THEN 1 END)::integer AS invoiced_count
     FROM cost_allocation_entries cae
     JOIN allocations a ON a.id = cae.allocation_id
     JOIN customers c ON c.id = cae.customer_id
     WHERE a.target_month = $1
     GROUP BY c.id, c.customer_code, c.customer_name
     ORDER BY c.customer_name`,
    [periodStart]
  );
}

/**
 * List cost allocation entries with optional filters.
 */
export async function listCostAllocationEntries(filters: {
  customer_id?: string;
  allocation_id?: string;
  status?: string;
  billing_month?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: CostAllocationEntry[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.customer_id) {
    conditions.push(`cae.customer_id = $${paramIndex++}`);
    params.push(filters.customer_id);
  }
  if (filters.allocation_id) {
    conditions.push(`cae.allocation_id = $${paramIndex++}`);
    params.push(filters.allocation_id);
  }
  if (filters.status) {
    conditions.push(`cae.status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.billing_month) {
    conditions.push(`a.target_month = $${paramIndex++}`);
    params.push(filters.billing_month);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM cost_allocation_entries cae
     JOIN allocations a ON a.id = cae.allocation_id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const entries = await query<CostAllocationEntry>(
    `SELECT cae.*,
            c.customer_code,
            c.customer_name
     FROM cost_allocation_entries cae
     JOIN allocations a ON a.id = cae.allocation_id
     JOIN customers c ON c.id = cae.customer_id
     ${whereClause}
     ORDER BY cae.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return { entries, total };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Monthly Invoice Generation
  runPreflight,
  generateMonthlyInvoices,
  generateInvoiceNumber,
  // Rate Management
  getRateHistory,
  updateRate,
  // Mileage
  createMileageFile,
  importMileageRecords,
  verifyMileageRecord,
  getMileageSummary,
  // Chargebacks
  createChargeback,
  listChargebacks,
  reviewChargeback,
  generateChargebackInvoice,
  // Adjustments
  createAdjustment,
  listPendingAdjustments,
  approveAdjustment,
  rejectAdjustment,
  // Billing Runs
  createBillingRun,
  getBillingRun,
  listBillingRuns,
  approveBillingRun,
  completeBillingRun,
  // Cost Allocation
  createCostAllocationEntry,
  getCostAllocationSummary,
  listCostAllocationEntries,
  // Reporting
  getBillingSummary,
  getCustomerInvoiceHistory,
  listOutboundInvoices,
  getOutboundInvoice,
  approveOutboundInvoice,
  voidOutboundInvoice,
};
