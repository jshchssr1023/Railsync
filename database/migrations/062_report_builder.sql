-- Report Builder: saved reports with scheduling
-- Sprint 6 gap fill

CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    columns JSONB NOT NULL DEFAULT '[]',
    filters JSONB NOT NULL DEFAULT '{}',
    sort_by VARCHAR(100),
    sort_dir VARCHAR(4) DEFAULT 'ASC',
    created_by UUID NOT NULL REFERENCES users(id),
    is_scheduled BOOLEAN DEFAULT FALSE,
    schedule_cron VARCHAR(50),
    schedule_recipients JSONB,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON saved_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_reports_scheduled ON saved_reports(is_scheduled) WHERE is_scheduled = TRUE;
