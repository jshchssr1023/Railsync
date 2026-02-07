-- ============================================================================
-- Migration 060: System Mode + Go-Live Incidents
-- Sprint 11 — Cutover control and incident tracking
-- ============================================================================

-- ============================================================================
-- 1. SYSTEM SETTINGS — key-value store for system configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed system mode
INSERT INTO system_settings (key, value) VALUES
    ('system_mode', '"parallel"'),
    ('cutover_started_at', 'null'),
    ('go_live_date', 'null')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. GO-LIVE INCIDENTS — cutover-week issue tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS go_live_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('P1', 'P2', 'P3')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'investigating', 'resolved', 'closed'
    )),
    category VARCHAR(50),     -- 'data', 'billing', 'integration', 'performance', 'ui', 'other'
    assigned_to UUID REFERENCES users(id),
    reported_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON go_live_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON go_live_incidents(severity, status);
