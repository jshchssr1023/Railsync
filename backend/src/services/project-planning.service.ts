/**
 * Project Planning Service
 *
 * Core service for project-level planning integration.
 * Manages the lifecycle: Plan -> Lock -> Relock/Cancel.
 *
 * Key invariants:
 * - project_assignments is the bridge between projects and car_assignments (SSOT)
 * - Only one active plan per project car (DB unique index enforces)
 * - Lock creates a car_assignment with source='project_plan'
 * - Relock supersedes old row, creates new row with lock_version++
 * - All state changes produce audit events
 */

import { query, queryOne, transaction } from '../config/database';
import logger from '../config/logger';
import { writeAuditEvent, writeAuditEventTx } from './project-audit.service';
import { notifyProjectRelock, notifyProjectBundling } from './email.service';
import { logTransition } from './transition-log.service';
import * as shoppingEventV2Service from './shopping-event-v2.service';
import type { ProjectAssignment, ProjectCommunication, ProjectPlanSummary } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface PlanCarInput {
  project_car_id: string;
  car_number: string;
  shop_code: string;
  target_month: string;
  target_date?: string;
  estimated_cost?: number;
}

export interface PlanCarsInput {
  project_id: string;
  cars: PlanCarInput[];
  created_by_id: string;
  created_by_email?: string;
}

export interface LockCarsInput {
  project_id: string;
  assignment_ids: string[];
  locked_by_id: string;
  locked_by_email?: string;
}

export interface RelockCarInput {
  project_id: string;
  project_assignment_id: string;
  new_shop_code: string;
  new_target_month: string;
  new_target_date?: string;
  new_estimated_cost?: number;
  reason: string;
  relocked_by_id: string;
  relocked_by_email?: string;
}

export interface CancelPlanInput {
  project_id: string;
  project_assignment_id: string;
  reason: string;
  cancelled_by_id: string;
  cancelled_by_email?: string;
}

export interface LogCommunicationInput {
  project_id: string;
  communication_type: string;
  communicated_to?: string;
  communication_method?: string;
  subject?: string;
  notes?: string;
  communicated_by_id: string;
  communicated_by_email?: string;
}

export interface BundleProjectWorkInput {
  shopping_event_id: string;
  project_id: string;
  project_car_id: string;
  car_number: string;
  shop_code: string;
  target_month: string;
  bundled_by_id: string;
  bundled_by_email?: string;
}

// ============================================================================
// PLAN CARS (Planned state)
// ============================================================================

/**
 * Create planned assignments for project cars.
 * Each car gets a project_assignment row in 'Planned' state.
 * No SSOT car_assignment is created yet (that happens at Lock).
 */
export async function planCars(input: PlanCarsInput): Promise<ProjectAssignment[]> {
  const results: ProjectAssignment[] = [];

  for (const car of input.cars) {
    // Get shop name for denormalization
    const shopResult = await queryOne<{ shop_name: string }>(
      'SELECT shop_name FROM shops WHERE shop_code = $1',
      [car.shop_code]
    );

    const sql = `
      INSERT INTO project_assignments (
        project_id, project_car_id, car_number,
        shop_code, shop_name, target_month, target_date, estimated_cost,
        plan_state, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Planned', $9)
      RETURNING *
    `;

    const rows = await query<ProjectAssignment>(sql, [
      input.project_id,
      car.project_car_id,
      car.car_number,
      car.shop_code,
      shopResult?.shop_name || car.shop_code,
      car.target_month,
      car.target_date || null,
      car.estimated_cost || null,
      input.created_by_id,
    ]);

    const created = rows[0];
    results.push(created);

    // Write audit event
    await writeAuditEvent({
      project_id: input.project_id,
      project_assignment_id: created.id,
      car_number: car.car_number,
      actor_id: input.created_by_id,
      actor_email: input.created_by_email,
      action: 'plan_created',
      after_state: 'Planned',
      plan_snapshot: {
        shop_code: car.shop_code,
        target_month: car.target_month,
        estimated_cost: car.estimated_cost,
      },
    });
  }

  // Update project planning counts
  await updateProjectPlanCounts(input.project_id);

  return results;
}

// ============================================================================
// LOCK CARS (Planned -> Locked)
// ============================================================================

/**
 * Lock selected planned assignments. For each:
 * 1. Validate car is in Planned state
 * 2. Create car_assignment SSOT record (source='project_plan')
 * 3. Update project_assignment to Locked
 * 4. Write audit event
 *
 * Uses transaction per car to isolate failures.
 */
export async function lockCars(input: LockCarsInput): Promise<{ locked: ProjectAssignment[]; errors: { id: string; error: string }[] }> {
  const locked: ProjectAssignment[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const assignmentId of input.assignment_ids) {
    try {
      const result = await transaction(async (client) => {
        // Get current assignment
        const paResult = await client.query(
          'SELECT * FROM project_assignments WHERE id = $1 FOR UPDATE',
          [assignmentId]
        );
        const pa = paResult.rows[0] as ProjectAssignment;

        if (!pa) {
          throw new Error('Project assignment not found');
        }
        if (pa.plan_state !== 'Planned') {
          throw new Error(`Cannot lock: current state is ${pa.plan_state}, expected Planned`);
        }
        if (pa.project_id !== input.project_id) {
          throw new Error('Assignment does not belong to this project');
        }

        // Check for SSOT conflict (car already has active shopping event)
        const conflictResult = await client.query(
          `SELECT id, shop_code, target_month FROM shopping_events_v2
           WHERE car_number = $1 AND state NOT IN ('CLOSED', 'CANCELLED')
           LIMIT 1`,
          [pa.car_number]
        );

        if (conflictResult.rows.length > 0) {
          const existing = conflictResult.rows[0];
          throw new Error(
            `Car ${pa.car_number} already has active assignment to ${existing.shop_code} for ${existing.target_month}`
          );
        }

        // Create SSOT car_assignment record
        const caResult = await client.query(
          `INSERT INTO car_assignments (
            car_id, car_number, shop_code, shop_name,
            target_month, target_date, estimated_cost,
            source, source_reference_id, source_reference_type,
            project_id, project_assignment_id,
            created_by_id
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6,
            'project_plan', $7, 'project_assignment',
            $8, $9, $10
          )
          RETURNING *`,
          [
            pa.car_number, pa.shop_code, pa.shop_name,
            pa.target_month, pa.target_date || null, pa.estimated_cost || null,
            pa.id, input.project_id, assignmentId,
            input.locked_by_id,
          ]
        );

        const carAssignment = caResult.rows[0];

        // Update project_assignment to Locked
        const updateResult = await client.query(
          `UPDATE project_assignments SET
            plan_state = 'Locked',
            locked_at = NOW(),
            locked_by = $1,
            lock_version = lock_version + 1,
            car_assignment_id = $2,
            updated_at = NOW()
          WHERE id = $3
          RETURNING *`,
          [input.locked_by_id, carAssignment.id, assignmentId]
        );

        const updated = updateResult.rows[0] as ProjectAssignment;

        // Audit event
        await writeAuditEventTx(client, {
          project_id: input.project_id,
          project_assignment_id: assignmentId,
          car_number: pa.car_number,
          actor_id: input.locked_by_id,
          actor_email: input.locked_by_email,
          action: 'plan_locked',
          before_state: 'Planned',
          after_state: 'Locked',
          plan_snapshot: {
            shop_code: pa.shop_code,
            target_month: pa.target_month,
            estimated_cost: pa.estimated_cost,
            car_assignment_id: carAssignment.id,
          },
        });

        return updated;
      });

      locked.push(result);

      // Dual-write: create V2 shopping event (non-blocking, outside transaction)
      try {
        await shoppingEventV2Service.createShoppingEvent({
          car_number: result.car_number,
          source: 'project_plan',
          source_reference_id: result.car_assignment_id,
          source_reference_type: 'car_assignment',
          shop_code: result.shop_code,
          target_month: result.target_month,
          project_id: input.project_id,
          estimated_cost: result.estimated_cost,
        }, input.locked_by_id);
      } catch (v2Err) {
        logger.warn({ err: v2Err }, `[ProjectPlanning] V2 dual-write failed for ${result.car_number} (non-blocking)`);
      }
    } catch (err) {
      errors.push({ id: assignmentId, error: (err as Error).message });
    }
  }

  // Update project planning counts + lock timestamp
  if (locked.length > 0) {
    await query(
      `UPDATE projects SET
        last_plan_locked_at = NOW(),
        plan_version = plan_version + 1,
        updated_at = NOW()
      WHERE id = $1`,
      [input.project_id]
    );
    await updateProjectPlanCounts(input.project_id);
  }

  return { locked, errors };
}

// ============================================================================
// RELOCK CAR (Locked -> Superseded + new Locked)
// ============================================================================

/**
 * Relock: Supersede the old assignment, create a new one in Locked state.
 * Mandatory reason required. Updates the SSOT car_assignment.
 */
export async function relockCar(input: RelockCarInput): Promise<ProjectAssignment> {
  return transaction(async (client) => {
    // Get current assignment with lock
    const paResult = await client.query(
      'SELECT * FROM project_assignments WHERE id = $1 FOR UPDATE',
      [input.project_assignment_id]
    );
    const old = paResult.rows[0] as ProjectAssignment;

    if (!old) throw new Error('Project assignment not found');
    if (old.plan_state !== 'Locked') throw new Error(`Cannot relock: current state is ${old.plan_state}, expected Locked`);
    if (old.project_id !== input.project_id) throw new Error('Assignment does not belong to this project');
    if (!input.reason) throw new Error('Reason is required for relock');

    // Get new shop name
    const shopResult = await client.query('SELECT shop_name FROM shops WHERE shop_code = $1', [input.new_shop_code]);
    const newShopName = shopResult.rows[0]?.shop_name || input.new_shop_code;

    // Mark old row as Superseded FIRST (before inserting new row)
    // so the partial unique index on project_car_id allows the new insert
    await client.query(
      `UPDATE project_assignments SET
        plan_state = 'Superseded',
        superseded_at = NOW(),
        supersede_reason = $1,
        updated_at = NOW()
      WHERE id = $2`,
      [input.reason, old.id]
    );

    // Create new project_assignment row (Locked)
    const newResult = await client.query(
      `INSERT INTO project_assignments (
        project_id, project_car_id, car_number,
        shop_code, shop_name, target_month, target_date, estimated_cost,
        plan_state, locked_at, locked_by, lock_version,
        car_assignment_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Locked', NOW(), $9, $10, $11, $9)
      RETURNING *`,
      [
        input.project_id, old.project_car_id, old.car_number,
        input.new_shop_code, newShopName,
        input.new_target_month, input.new_target_date || null,
        input.new_estimated_cost ?? old.estimated_cost ?? null,
        input.relocked_by_id, (old.lock_version || 0) + 1,
        old.car_assignment_id,
      ]
    );

    const newPa = newResult.rows[0] as ProjectAssignment;

    // Link old row to new row via superseded_by_id
    await client.query(
      `UPDATE project_assignments SET superseded_by_id = $1 WHERE id = $2`,
      [newPa.id, old.id]
    );

    // Update the SSOT car_assignment if it exists
    if (old.car_assignment_id) {
      await client.query(
        `UPDATE car_assignments SET
          shop_code = $1,
          shop_name = $2,
          target_month = $3,
          target_date = $4,
          estimated_cost = COALESCE($5, estimated_cost),
          original_shop_code = COALESCE(original_shop_code, shop_code),
          original_target_month = COALESCE(original_target_month, target_month),
          modification_reason = $6,
          project_assignment_id = $7,
          updated_by_id = $8
        WHERE id = $9`,
        [
          input.new_shop_code, newShopName,
          input.new_target_month, input.new_target_date || null,
          input.new_estimated_cost || null,
          input.reason, newPa.id,
          input.relocked_by_id, old.car_assignment_id,
        ]
      );

      // Dual-write: update V2 event shop/month (non-blocking)
      try {
        const v2Event = await shoppingEventV2Service.getActiveEventForCar(old.car_number);
        if (v2Event) {
          await query(
            `UPDATE shopping_events_v2 SET
              shop_code = $1, target_month = $2, estimated_cost = COALESCE($3, estimated_cost),
              updated_by_id = $4
            WHERE id = $5`,
            [input.new_shop_code, input.new_target_month, input.new_estimated_cost || null, input.relocked_by_id, v2Event.id]
          );
        }
      } catch (v2Err) {
        logger.warn({ err: v2Err }, `[ProjectPlanning] V2 relock sync failed for ${old.car_number} (non-blocking)`);
      }
    }

    // Audit: supersede event
    await writeAuditEventTx(client, {
      project_id: input.project_id,
      project_assignment_id: old.id,
      car_number: old.car_number,
      actor_id: input.relocked_by_id,
      actor_email: input.relocked_by_email,
      action: 'plan_superseded',
      before_state: 'Locked',
      after_state: 'Superseded',
      reason: input.reason,
      plan_snapshot: {
        old_shop_code: old.shop_code,
        old_target_month: old.target_month,
        superseded_by_id: newPa.id,
      },
    });

    // Audit: relock event
    await writeAuditEventTx(client, {
      project_id: input.project_id,
      project_assignment_id: newPa.id,
      car_number: old.car_number,
      actor_id: input.relocked_by_id,
      actor_email: input.relocked_by_email,
      action: 'plan_relocked',
      before_state: 'Locked',
      after_state: 'Locked',
      reason: input.reason,
      plan_snapshot: {
        new_shop_code: input.new_shop_code,
        new_target_month: input.new_target_month,
        lock_version: (old.lock_version || 0) + 1,
        previous_assignment_id: old.id,
      },
    });

    // Update project counts
    await client.query(
      `UPDATE projects SET
        plan_version = plan_version + 1,
        last_plan_locked_at = NOW(),
        updated_at = NOW()
      WHERE id = $1`,
      [input.project_id]
    );

    // Queue relock email notification (non-blocking)
    const projInfo = await client.query(
      'SELECT project_number, project_name FROM projects WHERE id = $1',
      [input.project_id]
    );
    const proj = projInfo.rows[0];
    if (proj) {
      notifyProjectRelock({
        project_number: proj.project_number,
        project_name: proj.project_name,
        car_number: old.car_number,
        old_shop: old.shop_code,
        new_shop: input.new_shop_code,
        old_month: old.target_month,
        new_month: input.new_target_month,
        reason: input.reason,
        relocked_by: input.relocked_by_email || 'system',
      }).catch(err => logger.error({ err: err }, '[Email] Failed to queue relock notification'));
    }

    return newPa;
  });
}

// ============================================================================
// CANCEL PLAN
// ============================================================================

/**
 * Cancel a plan (Planned or Locked -> Cancelled).
 * If locked, also cancels the SSOT car_assignment.
 */
export async function cancelPlan(input: CancelPlanInput): Promise<ProjectAssignment> {
  return transaction(async (client) => {
    const paResult = await client.query(
      'SELECT * FROM project_assignments WHERE id = $1 FOR UPDATE',
      [input.project_assignment_id]
    );
    const pa = paResult.rows[0] as ProjectAssignment;

    if (!pa) throw new Error('Project assignment not found');
    if (pa.plan_state === 'Superseded' || pa.plan_state === 'Cancelled') {
      throw new Error(`Cannot cancel: current state is ${pa.plan_state}`);
    }
    if (pa.project_id !== input.project_id) throw new Error('Assignment does not belong to this project');

    const previousState = pa.plan_state;

    // Cancel the project_assignment
    const updateResult = await client.query(
      `UPDATE project_assignments SET
        plan_state = 'Cancelled',
        supersede_reason = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
      [input.reason, pa.id]
    );

    // If it was Locked, also cancel the SSOT car_assignment
    if (previousState === 'Locked' && pa.car_assignment_id) {
      await client.query(
        `UPDATE car_assignments SET
          status = 'Cancelled',
          cancelled_at = NOW(),
          cancelled_by_id = $1,
          cancellation_reason = $2
        WHERE id = $3`,
        [input.cancelled_by_id, input.reason, pa.car_assignment_id]
      );

      // Dual-write: cancel V2 event (non-blocking)
      try {
        const v2Event = await shoppingEventV2Service.getActiveEventForCar(pa.car_number);
        if (v2Event) {
          await shoppingEventV2Service.cancelShoppingEvent(v2Event.id, input.reason, input.cancelled_by_id);
        }
      } catch (v2Err) {
        logger.warn({ err: v2Err }, `[ProjectPlanning] V2 cancel sync failed for ${pa.car_number} (non-blocking)`);
      }
    }

    // Audit
    await writeAuditEventTx(client, {
      project_id: input.project_id,
      project_assignment_id: pa.id,
      car_number: pa.car_number,
      actor_id: input.cancelled_by_id,
      actor_email: input.cancelled_by_email,
      action: 'plan_cancelled',
      before_state: previousState,
      after_state: 'Cancelled',
      reason: input.reason,
    });

    await updateProjectPlanCountsTx(client, input.project_id);

    return updateResult.rows[0] as ProjectAssignment;
  });
}

// ============================================================================
// GET PLAN SUMMARY
// ============================================================================

/**
 * Get the full plan summary for a project, grouped by shop.
 */
export async function getPlanSummary(projectId: string): Promise<ProjectPlanSummary> {
  // Get project info
  const project = await queryOne<{
    id: string;
    project_number: string;
    project_name: string;
    plan_version: number;
    last_plan_locked_at: string;
    last_communicated_at: string;
  }>('SELECT id, project_number, project_name, plan_version, last_plan_locked_at, last_communicated_at FROM projects WHERE id = $1', [projectId]);

  if (!project) throw new Error('Project not found');

  // Get all active assignments (not Superseded)
  const assignments = await query<ProjectAssignment>(
    `SELECT * FROM v_project_assignments_detail
     WHERE project_id = $1
     ORDER BY plan_state, shop_code, target_month, car_number`,
    [projectId]
  );

  // Get car counts
  const counts = await queryOne<{
    total_cars: string;
    unplanned_cars: string;
    completed_cars: string;
  }>(`
    SELECT
      COUNT(*) AS total_cars,
      COUNT(*) FILTER (WHERE pc.status = 'pending') AS unplanned_cars,
      COUNT(*) FILTER (WHERE pc.status = 'completed') AS completed_cars
    FROM project_cars pc
    WHERE pc.project_id = $1
  `, [projectId]);

  const activeAssignments = assignments.filter(a => a.plan_state !== 'Superseded');
  const planned = activeAssignments.filter(a => a.plan_state === 'Planned').length;
  const locked = activeAssignments.filter(a => a.plan_state === 'Locked').length;
  const totalEstimatedCost = activeAssignments
    .filter(a => a.plan_state !== 'Cancelled')
    .reduce((sum, a) => sum + (Number(a.estimated_cost) || 0), 0);

  // Group by shop
  const byShop: Record<string, ProjectAssignment[]> = {};
  for (const a of activeAssignments) {
    const key = `${a.shop_code} - ${a.shop_name || a.shop_code}`;
    if (!byShop[key]) byShop[key] = [];
    byShop[key].push(a);
  }

  return {
    project_id: project.id,
    project_number: project.project_number,
    project_name: project.project_name,
    total_cars: parseInt(counts?.total_cars || '0', 10),
    unplanned_cars: parseInt(counts?.unplanned_cars || '0', 10),
    planned_cars: planned,
    locked_cars: locked,
    completed_cars: parseInt(counts?.completed_cars || '0', 10),
    total_estimated_cost: totalEstimatedCost,
    plan_version: project.plan_version || 0,
    last_plan_locked_at: project.last_plan_locked_at ? new Date(project.last_plan_locked_at) : undefined,
    last_communicated_at: project.last_communicated_at ? new Date(project.last_communicated_at) : undefined,
    assignments,
    assignments_by_shop: byShop,
  };
}

// ============================================================================
// COMMUNICATIONS
// ============================================================================

/**
 * Log a customer communication. Snapshots the current plan state.
 */
export async function logCommunication(input: LogCommunicationInput): Promise<ProjectCommunication> {
  // Snapshot current plan
  const planSummary = await getPlanSummary(input.project_id);
  const snapshot = {
    plan_version: planSummary.plan_version,
    total_cars: planSummary.total_cars,
    planned_cars: planSummary.planned_cars,
    locked_cars: planSummary.locked_cars,
    completed_cars: planSummary.completed_cars,
    total_estimated_cost: planSummary.total_estimated_cost,
    assignments: planSummary.assignments.filter(a => a.plan_state !== 'Superseded').map(a => ({
      car_number: a.car_number,
      shop_code: a.shop_code,
      target_month: a.target_month,
      plan_state: a.plan_state,
      estimated_cost: a.estimated_cost,
    })),
  };

  const sql = `
    INSERT INTO project_communications (
      project_id, communication_type, plan_version_snapshot,
      communicated_by, communicated_to, communication_method,
      subject, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const rows = await query<ProjectCommunication>(sql, [
    input.project_id,
    input.communication_type,
    JSON.stringify(snapshot),
    input.communicated_by_id,
    input.communicated_to || null,
    input.communication_method || null,
    input.subject || null,
    input.notes || null,
  ]);

  // Update project last_communicated_at
  await query(
    'UPDATE projects SET last_communicated_at = NOW(), updated_at = NOW() WHERE id = $1',
    [input.project_id]
  );

  // Audit event
  await writeAuditEvent({
    project_id: input.project_id,
    actor_id: input.communicated_by_id,
    actor_email: input.communicated_by_email,
    action: 'communication_logged',
    notes: `${input.communication_type}: ${input.subject || '(no subject)'}`,
  });

  return rows[0];
}

/**
 * Get communications for a project
 */
export async function getCommunications(projectId: string): Promise<ProjectCommunication[]> {
  return query<ProjectCommunication>(
    `SELECT pc.*,
      TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS communicated_by_name
    FROM project_communications pc
    LEFT JOIN users u ON u.id = pc.communicated_by
    WHERE pc.project_id = $1
    ORDER BY pc.communicated_at DESC`,
    [projectId]
  );
}

// ============================================================================
// OPPORTUNISTIC BUNDLING
// ============================================================================

/**
 * Detect if a car belongs to an active project with pending work.
 * Called when a shopping event is created or an assignment status changes.
 */
export async function detectProjectForCar(carNumber: string): Promise<{
  project_id: string;
  project_car_id: string;
  project_number: string;
  project_name: string;
  scope_of_work: string;
  assignment_id?: string;
  shop_code?: string;
  target_month?: string;
  plan_state?: string;
} | null> {
  const sql = `
    SELECT pc.project_id, pc.id AS project_car_id,
           p.project_number, p.project_name, p.scope_of_work,
           pa.id AS assignment_id, pa.shop_code, pa.target_month, pa.plan_state
    FROM project_cars pc
    JOIN projects p ON p.id = pc.project_id
    LEFT JOIN project_assignments pa ON pa.project_car_id = pc.id
      AND pa.plan_state IN ('Planned', 'Locked')
    WHERE pc.car_number = $1
      AND p.status IN ('active', 'in_progress')
      AND pc.status IN ('pending', 'in_progress')
    LIMIT 1
  `;

  return queryOne(sql, [carNumber]);
}

/**
 * Bundle project work onto a shopping event.
 * Creates an opportunistic project_assignment.
 */
export async function bundleProjectWork(input: BundleProjectWorkInput): Promise<ProjectAssignment> {
  return transaction(async (client) => {
    // Check if there's an existing active plan for this car
    const existingResult = await client.query(
      `SELECT * FROM project_assignments
       WHERE project_car_id = $1 AND plan_state IN ('Planned', 'Locked')
       FOR UPDATE`,
      [input.project_car_id]
    );

    const existing = existingResult.rows[0] as ProjectAssignment | undefined;

    // Get shop name
    const shopResult = await client.query(
      'SELECT shop_name FROM shops WHERE shop_code = $1',
      [input.shop_code]
    );
    const shopName = shopResult.rows[0]?.shop_name || input.shop_code;

    // If existing locked plan for DIFFERENT shop, supersede it
    if (existing && existing.plan_state === 'Locked' && existing.shop_code !== input.shop_code) {
      await client.query(
        `UPDATE project_assignments SET
          plan_state = 'Superseded',
          superseded_at = NOW(),
          supersede_reason = 'Opportunistic bundling at different shop',
          updated_at = NOW()
        WHERE id = $1`,
        [existing.id]
      );

      await writeAuditEventTx(client, {
        project_id: input.project_id,
        project_assignment_id: existing.id,
        car_number: input.car_number,
        actor_id: input.bundled_by_id,
        actor_email: input.bundled_by_email,
        action: 'plan_superseded',
        before_state: existing.plan_state,
        after_state: 'Superseded',
        reason: 'Opportunistic bundling at different shop',
      });
    } else if (existing && existing.plan_state === 'Planned') {
      // Cancel the planned one
      await client.query(
        `UPDATE project_assignments SET
          plan_state = 'Cancelled',
          supersede_reason = 'Superseded by opportunistic bundling',
          updated_at = NOW()
        WHERE id = $1`,
        [existing.id]
      );
    }

    // Create new opportunistic assignment
    const newResult = await client.query(
      `INSERT INTO project_assignments (
        project_id, project_car_id, car_number,
        shop_code, shop_name, target_month,
        plan_state, is_opportunistic, opportunistic_source,
        original_shopping_event_id,
        locked_at, locked_by, lock_version,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Locked', TRUE, 'other_shopping', $7, NOW(), $8, 1, $8)
      RETURNING *`,
      [
        input.project_id, input.project_car_id, input.car_number,
        input.shop_code, shopName, input.target_month,
        input.shopping_event_id,
        input.bundled_by_id,
      ]
    );

    const newPa = newResult.rows[0] as ProjectAssignment;

    // If old was superseded, link chain
    if (existing && existing.plan_state === 'Locked') {
      await client.query(
        'UPDATE project_assignments SET superseded_by_id = $1 WHERE id = $2',
        [newPa.id, existing.id]
      );
    }

    // Update project_cars status to in_progress
    await client.query(
      `UPDATE project_cars SET status = 'in_progress'
       WHERE id = $1 AND status = 'pending'`,
      [input.project_car_id]
    );

    // Update shopping event with project flag
    await client.query(
      `UPDATE shopping_events SET
        flagged_project_id = $1,
        bundled_project_assignment_id = $2,
        project_flag_checked = TRUE
      WHERE id = $3`,
      [input.project_id, newPa.id, input.shopping_event_id]
    );

    // Audit
    await writeAuditEventTx(client, {
      project_id: input.project_id,
      project_assignment_id: newPa.id,
      car_number: input.car_number,
      actor_id: input.bundled_by_id,
      actor_email: input.bundled_by_email,
      action: 'bundled_opportunistic',
      after_state: 'Locked',
      plan_snapshot: {
        shop_code: input.shop_code,
        target_month: input.target_month,
        shopping_event_id: input.shopping_event_id,
      },
    });

    await updateProjectPlanCountsTx(client, input.project_id);

    // Queue bundling alert email (non-blocking)
    const projInfo = await client.query(
      'SELECT project_number, project_name, scope_of_work FROM projects WHERE id = $1',
      [input.project_id]
    );
    const proj = projInfo.rows[0];
    if (proj) {
      notifyProjectBundling({
        project_number: proj.project_number,
        project_name: proj.project_name,
        car_number: input.car_number,
        shop_code: input.shop_code,
        scope_of_work: proj.scope_of_work || '',
      }).catch(err => logger.error({ err: err }, '[Email] Failed to queue bundling alert'));
    }

    return newPa;
  });
}

// ============================================================================
// UNLOCK PLAN (Locked -> Planned)
// ============================================================================

/**
 * Unlock a plan (Locked -> Planned).
 * Cancels the SSOT car_assignment and reverts the project_assignment.
 */
export async function unlockPlan(
  projectId: string,
  assignmentId: string,
  userId: string,
  notes?: string
): Promise<ProjectAssignment> {
  return transaction(async (client) => {
    // Get current assignment with lock
    const paResult = await client.query(
      'SELECT * FROM project_assignments WHERE id = $1 FOR UPDATE',
      [assignmentId]
    );
    const pa = paResult.rows[0] as ProjectAssignment;

    if (!pa) throw new Error('Project assignment not found');
    if (pa.plan_state !== 'Locked') {
      throw new Error(`Cannot unlock: current state is ${pa.plan_state}, expected Locked`);
    }
    if (pa.project_id !== projectId) {
      throw new Error('Assignment does not belong to this project');
    }

    // Cancel the SSOT car_assignment if it exists
    if (pa.car_assignment_id) {
      await client.query(
        `UPDATE car_assignments SET
          status = 'Cancelled',
          cancelled_at = NOW(),
          cancelled_by_id = $1,
          cancellation_reason = 'Plan unlocked'
        WHERE id = $2`,
        [userId, pa.car_assignment_id]
      );

      // Dual-write: cancel V2 event (non-blocking)
      try {
        const v2Event = await shoppingEventV2Service.getActiveEventForCar(pa.car_number);
        if (v2Event) {
          await shoppingEventV2Service.cancelShoppingEvent(v2Event.id, 'Plan unlocked', userId);
        }
      } catch (v2Err) {
        logger.warn({ err: v2Err }, `[ProjectPlanning] V2 unlock sync failed for ${pa.car_number} (non-blocking)`);
      }
    }

    // Revert project_assignment to Planned
    const updateResult = await client.query(
      `UPDATE project_assignments SET
        plan_state = 'Planned',
        locked_at = NULL,
        locked_by = NULL,
        car_assignment_id = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [assignmentId]
    );

    const updated = updateResult.rows[0] as ProjectAssignment;

    // Log the transition
    await logTransition({
      processType: 'project_assignment',
      entityId: assignmentId,
      entityNumber: pa.car_number,
      fromState: 'Locked',
      toState: 'Planned',
      isReversible: false,
      actorId: userId,
      sideEffects: pa.car_assignment_id
        ? [{ type: 'cancelled', entity_type: 'car_assignment', entity_id: pa.car_assignment_id }]
        : [],
      notes: notes || 'Plan unlocked',
    });

    // Audit event
    await writeAuditEventTx(client, {
      project_id: projectId,
      project_assignment_id: assignmentId,
      car_number: pa.car_number,
      actor_id: userId,
      action: 'plan_unlocked',
      before_state: 'Locked',
      after_state: 'Planned',
      reason: notes || 'Plan unlocked',
      plan_snapshot: {
        shop_code: pa.shop_code,
        target_month: pa.target_month,
        car_assignment_id: pa.car_assignment_id,
      },
    });

    // Update project counts
    await updateProjectPlanCountsTx(client, projectId);

    return updated;
  });
}

// ============================================================================
// HELPERS
// ============================================================================

async function updateProjectPlanCounts(projectId: string): Promise<void> {
  await query(
    `UPDATE projects SET
      planned_cars_count = (
        SELECT COUNT(*) FROM project_assignments
        WHERE project_id = $1 AND plan_state = 'Planned'
      ),
      locked_cars_count = (
        SELECT COUNT(*) FROM project_assignments
        WHERE project_id = $1 AND plan_state = 'Locked'
      ),
      updated_at = NOW()
    WHERE id = $1`,
    [projectId]
  );
}

async function updateProjectPlanCountsTx(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  projectId: string
): Promise<void> {
  await client.query(
    `UPDATE projects SET
      planned_cars_count = (
        SELECT COUNT(*) FROM project_assignments
        WHERE project_id = $1 AND plan_state = 'Planned'
      ),
      locked_cars_count = (
        SELECT COUNT(*) FROM project_assignments
        WHERE project_id = $1 AND plan_state = 'Locked'
      ),
      updated_at = NOW()
    WHERE id = $1`,
    [projectId]
  );
}

export default {
  planCars,
  lockCars,
  relockCar,
  cancelPlan,
  unlockPlan,
  getPlanSummary,
  logCommunication,
  getCommunications,
  detectProjectForCar,
  bundleProjectWork,
};
