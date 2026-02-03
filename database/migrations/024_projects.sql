-- ============================================================================
-- Migration 024: Projects
-- Folders that group cars for coordinated work (assignments, releases, qualifications)
-- ============================================================================

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  project_number VARCHAR(50) NOT NULL UNIQUE,
  project_name VARCHAR(200) NOT NULL,

  -- Type: assignment, release, qualification, other
  project_type VARCHAR(50) NOT NULL CHECK (project_type IN ('assignment', 'release', 'qualification', 'lining', 'inspection', 'other')),

  -- Classification
  shopping_reason_id UUID REFERENCES shopping_reasons(id),
  shopping_reason_code VARCHAR(50),
  shopping_reason_name VARCHAR(100),

  -- Scope
  scope_of_work TEXT NOT NULL,
  special_instructions TEXT,
  engineer_notes TEXT,

  -- Cost allocation
  customer_billable BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_total_cost DECIMAL(12,2) DEFAULT 0,
  actual_total_cost DECIMAL(12,2) DEFAULT 0,

  -- Lessee (optional - can be multi-lessee project)
  lessee_code VARCHAR(20),
  lessee_name VARCHAR(200),

  -- Deadline
  due_date DATE,
  priority INT DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),  -- 1=highest

  -- Team assignment
  mc_user_id UUID REFERENCES users(id),        -- Maintenance Coordinator
  ec_user_id UUID REFERENCES users(id),        -- Event Coordinator
  created_by UUID REFERENCES users(id),

  -- Status: draft, active, in_progress, pending_review, completed, cancelled
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'in_progress', 'pending_review', 'completed', 'cancelled')),

  -- Completion (MC designates via BRC review)
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES users(id),
  completion_notes TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Cars (cars included in the project)
CREATE TABLE IF NOT EXISTS project_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),

  -- Status within project: pending, in_progress, completed, excluded
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'excluded')),

  -- Tracking
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES users(id),
  completion_notes TEXT,

  -- BRC (Bad Order Report Card) review
  brc_reviewed BOOLEAN DEFAULT FALSE,
  brc_reviewed_at TIMESTAMP WITH TIME ZONE,
  brc_reviewed_by UUID REFERENCES users(id),

  CONSTRAINT unique_project_car UNIQUE (project_id, car_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_lessee ON projects(lessee_code);
CREATE INDEX IF NOT EXISTS idx_projects_due ON projects(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_mc ON projects(mc_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_ec ON projects(ec_user_id);

CREATE INDEX IF NOT EXISTS idx_project_cars_project ON project_cars(project_id);
CREATE INDEX IF NOT EXISTS idx_project_cars_car ON project_cars(car_number);
CREATE INDEX IF NOT EXISTS idx_project_cars_status ON project_cars(status);

-- Link cars to current active project
ALTER TABLE cars ADD COLUMN IF NOT EXISTS current_project_id UUID REFERENCES projects(id);
CREATE INDEX IF NOT EXISTS idx_cars_project ON cars(current_project_id);

-- Function to generate project number
CREATE OR REPLACE FUNCTION generate_project_number(p_type VARCHAR) RETURNS VARCHAR(50) AS $$
DECLARE
  prefix VARCHAR(3);
  seq INT;
BEGIN
  prefix := CASE p_type
    WHEN 'assignment' THEN 'ASN'
    WHEN 'release' THEN 'REL'
    WHEN 'qualification' THEN 'QUL'
    WHEN 'lining' THEN 'LIN'
    WHEN 'inspection' THEN 'INS'
    ELSE 'PRJ'
  END;

  SELECT COALESCE(MAX(CAST(SUBSTRING(project_number FROM 8) AS INT)), 0) + 1
  INTO seq
  FROM projects
  WHERE project_number LIKE prefix || '-' || TO_CHAR(NOW(), 'YYMM') || '-%';

  RETURN prefix || '-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- View: All projects with counts
CREATE OR REPLACE VIEW v_projects AS
SELECT
  p.*,
  mc.email AS mc_email,
  mc.first_name || ' ' || mc.last_name AS mc_name,
  ec.email AS ec_email,
  ec.first_name || ' ' || ec.last_name AS ec_name,
  cb.email AS created_by_email,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id) AS total_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'pending') AS pending_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'in_progress') AS in_progress_cars,
  (SELECT COUNT(*) FROM project_cars pc WHERE pc.project_id = p.id AND pc.status = 'completed') AS completed_cars,
  CASE
    WHEN p.due_date IS NULL THEN 'No Deadline'
    WHEN p.due_date < CURRENT_DATE THEN 'Overdue'
    WHEN p.due_date < CURRENT_DATE + 7 THEN 'Due This Week'
    WHEN p.due_date < CURRENT_DATE + 30 THEN 'Due This Month'
    ELSE 'Future'
  END AS deadline_status
FROM projects p
LEFT JOIN users mc ON mc.id = p.mc_user_id
LEFT JOIN users ec ON ec.id = p.ec_user_id
LEFT JOIN users cb ON cb.id = p.created_by
ORDER BY p.priority, p.due_date NULLS LAST, p.created_at DESC;

-- View: Active projects (not completed or cancelled)
CREATE OR REPLACE VIEW v_active_projects AS
SELECT * FROM v_projects
WHERE status NOT IN ('completed', 'cancelled')
ORDER BY priority, due_date NULLS LAST;

-- View: Project cars with details
CREATE OR REPLACE VIEW v_project_cars AS
SELECT
  pc.*,
  p.project_number,
  p.project_name,
  p.project_type,
  p.scope_of_work,
  p.status AS project_status,
  c.car_type,
  c.lessee_name,
  c.commodity,
  c.tank_qual_year,
  c.current_status AS car_current_status,
  ua.email AS added_by_email,
  uc.email AS completed_by_email,
  ur.email AS brc_reviewed_by_email
FROM project_cars pc
JOIN projects p ON p.id = pc.project_id
JOIN cars c ON c.car_number = pc.car_number
LEFT JOIN users ua ON ua.id = pc.added_by
LEFT JOIN users uc ON uc.id = pc.completed_by
LEFT JOIN users ur ON ur.id = pc.brc_reviewed_by;

-- View: Car project history (all projects a car has been in)
CREATE OR REPLACE VIEW v_car_project_history AS
SELECT
  pc.car_number,
  p.project_number,
  p.project_name,
  p.project_type,
  p.status AS project_status,
  pc.status AS car_status,
  pc.added_at,
  pc.completed_at,
  pc.brc_reviewed,
  pc.brc_reviewed_at
FROM project_cars pc
JOIN projects p ON p.id = pc.project_id
ORDER BY pc.car_number, pc.added_at DESC;

-- View: Projects by type summary
CREATE OR REPLACE VIEW v_projects_by_type AS
SELECT
  project_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'active') AS active,
  COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('completed', 'cancelled')) AS overdue
FROM projects
GROUP BY project_type
ORDER BY project_type;

-- View: Projects by MC summary
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

-- Trigger to update car's current_project_id when added to active project
CREATE OR REPLACE FUNCTION update_car_project_link() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Link car to project
    UPDATE cars SET current_project_id = NEW.project_id WHERE car_number = NEW.car_number;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' THEN
    -- Unlink car from project when completed
    UPDATE cars SET current_project_id = NULL WHERE car_number = NEW.car_number AND current_project_id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Unlink car from project when removed
    UPDATE cars SET current_project_id = NULL WHERE car_number = OLD.car_number AND current_project_id = OLD.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_cars_link
  AFTER INSERT OR UPDATE OR DELETE ON project_cars
  FOR EACH ROW EXECUTE FUNCTION update_car_project_link();
