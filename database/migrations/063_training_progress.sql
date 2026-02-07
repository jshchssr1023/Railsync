-- Training progress tracking
CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,  -- 'getting_started', 'core_operations', 'advanced', 'admin'
  duration_minutes INT DEFAULT 30,
  sort_order INT DEFAULT 0,
  content_url TEXT,  -- link to training material
  is_required BOOLEAN DEFAULT false,
  prerequisites UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  module_id UUID NOT NULL REFERENCES training_modules(id),
  status VARCHAR(50) NOT NULL DEFAULT 'not_started',  -- not_started, in_progress, completed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score DECIMAL(5,2),  -- optional quiz score
  time_spent_minutes INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

CREATE TABLE IF NOT EXISTS training_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  certification_type VARCHAR(100) NOT NULL,  -- 'basic_operator', 'advanced_operator', 'admin', 'go_live_ready'
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES users(id),
  notes TEXT
);

-- Seed the 7 standard training modules
INSERT INTO training_modules (title, description, category, duration_minutes, sort_order, is_required) VALUES
('System Navigation', 'Learn sidebar navigation, breadcrumbs, global command bar (Cmd+K), and keyboard shortcuts', 'getting_started', 15, 1, true),
('Car & Fleet Management', 'Managing cars, UMLER attributes, car identifiers, and fleet location tracking', 'getting_started', 30, 2, true),
('Shopping Workflow', 'End-to-end shopping event lifecycle from request to release, estimate review, and approval', 'core_operations', 45, 3, true),
('Invoice Processing', 'Invoice case state machine, BRC comparison, validation rules, and SAP integration', 'core_operations', 45, 4, true),
('Planning & Allocations', 'Quick Shop planning, master plans, demand forecasting, capacity grid, and project management', 'core_operations', 60, 5, true),
('Contracts & Billing', 'Contract hierarchy, amendments, riders, billing orchestration, and cost allocation', 'advanced', 45, 6, false),
('Admin & Configuration', 'User management, rules engine, CCM hierarchy, commodity cleaning, data validation, and system monitoring', 'admin', 60, 7, false)
ON CONFLICT DO NOTHING;

-- Index for fast progress lookups
CREATE INDEX IF NOT EXISTS idx_training_progress_user ON user_training_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_module ON user_training_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_training_cert_user ON training_certifications(user_id);

-- View for training dashboard
CREATE OR REPLACE VIEW v_training_dashboard AS
SELECT
  tm.id AS module_id,
  tm.title,
  tm.category,
  tm.duration_minutes,
  tm.is_required,
  tm.sort_order,
  COUNT(DISTINCT utp.user_id) FILTER (WHERE utp.status = 'completed') AS completed_count,
  COUNT(DISTINCT utp.user_id) FILTER (WHERE utp.status = 'in_progress') AS in_progress_count,
  COUNT(DISTINCT u.id) AS total_users,
  ROUND(
    COUNT(DISTINCT utp.user_id) FILTER (WHERE utp.status = 'completed')::DECIMAL /
    NULLIF(COUNT(DISTINCT u.id), 0) * 100, 1
  ) AS completion_rate
FROM training_modules tm
CROSS JOIN users u
LEFT JOIN user_training_progress utp ON utp.module_id = tm.id AND utp.user_id = u.id
WHERE u.is_active = true
GROUP BY tm.id, tm.title, tm.category, tm.duration_minutes, tm.is_required, tm.sort_order
ORDER BY tm.sort_order;
