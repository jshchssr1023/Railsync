-- Migration 011: Amendment Tracking for Fleet Shopping
-- Supports contractual alignment workflow with amendment impact tracking

-- ============================================================================
-- UPDATE LEASE AMENDMENTS TABLE
-- ============================================================================

-- Add version tracking and service requirement changes
ALTER TABLE lease_amendments
ADD COLUMN IF NOT EXISTS is_latest_version BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES lease_amendments(id),
ADD COLUMN IF NOT EXISTS required_shop_date DATE,
ADD COLUMN IF NOT EXISTS previous_shop_date DATE,
ADD COLUMN IF NOT EXISTS service_interval_days INTEGER,
ADD COLUMN IF NOT EXISTS previous_service_interval INTEGER,
ADD COLUMN IF NOT EXISTS impact_summary JSONB,
ADD COLUMN IF NOT EXISTS cars_impacted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Pending'; -- Pending, Active, Superseded

CREATE INDEX IF NOT EXISTS idx_amendments_status ON lease_amendments(status);
CREATE INDEX IF NOT EXISTS idx_amendments_latest ON lease_amendments(is_latest_version) WHERE is_latest_version = TRUE;

-- ============================================================================
-- RIDER CARS SERVICE REQUIREMENTS
-- ============================================================================

-- Add service requirements to rider_cars junction
ALTER TABLE rider_cars
ADD COLUMN IF NOT EXISTS required_shop_date DATE,
ADD COLUMN IF NOT EXISTS service_interval_days INTEGER DEFAULT 365,
ADD COLUMN IF NOT EXISTS last_service_date DATE,
ADD COLUMN IF NOT EXISTS next_service_due DATE,
ADD COLUMN IF NOT EXISTS has_pending_amendment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS amendment_conflict BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS conflict_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_rider_cars_pending ON rider_cars(has_pending_amendment) WHERE has_pending_amendment = TRUE;
CREATE INDEX IF NOT EXISTS idx_rider_cars_conflict ON rider_cars(amendment_conflict) WHERE amendment_conflict = TRUE;

-- ============================================================================
-- CAR MULTI-ASSIGNMENT TRACKING (Return/Reassignment in progress)
-- ============================================================================

CREATE TABLE IF NOT EXISTS car_lease_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),
    from_rider_id UUID REFERENCES lease_riders(id),
    to_rider_id UUID REFERENCES lease_riders(id),
    transition_type VARCHAR(30) NOT NULL, -- 'return', 'reassignment', 'new_lease'
    status VARCHAR(30) DEFAULT 'Pending', -- Pending, InProgress, Complete, Cancelled
    initiated_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_completion_date DATE,
    completed_date DATE,
    requires_shop_visit BOOLEAN DEFAULT FALSE,
    shop_visit_id UUID, -- Reference to car_assignments if shop needed
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_car_transitions_car ON car_lease_transitions(car_number);
CREATE INDEX IF NOT EXISTS idx_car_transitions_status ON car_lease_transitions(status);
CREATE INDEX IF NOT EXISTS idx_car_transitions_pending ON car_lease_transitions(status) WHERE status IN ('Pending', 'InProgress');

-- ============================================================================
-- AMENDMENT IMPACT CACHE (Performance optimization for 100k+ cars)
-- ============================================================================

CREATE TABLE IF NOT EXISTS amendment_impact_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amendment_id UUID NOT NULL REFERENCES lease_amendments(id) ON DELETE CASCADE,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    total_cars_affected INTEGER NOT NULL,
    cars_with_conflicts INTEGER DEFAULT 0,
    cars_needing_resync INTEGER DEFAULT 0,
    impact_by_status JSONB, -- {"Planned": 5, "Scheduled": 3, ...}
    car_numbers TEXT[], -- Array of affected car numbers (for quick lookup)
    is_valid BOOLEAN DEFAULT TRUE,
    UNIQUE(amendment_id)
);

CREATE INDEX IF NOT EXISTS idx_impact_cache_valid ON amendment_impact_cache(amendment_id) WHERE is_valid = TRUE;
CREATE INDEX IF NOT EXISTS idx_impact_cache_expires ON amendment_impact_cache(expires_at);

-- ============================================================================
-- VIEWS FOR FLEET NAVIGATION
-- ============================================================================

-- Cars with amendment status (for Fleet Overview badges)
CREATE OR REPLACE VIEW v_cars_with_amendments AS
SELECT
    c.car_number,
    c.car_type,
    c.material_type,
    c.lessee_name,
    c.current_status,
    rc.rider_id,
    lr.rider_name,
    lr.master_lease_id,
    ml.lease_id,
    cust.customer_name,
    rc.required_shop_date,
    rc.next_service_due,
    rc.has_pending_amendment,
    rc.amendment_conflict,
    rc.conflict_reason,
    -- Check for active transitions (return/reassignment in progress)
    EXISTS (
        SELECT 1 FROM car_lease_transitions clt
        WHERE clt.car_number = c.car_number
        AND clt.status IN ('Pending', 'InProgress')
    ) AS has_active_transition,
    -- Get transition details if exists
    (
        SELECT jsonb_build_object(
            'type', clt.transition_type,
            'status', clt.status,
            'from_customer', from_cust.customer_name,
            'to_customer', to_cust.customer_name,
            'target_date', clt.target_completion_date
        )
        FROM car_lease_transitions clt
        LEFT JOIN lease_riders from_lr ON from_lr.id = clt.from_rider_id
        LEFT JOIN master_leases from_ml ON from_ml.id = from_lr.master_lease_id
        LEFT JOIN customers from_cust ON from_cust.id = from_ml.customer_id
        LEFT JOIN lease_riders to_lr ON to_lr.id = clt.to_rider_id
        LEFT JOIN master_leases to_ml ON to_ml.id = to_lr.master_lease_id
        LEFT JOIN customers to_cust ON to_cust.id = to_ml.customer_id
        WHERE clt.car_number = c.car_number
        AND clt.status IN ('Pending', 'InProgress')
        LIMIT 1
    ) AS transition_details,
    -- Count active assignments
    (
        SELECT COUNT(*) FROM car_assignments ca
        WHERE ca.car_number = c.car_number
        AND ca.status NOT IN ('Complete', 'Cancelled')
    ) AS active_assignments
FROM cars c
LEFT JOIN rider_cars rc ON rc.car_number = c.car_number AND rc.is_active = TRUE
LEFT JOIN lease_riders lr ON lr.id = rc.rider_id
LEFT JOIN master_leases ml ON ml.id = lr.master_lease_id
LEFT JOIN customers cust ON cust.id = ml.customer_id;

-- Amendment timeline view
CREATE OR REPLACE VIEW v_amendment_timeline AS
SELECT
    la.id AS amendment_id,
    la.amendment_id AS amendment_code,
    la.master_lease_id,
    la.rider_id,
    lr.rider_name,
    ml.lease_id,
    cust.customer_name,
    la.amendment_type,
    la.effective_date,
    la.change_summary,
    la.status,
    la.is_latest_version,
    la.required_shop_date,
    la.previous_shop_date,
    la.service_interval_days,
    la.previous_service_interval,
    la.cars_impacted,
    la.approved_by,
    la.approved_at,
    la.created_at,
    -- Calculate days until effective
    la.effective_date - CURRENT_DATE AS days_until_effective,
    -- Get impact cache if available
    aic.total_cars_affected,
    aic.cars_with_conflicts,
    aic.cars_needing_resync
FROM lease_amendments la
LEFT JOIN lease_riders lr ON lr.id = la.rider_id
LEFT JOIN master_leases ml ON ml.id = COALESCE(la.master_lease_id, lr.master_lease_id)
LEFT JOIN customers cust ON cust.id = ml.customer_id
LEFT JOIN amendment_impact_cache aic ON aic.amendment_id = la.id AND aic.is_valid = TRUE;

-- ============================================================================
-- FUNCTIONS FOR AMENDMENT PROCESSING
-- ============================================================================

-- Function to detect conflicts when amendment changes service dates
CREATE OR REPLACE FUNCTION detect_amendment_conflicts(p_amendment_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_amendment RECORD;
BEGIN
    -- Get amendment details
    SELECT * INTO v_amendment FROM lease_amendments WHERE id = p_amendment_id;

    IF v_amendment IS NULL THEN
        RETURN 0;
    END IF;

    -- Mark conflicts on rider_cars
    UPDATE rider_cars rc
    SET
        amendment_conflict = TRUE,
        conflict_reason = CASE
            WHEN ca.status IN ('Planned', 'Scheduled') AND v_amendment.required_shop_date IS NOT NULL
                 AND ca.target_date::DATE != v_amendment.required_shop_date
            THEN 'Shop date mismatch: Planned ' || ca.target_date || ' vs Required ' || v_amendment.required_shop_date
            ELSE 'Service interval changed'
        END
    FROM car_assignments ca
    WHERE rc.rider_id = v_amendment.rider_id
      AND ca.car_number = rc.car_number
      AND ca.status IN ('Planned', 'Scheduled')
      AND rc.is_active = TRUE
      AND (
          (v_amendment.required_shop_date IS NOT NULL AND ca.target_date::DATE != v_amendment.required_shop_date)
          OR (v_amendment.service_interval_days IS NOT NULL AND v_amendment.service_interval_days != rc.service_interval_days)
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Update amendment impact count
    UPDATE lease_amendments
    SET cars_impacted = v_count
    WHERE id = p_amendment_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to resync schedules based on amendment
CREATE OR REPLACE FUNCTION resync_rider_schedules(p_rider_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_latest_amendment RECORD;
BEGIN
    -- Get latest active amendment for rider
    SELECT * INTO v_latest_amendment
    FROM lease_amendments
    WHERE rider_id = p_rider_id
      AND is_latest_version = TRUE
      AND status = 'Active'
    ORDER BY effective_date DESC
    LIMIT 1;

    IF v_latest_amendment IS NULL THEN
        RETURN 0;
    END IF;

    -- Update car_assignments with new dates
    UPDATE car_assignments ca
    SET
        target_date = v_latest_amendment.required_shop_date::VARCHAR,
        modification_reason = 'Re-synced to Amendment ' || v_latest_amendment.amendment_id,
        updated_by_id = p_user_id
    FROM rider_cars rc
    WHERE rc.rider_id = p_rider_id
      AND ca.car_number = rc.car_number
      AND ca.status IN ('Planned', 'Scheduled')
      AND rc.is_active = TRUE
      AND v_latest_amendment.required_shop_date IS NOT NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Clear conflict flags
    UPDATE rider_cars
    SET amendment_conflict = FALSE, conflict_reason = NULL, has_pending_amendment = FALSE
    WHERE rider_id = p_rider_id AND is_active = TRUE;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DEMO AMENDMENTS
-- ============================================================================

-- Add some sample amendments with service date changes
INSERT INTO lease_amendments (
    amendment_id, rider_id, amendment_type, effective_date,
    change_summary, required_shop_date, previous_shop_date,
    service_interval_days, previous_service_interval,
    status, is_latest_version, cars_impacted
)
SELECT
    'AMD-' || lr.rider_id || '-001',
    lr.id,
    'Service Interval',
    CURRENT_DATE + INTERVAL '30 days',
    'Updated service interval from 365 to 180 days per new safety requirements',
    CURRENT_DATE + INTERVAL '60 days',
    NULL,
    180,
    365,
    'Pending',
    TRUE,
    (SELECT COUNT(*) FROM rider_cars rc WHERE rc.rider_id = lr.id AND rc.is_active = TRUE)
FROM lease_riders lr
WHERE lr.rider_name LIKE '%Schedule A%'
LIMIT 3
ON CONFLICT (amendment_id) DO NOTHING;

-- Mark some cars as having pending amendments
UPDATE rider_cars rc
SET has_pending_amendment = TRUE
FROM lease_amendments la
WHERE la.rider_id = rc.rider_id
  AND la.status = 'Pending'
  AND rc.is_active = TRUE;

COMMENT ON TABLE car_lease_transitions IS 'Tracks cars in transition between lessees (return/reassignment)';
COMMENT ON TABLE amendment_impact_cache IS 'Cached amendment impact calculations for performance';
COMMENT ON VIEW v_cars_with_amendments IS 'Cars with their amendment and transition status for Fleet Overview';
COMMENT ON VIEW v_amendment_timeline IS 'Amendment history with impact details';
