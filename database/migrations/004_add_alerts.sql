-- Migration: Add Alerts System
-- Version: 003
-- Date: 2026-02-01
-- Description: Add alerts table for qualification due, capacity warnings, etc.

-- ============================================================================
-- ALERTS TABLE
-- Stores system and user alerts for various conditions
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL,
    -- Types: 'qual_due_30', 'qual_due_60', 'qual_due_90', 'capacity_warning',
    --        'capacity_critical', 'demurrage_risk', 'brc_received'

    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    -- Severities: 'info', 'warning', 'critical'

    title VARCHAR(200) NOT NULL,
    message TEXT,

    -- Entity references (polymorphic)
    entity_type VARCHAR(50), -- 'car', 'shop', 'allocation'
    entity_id VARCHAR(100),

    -- Targeting
    target_user_id UUID REFERENCES users(id),
    target_role VARCHAR(20), -- 'admin', 'operator', 'viewer', or NULL for all

    -- Status
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    dismissed_by UUID REFERENCES users(id),
    dismissed_at TIMESTAMP WITH TIME ZONE,

    -- Expiry
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata JSONB, -- Additional context data

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_entity ON alerts(entity_type, entity_id);
CREATE INDEX idx_alerts_target_user ON alerts(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX idx_alerts_target_role ON alerts(target_role) WHERE target_role IS NOT NULL;
CREATE INDEX idx_alerts_unread ON alerts(is_read) WHERE is_read = FALSE;
-- Note: Cannot use CURRENT_TIMESTAMP in partial index (not immutable)
-- Just index on the columns and filter at query time
CREATE INDEX idx_alerts_active ON alerts(is_dismissed, expires_at) WHERE is_dismissed = FALSE;

-- Trigger for updated_at
CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEW: Active alerts for dashboard
-- ============================================================================
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT *
FROM alerts
WHERE is_dismissed = FALSE
  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
ORDER BY
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        ELSE 3
    END,
    created_at DESC;
