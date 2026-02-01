-- Migration 001: Authentication and Audit Logging
-- Run after initial schema setup

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'operator', 'viewer')),
    organization VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- REFRESH TOKENS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================================================
-- SERVICE EVENTS TABLE (for "Select This Shop" feature)
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_number VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL DEFAULT 'shop_assignment',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    requested_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_shop VARCHAR(20) REFERENCES shops(shop_code),
    estimated_cost DECIMAL(12, 2),
    actual_cost DECIMAL(12, 2),
    override_exterior_paint BOOLEAN DEFAULT FALSE,
    override_new_lining BOOLEAN DEFAULT FALSE,
    override_interior_blast BOOLEAN DEFAULT FALSE,
    override_kosher_cleaning BOOLEAN DEFAULT FALSE,
    override_primary_network BOOLEAN DEFAULT FALSE,
    car_input JSONB,
    evaluation_result JSONB,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_events_car ON service_events(car_number);
CREATE INDEX IF NOT EXISTS idx_service_events_shop ON service_events(assigned_shop);
CREATE INDEX IF NOT EXISTS idx_service_events_status ON service_events(status);
CREATE INDEX IF NOT EXISTS idx_service_events_created ON service_events(created_at DESC);

-- ============================================================================
-- SHOP LOCATIONS TABLE (for distance-based freight calculation)
-- ============================================================================
-- Already have latitude/longitude in shops table, but add origin locations
CREATE TABLE IF NOT EXISTS origin_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_code VARCHAR(20) NOT NULL UNIQUE,
    location_name VARCHAR(100) NOT NULL,
    region VARCHAR(50),
    city VARCHAR(100),
    state VARCHAR(2),
    latitude DECIMAL(10, 6) NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_origin_locations_code ON origin_locations(location_code);
CREATE INDEX IF NOT EXISTS idx_origin_locations_region ON origin_locations(region);

-- ============================================================================
-- FREIGHT RATES TABLE - Already created in schema.sql with origin_region/destination_shop columns
-- See database/schema.sql for the freight_rates table definition

-- ============================================================================
-- WORK HOURS FACTORS TABLE (for ML-style estimation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_hours_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factor_type VARCHAR(50) NOT NULL,
    factor_value VARCHAR(100) NOT NULL,
    work_type VARCHAR(20) NOT NULL,
    base_hours DECIMAL(6, 2) NOT NULL DEFAULT 0,
    multiplier DECIMAL(5, 3) NOT NULL DEFAULT 1.000,
    effective_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(factor_type, factor_value, work_type, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_work_hours_factors_type ON work_hours_factors(factor_type, factor_value);

-- ============================================================================
-- SEED DEFAULT ADMIN USER
-- Password: admin123 (bcrypt hash)
-- ============================================================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization)
VALUES (
    'admin@railsync.com',
    '$2b$12$DAbdF7nwOhVY7T0D/4AhCeTuOEUgQom3kChE/kk71Pgv60AyFwXyi',
    'System',
    'Administrator',
    'admin',
    'Railsync'
) ON CONFLICT (email) DO NOTHING;

-- Seed operator user (password: operator123)
INSERT INTO users (email, password_hash, first_name, last_name, role, organization)
VALUES (
    'operator@railsync.com',
    '$2b$12$88aM1qw93N3bF/ouRgUuRO5fwxGXx8/9WmQspGYNHDhE0kJwlvuyu',
    'Shop',
    'Operator',
    'operator',
    'Railsync'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- SEED ORIGIN LOCATIONS
-- ============================================================================
INSERT INTO origin_locations (location_code, location_name, region, city, state, latitude, longitude) VALUES
('CHI', 'Chicago Hub', 'Midwest', 'Chicago', 'IL', 41.8781, -87.6298),
('DAL', 'Dallas Terminal', 'South', 'Dallas', 'TX', 32.7767, -96.7970),
('LAX', 'Los Angeles Yard', 'West', 'Los Angeles', 'CA', 34.0522, -118.2437),
('ATL', 'Atlanta Gateway', 'Southeast', 'Atlanta', 'GA', 33.7490, -84.3880),
('NYC', 'New York Metro', 'Northeast', 'Newark', 'NJ', 40.7357, -74.1724),
('HOU', 'Houston Refinery Row', 'South', 'Houston', 'TX', 29.7604, -95.3698),
('SEA', 'Seattle Pacific', 'Northwest', 'Seattle', 'WA', 47.6062, -122.3321),
('DEN', 'Denver Intermodal', 'Mountain', 'Denver', 'CO', 39.7392, -104.9903)
ON CONFLICT (location_code) DO NOTHING;

-- FREIGHT RATES SEED DATA - Already seeded in seed.sql with origin_region/destination_shop format

-- ============================================================================
-- SEED WORK HOURS FACTORS
-- ============================================================================
-- Base hours by car type
INSERT INTO work_hours_factors (factor_type, factor_value, work_type, base_hours, multiplier, effective_date, notes) VALUES
-- Tank car base hours
('car_type', 'Tank', 'cleaning', 4.0, 1.0, '2024-01-01', 'Base cleaning hours for tank cars'),
('car_type', 'Tank', 'mechanical', 8.0, 1.0, '2024-01-01', 'Base mechanical inspection/repair'),
('car_type', 'Tank', 'blast', 6.0, 1.0, '2024-01-01', 'Base blast hours'),
('car_type', 'Tank', 'lining', 12.0, 1.0, '2024-01-01', 'Base lining application'),
('car_type', 'Tank', 'paint', 4.0, 1.0, '2024-01-01', 'Base exterior paint'),
('car_type', 'Tank', 'flare', 2.0, 1.0, '2024-01-01', 'Base flare/venting hours'),

-- Hopper car base hours
('car_type', 'Hopper', 'cleaning', 3.0, 1.0, '2024-01-01', 'Base cleaning hours for hoppers'),
('car_type', 'Hopper', 'mechanical', 6.0, 1.0, '2024-01-01', 'Base mechanical for hoppers'),
('car_type', 'Hopper', 'blast', 5.0, 1.0, '2024-01-01', 'Base blast for hoppers'),
('car_type', 'Hopper', 'lining', 8.0, 1.0, '2024-01-01', 'Base lining for hoppers'),
('car_type', 'Hopper', 'paint', 3.0, 1.0, '2024-01-01', 'Base paint for hoppers'),

-- Material multipliers
('material', 'Carbon Steel', 'mechanical', 0, 1.0, '2024-01-01', 'Standard carbon steel'),
('material', 'Stainless', 'mechanical', 0, 1.25, '2024-01-01', 'Stainless requires more care'),
('material', 'Stainless', 'blast', 0, 1.3, '2024-01-01', 'Stainless blast takes longer'),
('material', 'Aluminum', 'mechanical', 0, 1.35, '2024-01-01', 'Aluminum is delicate'),
('material', 'Aluminum', 'blast', 0, 1.4, '2024-01-01', 'Aluminum blast requires care'),

-- Lining type multipliers
('lining', 'High Bake', 'lining', 4.0, 1.0, '2024-01-01', 'High bake lining additional hours'),
('lining', 'Plasite', 'lining', 6.0, 1.0, '2024-01-01', 'Plasite additional hours'),
('lining', 'Rubber', 'lining', 8.0, 1.0, '2024-01-01', 'Rubber lining additional hours'),
('lining', 'Vinyl Ester', 'lining', 5.0, 1.0, '2024-01-01', 'Vinyl ester additional hours'),
('lining', 'Epoxy', 'lining', 3.0, 1.0, '2024-01-01', 'Epoxy additional hours'),

-- Cleaning class multipliers
('cleaning_class', 'A', 'cleaning', 0, 1.0, '2024-01-01', 'Class A - light cleaning'),
('cleaning_class', 'B', 'cleaning', 0, 1.25, '2024-01-01', 'Class B - moderate cleaning'),
('cleaning_class', 'C', 'cleaning', 0, 1.5, '2024-01-01', 'Class C - heavy cleaning'),
('cleaning_class', 'D', 'cleaning', 0, 2.0, '2024-01-01', 'Class D - hazmat cleaning'),

-- Special requirements
('special', 'Kosher', 'cleaning', 2.0, 1.0, '2024-01-01', 'Kosher certification adds hours'),
('special', 'Asbestos', 'other', 8.0, 1.0, '2024-01-01', 'Asbestos abatement hours'),
('special', 'Nitrogen', 'other', 1.0, 1.0, '2024-01-01', 'Per nitrogen stage hour add')
ON CONFLICT (factor_type, factor_value, work_type, effective_date) DO NOTHING;
