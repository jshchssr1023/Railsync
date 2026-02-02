-- ============================================================================
-- Migration 014: Shopping Type & Shopping Reason Classification
-- Canonical classification for why cars need shop service
-- ============================================================================

-- Shopping Types (12 high-level categories)
CREATE TABLE IF NOT EXISTS shopping_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_planned BOOLEAN DEFAULT TRUE,
    default_cost_owner VARCHAR(50) DEFAULT 'lessor',  -- 'lessor' or 'lessee'
    tier_preference INTEGER DEFAULT 1,  -- 1 = Tier 1 preferred, 2 = Tier 2 OK
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shopping Reasons (dependent on Shopping Type)
CREATE TABLE IF NOT EXISTS shopping_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_type_id UUID NOT NULL REFERENCES shopping_types(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shopping_reasons_type ON shopping_reasons(shopping_type_id);

-- ============================================================================
-- SEED DATA: 12 Shopping Types
-- ============================================================================

INSERT INTO shopping_types (code, name, description, is_planned, default_cost_owner, tier_preference, sort_order) VALUES
('QUAL_REG', 'Qualification / Regulatory', 'Tank qualification, HM-201, regulatory compliance', TRUE, 'lessor', 1, 1),
('BAD_ORDER', 'Bad Order / Mechanical Failure', 'Unplanned repairs due to mechanical issues', FALSE, 'lessor', 1, 2),
('LEASE_ASSIGN', 'Lease Assignment Prep', 'Preparing car for new lessee', TRUE, 'lessor', 1, 3),
('LEASE_RETURN', 'Lease Return / Off-Hire', 'Processing car returned from lessee', TRUE, 'lessor', 1, 4),
('LESSEE_REQ', 'Lessee-Requested Service', 'Service requested by current lessee', TRUE, 'lessee', 2, 5),
('COMMODITY_CONV', 'Commodity Conversion', 'Converting car for different commodity', TRUE, 'lessor', 1, 6),
('RUNNING_REPAIR', 'Running Repair', 'Minor repairs while car remains in service', FALSE, 'lessor', 2, 7),
('PREVENTIVE', 'Preventive Maintenance', 'Scheduled preventive service', TRUE, 'lessor', 2, 8),
('STORAGE_PREP', 'Storage Preparation', 'Preparing car for long-term storage', TRUE, 'lessor', 2, 9),
('REACTIVATION', 'Reactivation from Storage', 'Returning stored car to active service', TRUE, 'lessor', 1, 10),
('INSURANCE_CLAIM', 'Insurance / Damage Claim', 'Repairs covered by insurance claim', FALSE, 'lessor', 1, 11),
('OTHER', 'Other / Miscellaneous', 'Other reasons not classified above', FALSE, 'lessor', 2, 12)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SEED DATA: Shopping Reasons by Type
-- ============================================================================

-- Bad Order / Mechanical Failure reasons
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_LEAK_PRODUCT', 'Leak - Product', 1 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_LEAK_NONPRODUCT', 'Leak - Non-Product', 2 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_VALVE_FAILURE', 'Valve Failure', 3 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_SAFETY_DEVICE', 'Safety Device Failure', 4 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_STRUCTURAL', 'Structural Damage', 5 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_TRUCK_COUPLER', 'Truck / Coupler Issue', 6 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_LINING_FAIL', 'Lining / Coating Failure', 7 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_THERMAL', 'Thermal Protection Damage', 8 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_HEATER_COIL', 'Heater / Coil Failure', 9 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;

-- Qualification / Regulatory reasons
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'QUAL_TANK_10YR', 'Tank Qualification (10-Year)', 1 FROM shopping_types WHERE code = 'QUAL_REG'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'QUAL_TANK_5YR', 'Tank Qualification (5-Year)', 2 FROM shopping_types WHERE code = 'QUAL_REG'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'QUAL_HM201', 'HM-201 Compliance', 3 FROM shopping_types WHERE code = 'QUAL_REG'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'QUAL_NONHM201', 'Non-HM-201 Service', 4 FROM shopping_types WHERE code = 'QUAL_REG'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'QUAL_AAR', 'AAR Compliance', 5 FROM shopping_types WHERE code = 'QUAL_REG'
ON CONFLICT (code) DO NOTHING;

-- Lease Assignment reasons
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'ASSIGN_NEW_LESSEE', 'New Lessee Preparation', 1 FROM shopping_types WHERE code = 'LEASE_ASSIGN'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'ASSIGN_COMMODITY_PREP', 'Commodity-Specific Prep', 2 FROM shopping_types WHERE code = 'LEASE_ASSIGN'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'ASSIGN_COSMETIC', 'Cosmetic / Stenciling', 3 FROM shopping_types WHERE code = 'LEASE_ASSIGN'
ON CONFLICT (code) DO NOTHING;

-- Lease Return reasons
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'RETURN_INSPECTION', 'Return Inspection', 1 FROM shopping_types WHERE code = 'LEASE_RETURN'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'RETURN_CLEANING', 'Cleaning / Decon', 2 FROM shopping_types WHERE code = 'LEASE_RETURN'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'RETURN_DAMAGE_REPAIR', 'Damage Repair (Billable)', 3 FROM shopping_types WHERE code = 'LEASE_RETURN'
ON CONFLICT (code) DO NOTHING;

-- Running Repair reasons
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'RR_MINOR_LEAK', 'Minor Leak Repair', 1 FROM shopping_types WHERE code = 'RUNNING_REPAIR'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'RR_VALVE_ADJ', 'Valve Adjustment', 2 FROM shopping_types WHERE code = 'RUNNING_REPAIR'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'RR_GASKET', 'Gasket Replacement', 3 FROM shopping_types WHERE code = 'RUNNING_REPAIR'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'RR_STENCIL', 'Stencil Update', 4 FROM shopping_types WHERE code = 'RUNNING_REPAIR'
ON CONFLICT (code) DO NOTHING;

-- Commodity Conversion reasons
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'CONV_FULL', 'Full Commodity Conversion', 1 FROM shopping_types WHERE code = 'COMMODITY_CONV'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'CONV_LINING', 'Lining Change Only', 2 FROM shopping_types WHERE code = 'COMMODITY_CONV'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'CONV_CLEANING', 'Deep Clean / Purge', 3 FROM shopping_types WHERE code = 'COMMODITY_CONV'
ON CONFLICT (code) DO NOTHING;

-- Lessee-Requested reasons
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'LESSEE_CLEANING', 'Lessee Cleaning Request', 1 FROM shopping_types WHERE code = 'LESSEE_REQ'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'LESSEE_MODIFICATION', 'Lessee Modification', 2 FROM shopping_types WHERE code = 'LESSEE_REQ'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'LESSEE_INSPECTION', 'Lessee Inspection Request', 3 FROM shopping_types WHERE code = 'LESSEE_REQ'
ON CONFLICT (code) DO NOTHING;

-- Generic reasons for other types
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'PREV_SCHEDULED', 'Scheduled PM', 1 FROM shopping_types WHERE code = 'PREVENTIVE'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'STORAGE_LAYUP', 'Storage Layup', 1 FROM shopping_types WHERE code = 'STORAGE_PREP'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'REACT_RETURN', 'Return to Service', 1 FROM shopping_types WHERE code = 'REACTIVATION'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'INS_DERAILMENT', 'Derailment Damage', 1 FROM shopping_types WHERE code = 'INSURANCE_CLAIM'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'INS_THIRD_PARTY', 'Third-Party Damage', 2 FROM shopping_types WHERE code = 'INSURANCE_CLAIM'
ON CONFLICT (code) DO NOTHING;
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'OTHER_MISC', 'Miscellaneous', 1 FROM shopping_types WHERE code = 'OTHER'
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Add shopping classification to allocations
-- ============================================================================

ALTER TABLE allocations ADD COLUMN IF NOT EXISTS shopping_type_id UUID REFERENCES shopping_types(id);
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS shopping_reason_id UUID REFERENCES shopping_reasons(id);

CREATE INDEX IF NOT EXISTS idx_allocations_shopping_type ON allocations(shopping_type_id);
CREATE INDEX IF NOT EXISTS idx_allocations_shopping_reason ON allocations(shopping_reason_id);

-- ============================================================================
-- View for shopping classification lookup
-- ============================================================================

CREATE OR REPLACE VIEW v_shopping_reasons AS
SELECT
    sr.id,
    sr.code,
    sr.name,
    sr.description,
    sr.sort_order,
    st.id as type_id,
    st.code as type_code,
    st.name as type_name,
    st.is_planned,
    st.default_cost_owner,
    st.tier_preference
FROM shopping_reasons sr
JOIN shopping_types st ON sr.shopping_type_id = st.id
WHERE sr.is_active = TRUE AND st.is_active = TRUE
ORDER BY st.sort_order, sr.sort_order;
