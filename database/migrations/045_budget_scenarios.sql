-- Migration 045: Budget Scenarios
-- Budget impact modeling with slider-based multipliers for 4 dynamic categories.
-- Separate from existing "scenarios" table (shop selection weights).
-- Running Repairs is always static — no slider.

BEGIN;

CREATE TABLE budget_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  slider_assignment NUMERIC(5,2) NOT NULL DEFAULT 0,
  slider_qualification NUMERIC(5,2) NOT NULL DEFAULT 0,
  slider_commodity_conversion NUMERIC(5,2) NOT NULL DEFAULT 0,
  slider_bad_orders NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: sliders must be in range -100 to +100
ALTER TABLE budget_scenarios
  ADD CONSTRAINT chk_slider_assignment CHECK (slider_assignment BETWEEN -100 AND 100),
  ADD CONSTRAINT chk_slider_qualification CHECK (slider_qualification BETWEEN -100 AND 100),
  ADD CONSTRAINT chk_slider_commodity_conversion CHECK (slider_commodity_conversion BETWEEN -100 AND 100),
  ADD CONSTRAINT chk_slider_bad_orders CHECK (slider_bad_orders BETWEEN -100 AND 100);

-- Index for quick lookup by creator
CREATE INDEX idx_budget_scenarios_created_by ON budget_scenarios(created_by);

-- Seed system scenarios
INSERT INTO budget_scenarios (name, is_system, slider_assignment, slider_qualification, slider_commodity_conversion, slider_bad_orders) VALUES
  ('Balanced',       TRUE,   0,   0,   0,  0),
  ('AITX First',     TRUE,  10,   0, -10,  0),
  ('Cost Optimized', TRUE, -15, -10, -20,  0),
  ('Speed Optimized', TRUE, 20,  10,   0, 10);

COMMIT;
