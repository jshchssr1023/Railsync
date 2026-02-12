/**
 * Cross-Module Data Validation Service
 *
 * Provides comprehensive data integrity validation across all Railsync modules.
 * Checks for orphaned records, invalid references, stale data, and constraint violations.
 */

import { query } from '../config/database';

export interface ValidationResult {
  check_name: string;
  category: 'cars' | 'qualifications' | 'contracts' | 'allocations' | 'shopping' | 'invoices' | 'cross_module';
  status: 'pass' | 'warn' | 'fail';
  message: string;
  count: number;
  details?: any[];
}

/**
 * Run all validation checks and return consolidated report
 */
export async function runFullValidation(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Run all validation categories in parallel for efficiency
  const [
    carResults,
    qualResults,
    contractResults,
    allocationResults,
    shoppingResults,
    invoiceResults,
    crossModuleResults,
  ] = await Promise.all([
    validateCarIntegrity(),
    validateQualificationIntegrity(),
    validateContractIntegrity(),
    validateAllocationIntegrity(),
    validateShoppingIntegrity(),
    validateInvoiceIntegrity(),
    validateCrossModuleLinks(),
  ]);

  results.push(
    ...carResults,
    ...qualResults,
    ...contractResults,
    ...allocationResults,
    ...shoppingResults,
    ...invoiceResults,
    ...crossModuleResults
  );

  return results;
}

/**
 * Validate car data integrity
 */
export async function validateCarIntegrity(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check for cars with missing lessee_code
  const missingLesseeRows = await query<{ car_number: string; car_type: string; id: string }>(
    `SELECT id, car_number, car_type
     FROM cars
     WHERE lessee_code IS NULL OR lessee_code = ''
     ORDER BY car_number
     LIMIT 10`
  );
  const missingLesseeCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM cars WHERE lessee_code IS NULL OR lessee_code = ''`
  );

  results.push({
    check_name: 'cars_missing_lessee',
    category: 'cars',
    status: missingLesseeCount[0]?.count > 0 ? 'fail' : 'pass',
    message: `Cars without valid lessee_code assignment`,
    count: missingLesseeCount[0]?.count || 0,
    details: missingLesseeRows,
  });

  // Check for duplicate car_numbers
  const duplicateCarRows = await query<{ car_number: string; duplicate_count: number }>(
    `SELECT car_number, COUNT(*)::int AS duplicate_count
     FROM cars
     WHERE car_number IS NOT NULL
     GROUP BY car_number
     HAVING COUNT(*) > 1
     ORDER BY duplicate_count DESC
     LIMIT 10`
  );
  const duplicateCarCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM (
       SELECT car_number FROM cars WHERE car_number IS NOT NULL
       GROUP BY car_number HAVING COUNT(*) > 1
     ) AS dupes`
  );

  results.push({
    check_name: 'cars_duplicate_car_numbers',
    category: 'cars',
    status: duplicateCarCount[0]?.count > 0 ? 'fail' : 'pass',
    message: `Duplicate car_number entries in cars table`,
    count: duplicateCarCount[0]?.count || 0,
    details: duplicateCarRows,
  });

  // Check for orphaned cars (no allocations ever)
  const orphanedCarRows = await query<{ id: string; car_number: string; car_type: string; created_at: string }>(
    `SELECT c.id, c.car_number, c.car_type, c.created_at::text
     FROM cars c
     LEFT JOIN allocations a ON c.car_number = a.car_number OR c.id::text = a.car_id
     WHERE a.id IS NULL
       AND c.created_at < NOW() - INTERVAL '30 days'
     ORDER BY c.created_at
     LIMIT 10`
  );
  const orphanedCarCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM cars c
     LEFT JOIN allocations a ON c.car_number = a.car_number OR c.id::text = a.car_id
     WHERE a.id IS NULL AND c.created_at < NOW() - INTERVAL '30 days'`
  );

  results.push({
    check_name: 'cars_orphaned_no_allocations',
    category: 'cars',
    status: orphanedCarCount[0]?.count > 0 ? 'warn' : 'pass',
    message: `Cars created >30 days ago without any allocations`,
    count: orphanedCarCount[0]?.count || 0,
    details: orphanedCarRows,
  });

  return results;
}

/**
 * Validate qualification records integrity
 */
export async function validateQualificationIntegrity(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check for overdue qualifications without alerts
  const overdueNoAlertRows = await query<{
    qualification_id: string;
    car_number: string;
    qualification_type: string;
    next_due_date: string;
    days_overdue: number;
  }>(
    `SELECT
       q.id AS qualification_id,
       c.car_number,
       qt.name AS qualification_type,
       q.next_due_date::text,
       (CURRENT_DATE - q.next_due_date)::int AS days_overdue
     FROM qualifications q
     JOIN cars c ON q.car_id = c.id
     JOIN qualification_types qt ON q.qualification_type_id = qt.id
     LEFT JOIN qualification_alerts qa ON qa.qualification_id = q.id AND qa.alert_type = 'overdue'
     WHERE q.status = 'overdue'
       AND qa.id IS NULL
     ORDER BY days_overdue DESC
     LIMIT 10`
  );
  const overdueNoAlertCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM qualifications q
     LEFT JOIN qualification_alerts qa ON qa.qualification_id = q.id AND qa.alert_type = 'overdue'
     WHERE q.status = 'overdue' AND qa.id IS NULL`
  );

  results.push({
    check_name: 'qualifications_overdue_no_alert',
    category: 'qualifications',
    status: overdueNoAlertCount[0]?.count > 0 ? 'warn' : 'pass',
    message: `Overdue qualifications without alert records`,
    count: overdueNoAlertCount[0]?.count || 0,
    details: overdueNoAlertRows,
  });

  // Check for qualifications referencing non-existent cars
  const invalidCarRefRows = await query<{
    qualification_id: string;
    car_id: string;
    qualification_type: string;
  }>(
    `SELECT
       q.id AS qualification_id,
       q.car_id::text,
       qt.name AS qualification_type
     FROM qualifications q
     JOIN qualification_types qt ON q.qualification_type_id = qt.id
     LEFT JOIN cars c ON q.car_id = c.id
     WHERE c.id IS NULL
     LIMIT 10`
  );
  const invalidCarRefCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM qualifications q
     LEFT JOIN cars c ON q.car_id = c.id
     WHERE c.id IS NULL`
  );

  results.push({
    check_name: 'qualifications_invalid_car_reference',
    category: 'qualifications',
    status: invalidCarRefCount[0]?.count > 0 ? 'fail' : 'pass',
    message: `Qualifications referencing non-existent cars`,
    count: invalidCarRefCount[0]?.count || 0,
    details: invalidCarRefRows,
  });

  return results;
}

/**
 * Validate contract hierarchy integrity
 */
export async function validateContractIntegrity(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check for riders without valid leases
  const orphanedRiderRows = await query<{
    rider_id: string;
    rider_name: string;
    master_lease_id: string;
  }>(
    `SELECT
       lr.id AS rider_id,
       lr.rider_id,
       lr.rider_name,
       lr.master_lease_id::text
     FROM lease_riders lr
     LEFT JOIN master_leases ml ON lr.master_lease_id = ml.id
     WHERE ml.id IS NULL
     LIMIT 10`
  );
  const orphanedRiderCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM lease_riders lr
     LEFT JOIN master_leases ml ON lr.master_lease_id = ml.id
     WHERE ml.id IS NULL`
  );

  results.push({
    check_name: 'contracts_riders_without_lease',
    category: 'contracts',
    status: orphanedRiderCount[0]?.count > 0 ? 'fail' : 'pass',
    message: `Lease riders without valid master lease reference`,
    count: orphanedRiderCount[0]?.count || 0,
    details: orphanedRiderRows,
  });

  // Check for cars assigned to inactive/expired riders
  const inactiveRiderCarRows = await query<{
    car_number: string;
    rider_id: string;
    rider_status: string;
    expiration_date: string;
  }>(
    `SELECT
       rc.car_number,
       lr.rider_id,
       lr.status AS rider_status,
       lr.expiration_date::text
     FROM rider_cars rc
     JOIN lease_riders lr ON rc.rider_id = lr.id
     WHERE rc.status NOT IN ('off_rent', 'cancelled')
       AND (lr.status != 'Active' OR lr.expiration_date < CURRENT_DATE)
     LIMIT 10`
  );
  const inactiveRiderCarCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM rider_cars rc
     JOIN lease_riders lr ON rc.rider_id = lr.id
     WHERE rc.status NOT IN ('off_rent', 'cancelled')
       AND (lr.status != 'Active' OR lr.expiration_date < CURRENT_DATE)`
  );

  results.push({
    check_name: 'contracts_cars_on_inactive_riders',
    category: 'contracts',
    status: inactiveRiderCarCount[0]?.count > 0 ? 'warn' : 'pass',
    message: `Cars assigned to inactive or expired lease riders`,
    count: inactiveRiderCarCount[0]?.count || 0,
    details: inactiveRiderCarRows,
  });

  return results;
}

/**
 * Validate allocation data integrity
 */
export async function validateAllocationIntegrity(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check for allocations with non-existent car_ids
  const invalidCarIdRows = await query<{
    allocation_id: string;
    car_id: string;
    car_number: string;
    shop_code: string;
  }>(
    `SELECT
       a.id AS allocation_id,
       a.car_id,
       a.car_number,
       a.shop_code
     FROM allocations a
     LEFT JOIN cars c ON a.car_number = c.car_number OR a.car_id = c.id::text
     WHERE c.id IS NULL
       AND a.car_id IS NOT NULL
     LIMIT 10`
  );
  const invalidCarIdCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM allocations a
     LEFT JOIN cars c ON a.car_number = c.car_number OR a.car_id = c.id::text
     WHERE c.id IS NULL AND a.car_id IS NOT NULL`
  );

  results.push({
    check_name: 'allocations_invalid_car_reference',
    category: 'allocations',
    status: invalidCarIdCount[0]?.count > 0 ? 'fail' : 'pass',
    message: `Allocations referencing non-existent cars`,
    count: invalidCarIdCount[0]?.count || 0,
    details: invalidCarIdRows,
  });

  // Check for allocations with non-existent shop_codes
  const invalidShopRows = await query<{
    allocation_id: string;
    car_number: string;
    shop_code: string;
    target_month: string;
  }>(
    `SELECT
       a.id AS allocation_id,
       a.car_number,
       a.shop_code,
       a.target_month
     FROM allocations a
     LEFT JOIN shops s ON a.shop_code = s.shop_code
     WHERE s.shop_code IS NULL
     LIMIT 10`
  );
  const invalidShopCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM allocations a
     LEFT JOIN shops s ON a.shop_code = s.shop_code
     WHERE s.shop_code IS NULL`
  );

  results.push({
    check_name: 'allocations_invalid_shop_reference',
    category: 'allocations',
    status: invalidShopCount[0]?.count > 0 ? 'fail' : 'pass',
    message: `Allocations referencing non-existent shop codes`,
    count: invalidShopCount[0]?.count || 0,
    details: invalidShopRows,
  });

  // Check for double-booked cars (same car, overlapping months, both active)
  const doubleBookedRows = await query<{
    car_number: string;
    target_month: string;
    allocation_count: number;
    shop_codes: string;
  }>(
    `SELECT
       a.car_number,
       a.target_month,
       COUNT(*)::int AS allocation_count,
       STRING_AGG(a.shop_code, ', ') AS shop_codes
     FROM allocations a
     WHERE a.status NOT IN ('Released', 'Complete', 'cancelled')
     GROUP BY a.car_number, a.target_month
     HAVING COUNT(*) > 1
     ORDER BY allocation_count DESC
     LIMIT 10`
  );
  const doubleBookedCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM (
       SELECT a.car_number, a.target_month
       FROM allocations a
       WHERE a.status NOT IN ('Released', 'Complete', 'cancelled')
       GROUP BY a.car_number, a.target_month
       HAVING COUNT(*) > 1
     ) AS dupes`
  );

  results.push({
    check_name: 'allocations_double_booked_cars',
    category: 'allocations',
    status: doubleBookedCount[0]?.count > 0 ? 'fail' : 'pass',
    message: `Cars with multiple active allocations for the same month`,
    count: doubleBookedCount[0]?.count || 0,
    details: doubleBookedRows,
  });

  return results;
}

/**
 * Validate shopping event data integrity
 */
export async function validateShoppingIntegrity(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check for shopping events in non-terminal states older than 90 days (stale)
  const staleShoppingRows = await query<{
    event_id: string;
    event_number: string;
    car_number: string;
    shop_code: string;
    state: string;
    created_at: string;
    days_old: number;
  }>(
    `SELECT
       se.id AS event_id,
       se.event_number,
       se.car_number,
       se.shop_code,
       se.state,
       se.created_at::text,
       (CURRENT_DATE - se.created_at::date)::int AS days_old
     FROM shopping_events se
     WHERE se.state NOT IN ('RELEASED', 'CANCELLED')
       AND se.created_at < NOW() - INTERVAL '90 days'
     ORDER BY se.created_at
     LIMIT 10`
  );
  const staleShoppingCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM shopping_events se
     WHERE se.state NOT IN ('RELEASED', 'CANCELLED')
       AND se.created_at < NOW() - INTERVAL '90 days'`
  );

  results.push({
    check_name: 'shopping_events_stale',
    category: 'shopping',
    status: staleShoppingCount[0]?.count > 0 ? 'warn' : 'pass',
    message: `Shopping events in non-terminal states older than 90 days`,
    count: staleShoppingCount[0]?.count || 0,
    details: staleShoppingRows,
  });

  // Check for shopping events without linked allocations
  const noAllocationRows = await query<{
    event_id: string;
    event_number: string;
    car_number: string;
    shop_code: string;
    state: string;
  }>(
    `SELECT
       se.id AS event_id,
       se.event_number,
       se.car_number,
       se.shop_code,
       se.state
     FROM shopping_events se
     LEFT JOIN allocations a ON se.car_number = a.car_number AND se.shop_code = a.shop_code
     WHERE a.id IS NULL
       AND se.state NOT IN ('CANCELLED')
       AND se.created_at < NOW() - INTERVAL '7 days'
     LIMIT 10`
  );
  const noAllocationCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM shopping_events se
     LEFT JOIN allocations a ON se.car_number = a.car_number AND se.shop_code = a.shop_code
     WHERE a.id IS NULL
       AND se.state NOT IN ('CANCELLED')
       AND se.created_at < NOW() - INTERVAL '7 days'`
  );

  results.push({
    check_name: 'shopping_events_no_allocation',
    category: 'shopping',
    status: noAllocationCount[0]?.count > 0 ? 'warn' : 'pass',
    message: `Shopping events >7 days old without linked allocations`,
    count: noAllocationCount[0]?.count || 0,
    details: noAllocationRows,
  });

  return results;
}

/**
 * Validate invoice case data integrity
 */
export async function validateInvoiceIntegrity(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check for invoice cases stuck in non-terminal state >30 days
  const stuckInvoiceRows = await query<{
    case_id: string;
    case_number: string;
    workflow_state: string;
    vendor_name: string;
    state_changed_at: string;
    days_in_state: number;
  }>(
    `SELECT
       ic.id AS case_id,
       ic.case_number,
       ic.workflow_state,
       ic.vendor_name,
       ic.state_changed_at::text,
       (CURRENT_DATE - ic.state_changed_at::date)::int AS days_in_state
     FROM invoice_cases ic
     WHERE ic.workflow_state NOT IN ('CLOSED', 'PAID', 'SAP_POSTED', 'CANCELLED', 'BLOCKED')
       AND ic.state_changed_at < NOW() - INTERVAL '30 days'
     ORDER BY ic.state_changed_at
     LIMIT 10`
  );
  const stuckInvoiceCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM invoice_cases ic
     WHERE ic.workflow_state NOT IN ('CLOSED', 'PAID', 'SAP_POSTED', 'CANCELLED', 'BLOCKED')
       AND ic.state_changed_at < NOW() - INTERVAL '30 days'`
  );

  results.push({
    check_name: 'invoices_stuck_in_workflow',
    category: 'invoices',
    status: stuckInvoiceCount[0]?.count > 0 ? 'warn' : 'pass',
    message: `Invoice cases stuck in non-terminal state for >30 days`,
    count: stuckInvoiceCount[0]?.count || 0,
    details: stuckInvoiceRows,
  });

  // Check for invoice amounts exceeding configured threshold ($50k)
  const highValueInvoiceRows = await query<{
    case_id: string;
    case_number: string;
    workflow_state: string;
    vendor_name: string;
    total_amount: number;
    currency: string;
  }>(
    `SELECT
       ic.id AS case_id,
       ic.case_number,
       ic.workflow_state,
       ic.vendor_name,
       ic.total_amount,
       ic.currency
     FROM invoice_cases ic
     WHERE ic.total_amount > 50000
       AND ic.workflow_state NOT IN ('CLOSED', 'PAID')
     ORDER BY ic.total_amount DESC
     LIMIT 10`
  );
  const highValueInvoiceCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM invoice_cases ic
     WHERE ic.total_amount > 50000
       AND ic.workflow_state NOT IN ('CLOSED', 'PAID')`
  );

  results.push({
    check_name: 'invoices_high_value',
    category: 'invoices',
    status: highValueInvoiceCount[0]?.count > 0 ? 'warn' : 'pass',
    message: `Open invoice cases exceeding $50,000 threshold`,
    count: highValueInvoiceCount[0]?.count || 0,
    details: highValueInvoiceRows,
  });

  return results;
}

/**
 * Validate cross-module foreign key relationships
 */
export async function validateCrossModuleLinks(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check for shopping events referencing non-existent cars
  const shoppingInvalidCarRows = await query<{
    event_id: string;
    event_number: string;
    car_number: string;
    car_id: string;
  }>(
    `SELECT
       se.id AS event_id,
       se.event_number,
       se.car_number,
       se.car_id::text
     FROM shopping_events se
     LEFT JOIN cars c ON se.car_number = c.car_number OR se.car_id = c.id
     WHERE c.id IS NULL
     LIMIT 10`
  );
  const shoppingInvalidCarCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM shopping_events se
     LEFT JOIN cars c ON se.car_number = c.car_number OR se.car_id = c.id
     WHERE c.id IS NULL`
  );

  results.push({
    check_name: 'cross_module_shopping_invalid_car',
    category: 'cross_module',
    status: shoppingInvalidCarCount[0]?.count > 0 ? 'fail' : 'pass',
    message: `Shopping events referencing non-existent cars`,
    count: shoppingInvalidCarCount[0]?.count || 0,
    details: shoppingInvalidCarRows,
  });

  // Check for allocations referencing non-existent contracts (if rider data is used)
  const allocationInvalidContractRows = await query<{
    allocation_id: string;
    car_number: string;
    contract_number: string;
  }>(
    `SELECT
       a.id AS allocation_id,
       a.car_number,
       c.contract_number
     FROM allocations a
     JOIN cars c ON a.car_number = c.car_number OR a.car_id = c.id::text
     WHERE c.contract_number IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM master_leases ml WHERE ml.lease_id = c.contract_number
       )
     LIMIT 10`
  );
  const allocationInvalidContractCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM allocations a
     JOIN cars c ON a.car_number = c.car_number OR a.car_id = c.id::text
     WHERE c.contract_number IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM master_leases ml WHERE ml.lease_id = c.contract_number
       )`
  );

  results.push({
    check_name: 'cross_module_allocation_invalid_contract',
    category: 'cross_module',
    status: allocationInvalidContractCount[0]?.count > 0 ? 'warn' : 'pass',
    message: `Allocations for cars with contract references not in master_leases`,
    count: allocationInvalidContractCount[0]?.count || 0,
    details: allocationInvalidContractRows,
  });

  // Check for invoice cases without linked shopping events (where car_marks exist)
  const invoiceNoShoppingRows = await query<{
    case_id: string;
    case_number: string;
    car_marks: string[];
    invoice_type: string;
  }>(
    `SELECT
       ic.id AS case_id,
       ic.case_number,
       ic.car_marks,
       ic.invoice_type
     FROM invoice_cases ic
     WHERE ic.invoice_type = 'SHOP'
       AND ic.car_marks IS NOT NULL
       AND array_length(ic.car_marks, 1) > 0
       AND ic.workflow_state NOT IN ('BLOCKED', 'CANCELLED')
       AND NOT EXISTS (
         SELECT 1 FROM shopping_events se
         WHERE se.car_number = ANY(ic.car_marks)
           AND se.shop_code = ic.shop_code
       )
     LIMIT 10`
  );
  const invoiceNoShoppingCount = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM invoice_cases ic
     WHERE ic.invoice_type = 'SHOP'
       AND ic.car_marks IS NOT NULL
       AND array_length(ic.car_marks, 1) > 0
       AND ic.workflow_state NOT IN ('BLOCKED', 'CANCELLED')
       AND NOT EXISTS (
         SELECT 1 FROM shopping_events se
         WHERE se.car_number = ANY(ic.car_marks)
           AND se.shop_code = ic.shop_code
       )`
  );

  results.push({
    check_name: 'cross_module_invoice_no_shopping',
    category: 'cross_module',
    status: invoiceNoShoppingCount[0]?.count > 0 ? 'warn' : 'pass',
    message: `Shop invoices with car marks but no matching shopping events`,
    count: invoiceNoShoppingCount[0]?.count || 0,
    details: invoiceNoShoppingRows,
  });

  return results;
}
