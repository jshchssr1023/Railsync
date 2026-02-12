-- ============================================================================
-- Migration 072: FMS Project Summary Alignment
-- Closes 6 gaps between FMS legacy system and RailSync project module:
--   1. Project types as configurable lookup table
--   2. Four person roles (Eng, Manager, EC, MC)
--   3. Specialty boolean flag
--   4. Lessee as FK to customers
--   5. Car assignment status granularity (Active/Done/Other/Inactive)
--   6. FMS numeric project ID sequence
-- ============================================================================

-- ============================================================================
-- 1. Project Types Lookup Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_types_code ON project_types(code);
CREATE INDEX IF NOT EXISTS idx_project_types_active ON project_types(is_active);

-- Seed project types: existing RailSync types + FMS types
INSERT INTO project_types (code, name, description, sort_order) VALUES
  ('AITX_QUAL',   'AITX Qualification',  'Qualification project for AITX tank cars',             1),
  ('DRAWING_PKG', 'Drawing Package',      'Engineering drawing package project',                  2),
  ('ASSIGNMENT',  'Assignment',           'Car assignment project — coordinated fleet deployment', 3),
  ('RELEASE',     'Release',              'Car release project — coordinated fleet return',       4),
  ('LINING',      'Lining',               'Interior lining replacement or repair project',        5),
  ('INSPECTION',  'Inspection',           'Regulatory or maintenance inspection project',         6),
  ('OTHER',       'Other',                'Miscellaneous project type',                           99)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2-4. Add New Columns to projects table
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type_id UUID REFERENCES project_types(id),
  ADD COLUMN IF NOT EXISTS engineer_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS is_specialty BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fms_project_id INTEGER;

-- Indexes for new FK columns
CREATE INDEX IF NOT EXISTS idx_projects_type_id ON projects(project_type_id);
CREATE INDEX IF NOT EXISTS idx_projects_engineer ON projects(engineer_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_fms_id ON projects(fms_project_id);

-- ============================================================================
-- 6. FMS Numeric Project ID Sequence
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS fms_project_id_seq START WITH 308000;
ALTER TABLE projects ALTER COLUMN fms_project_id SET DEFAULT nextval('fms_project_id_seq');

-- Backfill fms_project_id for existing projects that don't have one
UPDATE projects
SET fms_project_id = nextval('fms_project_id_seq')
WHERE fms_project_id IS NULL;

-- Make it unique after backfill
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_fms_id_unique ON projects(fms_project_id) WHERE fms_project_id IS NOT NULL;

-- ============================================================================
-- 1b. Backfill project_type_id from existing project_type strings
-- ============================================================================
UPDATE projects p
SET project_type_id = pt.id
FROM project_types pt
WHERE p.project_type_id IS NULL
  AND (
    (p.project_type = 'qualification' AND pt.code = 'AITX_QUAL') OR
    (p.project_type = 'assignment'    AND pt.code = 'ASSIGNMENT') OR
    (p.project_type = 'release'       AND pt.code = 'RELEASE') OR
    (p.project_type = 'lining'        AND pt.code = 'LINING') OR
    (p.project_type = 'inspection'    AND pt.code = 'INSPECTION') OR
    (p.project_type = 'other'         AND pt.code = 'OTHER')
  );

-- ============================================================================
-- 5. Expand project_cars Status
-- ============================================================================
-- Drop old check constraint and add expanded one
ALTER TABLE project_cars DROP CONSTRAINT IF EXISTS project_cars_status_check;
ALTER TABLE project_cars ADD CONSTRAINT project_cars_status_check
  CHECK (status IN ('pending', 'active', 'in_progress', 'completed', 'other', 'inactive', 'excluded'));

-- Migrate 'excluded' → 'inactive' for FMS alignment
UPDATE project_cars SET status = 'inactive' WHERE status = 'excluded';

-- ============================================================================
-- Rebuild Views (must DROP first — column names changed from prior definition)
-- ============================================================================
DROP VIEW IF EXISTS v_active_projects CASCADE;
DROP VIEW IF EXISTS v_projects CASCADE;
DROP VIEW IF EXISTS v_projects_by_type CASCADE;
DROP VIEW IF EXISTS v_projects_by_mc CASCADE;

-- v_projects: Full project list with all new fields and FMS car count buckets
CREATE OR REPLACE VIEW v_projects AS
SELECT
  p.*,
  -- Project type from lookup
  pt.code AS project_type_code,
  pt.name AS project_type_name,
  -- FMS project ID display
  p.fms_project_id,
  -- Person roles
  eng.first_name || ' ' || eng.last_name AS engineer_name,
  eng.email AS engineer_email,
  mgr.first_name || ' ' || mgr.last_name AS manager_name,
  mgr.email AS manager_email,
  mc.first_name || ' ' || mc.last_name AS mc_name,
  mc.email AS mc_email,
  ec.first_name || ' ' || ec.last_name AS ec_name,
  ec.email AS ec_email,
  cb.email AS created_by_email,
  -- Customer/Lessee
  cust.customer_name AS customer_name,
  cust.customer_code AS customer_code_fk,
  -- Car count buckets (FMS alignment)
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id) AS total_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status IN ('pending', 'active', 'in_progress')) AS active_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'completed') AS done_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'other') AS other_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status IN ('inactive', 'excluded')) AS inactive_cars,
  -- Legacy counts (keep backward compat)
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'pending') AS pending_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'in_progress') AS in_progress_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'completed') AS completed_cars,
  -- Deadline status
  CASE
    WHEN p.due_date IS NULL THEN 'No Deadline'
    WHEN p.due_date < CURRENT_DATE THEN 'Overdue'
    WHEN p.due_date < CURRENT_DATE + 7 THEN 'Due This Week'
    WHEN p.due_date < CURRENT_DATE + 30 THEN 'Due This Month'
    ELSE 'Future'
  END AS deadline_status
FROM projects p
LEFT JOIN project_types pt ON pt.id = p.project_type_id
LEFT JOIN users eng ON eng.id = p.engineer_id
LEFT JOIN users mgr ON mgr.id = p.manager_id
LEFT JOIN users mc ON mc.id = p.mc_user_id
LEFT JOIN users ec ON ec.id = p.ec_user_id
LEFT JOIN users cb ON cb.id = p.created_by
LEFT JOIN customers cust ON cust.id = p.customer_id
ORDER BY p.priority, p.due_date NULLS LAST, p.created_at DESC;

-- v_active_projects: Non-terminal projects
CREATE OR REPLACE VIEW v_active_projects AS
SELECT * FROM v_projects
WHERE status NOT IN ('completed', 'cancelled')
ORDER BY priority, due_date NULLS LAST;

-- v_projects_by_type: Summary by type (updated for lookup table)
CREATE OR REPLACE VIEW v_projects_by_type AS
SELECT
  COALESCE(pt.name, p.project_type) AS project_type_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE p.status = 'active') AS active,
  COUNT(*) FILTER (WHERE p.status = 'in_progress') AS in_progress,
  COUNT(*) FILTER (WHERE p.status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE p.due_date < CURRENT_DATE AND p.status NOT IN ('completed', 'cancelled')) AS overdue
FROM projects p
LEFT JOIN project_types pt ON pt.id = p.project_type_id
GROUP BY COALESCE(pt.name, p.project_type)
ORDER BY total DESC;

-- v_projects_by_mc: Summary by MC (unchanged structure, just re-created for consistency)
CREATE OR REPLACE VIEW v_projects_by_mc AS
SELECT
  p.mc_user_id,
  u.email AS mc_email,
  u.first_name || ' ' || u.last_name AS mc_name,
  COUNT(*) AS total_projects,
  COUNT(*) FILTER (WHERE p.status = 'active') AS active,
  COUNT(*) FILTER (WHERE p.status = 'in_progress') AS in_progress,
  SUM((SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id)) AS total_cars
FROM projects p
LEFT JOIN users u ON u.id = p.mc_user_id
WHERE p.status NOT IN ('completed', 'cancelled')
GROUP BY p.mc_user_id, u.email, u.first_name, u.last_name
ORDER BY total_projects DESC;
