-- Migration 074: Abatement Configuration + Billing Integration
-- Adds: qualifies_for_abatement on shopping_types, rider_abatement_overrides,
--        abatement_periods (materialized from shopping events + manual override)

-- =====================================================================
-- 1. Global Config: which shopping types qualify for abatement
-- =====================================================================
ALTER TABLE shopping_types ADD COLUMN IF NOT EXISTS qualifies_for_abatement BOOLEAN DEFAULT FALSE;

-- Set defaults — QUAL_REG is the primary abatement-qualifying type
UPDATE shopping_types SET qualifies_for_abatement = TRUE WHERE code = 'QUAL_REG';

-- =====================================================================
-- 2. Per-rider override (allows rider to opt-in or opt-out per shopping type)
-- =====================================================================
CREATE TABLE IF NOT EXISTS rider_abatement_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES lease_riders(id) ON DELETE CASCADE,
    shopping_type_id UUID NOT NULL REFERENCES shopping_types(id),
    qualifies_for_abatement BOOLEAN NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rider_id, shopping_type_id)
);

-- =====================================================================
-- 3. Abatement periods: materialized from shop entry/exit + manual override
-- =====================================================================
CREATE TABLE IF NOT EXISTS abatement_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),
    rider_id UUID NOT NULL REFERENCES lease_riders(id),
    shopping_event_id UUID REFERENCES shopping_events(id),
    shopping_type_code VARCHAR(50),
    start_date DATE NOT NULL,
    end_date DATE,
    is_manual_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    overridden_by UUID REFERENCES users(id),
    abatement_days INTEGER,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'void', 'billed')),
    applied_to_invoice_id UUID REFERENCES outbound_invoices(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abatement_periods_car ON abatement_periods(car_number);
CREATE INDEX IF NOT EXISTS idx_abatement_periods_rider ON abatement_periods(rider_id);
CREATE INDEX IF NOT EXISTS idx_abatement_periods_event ON abatement_periods(shopping_event_id);
CREATE INDEX IF NOT EXISTS idx_abatement_periods_status ON abatement_periods(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_abatement_periods_dates ON abatement_periods(start_date, end_date);
