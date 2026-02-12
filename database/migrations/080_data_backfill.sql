-- ============================================================================
-- Migration 080: Data Backfill
-- Phase 1 of the Car Lifecycle Correction Plan (docs/design/car-lifecycle-correction-plan.md)
--
-- Migrates existing data from old tables into new structures.
-- Old tables remain untouched (read-only shadows until Phase 4 cleanup).
--
-- Sections:
--   1. Migrate car_assignments + shopping_events → shopping_events_v2
--   2. Backfill cars.ready_to_load from operational_status_group
--   3. Create initial idle_periods for idle cars
--   4. Create triage_queue entries from operational_status_group = 'pending'
-- ============================================================================

-- ============================================================================
-- 0. DISABLE TRIGGERS during backfill
--    Direct INSERT/UPDATE during migration bypasses lifecycle rules.
-- ============================================================================

ALTER TABLE shopping_events_v2 DISABLE TRIGGER trg_shopping_event_v2_transition;

-- ============================================================================
-- 1. MIGRATE car_assignments + shopping_events → shopping_events_v2
--
-- Data mapping (from plan Part 4, Phase 1, Migration 077):
--
--   Assignment Planned, no shopping event      → EVENT or SHOP_ASSIGNED
--   Assignment Scheduled, no shopping event     → SHOP_ASSIGNED
--   Assignment Enroute / shopping INBOUND       → ENROUTE
--   Assignment Arrived / shopping INSPECTION    → ARRIVED
--   Shopping ESTIMATE_SUBMITTED                 → ESTIMATE_RECEIVED
--   Shopping ESTIMATE_UNDER_REVIEW              → ESTIMATE_RECEIVED
--   Shopping ESTIMATE_APPROVED                  → ESTIMATE_APPROVED
--   Shopping CHANGES_REQUIRED                   → ESTIMATE_RECEIVED
--   Shopping WORK_AUTHORIZED                    → WORK_IN_PROGRESS
--   Shopping IN_REPAIR                          → WORK_IN_PROGRESS
--   Shopping QA_COMPLETE                        → WORK_IN_PROGRESS
--   Shopping FINAL_ESTIMATE_SUBMITTED           → FINAL_ESTIMATE_RECEIVED
--   Shopping FINAL_ESTIMATE_APPROVED            → FINAL_APPROVED
--   Shopping READY_FOR_RELEASE                  → FINAL_APPROVED
--   Shopping RELEASED                           → CLOSED
--   Assignment Complete (no shopping event)     → CLOSED
--   Either CANCELLED                            → CANCELLED
-- ============================================================================

-- 1A. car_assignments WITH linked shopping_events
-- The shopping event's state takes precedence when both exist.
INSERT INTO shopping_events_v2 (
  id,
  event_number,
  car_id,
  car_number,
  state,
  source,
  source_reference_id,
  source_reference_type,
  shop_code,
  shop_name,
  target_month,
  target_date,
  priority,
  is_expedited,
  expedite_reason,
  expedited_at,
  expedited_by_id,
  shopping_type_code,
  shopping_reason_code,
  scope_of_work_id,
  batch_id,
  estimated_cost,
  approved_cost,
  original_shop_code,
  original_target_month,
  modification_reason,
  cancelled_at,
  cancelled_by_id,
  cancellation_reason,
  project_id,
  event_at,
  created_at,
  created_by_id,
  updated_at,
  updated_by_id,
  version
)
SELECT
  se.id,                               -- Preserve original shopping_event ID
  se.event_number,                     -- Preserve original event number
  COALESCE(se.car_id, ca.car_id, c_lookup.id),
  COALESCE(se.car_number, ca.car_number),

  -- Map old state → new state
  CASE
    WHEN se.state = 'CANCELLED' THEN 'CANCELLED'
    WHEN se.state = 'RELEASED' THEN 'CLOSED'
    WHEN se.state = 'READY_FOR_RELEASE' THEN 'FINAL_APPROVED'
    WHEN se.state = 'FINAL_ESTIMATE_APPROVED' THEN 'FINAL_APPROVED'
    WHEN se.state = 'FINAL_ESTIMATE_SUBMITTED' THEN 'FINAL_ESTIMATE_RECEIVED'
    WHEN se.state = 'QA_COMPLETE' THEN 'WORK_IN_PROGRESS'
    WHEN se.state = 'IN_REPAIR' THEN 'WORK_IN_PROGRESS'
    WHEN se.state = 'WORK_AUTHORIZED' THEN 'WORK_IN_PROGRESS'
    WHEN se.state = 'CHANGES_REQUIRED' THEN 'ESTIMATE_RECEIVED'
    WHEN se.state = 'ESTIMATE_APPROVED' THEN 'ESTIMATE_APPROVED'
    WHEN se.state = 'ESTIMATE_UNDER_REVIEW' THEN 'ESTIMATE_RECEIVED'
    WHEN se.state = 'ESTIMATE_SUBMITTED' THEN 'ESTIMATE_RECEIVED'
    WHEN se.state = 'INSPECTION' THEN 'ARRIVED'
    WHEN se.state = 'INBOUND' THEN 'ENROUTE'
    WHEN se.state = 'ASSIGNED_TO_SHOP' THEN 'SHOP_ASSIGNED'
    WHEN se.state = 'REQUESTED' THEN 'EVENT'
    ELSE 'EVENT'
  END AS state,

  -- Source: derive from car_assignment.source if available, else 'migration'
  COALESCE(ca.source, 'migration'),
  ca.source_reference_id,
  ca.source_reference_type,

  -- Logistics from car_assignment (preferred) or shopping_event
  COALESCE(ca.shop_code, se.shop_code),
  ca.shop_name,
  ca.target_month,
  ca.target_date,
  COALESCE(ca.priority, 3),
  COALESCE(ca.is_expedited, FALSE),
  ca.expedite_reason,
  ca.expedited_at,
  ca.expedited_by_id,

  -- Work detail from shopping_event
  se.shopping_type_code,
  se.shopping_reason_code,
  se.scope_of_work_id,
  se.batch_id,

  -- Cost from car_assignment
  ca.estimated_cost,
  ca.actual_cost,  -- maps to approved_cost

  -- Modification tracking from car_assignment
  ca.original_shop_code,
  ca.original_target_month,
  ca.modification_reason,

  -- Cancellation
  COALESCE(se.cancelled_at, ca.cancelled_at),
  COALESCE(se.cancelled_by_id, ca.cancelled_by_id),
  COALESCE(se.cancellation_reason, ca.cancellation_reason),

  -- Project (if linked via car_assignment project tables)
  NULL,  -- project_id — will be backfilled separately if needed

  -- Timestamps
  COALESCE(se.created_at, ca.created_at),  -- event_at
  COALESCE(se.created_at, ca.created_at),  -- created_at
  COALESCE(se.created_by_id, ca.created_by_id),
  COALESCE(se.updated_at, ca.updated_at),
  COALESCE(se.updated_by_id, ca.updated_by_id),
  COALESCE(se.version, ca.version, 1)

FROM shopping_events se
LEFT JOIN car_assignments ca ON ca.id = se.car_assignment_id
LEFT JOIN cars c_lookup ON c_lookup.car_number = COALESCE(se.car_number, ca.car_number)
WHERE COALESCE(se.car_id, ca.car_id, c_lookup.id) IS NOT NULL  -- Skip orphans with no valid car
  AND NOT EXISTS (
    -- Skip if already migrated (idempotent)
    SELECT 1 FROM shopping_events_v2 sv2 WHERE sv2.id = se.id
  );

-- 1B. car_assignments WITHOUT linked shopping_events
-- These are assignments that never had a shopping event created.
INSERT INTO shopping_events_v2 (
  event_number,
  car_id,
  car_number,
  state,
  source,
  source_reference_id,
  source_reference_type,
  shop_code,
  shop_name,
  target_month,
  target_date,
  priority,
  is_expedited,
  expedite_reason,
  expedited_at,
  expedited_by_id,
  estimated_cost,
  approved_cost,
  original_shop_code,
  original_target_month,
  modification_reason,
  cancelled_at,
  cancelled_by_id,
  cancellation_reason,
  event_at,
  closed_at,
  created_at,
  created_by_id,
  updated_at,
  updated_by_id,
  version
)
SELECT
  'MIG-CA-' || ca.id::TEXT,  -- Generate event_number from assignment ID
  COALESCE(ca.car_id, c_lookup.id),
  ca.car_number,

  -- Map assignment status → new state
  CASE
    WHEN ca.status = 'Cancelled' THEN 'CANCELLED'
    WHEN ca.status = 'Complete' THEN 'CLOSED'
    WHEN ca.status = 'InShop' THEN 'WORK_IN_PROGRESS'
    WHEN ca.status = 'Arrived' THEN 'ARRIVED'
    WHEN ca.status = 'Enroute' THEN 'ENROUTE'
    WHEN ca.status = 'Scheduled' THEN 'SHOP_ASSIGNED'
    WHEN ca.status = 'Planned' AND ca.shop_code IS NOT NULL THEN 'SHOP_ASSIGNED'
    WHEN ca.status = 'Planned' THEN 'EVENT'
    ELSE 'EVENT'
  END AS state,

  ca.source,
  ca.source_reference_id,
  ca.source_reference_type,

  ca.shop_code,
  ca.shop_name,
  ca.target_month,
  ca.target_date,
  ca.priority,
  COALESCE(ca.is_expedited, FALSE),
  ca.expedite_reason,
  ca.expedited_at,
  ca.expedited_by_id,

  ca.estimated_cost,
  ca.actual_cost,

  ca.original_shop_code,
  ca.original_target_month,
  ca.modification_reason,

  ca.cancelled_at,
  ca.cancelled_by_id,
  ca.cancellation_reason,

  ca.created_at,       -- event_at
  CASE WHEN ca.status = 'Complete' THEN ca.completed_at END,  -- closed_at
  ca.created_at,
  ca.created_by_id,
  ca.updated_at,
  ca.updated_by_id,
  COALESCE(ca.version, 1)

FROM car_assignments ca
LEFT JOIN cars c_lookup ON c_lookup.car_number = ca.car_number
WHERE COALESCE(ca.car_id, c_lookup.id) IS NOT NULL  -- Skip orphans with no valid car
  AND NOT EXISTS (
    -- Only assignments with NO shopping event
    SELECT 1 FROM shopping_events se WHERE se.car_assignment_id = ca.id
  )
  AND NOT EXISTS (
    -- Skip if already migrated (idempotent)
    SELECT 1 FROM shopping_events_v2 sv2 WHERE sv2.event_number = 'MIG-CA-' || ca.id::TEXT
  );

-- 1C. Set state timestamps on migrated records
-- Fill in the most relevant timestamp based on the mapped state.
-- Uses the original timestamps from car_assignments for logistics states.
UPDATE shopping_events_v2 sv2 SET
  shop_assigned_at = CASE
    WHEN sv2.state IN ('SHOP_ASSIGNED', 'DISPO_TO_SHOP', 'ENROUTE', 'ARRIVED',
                        'ESTIMATE_RECEIVED', 'ESTIMATE_APPROVED', 'WORK_IN_PROGRESS',
                        'FINAL_ESTIMATE_RECEIVED', 'FINAL_APPROVED', 'CLOSED')
    THEN COALESCE(ca.scheduled_at, sv2.created_at)
    ELSE NULL
  END,
  enroute_at = CASE
    WHEN sv2.state IN ('ENROUTE', 'ARRIVED', 'ESTIMATE_RECEIVED', 'ESTIMATE_APPROVED',
                        'WORK_IN_PROGRESS', 'FINAL_ESTIMATE_RECEIVED', 'FINAL_APPROVED', 'CLOSED')
    THEN COALESCE(ca.enroute_at, sv2.created_at)
    ELSE NULL
  END,
  arrived_at = CASE
    WHEN sv2.state IN ('ARRIVED', 'ESTIMATE_RECEIVED', 'ESTIMATE_APPROVED',
                        'WORK_IN_PROGRESS', 'FINAL_ESTIMATE_RECEIVED', 'FINAL_APPROVED', 'CLOSED')
    THEN COALESCE(ca.arrived_at, sv2.created_at)
    ELSE NULL
  END,
  work_started_at = CASE
    WHEN sv2.state IN ('WORK_IN_PROGRESS', 'FINAL_ESTIMATE_RECEIVED', 'FINAL_APPROVED', 'CLOSED')
    THEN COALESCE(ca.in_shop_at, sv2.created_at)
    ELSE NULL
  END,
  closed_at = CASE
    WHEN sv2.state = 'CLOSED'
    THEN COALESCE(sv2.closed_at, ca.completed_at, sv2.updated_at)
    ELSE NULL
  END
FROM car_assignments ca
WHERE ca.car_number = sv2.car_number
  AND (
    -- Match by shopping event link
    EXISTS (
      SELECT 1 FROM shopping_events se
      WHERE se.car_assignment_id = ca.id AND se.id = sv2.id
    )
    -- Or by generated event_number
    OR sv2.event_number = 'MIG-CA-' || ca.id::TEXT
  )
  AND sv2.shop_assigned_at IS NULL;  -- Only update if not already set (idempotent)

-- ============================================================================
-- 2. BACKFILL cars.ready_to_load FROM operational_status_group
-- ============================================================================

UPDATE cars SET
  ready_to_load = TRUE,
  ready_to_load_at = COALESCE(updated_at, NOW())
WHERE operational_status_group = 'ready_to_load'
  AND ready_to_load = FALSE;

-- ============================================================================
-- 3. CREATE INITIAL IDLE_PERIODS for cars currently in idle_storage
--
-- Cars that are in_fleet, not in a shop, not on rent, and not in scrap →
-- they should have an open idle period.
-- ============================================================================

INSERT INTO idle_periods (car_id, car_number, start_date, reason, location_code)
SELECT
  c.id,
  c.car_number,
  COALESCE(c.updated_at::DATE, CURRENT_DATE),  -- Best approximation of when idle started
  CASE
    WHEN c.operational_status_group = 'idle_storage' THEN 'between_leases'
    ELSE 'unknown'
  END,
  NULL  -- location_code unknown for historical backfill
FROM cars c
WHERE c.fleet_status = 'in_fleet'
  AND c.is_active = TRUE
  -- Not on any active rider
  AND NOT EXISTS (
    SELECT 1 FROM rider_cars rc
    WHERE rc.car_number = c.car_number
      AND rc.status IN ('decided', 'prep_required', 'on_rent', 'releasing')
  )
  -- Not in an active shopping event (check both old and new tables)
  AND NOT EXISTS (
    SELECT 1 FROM shopping_events se
    WHERE se.car_number = c.car_number
      AND se.state NOT IN ('RELEASED', 'CANCELLED')
  )
  AND NOT EXISTS (
    SELECT 1 FROM shopping_events_v2 sv2
    WHERE sv2.car_number = c.car_number
      AND sv2.state NOT IN ('CLOSED', 'CANCELLED')
  )
  -- Not in scrap workflow
  AND NOT EXISTS (
    SELECT 1 FROM scraps s
    WHERE s.car_number = c.car_number
      AND s.status NOT IN ('completed', 'cancelled')
  )
  -- Not already has an open idle period (idempotent)
  AND NOT EXISTS (
    SELECT 1 FROM idle_periods ip
    WHERE ip.car_id = c.id AND ip.end_date IS NULL
  );

-- ============================================================================
-- 4. CREATE TRIAGE_QUEUE ENTRIES from operational_status_group = 'pending'
--
-- Cars in "pending" status get a triage entry so planners must make
-- an explicit decision about them.
-- ============================================================================

INSERT INTO triage_queue (car_id, car_number, reason, priority, notes)
SELECT
  c.id,
  c.car_number,
  'manual',  -- Historical pending → manual triage reason (exact reason unknown)
  3,         -- Default priority
  'Migrated from operational_status_group = pending'
FROM cars c
WHERE c.operational_status_group = 'pending'
  AND c.fleet_status = 'in_fleet'
  -- Not already has an active triage entry (idempotent)
  AND NOT EXISTS (
    SELECT 1 FROM triage_queue tq
    WHERE tq.car_id = c.id AND tq.resolved_at IS NULL
  );

-- ============================================================================
-- 5. RE-ENABLE TRIGGERS
-- ============================================================================

ALTER TABLE shopping_events_v2 ENABLE TRIGGER trg_shopping_event_v2_transition;

-- ============================================================================
-- VERIFICATION QUERIES (informational — run manually to check)
-- ============================================================================

-- Count migrated shopping events vs original
-- SELECT 'shopping_events' AS source, COUNT(*) FROM shopping_events
-- UNION ALL
-- SELECT 'car_assignments (no SE)' AS source, COUNT(*)
--   FROM car_assignments ca
--   WHERE NOT EXISTS (SELECT 1 FROM shopping_events se WHERE se.car_assignment_id = ca.id)
-- UNION ALL
-- SELECT 'shopping_events_v2' AS source, COUNT(*) FROM shopping_events_v2;

-- Check rider_cars status distribution
-- SELECT status, COUNT(*) FROM rider_cars GROUP BY status;

-- Check idle_periods created
-- SELECT reason, COUNT(*) FROM idle_periods WHERE end_date IS NULL GROUP BY reason;

-- Check triage entries created
-- SELECT reason, COUNT(*) FROM triage_queue WHERE resolved_at IS NULL GROUP BY reason;
