-- Railsync Shop Loading Tool Database Schema
-- PostgreSQL 14+

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SHOPS TABLE
-- Core shop information including location, rates, and network membership
-- ============================================================================
CREATE TABLE shops (
    shop_code VARCHAR(10) PRIMARY KEY,
    shop_name VARCHAR(100) NOT NULL,
    primary_railroad VARCHAR(10) NOT NULL,
    region VARCHAR(50) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(2),
    labor_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    material_multiplier DECIMAL(5, 3) NOT NULL DEFAULT 1.000,
    is_preferred_network BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shops_region ON shops(region);
CREATE INDEX idx_shops_railroad ON shops(primary_railroad);
CREATE INDEX idx_shops_active ON shops(is_active);

-- ============================================================================
-- SHOP CAPABILITIES TABLE
-- Tracks what each shop is certified/capable of handling
-- ============================================================================
CREATE TABLE shop_capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code) ON DELETE CASCADE,
    capability_type VARCHAR(50) NOT NULL,
    capability_value VARCHAR(100) NOT NULL,
    certified_date DATE,
    expiration_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_code, capability_type, capability_value)
);

CREATE INDEX idx_shop_capabilities_shop ON shop_capabilities(shop_code);
CREATE INDEX idx_shop_capabilities_type ON shop_capabilities(capability_type);

-- Capability types include:
-- 'car_type' - Tank, Hopper, Gondola, Boxcar, etc.
-- 'material' - Aluminum, Stainless, Carbon Steel
-- 'lining' - High Bake, Plasite, Rubber, Vinyl Ester, Epoxy
-- 'certification' - HM201, AAR, DOT
-- 'nitrogen_stage' - 1, 2, 3, 4, 5, 6, 7, 8, 9
-- 'service' - Cleaning, Flare, Mechanical, Blast, Paint
-- 'special' - Kosher, Asbestos Abatement

-- ============================================================================
-- COMMODITIES TABLE
-- Master list of commodities that can be transported
-- ============================================================================
CREATE TABLE commodities (
    cin_code VARCHAR(20) PRIMARY KEY,
    description VARCHAR(200) NOT NULL,
    cleaning_class VARCHAR(10),
    recommended_price DECIMAL(10, 2),
    hazmat_class VARCHAR(20),
    requires_kosher BOOLEAN NOT NULL DEFAULT FALSE,
    requires_nitrogen BOOLEAN NOT NULL DEFAULT FALSE,
    nitrogen_stage INTEGER,
    special_handling_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_commodities_class ON commodities(cleaning_class);
CREATE INDEX idx_commodities_hazmat ON commodities(hazmat_class);

-- ============================================================================
-- COMMODITY RESTRICTIONS TABLE
-- Defines which shops can handle which commodities
-- ============================================================================
CREATE TABLE commodity_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cin_code VARCHAR(20) NOT NULL REFERENCES commodities(cin_code) ON DELETE CASCADE,
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code) ON DELETE CASCADE,
    restriction_code VARCHAR(10) NOT NULL, -- Y, N, RC1, RC2, RC3, RC4
    restriction_reason TEXT,
    effective_date DATE DEFAULT CURRENT_DATE,
    expiration_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cin_code, shop_code)
);

CREATE INDEX idx_commodity_restrictions_cin ON commodity_restrictions(cin_code);
CREATE INDEX idx_commodity_restrictions_shop ON commodity_restrictions(shop_code);

-- Restriction codes:
-- Y - Fully approved
-- N - Not approved
-- RC1 - Restricted condition 1 (requires special approval)
-- RC2 - Restricted condition 2 (limited quantities)
-- RC3 - Restricted condition 3 (seasonal restriction)
-- RC4 - Restricted condition 4 (equipment-specific)

-- ============================================================================
-- SHOP BACKLOG TABLE
-- Daily snapshot of shop backlog and capacity metrics
-- ============================================================================
CREATE TABLE shop_backlog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    hours_backlog DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cars_backlog INTEGER NOT NULL DEFAULT 0,
    cars_en_route_0_6 INTEGER NOT NULL DEFAULT 0,  -- Cars arriving in 0-6 days
    cars_en_route_7_14 INTEGER NOT NULL DEFAULT 0, -- Cars arriving in 7-14 days
    cars_en_route_15_plus INTEGER NOT NULL DEFAULT 0, -- Cars arriving in 15+ days
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_code, date)
);

CREATE INDEX idx_shop_backlog_shop ON shop_backlog(shop_code);
CREATE INDEX idx_shop_backlog_date ON shop_backlog(date);

-- ============================================================================
-- SHOP CAPACITY TABLE
-- Weekly capacity by work type
-- ============================================================================
CREATE TABLE shop_capacity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code) ON DELETE CASCADE,
    work_type VARCHAR(50) NOT NULL, -- cleaning, flare, mechanical, blast, lining, paint
    weekly_hours_capacity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    current_utilization_pct DECIMAL(5, 2) NOT NULL DEFAULT 0,
    available_hours DECIMAL(10, 2) GENERATED ALWAYS AS (
        weekly_hours_capacity * (1 - current_utilization_pct / 100)
    ) STORED,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_code, work_type, effective_date)
);

CREATE INDEX idx_shop_capacity_shop ON shop_capacity(shop_code);
CREATE INDEX idx_shop_capacity_work_type ON shop_capacity(work_type);

-- ============================================================================
-- ELIGIBILITY RULES TABLE
-- Configurable rules for shop eligibility evaluation
-- ============================================================================
CREATE TABLE eligibility_rules (
    rule_id VARCHAR(50) PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_category VARCHAR(50) NOT NULL,
    rule_description TEXT,
    condition_json JSONB NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_blocking BOOLEAN NOT NULL DEFAULT TRUE, -- If true, failure means shop is ineligible
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_eligibility_rules_category ON eligibility_rules(rule_category);
CREATE INDEX idx_eligibility_rules_active ON eligibility_rules(is_active);
CREATE INDEX idx_eligibility_rules_priority ON eligibility_rules(priority);

-- Rule categories:
-- 'car_type' - Car type compatibility rules
-- 'material' - Material handling rules
-- 'lining' - Lining capability rules
-- 'certification' - Compliance certification rules
-- 'commodity' - Commodity restriction rules
-- 'capacity' - Capacity/backlog rules
-- 'network' - Railroad network rules
-- 'special' - Special handling rules (kosher, nitrogen, asbestos)

-- ============================================================================
-- CARS TABLE
-- Railcar master data
-- ============================================================================
CREATE TABLE cars (
    car_number VARCHAR(20) PRIMARY KEY,
    product_code VARCHAR(20),
    material_type VARCHAR(50), -- Aluminum, Stainless, Carbon Steel
    stencil_class VARCHAR(20),
    lining_type VARCHAR(50),
    commodity_cin VARCHAR(20) REFERENCES commodities(cin_code),
    has_asbestos BOOLEAN NOT NULL DEFAULT FALSE,
    asbestos_abatement_required BOOLEAN NOT NULL DEFAULT FALSE,
    nitrogen_pad_stage INTEGER,
    last_repair_date DATE,
    last_repair_shop VARCHAR(10) REFERENCES shops(shop_code),
    owner_code VARCHAR(10),
    lessee_code VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cars_product ON cars(product_code);
CREATE INDEX idx_cars_material ON cars(material_type);
CREATE INDEX idx_cars_commodity ON cars(commodity_cin);

-- ============================================================================
-- SERVICE EVENTS TABLE
-- Active service/repair events for cars
-- ============================================================================
CREATE TABLE service_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- Cleaning, Repair, Inspection, etc.
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assigned_shop VARCHAR(10) REFERENCES shops(shop_code),
    estimated_cost DECIMAL(12, 2),
    actual_cost DECIMAL(12, 2),
    override_exterior_paint BOOLEAN,
    override_new_lining BOOLEAN,
    override_interior_blast BOOLEAN,
    override_kosher_cleaning BOOLEAN,
    override_primary_network BOOLEAN,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_events_car ON service_events(car_number);
CREATE INDEX idx_service_events_status ON service_events(status);
CREATE INDEX idx_service_events_shop ON service_events(assigned_shop);

-- ============================================================================
-- FREIGHT RATES TABLE
-- Freight cost calculation between origins and shops
-- ============================================================================
CREATE TABLE freight_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin_region VARCHAR(50) NOT NULL,
    destination_shop VARCHAR(10) NOT NULL REFERENCES shops(shop_code) ON DELETE CASCADE,
    distance_miles INTEGER,
    base_rate DECIMAL(10, 2) NOT NULL,
    per_mile_rate DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    fuel_surcharge_pct DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(origin_region, destination_shop, effective_date)
);

CREATE INDEX idx_freight_rates_origin ON freight_rates(origin_region);
CREATE INDEX idx_freight_rates_destination ON freight_rates(destination_shop);

-- ============================================================================
-- LABOR RATES TABLE
-- Work type specific labor rates per shop
-- ============================================================================
CREATE TABLE labor_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code) ON DELETE CASCADE,
    work_type VARCHAR(50) NOT NULL,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    minimum_hours DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_code, work_type, effective_date)
);

CREATE INDEX idx_labor_rates_shop ON labor_rates(shop_code);
CREATE INDEX idx_labor_rates_work_type ON labor_rates(work_type);

-- ============================================================================
-- MATERIAL COSTS TABLE
-- Standard material costs for repairs
-- ============================================================================
CREATE TABLE material_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_code VARCHAR(50) PRIMARY KEY,
    material_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- Lining, Paint, Parts, Supplies
    base_cost DECIMAL(12, 2) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL, -- gallon, sqft, each, etc.
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drop the duplicate primary key (id was already set)
ALTER TABLE material_costs DROP CONSTRAINT material_costs_pkey;
ALTER TABLE material_costs ADD PRIMARY KEY (material_code);

CREATE INDEX idx_material_costs_category ON material_costs(category);

-- ============================================================================
-- AUDIT LOG TABLE
-- Track changes to critical data
-- ============================================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    action VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(changed_at);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Shop Summary with current backlog
CREATE VIEW v_shop_summary AS
SELECT
    s.shop_code,
    s.shop_name,
    s.primary_railroad,
    s.region,
    s.labor_rate,
    s.material_multiplier,
    s.is_preferred_network,
    b.hours_backlog,
    b.cars_backlog,
    b.cars_en_route_0_6,
    b.cars_en_route_7_14,
    b.cars_en_route_15_plus
FROM shops s
LEFT JOIN shop_backlog b ON s.shop_code = b.shop_code
    AND b.date = CURRENT_DATE
WHERE s.is_active = TRUE;

-- View: Shop Capabilities Summary
CREATE VIEW v_shop_capabilities_summary AS
SELECT
    s.shop_code,
    s.shop_name,
    ARRAY_AGG(DISTINCT CASE WHEN sc.capability_type = 'car_type' THEN sc.capability_value END)
        FILTER (WHERE sc.capability_type = 'car_type') AS car_types,
    ARRAY_AGG(DISTINCT CASE WHEN sc.capability_type = 'material' THEN sc.capability_value END)
        FILTER (WHERE sc.capability_type = 'material') AS materials,
    ARRAY_AGG(DISTINCT CASE WHEN sc.capability_type = 'lining' THEN sc.capability_value END)
        FILTER (WHERE sc.capability_type = 'lining') AS linings,
    ARRAY_AGG(DISTINCT CASE WHEN sc.capability_type = 'certification' THEN sc.capability_value END)
        FILTER (WHERE sc.capability_type = 'certification') AS certifications,
    ARRAY_AGG(DISTINCT CASE WHEN sc.capability_type = 'nitrogen_stage' THEN sc.capability_value END)
        FILTER (WHERE sc.capability_type = 'nitrogen_stage') AS nitrogen_stages,
    BOOL_OR(sc.capability_type = 'special' AND sc.capability_value = 'Kosher') AS is_kosher_certified,
    BOOL_OR(sc.capability_type = 'special' AND sc.capability_value = 'Asbestos Abatement') AS can_handle_asbestos
FROM shops s
LEFT JOIN shop_capabilities sc ON s.shop_code = sc.shop_code AND sc.is_active = TRUE
WHERE s.is_active = TRUE
GROUP BY s.shop_code, s.shop_name;

-- View: Active Service Events
CREATE VIEW v_active_service_events AS
SELECT
    se.*,
    c.product_code,
    c.material_type,
    c.stencil_class,
    c.lining_type,
    c.commodity_cin,
    c.has_asbestos,
    c.nitrogen_pad_stage,
    com.description AS commodity_description,
    com.cleaning_class
FROM service_events se
JOIN cars c ON se.car_number = c.car_number
LEFT JOIN commodities com ON c.commodity_cin = com.cin_code
WHERE se.status IN ('pending', 'in_progress');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Update timestamp on record modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to relevant tables
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_capabilities_updated_at BEFORE UPDATE ON shop_capabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commodities_updated_at BEFORE UPDATE ON commodities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commodity_restrictions_updated_at BEFORE UPDATE ON commodity_restrictions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_capacity_updated_at BEFORE UPDATE ON shop_capacity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_eligibility_rules_updated_at BEFORE UPDATE ON eligibility_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cars_updated_at BEFORE UPDATE ON cars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_events_updated_at BEFORE UPDATE ON service_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
