-- ============================================================================
-- Migration 056: Car Locations (CLM / Telegraph Integration)
-- Sprint 6 — CLM + Railinc + EDI
-- ============================================================================

-- Current car locations (one row per car, upserted on sync)
CREATE TABLE IF NOT EXISTS car_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_number VARCHAR(20) NOT NULL UNIQUE,
    railroad VARCHAR(10),
    city VARCHAR(100),
    state VARCHAR(2),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    location_type VARCHAR(20) DEFAULT 'in_transit' CHECK (location_type IN (
        'in_transit', 'at_shop', 'at_customer', 'at_yard', 'storage', 'unknown'
    )),
    source VARCHAR(30) DEFAULT 'clm',        -- clm, manual, railinc, gps
    reported_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_car_locations_car ON car_locations(car_number);
CREATE INDEX IF NOT EXISTS idx_car_locations_railroad ON car_locations(railroad);
CREATE INDEX IF NOT EXISTS idx_car_locations_type ON car_locations(location_type);
CREATE INDEX IF NOT EXISTS idx_car_locations_synced ON car_locations(synced_at DESC);

-- Location history (append-only log of all position reports)
CREATE TABLE IF NOT EXISTS car_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_number VARCHAR(20) NOT NULL,
    railroad VARCHAR(10),
    city VARCHAR(100),
    state VARCHAR(2),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    location_type VARCHAR(20),
    source VARCHAR(30) DEFAULT 'clm',
    reported_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_car_loc_hist_car ON car_location_history(car_number);
CREATE INDEX IF NOT EXISTS idx_car_loc_hist_car_date ON car_location_history(car_number, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_loc_hist_synced ON car_location_history(synced_at DESC);
