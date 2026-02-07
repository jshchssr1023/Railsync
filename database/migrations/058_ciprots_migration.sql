-- ============================================================================
-- Migration 058: CIPROTS Data Migration Staging Tables
-- Sprint 9 — Data Migration Pipeline
-- ============================================================================

-- Staging tables for CIPROTS CSV import. Data lands here first, then
-- gets validated and promoted to production tables.

-- ============================================================================
-- 1. MIGRATION RUNS — track each import batch
-- ============================================================================

CREATE TABLE IF NOT EXISTS migration_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,      -- 'car', 'contract', 'shopping', 'qualification', 'component'
    source_file VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'validating', 'importing', 'complete', 'failed'
    )),
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    warnings JSONB DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    initiated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_migration_runs_entity ON migration_runs(entity_type);
CREATE INDEX IF NOT EXISTS idx_migration_runs_status ON migration_runs(status);

-- ============================================================================
-- 2. MIGRATION ROW ERRORS — per-row validation errors
-- ============================================================================

CREATE TABLE IF NOT EXISTS migration_row_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_run_id UUID NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    field_name VARCHAR(100),
    error_type VARCHAR(50) NOT NULL,       -- 'missing_required', 'invalid_format', 'duplicate', 'fk_missing'
    error_message TEXT NOT NULL,
    raw_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_migration_errors_run ON migration_row_errors(migration_run_id);

-- ============================================================================
-- 3. PARALLEL RUN RESULTS — daily comparison outputs
-- ============================================================================

CREATE TABLE IF NOT EXISTS parallel_run_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date DATE NOT NULL,
    comparison_type VARCHAR(50) NOT NULL,   -- 'invoices', 'car_status', 'billing_totals'
    ciprots_count INTEGER DEFAULT 0,
    railsync_count INTEGER DEFAULT 0,
    match_count INTEGER DEFAULT 0,
    mismatch_count INTEGER DEFAULT 0,
    ciprots_only_count INTEGER DEFAULT 0,
    railsync_only_count INTEGER DEFAULT 0,
    match_pct NUMERIC(5,2) DEFAULT 0,
    summary JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(run_date, comparison_type)
);

CREATE INDEX IF NOT EXISTS idx_parallel_run_date ON parallel_run_results(run_date DESC);

-- ============================================================================
-- 4. PARALLEL RUN DISCREPANCIES — individual mismatches
-- ============================================================================

CREATE TABLE IF NOT EXISTS parallel_run_discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parallel_run_id UUID NOT NULL REFERENCES parallel_run_results(id) ON DELETE CASCADE,
    entity_ref VARCHAR(200) NOT NULL,      -- car_number, invoice_number, etc.
    field_name VARCHAR(100) NOT NULL,
    ciprots_value TEXT,
    railsync_value TEXT,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discrepancy_run ON parallel_run_discrepancies(parallel_run_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_unresolved ON parallel_run_discrepancies(resolved, severity)
    WHERE resolved = FALSE;
