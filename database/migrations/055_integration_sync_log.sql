-- ============================================================================
-- Migration 055: Integration Sync Log + Salesforce Sync Tables
-- Sprint 5 — SAP + Salesforce Integration
-- ============================================================================

-- ============================================================================
-- 1. INTEGRATION SYNC LOG (shared by SAP, Salesforce, CLM, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_name VARCHAR(30) NOT NULL CHECK (system_name IN (
        'sap', 'salesforce', 'clm', 'railinc'
    )),
    operation VARCHAR(50) NOT NULL,          -- e.g., 'push_approved_costs', 'pull_customers'
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('push', 'pull')),
    entity_type VARCHAR(50),                 -- e.g., 'allocation', 'invoice', 'customer'
    entity_id UUID,                          -- FK to the entity being synced
    entity_ref VARCHAR(100),                 -- human-readable reference (invoice number, customer code)
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'success', 'failed', 'retrying'
    )),
    payload JSONB,                           -- the data sent/received
    response JSONB,                          -- external system response
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    external_id VARCHAR(100),                -- ID from the external system (SAP doc number, SF record ID)
    initiated_by UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_log_system ON integration_sync_log(system_name);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON integration_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON integration_sync_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON integration_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_pending ON integration_sync_log(system_name, status, next_retry_at)
    WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_sync_log_failed ON integration_sync_log(system_name, status)
    WHERE status = 'failed';

-- ============================================================================
-- 2. INTEGRATION CONNECTION STATUS (per-system health tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_connection_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_name VARCHAR(30) NOT NULL UNIQUE,
    is_connected BOOLEAN DEFAULT FALSE,
    mode VARCHAR(20) NOT NULL DEFAULT 'mock' CHECK (mode IN ('mock', 'live', 'disabled')),
    last_check_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    config JSONB DEFAULT '{}',               -- non-sensitive config (endpoint URLs, sync intervals)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed connection status for known systems
INSERT INTO integration_connection_status (system_name, mode) VALUES
    ('sap', 'mock'),
    ('salesforce', 'mock'),
    ('clm', 'mock'),
    ('railinc', 'mock')
ON CONFLICT (system_name) DO NOTHING;

-- ============================================================================
-- 3. SALESFORCE SYNC MAPPING (track SF record IDs for conflict resolution)
-- ============================================================================

CREATE TABLE IF NOT EXISTS salesforce_sync_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,        -- 'customer', 'contact', 'opportunity'
    railsync_id UUID NOT NULL,               -- FK to our record
    salesforce_id VARCHAR(50) NOT NULL,       -- SF record ID
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_direction VARCHAR(10),              -- 'pull' or 'push'
    conflict_winner VARCHAR(20),             -- 'railsync' or 'salesforce'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, railsync_id),
    UNIQUE(entity_type, salesforce_id)
);

CREATE INDEX IF NOT EXISTS idx_sf_map_entity ON salesforce_sync_map(entity_type, railsync_id);
CREATE INDEX IF NOT EXISTS idx_sf_map_sf_id ON salesforce_sync_map(salesforce_id);
