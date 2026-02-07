-- ============================================================================
-- Migration 052: Component Registry, Commodity Cleaning Matrix, Invoice Distribution
-- Physical component tracking, lifecycle audit, cleaning requirements, invoice delivery
-- ============================================================================

-- ============================================================================
-- 1. COMPONENTS — Physical components installed on railcars
-- ============================================================================

CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_number VARCHAR(20) NOT NULL,
    component_type VARCHAR(50) NOT NULL CHECK (component_type IN (
        'valve', 'bov', 'fitting', 'gauge', 'relief_device',
        'lining', 'coating', 'heater', 'other'
    )),
    serial_number VARCHAR(100),
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    install_date DATE,
    last_inspection_date DATE,
    next_inspection_due DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'removed', 'failed', 'replaced'
    )),
    specification TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(car_number, component_type, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_components_car_number ON components(car_number);
CREATE INDEX IF NOT EXISTS idx_components_type ON components(component_type);
CREATE INDEX IF NOT EXISTS idx_components_status ON components(status);
CREATE INDEX IF NOT EXISTS idx_components_serial ON components(serial_number);
CREATE INDEX IF NOT EXISTS idx_components_next_inspection ON components(next_inspection_due);
CREATE INDEX IF NOT EXISTS idx_components_active ON components(status) WHERE status = 'active';

-- ============================================================================
-- 2. COMPONENT HISTORY — Audit trail for component lifecycle events
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    action VARCHAR(30) NOT NULL CHECK (action IN (
        'installed', 'inspected', 'repaired', 'replaced', 'removed', 'failed'
    )),
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shop_code VARCHAR(20) REFERENCES shops(shop_code),
    old_serial_number VARCHAR(100),
    new_serial_number VARCHAR(100),
    work_order_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comp_history_component ON component_history(component_id);
CREATE INDEX IF NOT EXISTS idx_comp_history_action ON component_history(action);
CREATE INDEX IF NOT EXISTS idx_comp_history_performed_at ON component_history(performed_at);
CREATE INDEX IF NOT EXISTS idx_comp_history_shop ON component_history(shop_code);
CREATE INDEX IF NOT EXISTS idx_comp_history_work_order ON component_history(work_order_reference);

-- ============================================================================
-- 3. COMMODITY CLEANING MATRIX — Maps commodity to cleaning requirements
-- ============================================================================

CREATE TABLE IF NOT EXISTS commodity_cleaning_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity_code VARCHAR(20) NOT NULL UNIQUE,
    commodity_name VARCHAR(200) NOT NULL,
    cleaning_class VARCHAR(20) NOT NULL CHECK (cleaning_class IN (
        'A', 'B', 'C', 'D', 'E', 'kosher', 'hazmat', 'none'
    )),
    requires_interior_blast BOOLEAN NOT NULL DEFAULT FALSE,
    requires_exterior_paint BOOLEAN NOT NULL DEFAULT FALSE,
    requires_new_lining BOOLEAN NOT NULL DEFAULT FALSE,
    requires_kosher_cleaning BOOLEAN NOT NULL DEFAULT FALSE,
    special_instructions TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ccm_cleaning_class ON commodity_cleaning_matrix(cleaning_class);
CREATE INDEX IF NOT EXISTS idx_ccm_active ON commodity_cleaning_matrix(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 4. INVOICE DISTRIBUTION CONFIG — Email delivery configuration per customer
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_distribution_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN (
        'email', 'portal', 'mail', 'edi'
    )),
    email_recipients TEXT[],
    cc_recipients TEXT[],
    template_name VARCHAR(50) NOT NULL DEFAULT 'standard',
    include_line_detail BOOLEAN NOT NULL DEFAULT TRUE,
    include_pdf BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inv_dist_customer ON invoice_distribution_config(customer_id);
CREATE INDEX IF NOT EXISTS idx_inv_dist_method ON invoice_distribution_config(delivery_method);
CREATE INDEX IF NOT EXISTS idx_inv_dist_active ON invoice_distribution_config(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 5. SEED DATA — Common commodities in the cleaning matrix
-- ============================================================================

INSERT INTO commodity_cleaning_matrix (commodity_code, commodity_name, cleaning_class, requires_interior_blast, requires_exterior_paint, requires_new_lining, requires_kosher_cleaning, special_instructions) VALUES
    ('HCL', 'Hydrochloric Acid', 'hazmat', TRUE, FALSE, TRUE, FALSE,
     'Full neutralization wash required. PPE Level B minimum. Must verify pH < 2 residue removed before lining inspection.'),
    ('NAOH', 'Caustic Soda (Sodium Hydroxide)', 'hazmat', TRUE, FALSE, TRUE, FALSE,
     'Acid neutralization rinse required. Inspect lining for caustic embrittlement. No aluminum contact.'),
    ('H2SO4', 'Sulfuric Acid', 'hazmat', TRUE, FALSE, TRUE, FALSE,
     'Specialized acid-resistant cleaning protocol. Double rinse with pH verification. Inspect all gaskets and seals.'),
    ('MEOH', 'Methanol', 'A', FALSE, FALSE, FALSE, FALSE,
     'Solvent flush followed by steam cleaning. Ensure no residual vapors before entry. LEL monitoring required.'),
    ('ETOH', 'Ethanol', 'A', FALSE, FALSE, FALSE, FALSE,
     'Steam clean and air dry. Verify no residual alcohol vapors. Standard Class A protocol.'),
    ('VEGOIL', 'Vegetable Oil', 'B', FALSE, FALSE, FALSE, FALSE,
     'Hot water wash with food-grade degreaser. Must meet food-grade cleanliness standard before reload.'),
    ('CORNSYR', 'Corn Syrup', 'B', TRUE, FALSE, FALSE, FALSE,
     'Hot water soak and high-pressure wash. Interior blast if crystallized residue present. Food-grade certification required.'),
    ('PHOSPH', 'Phosphoric Acid', 'hazmat', TRUE, FALSE, TRUE, FALSE,
     'Neutralization wash required. Inspect lining for acid degradation. PPE Level B minimum.'),
    ('STYRENE', 'Styrene Monomer', 'A', TRUE, FALSE, FALSE, FALSE,
     'Solvent purge followed by steam. Inhibitor residue must be removed. Ventilate 24 hours minimum.'),
    ('PROPGLY', 'Propylene Glycol', 'C', FALSE, FALSE, FALSE, FALSE,
     'Hot water rinse and steam clean. Standard Class C protocol. Food-grade variant requires additional certification.'),
    ('TALLOW', 'Tallow (Animal Fat)', 'B', TRUE, FALSE, FALSE, FALSE,
     'Hot water wash with industrial degreaser. Interior blast if solidified residue. Temperature-controlled wash recommended.'),
    ('LATEX', 'Latex Emulsion', 'C', TRUE, FALSE, FALSE, FALSE,
     'Water flush before latex cures. If cured, mechanical removal and interior blast required.'),
    ('MOLASSES', 'Molasses', 'B', TRUE, FALSE, FALSE, FALSE,
     'Extended hot water soak. High-pressure wash. Interior blast if caramelized residue present.'),
    ('KOSHER_OIL', 'Kosher Vegetable Oil', 'kosher', FALSE, FALSE, FALSE, TRUE,
     'Kosher-certified cleaning procedure required. Mashgiach supervision mandatory. Dedicated kosher cleaning equipment only.'),
    ('AMMONIA', 'Anhydrous Ammonia', 'hazmat', TRUE, FALSE, FALSE, FALSE,
     'Full vapor purge and neutralization. PPE Level A for initial entry. Atmospheric monitoring required throughout.'),
    ('CHLORINE', 'Chlorine', 'hazmat', TRUE, FALSE, TRUE, FALSE,
     'Emergency-rated cleaning protocol. Full decontamination. PPE Level A. New lining mandatory after chlorine service.'),
    ('BIODIESEL', 'Biodiesel', 'C', FALSE, FALSE, FALSE, FALSE,
     'Standard solvent flush and steam clean. Check for microbial growth in warm months.'),
    ('GLYCERIN', 'Glycerin', 'C', FALSE, FALSE, FALSE, FALSE,
     'Hot water rinse. Low residue commodity. Standard Class C cleaning sufficient.'),
    ('LPG', 'Liquefied Petroleum Gas', 'D', FALSE, FALSE, FALSE, FALSE,
     'Vapor-free certification required. Purge with inert gas. No interior wash needed for gas-phase service.'),
    ('ISOPROP', 'Isopropyl Alcohol', 'A', FALSE, FALSE, FALSE, FALSE,
     'Solvent flush and steam clean. LEL monitoring required. Standard Class A alcohol protocol.')
ON CONFLICT (commodity_code) DO NOTHING;

-- ============================================================================
-- 6. VIEWS
-- ============================================================================

-- Component summary: components by car with inspection status
CREATE OR REPLACE VIEW v_component_summary AS
SELECT
    c.car_number,
    c.id AS component_id,
    c.component_type,
    c.serial_number,
    c.manufacturer,
    c.model,
    c.status,
    c.install_date,
    c.last_inspection_date,
    c.next_inspection_due,
    CASE
        WHEN c.status != 'active' THEN 'inactive'
        WHEN c.next_inspection_due IS NULL THEN 'no_schedule'
        WHEN c.next_inspection_due < CURRENT_DATE THEN 'overdue'
        WHEN c.next_inspection_due <= CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
        WHEN c.next_inspection_due <= CURRENT_DATE + INTERVAL '90 days' THEN 'upcoming'
        ELSE 'current'
    END AS inspection_status,
    CASE
        WHEN c.next_inspection_due IS NOT NULL
        THEN c.next_inspection_due - CURRENT_DATE
        ELSE NULL
    END AS days_until_inspection,
    (SELECT COUNT(*) FROM component_history ch WHERE ch.component_id = c.id) AS history_count,
    (SELECT ch.action FROM component_history ch
     WHERE ch.component_id = c.id
     ORDER BY ch.performed_at DESC LIMIT 1) AS last_action,
    (SELECT ch.performed_at FROM component_history ch
     WHERE ch.component_id = c.id
     ORDER BY ch.performed_at DESC LIMIT 1) AS last_action_date
FROM components c
ORDER BY c.car_number, c.component_type;

-- Commodity cleaning lookup: active commodities with cleaning requirements
CREATE OR REPLACE VIEW v_commodity_cleaning_lookup AS
SELECT
    ccm.commodity_code,
    ccm.commodity_name,
    ccm.cleaning_class,
    ccm.requires_interior_blast,
    ccm.requires_exterior_paint,
    ccm.requires_new_lining,
    ccm.requires_kosher_cleaning,
    ccm.special_instructions,
    CASE
        WHEN ccm.cleaning_class = 'hazmat' THEN 'Hazardous Material — specialized protocol required'
        WHEN ccm.cleaning_class = 'kosher' THEN 'Kosher — certified cleaning with Mashgiach supervision'
        WHEN ccm.cleaning_class = 'A' THEN 'Class A — solvent/steam cleaning'
        WHEN ccm.cleaning_class = 'B' THEN 'Class B — hot water wash with degreaser'
        WHEN ccm.cleaning_class = 'C' THEN 'Class C — standard rinse and steam'
        WHEN ccm.cleaning_class = 'D' THEN 'Class D — vapor purge, minimal wash'
        WHEN ccm.cleaning_class = 'E' THEN 'Class E — dry clean or air purge only'
        WHEN ccm.cleaning_class = 'none' THEN 'No cleaning required'
        ELSE 'Unknown classification'
    END AS cleaning_description,
    (ccm.requires_interior_blast::int + ccm.requires_exterior_paint::int +
     ccm.requires_new_lining::int + ccm.requires_kosher_cleaning::int) AS requirement_count
FROM commodity_cleaning_matrix ccm
WHERE ccm.is_active = TRUE
ORDER BY ccm.cleaning_class, ccm.commodity_name;

-- ============================================================================
-- DONE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 052: Component registry, commodity cleaning matrix, and invoice distribution config created successfully';
END $$;
