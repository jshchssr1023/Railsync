/**
 * Data Reconciliation Service
 *
 * Post-migration discrepancy resolution for the CIPROTS-to-RailSync pipeline.
 * After CSV data is imported via migration-pipeline.service.ts, operators use
 * this service to find, review, and fix discrepancies between source and target
 * data. Operates on the parallel_run_discrepancies table.
 *
 * Table schema (parallel_run_discrepancies):
 *   id, run_id, entity_type, entity_id, discrepancy_type, severity,
 *   field_name, source_value, target_value, details (JSONB),
 *   resolved_at, resolved_by, resolution_type, notes, created_at
 */

import { query, queryOne, transaction } from '../config/database';
import { logTransition } from './transition-log.service';
import { PoolClient } from 'pg';

// =============================================================================
// TYPES
// =============================================================================

type Severity = 'critical' | 'warning' | 'info';

type DiscrepancyType =
  | 'missing_in_source'
  | 'missing_in_target'
  | 'field_mismatch'
  | 'duplicate';

type ResolutionAction =
  | 'accept_source'
  | 'accept_target'
  | 'manual_override'
  | 'ignore';

type EntityType =
  | 'customers'
  | 'cars'
  | 'contracts'
  | 'invoices'
  | 'allocations';

interface DiscrepancyRecord {
  id: string;
  run_id: string;
  entity_type: string;
  entity_id: string;
  discrepancy_type: DiscrepancyType;
  severity: Severity;
  field_name: string | null;
  source_value: string | null;
  target_value: string | null;
  details: Record<string, any> | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_type: string | null;
  notes: string | null;
  created_at: string;
}

interface DashboardSummary {
  total_discrepancies: number;
  by_severity: { severity: string; count: number }[];
  by_entity_type: { entity_type: string; count: number }[];
  by_discrepancy_type: { discrepancy_type: string; count: number }[];
}

interface DiscrepancyFilters {
  entity_type?: string;
  severity?: string;
  discrepancy_type?: string;
  status?: 'open' | 'resolved';
  search?: string;
  page?: number;
  page_size?: number;
}

interface PaginatedDiscrepancies {
  data: DiscrepancyRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface DiscrepancyDetail {
  discrepancy: DiscrepancyRecord;
  field_comparisons: { field: string; source: any; target: any }[];
  suggested_resolution: {
    action: ResolutionAction;
    reason: string;
  };
  related_entities: { entity_type: string; entity_id: string; label: string }[];
  run_info: {
    run_id: string;
    run_date: string | null;
    comparison_type: string | null;
  } | null;
}

interface Resolution {
  action: ResolutionAction;
  override_values?: Record<string, any>;
  notes?: string;
}

interface DuplicatePair {
  entity_type: string;
  entity_a_id: string;
  entity_a_label: string;
  entity_b_id: string;
  entity_b_label: string;
  match_confidence: number;
  matched_fields: string[];
}

// =============================================================================
// 1. DASHBOARD SUMMARY
// =============================================================================

/**
 * Returns summary counts of open discrepancies broken down by severity,
 * entity type, and discrepancy type. Only counts unresolved items
 * (resolved_at IS NULL).
 */
export async function getReconciliationDashboard(): Promise<DashboardSummary> {
  try {
    // Total open discrepancies
    const totalResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM parallel_run_discrepancies
       WHERE resolved_at IS NULL`
    );
    const totalDiscrepancies = parseInt(totalResult?.count || '0', 10);

    // By severity
    const bySeverity = await query<{ severity: string; count: string }>(
      `SELECT severity, COUNT(*)::text AS count
       FROM parallel_run_discrepancies
       WHERE resolved_at IS NULL
       GROUP BY severity
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 1
           WHEN 'warning' THEN 2
           WHEN 'info' THEN 3
           ELSE 4
         END`
    );

    // By entity type
    const byEntityType = await query<{ entity_type: string; count: string }>(
      `SELECT entity_type, COUNT(*)::text AS count
       FROM parallel_run_discrepancies
       WHERE resolved_at IS NULL
       GROUP BY entity_type
       ORDER BY COUNT(*) DESC`
    );

    // By discrepancy type
    const byDiscrepancyType = await query<{ discrepancy_type: string; count: string }>(
      `SELECT discrepancy_type, COUNT(*)::text AS count
       FROM parallel_run_discrepancies
       WHERE resolved_at IS NULL
       GROUP BY discrepancy_type
       ORDER BY COUNT(*) DESC`
    );

    return {
      total_discrepancies: totalDiscrepancies,
      by_severity: bySeverity.map(r => ({
        severity: r.severity,
        count: parseInt(r.count, 10),
      })),
      by_entity_type: byEntityType.map(r => ({
        entity_type: r.entity_type,
        count: parseInt(r.count, 10),
      })),
      by_discrepancy_type: byDiscrepancyType.map(r => ({
        discrepancy_type: r.discrepancy_type,
        count: parseInt(r.count, 10),
      })),
    };
  } catch (err) {
    throw new Error(
      `Failed to load reconciliation dashboard: ${(err as Error).message}`
    );
  }
}

// =============================================================================
// 2. LIST DISCREPANCIES (paginated + filtered)
// =============================================================================

/**
 * List discrepancies with pagination, filtering, and search.
 * Joins with parallel_run_results to include run metadata.
 */
export async function listDiscrepancies(
  filters: DiscrepancyFilters = {}
): Promise<PaginatedDiscrepancies> {
  try {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.page_size || 25));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    // Filter: entity_type
    if (filters.entity_type) {
      conditions.push(`d.entity_type = $${paramIdx++}`);
      params.push(filters.entity_type);
    }

    // Filter: severity
    if (filters.severity) {
      conditions.push(`d.severity = $${paramIdx++}`);
      params.push(filters.severity);
    }

    // Filter: discrepancy_type
    if (filters.discrepancy_type) {
      conditions.push(`d.discrepancy_type = $${paramIdx++}`);
      params.push(filters.discrepancy_type);
    }

    // Filter: status (open / resolved)
    if (filters.status === 'open') {
      conditions.push(`d.resolved_at IS NULL`);
    } else if (filters.status === 'resolved') {
      conditions.push(`d.resolved_at IS NOT NULL`);
    }

    // Filter: search term (matches entity_id, field_name, source_value, target_value, notes)
    if (filters.search && filters.search.trim()) {
      const searchParam = `%${filters.search.trim()}%`;
      conditions.push(
        `(d.entity_id ILIKE $${paramIdx}
          OR d.field_name ILIKE $${paramIdx}
          OR d.source_value ILIKE $${paramIdx}
          OR d.target_value ILIKE $${paramIdx}
          OR d.notes ILIKE $${paramIdx})`
      );
      params.push(searchParam);
      paramIdx++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching records
    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM parallel_run_discrepancies d
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.total || '0', 10);

    // Fetch paginated results with run info
    const data = await query<DiscrepancyRecord & { run_date: string | null; comparison_type: string | null }>(
      `SELECT
         d.*,
         pr.run_date::text AS run_date,
         pr.comparison_type
       FROM parallel_run_discrepancies d
       LEFT JOIN parallel_run_results pr ON pr.id = d.run_id
       ${whereClause}
       ORDER BY
         CASE d.severity
           WHEN 'critical' THEN 1
           WHEN 'warning' THEN 2
           WHEN 'info' THEN 3
           ELSE 4
         END,
         d.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset]
    );

    return {
      data,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
    };
  } catch (err) {
    throw new Error(
      `Failed to list discrepancies: ${(err as Error).message}`
    );
  }
}

// =============================================================================
// 3. DISCREPANCY DETAIL
// =============================================================================

/**
 * Get full detail for a single discrepancy including field comparisons,
 * suggested resolution, related entities, and run metadata.
 */
export async function getDiscrepancyDetail(
  id: string
): Promise<DiscrepancyDetail | null> {
  try {
    const discrepancy = await queryOne<DiscrepancyRecord>(
      `SELECT * FROM parallel_run_discrepancies WHERE id = $1`,
      [id]
    );

    if (!discrepancy) {
      return null;
    }

    // Build field comparisons from the details JSONB column
    const fieldComparisons: { field: string; source: any; target: any }[] = [];
    if (discrepancy.details && typeof discrepancy.details === 'object') {
      const details = discrepancy.details as Record<string, any>;
      // If details contains a field_comparisons array, use it directly
      if (Array.isArray(details.field_comparisons)) {
        fieldComparisons.push(...details.field_comparisons);
      } else if (details.source_fields && details.target_fields) {
        // If details has source_fields and target_fields objects, zip them
        const allFields = new Set([
          ...Object.keys(details.source_fields || {}),
          ...Object.keys(details.target_fields || {}),
        ]);
        for (const field of allFields) {
          fieldComparisons.push({
            field,
            source: details.source_fields?.[field] ?? null,
            target: details.target_fields?.[field] ?? null,
          });
        }
      } else {
        // Fall back to the top-level source_value/target_value
        if (discrepancy.field_name) {
          fieldComparisons.push({
            field: discrepancy.field_name,
            source: discrepancy.source_value,
            target: discrepancy.target_value,
          });
        }
      }
    } else if (discrepancy.field_name) {
      fieldComparisons.push({
        field: discrepancy.field_name,
        source: discrepancy.source_value,
        target: discrepancy.target_value,
      });
    }

    // Compute suggested resolution based on discrepancy type
    const suggestedResolution = computeSuggestedResolution(discrepancy);

    // Look up related entities based on entity_type and entity_id
    const relatedEntities = await findRelatedEntities(
      discrepancy.entity_type,
      discrepancy.entity_id
    );

    // Get run info
    let runInfo: DiscrepancyDetail['run_info'] = null;
    if (discrepancy.run_id) {
      const run = await queryOne<{ id: string; run_date: string; comparison_type: string }>(
        `SELECT id, run_date::text AS run_date, comparison_type
         FROM parallel_run_results
         WHERE id = $1`,
        [discrepancy.run_id]
      );
      if (run) {
        runInfo = {
          run_id: run.id,
          run_date: run.run_date,
          comparison_type: run.comparison_type,
        };
      }
    }

    return {
      discrepancy,
      field_comparisons: fieldComparisons,
      suggested_resolution: suggestedResolution,
      related_entities: relatedEntities,
      run_info: runInfo,
    };
  } catch (err) {
    throw new Error(
      `Failed to get discrepancy detail for id=${id}: ${(err as Error).message}`
    );
  }
}

// =============================================================================
// 4. RESOLVE SINGLE DISCREPANCY
// =============================================================================

/**
 * Resolve a single discrepancy by updating its resolution fields and
 * logging the action to the state_transition_log for audit.
 */
export async function resolveDiscrepancy(
  id: string,
  resolution: Resolution,
  userId: string
): Promise<DiscrepancyRecord> {
  try {
    // Verify the discrepancy exists and is still open
    const existing = await queryOne<DiscrepancyRecord>(
      `SELECT * FROM parallel_run_discrepancies WHERE id = $1`,
      [id]
    );

    if (!existing) {
      throw new Error(`Discrepancy ${id} not found`);
    }

    if (existing.resolved_at) {
      throw new Error(
        `Discrepancy ${id} is already resolved (resolved_at: ${existing.resolved_at})`
      );
    }

    // Build the updated details JSONB if manual override values are provided
    let updatedDetails = existing.details || {};
    if (
      resolution.action === 'manual_override' &&
      resolution.override_values
    ) {
      updatedDetails = {
        ...updatedDetails,
        override_values: resolution.override_values,
      };
    }

    // Update the discrepancy record
    const result = await queryOne<DiscrepancyRecord>(
      `UPDATE parallel_run_discrepancies
       SET
         resolved_at = NOW(),
         resolved_by = $2,
         resolution_type = $3,
         notes = COALESCE($4, notes),
         details = $5
       WHERE id = $1
       RETURNING *`,
      [
        id,
        userId,
        resolution.action,
        resolution.notes || null,
        JSON.stringify(updatedDetails),
      ]
    );

    if (!result) {
      throw new Error(`Failed to update discrepancy ${id}`);
    }

    // Log to state_transition_log for audit trail
    await logTransition({
      processType: 'data_reconciliation',
      entityId: id,
      entityNumber: existing.entity_id,
      fromState: 'open',
      toState: `resolved:${resolution.action}`,
      isReversible: true,
      actorId: userId,
      notes: resolution.notes || `Resolved via ${resolution.action}`,
      sideEffects: [],
    });

    return result;
  } catch (err) {
    throw new Error(
      `Failed to resolve discrepancy ${id}: ${(err as Error).message}`
    );
  }
}

// =============================================================================
// 5. BULK RESOLVE DISCREPANCIES
// =============================================================================

/**
 * Resolve multiple discrepancies in a single transaction.
 * All-or-nothing: if any resolution fails, the entire batch is rolled back.
 */
export async function bulkResolveDiscrepancies(
  ids: string[],
  resolution: Resolution,
  userId: string
): Promise<{ resolved_count: number; resolved_ids: string[] }> {
  if (!ids || ids.length === 0) {
    throw new Error('No discrepancy IDs provided for bulk resolution');
  }

  try {
    const result = await transaction(async (client: PoolClient) => {
      const resolvedIds: string[] = [];

      for (const id of ids) {
        // Verify each discrepancy exists and is still open
        const existingResult = await client.query(
          `SELECT * FROM parallel_run_discrepancies WHERE id = $1`,
          [id]
        );
        const existing = existingResult.rows[0] as DiscrepancyRecord | undefined;

        if (!existing) {
          throw new Error(`Discrepancy ${id} not found`);
        }

        if (existing.resolved_at) {
          // Skip already-resolved items in bulk mode rather than failing
          continue;
        }

        // Build updated details for manual overrides
        let updatedDetails = existing.details || {};
        if (
          resolution.action === 'manual_override' &&
          resolution.override_values
        ) {
          updatedDetails = {
            ...updatedDetails,
            override_values: resolution.override_values,
          };
        }

        // Update the discrepancy
        await client.query(
          `UPDATE parallel_run_discrepancies
           SET
             resolved_at = NOW(),
             resolved_by = $2,
             resolution_type = $3,
             notes = COALESCE($4, notes),
             details = $5
           WHERE id = $1`,
          [
            id,
            userId,
            resolution.action,
            resolution.notes || null,
            JSON.stringify(updatedDetails),
          ]
        );

        // Log each resolution to the audit trail
        await client.query(
          `INSERT INTO state_transition_log
             (process_type, entity_id, entity_number, from_state, to_state,
              is_reversible, actor_id, notes, side_effects)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            'data_reconciliation',
            id,
            existing.entity_id,
            'open',
            `resolved:${resolution.action}`,
            true,
            userId,
            resolution.notes || `Bulk resolved via ${resolution.action}`,
            JSON.stringify([]),
          ]
        );

        resolvedIds.push(id);
      }

      return { resolved_count: resolvedIds.length, resolved_ids: resolvedIds };
    });

    return result;
  } catch (err) {
    throw new Error(
      `Failed to bulk resolve discrepancies: ${(err as Error).message}`
    );
  }
}

// =============================================================================
// 6. DETECT DUPLICATES
// =============================================================================

/**
 * Find potential duplicate records for a given entity type.
 * - customers: match on LOWER(TRIM(customer_name))
 * - cars: match on car_number
 * Returns pairs of potential duplicates with match confidence.
 */
export async function detectDuplicates(
  entityType: EntityType
): Promise<DuplicatePair[]> {
  try {
    switch (entityType) {
      case 'customers':
        return detectCustomerDuplicates();
      case 'cars':
        return detectCarDuplicates();
      case 'contracts':
        return detectContractDuplicates();
      case 'invoices':
        return detectInvoiceDuplicates();
      case 'allocations':
        return detectAllocationDuplicates();
      default:
        throw new Error(`Unsupported entity type for duplicate detection: ${entityType}`);
    }
  } catch (err) {
    throw new Error(
      `Failed to detect duplicates for ${entityType}: ${(err as Error).message}`
    );
  }
}

async function detectCustomerDuplicates(): Promise<DuplicatePair[]> {
  // Match customers whose normalized names are identical
  const rows = await query<{
    a_id: string;
    a_name: string;
    b_id: string;
    b_name: string;
    a_code: string;
    b_code: string;
  }>(
    `SELECT
       a.id AS a_id, a.customer_name AS a_name, a.customer_code AS a_code,
       b.id AS b_id, b.customer_name AS b_name, b.customer_code AS b_code
     FROM customers a
     JOIN customers b ON a.id < b.id
       AND LOWER(TRIM(a.customer_name)) = LOWER(TRIM(b.customer_name))
     ORDER BY a.customer_name
     LIMIT 500`
  );

  return rows.map(r => ({
    entity_type: 'customers',
    entity_a_id: r.a_id,
    entity_a_label: `${r.a_name} (${r.a_code})`,
    entity_b_id: r.b_id,
    entity_b_label: `${r.b_name} (${r.b_code})`,
    match_confidence: 1.0,
    matched_fields: ['customer_name'],
  }));
}

async function detectCarDuplicates(): Promise<DuplicatePair[]> {
  // Match cars with identical car_number (should not happen with unique
  // constraint, but can occur if imports bypass it via different casing)
  const rows = await query<{
    a_id: string;
    a_number: string;
    a_mark: string | null;
    b_id: string;
    b_number: string;
    b_mark: string | null;
  }>(
    `SELECT
       a.id AS a_id, a.car_number AS a_number, a.car_mark AS a_mark,
       b.id AS b_id, b.car_number AS b_number, b.car_mark AS b_mark
     FROM cars a
     JOIN cars b ON a.id < b.id
       AND LOWER(TRIM(a.car_number)) = LOWER(TRIM(b.car_number))
     ORDER BY a.car_number
     LIMIT 500`
  );

  return rows.map(r => ({
    entity_type: 'cars',
    entity_a_id: r.a_id,
    entity_a_label: `${r.a_number} (${r.a_mark || 'N/A'})`,
    entity_b_id: r.b_id,
    entity_b_label: `${r.b_number} (${r.b_mark || 'N/A'})`,
    match_confidence: 1.0,
    matched_fields: ['car_number'],
  }));
}

async function detectContractDuplicates(): Promise<DuplicatePair[]> {
  const rows = await query<{
    a_id: string;
    a_number: string;
    a_name: string | null;
    b_id: string;
    b_number: string;
    b_name: string | null;
  }>(
    `SELECT
       a.id AS a_id, a.lease_number AS a_number, a.lease_name AS a_name,
       b.id AS b_id, b.lease_number AS b_number, b.lease_name AS b_name
     FROM master_leases a
     JOIN master_leases b ON a.id < b.id
       AND LOWER(TRIM(a.lease_number)) = LOWER(TRIM(b.lease_number))
     ORDER BY a.lease_number
     LIMIT 500`
  );

  return rows.map(r => ({
    entity_type: 'contracts',
    entity_a_id: r.a_id,
    entity_a_label: `${r.a_number} (${r.a_name || 'N/A'})`,
    entity_b_id: r.b_id,
    entity_b_label: `${r.b_number} (${r.b_name || 'N/A'})`,
    match_confidence: 1.0,
    matched_fields: ['lease_number'],
  }));
}

async function detectInvoiceDuplicates(): Promise<DuplicatePair[]> {
  const rows = await query<{
    a_id: string;
    a_number: string;
    a_vendor: string | null;
    b_id: string;
    b_number: string;
    b_vendor: string | null;
  }>(
    `SELECT
       a.id AS a_id, a.invoice_number AS a_number, a.vendor_code AS a_vendor,
       b.id AS b_id, b.invoice_number AS b_number, b.vendor_code AS b_vendor
     FROM invoices a
     JOIN invoices b ON a.id < b.id
       AND LOWER(TRIM(a.invoice_number)) = LOWER(TRIM(b.invoice_number))
     ORDER BY a.invoice_number
     LIMIT 500`
  );

  return rows.map(r => ({
    entity_type: 'invoices',
    entity_a_id: r.a_id,
    entity_a_label: `${r.a_number} (vendor: ${r.a_vendor || 'N/A'})`,
    entity_b_id: r.b_id,
    entity_b_label: `${r.b_number} (vendor: ${r.b_vendor || 'N/A'})`,
    match_confidence: 1.0,
    matched_fields: ['invoice_number'],
  }));
}

async function detectAllocationDuplicates(): Promise<DuplicatePair[]> {
  const rows = await query<{
    a_id: string;
    a_car: string;
    a_month: string;
    a_shop: string | null;
    b_id: string;
    b_car: string;
    b_month: string;
    b_shop: string | null;
  }>(
    `SELECT
       a.id AS a_id, a.car_number AS a_car, a.target_month AS a_month, a.shop_code AS a_shop,
       b.id AS b_id, b.car_number AS b_car, b.target_month AS b_month, b.shop_code AS b_shop
     FROM allocations a
     JOIN allocations b ON a.id < b.id
       AND a.car_number = b.car_number
       AND a.target_month = b.target_month
     ORDER BY a.car_number, a.target_month
     LIMIT 500`
  );

  return rows.map(r => ({
    entity_type: 'allocations',
    entity_a_id: r.a_id,
    entity_a_label: `${r.a_car} / ${r.a_month} (shop: ${r.a_shop || 'N/A'})`,
    entity_b_id: r.b_id,
    entity_b_label: `${r.b_car} / ${r.b_month} (shop: ${r.b_shop || 'N/A'})`,
    match_confidence: 1.0,
    matched_fields: ['car_number', 'target_month'],
  }));
}

// =============================================================================
// 7. RUN RECONCILIATION
// =============================================================================

/**
 * Re-run reconciliation for a specific migration run.
 * Compares source and target record counts per entity type and detects
 * key field mismatches. Inserts new discrepancies into
 * parallel_run_discrepancies and returns the count of new issues found.
 */
export async function runReconciliation(
  runId: string
): Promise<{ new_issues: number; run_id: string }> {
  try {
    // Look up the migration run to determine entity type and time window
    const migrationRun = await queryOne<{
      id: string;
      entity_type: string;
      started_at: string;
      completed_at: string;
      imported_rows: number;
      status: string;
    }>(
      `SELECT id, entity_type, started_at::text, completed_at::text, imported_rows, status
       FROM migration_runs
       WHERE id = $1`,
      [runId]
    );

    if (!migrationRun) {
      throw new Error(`Migration run ${runId} not found`);
    }

    if (migrationRun.status !== 'complete') {
      throw new Error(
        `Migration run ${runId} is not complete (status: ${migrationRun.status}). ` +
        `Only completed runs can be reconciled.`
      );
    }

    // Map entity types to their reconciliation queries
    const entityReconcilers: Record<string, () => Promise<number>> = {
      car: () => reconcileCars(runId, migrationRun),
      customer: () => reconcileCustomers(runId, migrationRun),
      contract: () => reconcileContracts(runId, migrationRun),
      invoice: () => reconcileInvoices(runId, migrationRun),
      allocation: () => reconcileAllocations(runId, migrationRun),
    };

    const reconciler = entityReconcilers[migrationRun.entity_type];
    if (!reconciler) {
      throw new Error(
        `No reconciliation logic for entity type: ${migrationRun.entity_type}`
      );
    }

    // Also create/update a parallel_run_results entry for this reconciliation
    const parallelRunResult = await queryOne<{ id: string }>(
      `INSERT INTO parallel_run_results (run_date, comparison_type, ciprots_count, railsync_count)
       VALUES (CURRENT_DATE, $1, 0, 0)
       RETURNING id`,
      [`reconciliation_${migrationRun.entity_type}`]
    );

    const newIssues = await reconciler();

    // Update the parallel run result with counts
    if (parallelRunResult) {
      await query(
        `UPDATE parallel_run_results
         SET mismatch_count = $2, summary = $3
         WHERE id = $1`,
        [
          parallelRunResult.id,
          newIssues,
          JSON.stringify({
            migration_run_id: runId,
            entity_type: migrationRun.entity_type,
            new_discrepancies: newIssues,
            reconciled_at: new Date().toISOString(),
          }),
        ]
      );
    }

    return { new_issues: newIssues, run_id: runId };
  } catch (err) {
    throw new Error(
      `Failed to run reconciliation for run ${runId}: ${(err as Error).message}`
    );
  }
}

// =============================================================================
// INTERNAL HELPERS: Suggested Resolution
// =============================================================================

function computeSuggestedResolution(
  discrepancy: DiscrepancyRecord
): { action: ResolutionAction; reason: string } {
  switch (discrepancy.discrepancy_type) {
    case 'missing_in_source':
      return {
        action: 'accept_target',
        reason:
          'Record exists in RailSync but not in CIPROTS source. ' +
          'This may be a new record created directly in RailSync. ' +
          'Accepting the target value preserves the RailSync data.',
      };

    case 'missing_in_target':
      return {
        action: 'accept_source',
        reason:
          'Record exists in CIPROTS source but not in RailSync. ' +
          'This indicates a failed or skipped import. ' +
          'Accepting the source value will trigger re-import.',
      };

    case 'field_mismatch':
      // If severity is info-level, suggest ignoring minor differences
      if (discrepancy.severity === 'info') {
        return {
          action: 'ignore',
          reason:
            'Minor field-level difference with low severity. ' +
            'This is likely a formatting or rounding difference that does not ' +
            'affect operational accuracy.',
        };
      }
      return {
        action: 'accept_source',
        reason:
          'Field values differ between source and target. ' +
          'CIPROTS is the system of record during migration — accepting ' +
          'the source value aligns RailSync with the authoritative data.',
      };

    case 'duplicate':
      return {
        action: 'manual_override',
        reason:
          'Duplicate records detected. Manual review is required to determine ' +
          'which record to keep and which to merge or remove. ' +
          'Use manual_override with the correct values.',
      };

    default:
      return {
        action: 'manual_override',
        reason:
          'Unknown discrepancy type. Manual review is required to determine ' +
          'the correct resolution.',
      };
  }
}

// =============================================================================
// INTERNAL HELPERS: Related Entities
// =============================================================================

async function findRelatedEntities(
  entityType: string,
  entityId: string
): Promise<{ entity_type: string; entity_id: string; label: string }[]> {
  const related: { entity_type: string; entity_id: string; label: string }[] = [];

  try {
    switch (entityType) {
      case 'cars': {
        // Find allocations and shopping events related to this car
        const allocations = await query<{ id: string; target_month: string }>(
          `SELECT id, target_month FROM allocations WHERE car_number = $1 LIMIT 5`,
          [entityId]
        );
        for (const a of allocations) {
          related.push({
            entity_type: 'allocation',
            entity_id: a.id,
            label: `Allocation for ${entityId} in ${a.target_month}`,
          });
        }

        const events = await query<{ id: string; event_type: string }>(
          `SELECT id, event_type FROM shopping_events WHERE car_number = $1 LIMIT 5`,
          [entityId]
        );
        for (const e of events) {
          related.push({
            entity_type: 'shopping_event',
            entity_id: e.id,
            label: `Shopping event (${e.event_type}) for ${entityId}`,
          });
        }
        break;
      }

      case 'customers': {
        // Find contracts related to this customer
        const contracts = await query<{ id: string; lease_number: string }>(
          `SELECT ml.id, ml.lease_number
           FROM master_leases ml
           JOIN customers c ON c.id = ml.customer_id
           WHERE c.customer_code = $1 OR c.id::text = $1
           LIMIT 5`,
          [entityId]
        );
        for (const c of contracts) {
          related.push({
            entity_type: 'contract',
            entity_id: c.id,
            label: `Contract ${c.lease_number}`,
          });
        }
        break;
      }

      case 'invoices': {
        // Find the shop associated with this invoice
        const invoice = await queryOne<{ shop_code: string | null; vendor_code: string | null }>(
          `SELECT shop_code, vendor_code FROM invoices WHERE invoice_number = $1 OR id::text = $1`,
          [entityId]
        );
        if (invoice?.shop_code) {
          const shop = await queryOne<{ shop_code: string; shop_name: string }>(
            `SELECT shop_code, shop_name FROM shops WHERE shop_code = $1`,
            [invoice.shop_code]
          );
          if (shop) {
            related.push({
              entity_type: 'shop',
              entity_id: shop.shop_code,
              label: `Shop ${shop.shop_name} (${shop.shop_code})`,
            });
          }
        }
        break;
      }

      // For contracts and allocations, the entity_id itself is sufficient context
      default:
        break;
    }
  } catch {
    // Non-fatal: related entities are supplementary information
  }

  return related;
}

// =============================================================================
// INTERNAL HELPERS: Entity-Specific Reconcilers
// =============================================================================

async function reconcileCars(
  runId: string,
  run: { started_at: string; completed_at: string }
): Promise<number> {
  let newIssues = 0;

  // Find cars in migration_row_errors that were skipped
  const errorRows = await query<{ raw_value: string; error_type: string }>(
    `SELECT raw_value, error_type
     FROM migration_row_errors
     WHERE migration_run_id = $1 AND raw_value IS NOT NULL`,
    [runId]
  );

  for (const row of errorRows) {
    if (!row.raw_value) continue;

    // Check if the car exists in target (RailSync)
    const exists = await queryOne<{ car_number: string }>(
      `SELECT car_number FROM cars WHERE car_number = $1`,
      [row.raw_value]
    );

    if (!exists) {
      await insertDiscrepancy({
        run_id: runId,
        entity_type: 'cars',
        entity_id: row.raw_value,
        discrepancy_type: 'missing_in_target',
        severity: 'critical',
        field_name: 'car_number',
        source_value: row.raw_value,
        target_value: null,
        details: { error_type: row.error_type, source: 'migration_row_errors' },
      });
      newIssues++;
    }
  }

  // Check for car count discrepancy
  const sourceCount = await queryOne<{ count: string }>(
    `SELECT (total_rows)::text AS count FROM migration_runs WHERE id = $1`,
    [runId]
  );
  const targetCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM cars
     WHERE created_at >= $1::timestamp AND created_at <= $2::timestamp`,
    [run.started_at, run.completed_at]
  );

  const srcCount = parseInt(sourceCount?.count || '0', 10);
  const tgtCount = parseInt(targetCount?.count || '0', 10);

  if (srcCount !== tgtCount && srcCount > 0) {
    await insertDiscrepancy({
      run_id: runId,
      entity_type: 'cars',
      entity_id: `run:${runId}`,
      discrepancy_type: 'field_mismatch',
      severity: Math.abs(srcCount - tgtCount) > 10 ? 'critical' : 'warning',
      field_name: 'record_count',
      source_value: srcCount.toString(),
      target_value: tgtCount.toString(),
      details: {
        difference: srcCount - tgtCount,
        source_total: srcCount,
        target_total: tgtCount,
      },
    });
    newIssues++;
  }

  return newIssues;
}

async function reconcileCustomers(
  runId: string,
  run: { started_at: string; completed_at: string }
): Promise<number> {
  let newIssues = 0;

  const errorRows = await query<{ raw_value: string; error_type: string }>(
    `SELECT raw_value, error_type
     FROM migration_row_errors
     WHERE migration_run_id = $1 AND raw_value IS NOT NULL`,
    [runId]
  );

  for (const row of errorRows) {
    if (!row.raw_value) continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT id FROM customers WHERE customer_code = $1`,
      [row.raw_value]
    );

    if (!exists) {
      await insertDiscrepancy({
        run_id: runId,
        entity_type: 'customers',
        entity_id: row.raw_value,
        discrepancy_type: 'missing_in_target',
        severity: 'critical',
        field_name: 'customer_code',
        source_value: row.raw_value,
        target_value: null,
        details: { error_type: row.error_type, source: 'migration_row_errors' },
      });
      newIssues++;
    }
  }

  // Count comparison
  const sourceCount = await queryOne<{ count: string }>(
    `SELECT (total_rows)::text AS count FROM migration_runs WHERE id = $1`,
    [runId]
  );
  const targetCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM customers
     WHERE created_at >= $1::timestamp AND created_at <= $2::timestamp`,
    [run.started_at, run.completed_at]
  );

  const srcCount = parseInt(sourceCount?.count || '0', 10);
  const tgtCount = parseInt(targetCount?.count || '0', 10);

  if (srcCount !== tgtCount && srcCount > 0) {
    await insertDiscrepancy({
      run_id: runId,
      entity_type: 'customers',
      entity_id: `run:${runId}`,
      discrepancy_type: 'field_mismatch',
      severity: Math.abs(srcCount - tgtCount) > 10 ? 'critical' : 'warning',
      field_name: 'record_count',
      source_value: srcCount.toString(),
      target_value: tgtCount.toString(),
      details: {
        difference: srcCount - tgtCount,
        source_total: srcCount,
        target_total: tgtCount,
      },
    });
    newIssues++;
  }

  return newIssues;
}

async function reconcileContracts(
  runId: string,
  run: { started_at: string; completed_at: string }
): Promise<number> {
  let newIssues = 0;

  const errorRows = await query<{ raw_value: string; error_type: string }>(
    `SELECT raw_value, error_type
     FROM migration_row_errors
     WHERE migration_run_id = $1 AND raw_value IS NOT NULL`,
    [runId]
  );

  for (const row of errorRows) {
    if (!row.raw_value) continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT id FROM master_leases WHERE lease_number = $1`,
      [row.raw_value]
    );

    if (!exists) {
      await insertDiscrepancy({
        run_id: runId,
        entity_type: 'contracts',
        entity_id: row.raw_value,
        discrepancy_type: 'missing_in_target',
        severity: 'critical',
        field_name: 'lease_number',
        source_value: row.raw_value,
        target_value: null,
        details: { error_type: row.error_type, source: 'migration_row_errors' },
      });
      newIssues++;
    }
  }

  const sourceCount = await queryOne<{ count: string }>(
    `SELECT (total_rows)::text AS count FROM migration_runs WHERE id = $1`,
    [runId]
  );
  const targetCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM master_leases
     WHERE created_at >= $1::timestamp AND created_at <= $2::timestamp`,
    [run.started_at, run.completed_at]
  );

  const srcCount = parseInt(sourceCount?.count || '0', 10);
  const tgtCount = parseInt(targetCount?.count || '0', 10);

  if (srcCount !== tgtCount && srcCount > 0) {
    await insertDiscrepancy({
      run_id: runId,
      entity_type: 'contracts',
      entity_id: `run:${runId}`,
      discrepancy_type: 'field_mismatch',
      severity: Math.abs(srcCount - tgtCount) > 5 ? 'critical' : 'warning',
      field_name: 'record_count',
      source_value: srcCount.toString(),
      target_value: tgtCount.toString(),
      details: {
        difference: srcCount - tgtCount,
        source_total: srcCount,
        target_total: tgtCount,
      },
    });
    newIssues++;
  }

  return newIssues;
}

async function reconcileInvoices(
  runId: string,
  run: { started_at: string; completed_at: string }
): Promise<number> {
  let newIssues = 0;

  const errorRows = await query<{ raw_value: string; error_type: string }>(
    `SELECT raw_value, error_type
     FROM migration_row_errors
     WHERE migration_run_id = $1 AND raw_value IS NOT NULL`,
    [runId]
  );

  for (const row of errorRows) {
    if (!row.raw_value) continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT id FROM invoices WHERE invoice_number = $1`,
      [row.raw_value]
    );

    if (!exists) {
      await insertDiscrepancy({
        run_id: runId,
        entity_type: 'invoices',
        entity_id: row.raw_value,
        discrepancy_type: 'missing_in_target',
        severity: 'critical',
        field_name: 'invoice_number',
        source_value: row.raw_value,
        target_value: null,
        details: { error_type: row.error_type, source: 'migration_row_errors' },
      });
      newIssues++;
    }
  }

  const sourceCount = await queryOne<{ count: string }>(
    `SELECT (total_rows)::text AS count FROM migration_runs WHERE id = $1`,
    [runId]
  );
  const targetCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM invoices
     WHERE created_at >= $1::timestamp AND created_at <= $2::timestamp`,
    [run.started_at, run.completed_at]
  );

  const srcCount = parseInt(sourceCount?.count || '0', 10);
  const tgtCount = parseInt(targetCount?.count || '0', 10);

  if (srcCount !== tgtCount && srcCount > 0) {
    await insertDiscrepancy({
      run_id: runId,
      entity_type: 'invoices',
      entity_id: `run:${runId}`,
      discrepancy_type: 'field_mismatch',
      severity: Math.abs(srcCount - tgtCount) > 5 ? 'critical' : 'warning',
      field_name: 'record_count',
      source_value: srcCount.toString(),
      target_value: tgtCount.toString(),
      details: {
        difference: srcCount - tgtCount,
        source_total: srcCount,
        target_total: tgtCount,
      },
    });
    newIssues++;
  }

  return newIssues;
}

async function reconcileAllocations(
  runId: string,
  run: { started_at: string; completed_at: string }
): Promise<number> {
  let newIssues = 0;

  const errorRows = await query<{ raw_value: string; error_type: string }>(
    `SELECT raw_value, error_type
     FROM migration_row_errors
     WHERE migration_run_id = $1 AND raw_value IS NOT NULL`,
    [runId]
  );

  for (const row of errorRows) {
    if (!row.raw_value) continue;

    const exists = await queryOne<{ id: string }>(
      `SELECT id FROM allocations WHERE car_number = $1 LIMIT 1`,
      [row.raw_value]
    );

    if (!exists) {
      await insertDiscrepancy({
        run_id: runId,
        entity_type: 'allocations',
        entity_id: row.raw_value,
        discrepancy_type: 'missing_in_target',
        severity: 'warning',
        field_name: 'car_number',
        source_value: row.raw_value,
        target_value: null,
        details: { error_type: row.error_type, source: 'migration_row_errors' },
      });
      newIssues++;
    }
  }

  const sourceCount = await queryOne<{ count: string }>(
    `SELECT (total_rows)::text AS count FROM migration_runs WHERE id = $1`,
    [runId]
  );
  const targetCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM allocations
     WHERE created_at >= $1::timestamp AND created_at <= $2::timestamp`,
    [run.started_at, run.completed_at]
  );

  const srcCount = parseInt(sourceCount?.count || '0', 10);
  const tgtCount = parseInt(targetCount?.count || '0', 10);

  if (srcCount !== tgtCount && srcCount > 0) {
    await insertDiscrepancy({
      run_id: runId,
      entity_type: 'allocations',
      entity_id: `run:${runId}`,
      discrepancy_type: 'field_mismatch',
      severity: Math.abs(srcCount - tgtCount) > 10 ? 'critical' : 'warning',
      field_name: 'record_count',
      source_value: srcCount.toString(),
      target_value: tgtCount.toString(),
      details: {
        difference: srcCount - tgtCount,
        source_total: srcCount,
        target_total: tgtCount,
      },
    });
    newIssues++;
  }

  return newIssues;
}

// =============================================================================
// INTERNAL HELPERS: Insert Discrepancy
// =============================================================================

async function insertDiscrepancy(params: {
  run_id: string;
  entity_type: string;
  entity_id: string;
  discrepancy_type: string;
  severity: string;
  field_name: string | null;
  source_value: string | null;
  target_value: string | null;
  details: Record<string, any>;
}): Promise<void> {
  await query(
    `INSERT INTO parallel_run_discrepancies
       (run_id, entity_type, entity_id, discrepancy_type, severity,
        field_name, source_value, target_value, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      params.run_id,
      params.entity_type,
      params.entity_id,
      params.discrepancy_type,
      params.severity,
      params.field_name,
      params.source_value,
      params.target_value,
      JSON.stringify(params.details),
    ]
  );
}
