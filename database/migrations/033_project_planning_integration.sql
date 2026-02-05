-- Migration 033: Project Planning Integration
-- Adds project_assignments (bridge between projects and car_assignments SSOT),
-- project_plan_audit_events (immutable), project_communications, and supporting columns.

-- ==============================================================================
-- SECTION 1: New Table - project_assignments
-- Bridge between a project car and its shop assignment. Carries plan/lock lifecycle.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_car_id UUID NOT NULL REFERENCES project_cars(id) ON DELETE CASCADE,
  car_number VARCHAR(20) NOT NULL,
  car_assignment_id UUID REFERENCES car_assignments(id),

  -- Plan details (denormalized; SSOT remains car_assignments)
  shop_code VARCHAR(20) NOT NULL REFERENCES shops(shop_code),
  shop_name VARCHAR(100),
  target_month VARCHAR(7) NOT NULL,
  target_date DATE,
  estimated_cost DECIMAL(12,2),

  -- Plan state machine: Planned -> Locked -> Superseded | Cancelled
  plan_state VARCHAR(20) NOT NULL DEFAULT 'Planned'
    CHECK (plan_state IN ('Planned', 'Locked', 'Superseded', 'Cancelled')),

  -- Lock tracking
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id),
  lock_version INTEGER DEFAULT 0,

  -- Supersession chain (relock creates new row, old row points here)
  superseded_by_id UUID REFERENCES project_assignments(id),
  superseded_at TIMESTAMPTZ,
  supersede_reason TEXT,

  -- Opportunistic bundling
  is_opportunistic BOOLEAN DEFAULT FALSE,
  opportunistic_source VARCHAR(50),
  original_shopping_event_id UUID,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1
);

-- Only one active plan per project car (Superseded and Cancelled don't count)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_plan_per_project_car
  ON project_assignments(project_car_id)
  WHERE plan_state NOT IN ('Superseded', 'Cancelled');

CREATE INDEX IF NOT EXISTS idx_pa_project ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_pa_car_number ON project_assignments(car_number);
CREATE INDEX IF NOT EXISTS idx_pa_car_assignment ON project_assignments(car_assignment_id);
CREATE INDEX IF NOT EXISTS idx_pa_shop ON project_assignments(shop_code, target_month);
CREATE INDEX IF NOT EXISTS idx_pa_state ON project_assignments(plan_state);

-- ==============================================================================
-- SECTION 2: New Table - project_plan_audit_events (Immutable)
-- Modeled after invoice_audit_events from migration 031.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS project_plan_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_assignment_id UUID REFERENCES project_assignments(id),
  car_number VARCHAR(20),
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID REFERENCES users(id),
  actor_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  before_state VARCHAR(20),
  after_state VARCHAR(20),
  plan_snapshot JSONB,
  reason TEXT,
  notes TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_ppae_project ON project_plan_audit_events(project_id);
CREATE INDEX IF NOT EXISTS idx_ppae_assignment ON project_plan_audit_events(project_assignment_id);
CREATE INDEX IF NOT EXISTS idx_ppae_timestamp ON project_plan_audit_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_ppae_action ON project_plan_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_ppae_car ON project_plan_audit_events(car_number);

-- Reuse existing prevent_audit_modification() function from migration 031.
-- If it doesn't exist (e.g., running standalone), create it.
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit events are immutable and cannot be modified or deleted';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_project_audit_update ON project_plan_audit_events;
CREATE TRIGGER prevent_project_audit_update
    BEFORE UPDATE OR DELETE ON project_plan_audit_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- ==============================================================================
-- SECTION 3: New Table - project_communications
-- Internal log of customer communications about the plan.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS project_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  communication_type VARCHAR(50) NOT NULL
    CHECK (communication_type IN ('plan_shared', 'lock_notification', 'relock_notification', 'status_update', 'completion_notice', 'other')),
  plan_version_snapshot JSONB NOT NULL,
  communicated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  communicated_by UUID NOT NULL REFERENCES users(id),
  communicated_to VARCHAR(500),
  communication_method VARCHAR(50)
    CHECK (communication_method IN ('email', 'phone', 'meeting', 'portal', 'other')),
  subject VARCHAR(500),
  notes TEXT,
  email_queue_id UUID REFERENCES email_queue(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pc_project ON project_communications(project_id);
CREATE INDEX IF NOT EXISTS idx_pc_type ON project_communications(communication_type);

-- ==============================================================================
-- SECTION 4: Column Additions to Existing Tables
-- ==============================================================================

-- car_assignments: link back to project
ALTER TABLE car_assignments ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE car_assignments ADD COLUMN IF NOT EXISTS project_assignment_id UUID REFERENCES project_assignments(id);

-- demands: optional project link
ALTER TABLE demands ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- projects: planning summary fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_version INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_plan_locked_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_communicated_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS locked_cars_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS planned_cars_count INTEGER DEFAULT 0;

-- notification_preferences: project notifications
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_project_lock_changes BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_project_bundling_alerts BOOLEAN DEFAULT true;

-- shopping_events: project detection flags
ALTER TABLE shopping_events ADD COLUMN IF NOT EXISTS project_flag_checked BOOLEAN DEFAULT FALSE;
ALTER TABLE shopping_events ADD COLUMN IF NOT EXISTS flagged_project_id UUID REFERENCES projects(id);
ALTER TABLE shopping_events ADD COLUMN IF NOT EXISTS bundled_project_assignment_id UUID REFERENCES project_assignments(id);

-- car_assignments source constraint: add 'project_plan'
-- Drop and re-add (safe because all existing values are valid subsets)
ALTER TABLE car_assignments DROP CONSTRAINT IF EXISTS chk_ca_source;
ALTER TABLE car_assignments ADD CONSTRAINT chk_ca_source
  CHECK (source IN ('demand_plan', 'service_plan', 'scenario_export', 'bad_order', 'quick_shop', 'import', 'master_plan', 'migration', 'brc_import', 'project_plan'));

-- ==============================================================================
-- SECTION 5: Views
-- ==============================================================================

-- v_project_plan_summary: project with planning metrics
CREATE OR REPLACE VIEW v_project_plan_summary AS
SELECT
  p.id,
  p.project_number,
  p.project_name,
  p.project_type,
  p.status,
  p.priority,
  p.lessee_code,
  p.lessee_name,
  p.mc_user_id,
  p.ec_user_id,
  p.plan_version,
  p.last_plan_locked_at,
  p.last_communicated_at,
  COALESCE(p.planned_cars_count, 0) AS planned_cars_count,
  COALESCE(p.locked_cars_count, 0) AS locked_cars_count,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id) AS total_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'pending') AS unplanned_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'completed') AS completed_cars,
  (SELECT COUNT(*) FROM project_assignments pa WHERE pa.project_id = p.id AND pa.plan_state = 'Planned') AS active_planned,
  (SELECT COUNT(*) FROM project_assignments pa WHERE pa.project_id = p.id AND pa.plan_state = 'Locked') AS active_locked,
  (SELECT COALESCE(SUM(pa.estimated_cost), 0) FROM project_assignments pa WHERE pa.project_id = p.id AND pa.plan_state IN ('Planned', 'Locked')) AS total_estimated_cost,
  (SELECT MAX(pc2.communicated_at) FROM project_communications pc2 WHERE pc2.project_id = p.id) AS last_communication_at,
  TRIM(COALESCE(mc.first_name, '') || ' ' || COALESCE(mc.last_name, '')) AS mc_name,
  TRIM(COALESCE(ec.first_name, '') || ' ' || COALESCE(ec.last_name, '')) AS ec_name
FROM projects p
LEFT JOIN users mc ON mc.id = p.mc_user_id
LEFT JOIN users ec ON ec.id = p.ec_user_id;

-- v_project_assignments_detail: full detail join
CREATE OR REPLACE VIEW v_project_assignments_detail AS
SELECT
  pa.id,
  pa.project_id,
  pa.project_car_id,
  pa.car_number,
  pa.car_assignment_id,
  pa.shop_code,
  pa.shop_name,
  pa.target_month,
  pa.target_date,
  pa.estimated_cost,
  pa.plan_state,
  pa.locked_at,
  pa.locked_by,
  pa.lock_version,
  pa.superseded_by_id,
  pa.superseded_at,
  pa.supersede_reason,
  pa.is_opportunistic,
  pa.opportunistic_source,
  pa.original_shopping_event_id,
  pa.created_at,
  pa.created_by,
  pa.updated_at,
  pa.version,
  p.project_number,
  p.project_name,
  p.project_type,
  p.status AS project_status,
  pc.status AS car_status,
  ca.status AS assignment_status,
  TRIM(COALESCE(lb.first_name, '') || ' ' || COALESCE(lb.last_name, '')) AS locked_by_name,
  TRIM(COALESCE(cb.first_name, '') || ' ' || COALESCE(cb.last_name, '')) AS created_by_name
FROM project_assignments pa
JOIN projects p ON p.id = pa.project_id
JOIN project_cars pc ON pc.id = pa.project_car_id
LEFT JOIN car_assignments ca ON ca.id = pa.car_assignment_id
LEFT JOIN users lb ON lb.id = pa.locked_by
LEFT JOIN users cb ON cb.id = pa.created_by;

-- Grant permissions
GRANT SELECT ON v_project_plan_summary TO railsync_app;
GRANT SELECT ON v_project_assignments_detail TO railsync_app;
GRANT ALL ON project_assignments TO railsync_app;
GRANT ALL ON project_plan_audit_events TO railsync_app;
GRANT ALL ON project_communications TO railsync_app;
