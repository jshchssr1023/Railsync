-- Migration 007: SSOT Car Assignments Architecture
-- This migration creates the Single Source of Truth tables for car assignments
-- All planning paths (demand, service plan, scenario, quick shop, bad order) feed into car_assignments

-- ============================================================================
-- CAR ASSIGNMENTS TABLE (The Single Source of Truth)
-- ============================================================================
-- This is the ONLY table that tracks active car-to-shop assignments.

CREATE TABLE IF NOT EXISTS car_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════
  -- CORE REFERENCE
  -- ═══════════════════════════════════════════════════════════════════
  car_id UUID NOT NULL,
  car_number VARCHAR(20) NOT NULL,  -- Denormalized for performance

  -- ═══════════════════════════════════════════════════════════════════
  -- ASSIGNMENT DETAILS
  -- ═══════════════════════════════════════════════════════════════════
  shop_code VARCHAR(20) NOT NULL,
  shop_name VARCHAR(100),  -- Denormalized for display
  target_month VARCHAR(7) NOT NULL,  -- YYYY-MM
  target_date DATE,  -- Specific date if known

  -- ═══════════════════════════════════════════════════════════════════
  -- STATUS LIFECYCLE
  -- ═══════════════════════════════════════════════════════════════════
  status VARCHAR(20) NOT NULL DEFAULT 'Planned',
  -- Planned     = Assignment created, not yet scheduled
  -- Scheduled   = Confirmed with shop, date set
  -- Enroute     = Car shipped to shop
  -- Arrived     = Car at shop
  -- InShop      = Work in progress
  -- Complete    = Work finished
  -- Cancelled   = Assignment cancelled

  -- Status dates
  planned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  enroute_at TIMESTAMP WITH TIME ZONE,
  arrived_at TIMESTAMP WITH TIME ZONE,
  in_shop_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- ═══════════════════════════════════════════════════════════════════
  -- PRIORITY & EXPEDITE
  -- ═══════════════════════════════════════════════════════════════════
  priority INTEGER NOT NULL DEFAULT 3,
  -- 1 = Critical (bad order, safety)
  -- 2 = High (qualification due within 30 days)
  -- 3 = Medium (qualification due within 90 days)
  -- 4 = Low (planned maintenance)

  is_expedited BOOLEAN DEFAULT FALSE,
  expedite_reason TEXT,
  expedited_at TIMESTAMP WITH TIME ZONE,
  expedited_by_id UUID,

  -- ═══════════════════════════════════════════════════════════════════
  -- COST TRACKING
  -- ═══════════════════════════════════════════════════════════════════
  estimated_cost DECIMAL(12,2),
  actual_cost DECIMAL(12,2),
  cost_variance DECIMAL(12,2) GENERATED ALWAYS AS (actual_cost - estimated_cost) STORED,
  cost_breakdown JSONB,  -- Detailed cost components

  -- ═══════════════════════════════════════════════════════════════════
  -- SOURCE TRACKING (Where did this assignment come from?)
  -- ═══════════════════════════════════════════════════════════════════
  source VARCHAR(30) NOT NULL,
  -- 'demand_plan'      = From demand/qualification planning
  -- 'service_plan'     = From approved service plan
  -- 'scenario_export'  = From scenario commitment
  -- 'bad_order'        = Created from bad order report
  -- 'quick_shop'       = Manual via Quick Shop
  -- 'import'           = Bulk import
  -- 'master_plan'      = From master plan commitment
  -- 'migration'        = Migrated from legacy allocations

  source_reference_id UUID,  -- FK to originating record (demand_id, service_plan_id, etc.)
  source_reference_type VARCHAR(30),  -- Table name of source

  -- ═══════════════════════════════════════════════════════════════════
  -- MODIFICATION TRACKING
  -- ═══════════════════════════════════════════════════════════════════
  original_shop_code VARCHAR(20),  -- If shop was changed
  original_target_month VARCHAR(7),  -- If date was changed
  modification_reason TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- CANCELLATION
  -- ═══════════════════════════════════════════════════════════════════
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by_id UUID,
  cancellation_reason TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_id UUID,
  version INTEGER DEFAULT 1,  -- Optimistic locking

  -- ═══════════════════════════════════════════════════════════════════
  -- CONSTRAINTS
  -- ═══════════════════════════════════════════════════════════════════
  CONSTRAINT fk_ca_shop FOREIGN KEY (shop_code) REFERENCES shops(shop_code),
  CONSTRAINT chk_ca_status CHECK (status IN ('Planned', 'Scheduled', 'Enroute', 'Arrived', 'InShop', 'Complete', 'Cancelled')),
  CONSTRAINT chk_ca_priority CHECK (priority BETWEEN 1 AND 4),
  CONSTRAINT chk_ca_source CHECK (source IN ('demand_plan', 'service_plan', 'scenario_export', 'bad_order', 'quick_shop', 'import', 'master_plan', 'migration'))
);

-- CRITICAL: Only one active assignment per car
-- This constraint ensures data integrity across all planning paths
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_per_car
  ON car_assignments(car_id)
  WHERE status NOT IN ('Complete', 'Cancelled');

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ca_status ON car_assignments(status);
CREATE INDEX IF NOT EXISTS idx_ca_shop ON car_assignments(shop_code);
CREATE INDEX IF NOT EXISTS idx_ca_target_month ON car_assignments(target_month);
CREATE INDEX IF NOT EXISTS idx_ca_priority ON car_assignments(priority) WHERE status = 'Planned';
CREATE INDEX IF NOT EXISTS idx_ca_car_number ON car_assignments(car_number);
CREATE INDEX IF NOT EXISTS idx_ca_source ON car_assignments(source);
CREATE INDEX IF NOT EXISTS idx_ca_created_at ON car_assignments(created_at);

-- ============================================================================
-- ASSIGNMENT SERVICE OPTIONS TABLE (Work to be Performed)
-- ============================================================================
-- Service options are attached to assignments. Qualification is just another service option.

CREATE TABLE IF NOT EXISTS assignment_service_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════
  -- REFERENCE
  -- ═══════════════════════════════════════════════════════════════════
  assignment_id UUID NOT NULL REFERENCES car_assignments(id) ON DELETE CASCADE,

  -- ═══════════════════════════════════════════════════════════════════
  -- SERVICE OPTION DETAILS
  -- ═══════════════════════════════════════════════════════════════════
  service_type VARCHAR(30) NOT NULL,
  -- Qualification types:
  --   'tank_qualification', 'rule_88b', 'safety_relief', 'service_equipment',
  --   'stub_sill', 'tank_thickness', 'interior_lining', 'min_inspection'
  -- Repair types:
  --   'bad_order_repair', 'running_repair', 'lining_replacement',
  --   'valve_repair', 'structural_repair'
  -- Other:
  --   'cleaning', 'painting', 'inspection'

  service_category VARCHAR(20) NOT NULL,
  -- 'qualification', 'repair', 'maintenance', 'inspection'

  description TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- TIMING
  -- ═══════════════════════════════════════════════════════════════════
  due_date DATE,           -- For qualifications (when it's due)
  reported_date DATE,      -- For bad orders (when reported)

  -- ═══════════════════════════════════════════════════════════════════
  -- SELECTION & STATUS
  -- ═══════════════════════════════════════════════════════════════════
  is_required BOOLEAN DEFAULT FALSE,  -- Must be performed (e.g., overdue qual)
  is_selected BOOLEAN DEFAULT TRUE,   -- User selected to perform this

  status VARCHAR(20) DEFAULT 'Pending',
  -- Pending, InProgress, Complete, Skipped

  completed_at TIMESTAMP WITH TIME ZONE,

  -- ═══════════════════════════════════════════════════════════════════
  -- COST
  -- ═══════════════════════════════════════════════════════════════════
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  estimated_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2),

  -- ═══════════════════════════════════════════════════════════════════
  -- SOURCE (Where did this service option come from?)
  -- ═══════════════════════════════════════════════════════════════════
  source VARCHAR(30),
  -- 'qualification_due'  = Auto-added because qual is due
  -- 'bad_order'         = From bad order report
  -- 'user_added'        = Manually added by user
  -- 'service_plan'      = From service plan
  -- 'bundled'           = Added to bundle work

  source_reference_id UUID,  -- FK to bad_order_report, etc.

  -- ═══════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by_id UUID,

  -- ═══════════════════════════════════════════════════════════════════
  -- CONSTRAINTS
  -- ═══════════════════════════════════════════════════════════════════
  CONSTRAINT chk_aso_category CHECK (service_category IN ('qualification', 'repair', 'maintenance', 'inspection')),
  CONSTRAINT chk_aso_status CHECK (status IN ('Pending', 'InProgress', 'Complete', 'Skipped'))
);

CREATE INDEX IF NOT EXISTS idx_aso_assignment ON assignment_service_options(assignment_id);
CREATE INDEX IF NOT EXISTS idx_aso_type ON assignment_service_options(service_type);
CREATE INDEX IF NOT EXISTS idx_aso_category ON assignment_service_options(service_category);
CREATE INDEX IF NOT EXISTS idx_aso_status ON assignment_service_options(status);

-- ============================================================================
-- BAD ORDER REPORTS TABLE
-- ============================================================================
-- Bad orders are tracked separately but MUST link to an assignment for resolution.

CREATE TABLE IF NOT EXISTS bad_order_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════
  -- CAR REFERENCE
  -- ═══════════════════════════════════════════════════════════════════
  car_id UUID NOT NULL,
  car_number VARCHAR(20) NOT NULL,

  -- ═══════════════════════════════════════════════════════════════════
  -- ISSUE DETAILS
  -- ═══════════════════════════════════════════════════════════════════
  reported_date DATE NOT NULL DEFAULT CURRENT_DATE,

  issue_type VARCHAR(50) NOT NULL,
  -- 'valve_leak', 'structural_damage', 'lining_failure', 'gasket_failure',
  -- 'tank_integrity', 'safety_device', 'wheels_trucks', 'other'

  issue_description TEXT NOT NULL,

  severity VARCHAR(20) NOT NULL,
  -- 'critical' = Safety issue, cannot move car
  -- 'high'     = Significant issue, needs prompt attention
  -- 'medium'   = Issue found during inspection
  -- 'low'      = Minor issue, can wait

  -- ═══════════════════════════════════════════════════════════════════
  -- LOCATION & REPORTER
  -- ═══════════════════════════════════════════════════════════════════
  location VARCHAR(100),
  reported_by VARCHAR(100),
  reporter_contact VARCHAR(100),

  -- ═══════════════════════════════════════════════════════════════════
  -- STATUS & RESOLUTION
  -- ═══════════════════════════════════════════════════════════════════
  status VARCHAR(20) DEFAULT 'Open',
  -- 'open'              = Just reported
  -- 'pending_decision'  = Has existing plan, awaiting user decision
  -- 'assigned'          = Linked to assignment
  -- 'resolved'          = Work completed

  -- What action did the user take?
  resolution_action VARCHAR(30),
  -- 'expedite_existing'    = Moved up existing plan, added bad order work
  -- 'new_shop_combined'    = New shop, combined with planned work
  -- 'repair_only'          = Separate repair, kept original plan
  -- 'planning_review'      = Flagged for planning team

  -- Link to the assignment that resolves this
  assignment_id UUID REFERENCES car_assignments(id),

  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by_id UUID,
  resolution_notes TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- EXISTING PLAN DETECTION (populated when bad order is created)
  -- ═══════════════════════════════════════════════════════════════════
  existing_assignment_id UUID,  -- If car had a plan when bad order reported
  existing_shop_code VARCHAR(20),
  existing_target_month VARCHAR(7),
  had_existing_plan BOOLEAN DEFAULT FALSE,

  -- ═══════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_id UUID,

  -- ═══════════════════════════════════════════════════════════════════
  -- CONSTRAINTS
  -- ═══════════════════════════════════════════════════════════════════
  CONSTRAINT chk_bor_severity CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT chk_bor_status CHECK (status IN ('open', 'pending_decision', 'assigned', 'resolved')),
  CONSTRAINT chk_bor_resolution CHECK (resolution_action IS NULL OR resolution_action IN ('expedite_existing', 'new_shop_combined', 'repair_only', 'planning_review'))
);

CREATE INDEX IF NOT EXISTS idx_bor_car ON bad_order_reports(car_id);
CREATE INDEX IF NOT EXISTS idx_bor_car_number ON bad_order_reports(car_number);
CREATE INDEX IF NOT EXISTS idx_bor_status ON bad_order_reports(status);
CREATE INDEX IF NOT EXISTS idx_bor_severity ON bad_order_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bor_reported_date ON bad_order_reports(reported_date);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active assignments view (excludes completed and cancelled)
CREATE OR REPLACE VIEW v_active_assignments AS
SELECT
  ca.*,
  s.shop_name as current_shop_name,
  s.region,
  s.primary_railroad,
  s.is_preferred_network,
  (SELECT COUNT(*) FROM assignment_service_options aso WHERE aso.assignment_id = ca.id AND aso.is_selected = TRUE) as selected_options_count,
  (SELECT COALESCE(SUM(aso.estimated_cost), 0) FROM assignment_service_options aso WHERE aso.assignment_id = ca.id AND aso.is_selected = TRUE) as total_estimated_cost
FROM car_assignments ca
LEFT JOIN shops s ON ca.shop_code = s.shop_code
WHERE ca.status NOT IN ('Complete', 'Cancelled');

-- Assignment with service options summary
CREATE OR REPLACE VIEW v_assignment_summary AS
SELECT
  ca.id,
  ca.car_number,
  ca.shop_code,
  ca.shop_name,
  ca.target_month,
  ca.status,
  ca.priority,
  ca.source,
  ca.is_expedited,
  ca.estimated_cost,
  ca.actual_cost,
  ca.cost_variance,
  ca.created_at,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'id', aso.id,
      'service_type', aso.service_type,
      'service_category', aso.service_category,
      'description', aso.description,
      'is_required', aso.is_required,
      'is_selected', aso.is_selected,
      'status', aso.status,
      'estimated_cost', aso.estimated_cost
    ))
    FROM assignment_service_options aso
    WHERE aso.assignment_id = ca.id),
    '[]'::json
  ) as service_options
FROM car_assignments ca;

-- Open bad orders view
CREATE OR REPLACE VIEW v_open_bad_orders AS
SELECT
  bor.*,
  CASE
    WHEN bor.severity = 'critical' THEN 1
    WHEN bor.severity = 'high' THEN 2
    WHEN bor.severity = 'medium' THEN 3
    ELSE 4
  END as severity_rank,
  CURRENT_DATE - bor.reported_date as days_open
FROM bad_order_reports bor
WHERE bor.status IN ('open', 'pending_decision')
ORDER BY severity_rank, bor.reported_date;

-- Shop workload view (assignments per shop per month)
CREATE OR REPLACE VIEW v_shop_workload AS
SELECT
  ca.shop_code,
  s.shop_name,
  ca.target_month,
  COUNT(*) as assignment_count,
  COUNT(*) FILTER (WHERE ca.status = 'Planned') as planned_count,
  COUNT(*) FILTER (WHERE ca.status = 'Scheduled') as scheduled_count,
  COUNT(*) FILTER (WHERE ca.status IN ('Enroute', 'Arrived', 'InShop')) as in_progress_count,
  COALESCE(SUM(ca.estimated_cost), 0) as total_estimated_cost,
  COALESCE(SUM(ca.actual_cost), 0) as total_actual_cost
FROM car_assignments ca
JOIN shops s ON ca.shop_code = s.shop_code
WHERE ca.status NOT IN ('Cancelled')
GROUP BY ca.shop_code, s.shop_name, ca.target_month
ORDER BY ca.target_month, ca.shop_code;

-- ============================================================================
-- TRIGGERS FOR AUDIT AND VERSIONING
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_car_assignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_car_assignment_update ON car_assignments;
CREATE TRIGGER trg_car_assignment_update
  BEFORE UPDATE ON car_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_car_assignment_timestamp();

-- ============================================================================
-- MIGRATION: Convert existing allocations to car_assignments
-- ============================================================================
-- This inserts existing allocations into the new SSOT table

INSERT INTO car_assignments (
  car_id,
  car_number,
  shop_code,
  shop_name,
  target_month,
  status,
  priority,
  estimated_cost,
  actual_cost,
  source,
  source_reference_id,
  created_at
)
SELECT
  -- Use car_id if it's a UUID, otherwise generate one based on car_number
  COALESCE(
    (SELECT c.id FROM cars c WHERE c.car_number = a.car_number LIMIT 1),
    gen_random_uuid()
  ) as car_id,
  a.car_number,
  a.shop_code,
  s.shop_name,
  a.target_month,
  CASE
    WHEN a.current_status = 'completed' THEN 'Complete'
    WHEN a.current_status = 'in_shop' THEN 'InShop'
    WHEN a.current_status = 'enroute' THEN 'Enroute'
    WHEN a.current_status = 'scheduled' THEN 'Scheduled'
    WHEN a.current_status = 'dispo' THEN 'Planned'
    WHEN a.status = 'Released' THEN 'Cancelled'
    ELSE 'Planned'
  END as status,
  CASE
    WHEN a.needs_shopping_reason ILIKE '%bad order%' THEN 1
    WHEN a.needs_shopping_reason ILIKE '%qualification%' THEN 2
    ELSE 3
  END as priority,
  CAST(a.estimated_cost AS DECIMAL(12,2)),
  CAST(a.actual_cost AS DECIMAL(12,2)),
  'migration' as source,
  a.id as source_reference_id,
  a.created_at
FROM allocations a
LEFT JOIN shops s ON a.shop_code = s.shop_code
WHERE a.status != 'Released'
  AND NOT EXISTS (
    SELECT 1 FROM car_assignments ca WHERE ca.source_reference_id = a.id
  )
ON CONFLICT DO NOTHING;

-- Add default service options for migrated assignments based on needs_shopping_reason
INSERT INTO assignment_service_options (
  assignment_id,
  service_type,
  service_category,
  description,
  is_required,
  is_selected,
  source
)
SELECT
  ca.id,
  CASE
    WHEN a.needs_shopping_reason ILIKE '%qualification%' THEN 'tank_qualification'
    WHEN a.needs_shopping_reason ILIKE '%bad order%' THEN 'bad_order_repair'
    ELSE 'running_repair'
  END as service_type,
  CASE
    WHEN a.needs_shopping_reason ILIKE '%qualification%' THEN 'qualification'
    ELSE 'repair'
  END as service_category,
  COALESCE(a.needs_shopping_reason, 'Migrated from allocations'),
  TRUE,
  TRUE,
  'qualification_due'
FROM car_assignments ca
JOIN allocations a ON ca.source_reference_id = a.id
WHERE ca.source = 'migration'
  AND NOT EXISTS (
    SELECT 1 FROM assignment_service_options aso WHERE aso.assignment_id = ca.id
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify migration completed
DO $$
DECLARE
  allocation_count INTEGER;
  assignment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO allocation_count FROM allocations WHERE status != 'Released';
  SELECT COUNT(*) INTO assignment_count FROM car_assignments WHERE source = 'migration';

  RAISE NOTICE 'Migration complete: % allocations -> % assignments', allocation_count, assignment_count;
END $$;
