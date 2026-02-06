-- ============================================================================
-- Migration 050: Qualifications Engine
-- Full qualification tracking, AAR/FRA rules library, compliance alerting
-- ============================================================================

-- ============================================================================
-- 1. Qualification Types (tank requalification, air brake, safety appliance, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS qualification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  regulatory_body VARCHAR(50) NOT NULL DEFAULT 'AAR', -- AAR, FRA, DOT, TC
  default_interval_months INT NOT NULL DEFAULT 120, -- 10 years default
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Qualification Rules Library (regulatory intervals, exemptions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS qualification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_type_id UUID NOT NULL REFERENCES qualification_types(id) ON DELETE CASCADE,
  rule_name VARCHAR(200) NOT NULL,
  interval_months INT NOT NULL,
  warning_days_90 BOOLEAN NOT NULL DEFAULT TRUE,
  warning_days_60 BOOLEAN NOT NULL DEFAULT TRUE,
  warning_days_30 BOOLEAN NOT NULL DEFAULT TRUE,
  applies_to_car_types JSONB DEFAULT '[]'::jsonb, -- e.g. ["DOT111","DOT112"]
  applies_to_commodities JSONB DEFAULT '[]'::jsonb, -- e.g. ["Chlorine","Ammonia"]
  exemption_conditions JSONB DEFAULT '{}'::jsonb, -- conditions that exempt a car
  regulatory_reference VARCHAR(200), -- e.g. "49 CFR 180.509"
  effective_date DATE,
  expiration_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qual_rules_type_id ON qualification_rules(qualification_type_id);
CREATE INDEX IF NOT EXISTS idx_qual_rules_active ON qualification_rules(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 3. Qualifications (per-car qualification records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  qualification_type_id UUID NOT NULL REFERENCES qualification_types(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('current', 'due_soon', 'due', 'overdue', 'exempt', 'unknown')),
  last_completed_date DATE,
  next_due_date DATE,
  expiry_date DATE,
  interval_months INT, -- override from type default if needed
  completed_by VARCHAR(200),
  completion_shop_code VARCHAR(20),
  certificate_number VARCHAR(100),
  notes TEXT,
  is_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  exempt_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(car_id, qualification_type_id)
);

CREATE INDEX IF NOT EXISTS idx_qualifications_car_id ON qualifications(car_id);
CREATE INDEX IF NOT EXISTS idx_qualifications_type_id ON qualifications(qualification_type_id);
CREATE INDEX IF NOT EXISTS idx_qualifications_status ON qualifications(status);
CREATE INDEX IF NOT EXISTS idx_qualifications_next_due ON qualifications(next_due_date);
CREATE INDEX IF NOT EXISTS idx_qualifications_overdue ON qualifications(status) WHERE status IN ('overdue', 'due', 'due_soon');

-- ============================================================================
-- 4. Qualification History (completion records, status changes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS qualification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id UUID NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL
    CHECK (action IN ('completed', 'updated', 'exempted', 'unexempted', 'expired', 'created', 'status_changed')),
  performed_by UUID REFERENCES users(id),
  performed_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_status VARCHAR(30),
  new_status VARCHAR(30),
  old_due_date DATE,
  new_due_date DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_qual_history_qual_id ON qualification_history(qualification_id);
CREATE INDEX IF NOT EXISTS idx_qual_history_date ON qualification_history(performed_date);

-- ============================================================================
-- 5. Qualification Alerts (generated warnings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS qualification_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id UUID NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  qualification_type_id UUID NOT NULL REFERENCES qualification_types(id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL
    CHECK (alert_type IN ('warning_90', 'warning_60', 'warning_30', 'overdue', 'expired')),
  alert_date DATE NOT NULL,
  due_date DATE NOT NULL,
  days_until_due INT,
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qual_alerts_car_id ON qualification_alerts(car_id);
CREATE INDEX IF NOT EXISTS idx_qual_alerts_type ON qualification_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_qual_alerts_unacked ON qualification_alerts(is_acknowledged) WHERE is_acknowledged = FALSE;

-- ============================================================================
-- 6. Seed standard AAR/FRA qualification types
-- ============================================================================
INSERT INTO qualification_types (code, name, description, regulatory_body, default_interval_months) VALUES
  ('TANK_REQUALIFICATION', 'Tank Requalification', 'Periodic tank car requalification per DOT/AAR requirements. Includes structural integrity, pressure testing, and safety device inspection.', 'DOT', 120),
  ('AIR_BRAKE', 'Air Brake Test', 'Single car air brake test per AAR requirements. Validates brake system functionality.', 'AAR', 48),
  ('SAFETY_APPLIANCE', 'Safety Appliance Inspection', 'Inspection of safety appliances (ladders, handholds, sill steps, brake wheels) per FRA requirements.', 'FRA', 60),
  ('HAZMAT_QUALIFICATION', 'Hazmat Qualification', 'Qualification for hazardous materials transport per DOT 49 CFR.', 'DOT', 120),
  ('PRESSURE_TEST', 'Hydrostatic Pressure Test', 'Tank car hydrostatic or pneumatic pressure test to verify structural integrity.', 'DOT', 120),
  ('VALVE_INSPECTION', 'Safety Relief Valve Inspection', 'Inspection and testing of safety relief valves and pressure relief devices.', 'AAR', 60),
  ('THICKNESS_TEST', 'Shell Thickness Test', 'Ultrasonic thickness testing of tank shell and heads to verify minimum thickness.', 'DOT', 120),
  ('EXTERIOR_VISUAL', 'Exterior Visual Inspection', 'Visual inspection of exterior including shell, heads, fittings, and running gear.', 'AAR', 12),
  ('LINING_INSPECTION', 'Interior Lining Inspection', 'Inspection of interior lining for cracks, disbondment, or deterioration.', 'AAR', 60),
  ('STUB_SILL', 'Stub Sill Inspection', 'Weld inspection of stub sill attachment per AAR requirement.', 'AAR', 120)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 7. Seed qualification rules for each type
-- ============================================================================
INSERT INTO qualification_rules (qualification_type_id, rule_name, interval_months, warning_days_90, warning_days_60, warning_days_30, applies_to_car_types, regulatory_reference)
SELECT qt.id, qt.name || ' - Standard Interval', qt.default_interval_months, TRUE, TRUE, TRUE, '[]'::jsonb,
  CASE qt.code
    WHEN 'TANK_REQUALIFICATION' THEN '49 CFR 180.509'
    WHEN 'AIR_BRAKE' THEN 'AAR S-486'
    WHEN 'SAFETY_APPLIANCE' THEN '49 CFR 231'
    WHEN 'HAZMAT_QUALIFICATION' THEN '49 CFR 173'
    WHEN 'PRESSURE_TEST' THEN '49 CFR 180.509(c)'
    WHEN 'VALVE_INSPECTION' THEN '49 CFR 180.509(d)'
    WHEN 'THICKNESS_TEST' THEN '49 CFR 180.509(e)'
    WHEN 'EXTERIOR_VISUAL' THEN 'AAR M-1002'
    WHEN 'LINING_INSPECTION' THEN 'AAR M-1002 App T'
    WHEN 'STUB_SILL' THEN 'AAR S-259'
    ELSE NULL
  END
FROM qualification_types qt
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. Backfill qualifications from existing cars.tank_qual_year
-- ============================================================================
-- Create a TANK_REQUALIFICATION record for every active car that has a tank_qual_year
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months)
SELECT
  c.id,
  qt.id,
  CASE
    WHEN c.tank_qual_year IS NULL THEN 'unknown'
    WHEN c.tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE) THEN 'overdue'
    WHEN c.tank_qual_year = EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN 'due_soon'
    ELSE 'current'
  END,
  -- Approximate last completed: 10 years before qual year
  CASE WHEN c.tank_qual_year IS NOT NULL
    THEN make_date(c.tank_qual_year - 10, 1, 1)
    ELSE NULL
  END,
  -- Next due: January 1 of qual year
  CASE WHEN c.tank_qual_year IS NOT NULL
    THEN make_date(c.tank_qual_year, 1, 1)
    ELSE NULL
  END,
  -- Expiry = end of qual year
  CASE WHEN c.tank_qual_year IS NOT NULL
    THEN make_date(c.tank_qual_year, 12, 31)
    ELSE NULL
  END,
  120 -- 10 year interval
FROM cars c
CROSS JOIN qualification_types qt
WHERE qt.code = 'TANK_REQUALIFICATION'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 9. Update existing qualification views to use new tables
-- ============================================================================
-- Drop old view (columns changed from migration 020)
DROP VIEW IF EXISTS v_qual_dashboard;
CREATE VIEW v_qual_dashboard AS
SELECT
  (SELECT COUNT(*) FROM cars WHERE is_active = TRUE) AS total_cars,
  (SELECT COUNT(*) FROM qualifications WHERE status = 'overdue') AS overdue_count,
  (SELECT COUNT(*) FROM qualifications WHERE status = 'due') AS due_count,
  (SELECT COUNT(*) FROM qualifications WHERE status = 'due_soon') AS due_soon_count,
  (SELECT COUNT(*) FROM qualifications WHERE status = 'current') AS current_count,
  (SELECT COUNT(*) FROM qualifications WHERE status = 'exempt') AS exempt_count,
  (SELECT COUNT(*) FROM qualifications WHERE status = 'unknown') AS unknown_count,
  (SELECT COUNT(DISTINCT car_id) FROM qualifications WHERE status = 'overdue') AS overdue_cars,
  (SELECT COUNT(DISTINCT car_id) FROM qualifications WHERE status IN ('due', 'due_soon')) AS due_cars,
  (SELECT COUNT(*) FROM qualification_alerts WHERE is_acknowledged = FALSE) AS unacked_alerts;
