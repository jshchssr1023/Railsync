-- Migration 002: Phase 9 - Planning, Budgeting & Forecasting
-- Adds car master extensions, budget tables, demands, allocations, and dashboard config

-- ============================================================================
-- EXTEND CARS TABLE FOR PLANNING
-- ============================================================================

-- Add new columns for car master (from Qual_Planner_Master.csv)
ALTER TABLE cars ADD COLUMN IF NOT EXISTS car_id VARCHAR(15);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS car_mark VARCHAR(4);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS car_type VARCHAR(50);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS lessee_name VARCHAR(100);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS contract_number VARCHAR(20);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS contract_expiration DATE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS portfolio_status VARCHAR(20);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS commodity VARCHAR(100);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_jacketed BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_lined BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS car_age INTEGER;

-- Compliance dates (year of next due)
ALTER TABLE cars ADD COLUMN IF NOT EXISTS min_no_lining_year INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS min_lining_year INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS interior_lining_year INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS rule_88b_year INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS safety_relief_year INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS service_equipment_year INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS stub_sill_year INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS tank_thickness_year INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS tank_qual_year INTEGER;

-- Planning status fields
ALTER TABLE cars ADD COLUMN IF NOT EXISTS current_status VARCHAR(30);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS adjusted_status VARCHAR(30);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS plan_status VARCHAR(20);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS assigned_shop_code VARCHAR(20);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS assigned_date DATE;

-- Indexes for planning queries
CREATE INDEX IF NOT EXISTS idx_cars_car_id ON cars(car_id);
CREATE INDEX IF NOT EXISTS idx_cars_portfolio ON cars(portfolio_status);
CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(current_status);
CREATE INDEX IF NOT EXISTS idx_cars_lessee ON cars(lessee_code);
CREATE INDEX IF NOT EXISTS idx_cars_tq_year ON cars(tank_qual_year);

-- Update car_id from car_number for existing records
UPDATE cars SET car_id = car_number WHERE car_id IS NULL;

-- ============================================================================
-- RUNNING REPAIRS BUDGET TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS running_repairs_budget (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,
    month VARCHAR(7) NOT NULL,                    -- "2026-01"

    -- Budget inputs
    cars_on_lease INTEGER NOT NULL,               -- Count of active cars
    allocation_per_car DECIMAL(10,2) NOT NULL,    -- $/car/month

    -- Calculated budget (will be computed in application)
    monthly_budget DECIMAL(14,2),

    -- Actuals (from unmatched BRCs)
    actual_spend DECIMAL(14,2) DEFAULT 0,
    actual_car_count INTEGER DEFAULT 0,

    -- Remaining (will be computed in application)
    remaining_budget DECIMAL(14,2),

    -- Audit
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(fiscal_year, month)
);

CREATE INDEX IF NOT EXISTS idx_rr_budget_year_month ON running_repairs_budget(fiscal_year, month);

-- ============================================================================
-- SERVICE EVENT BUDGET TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_event_budget (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,

    -- Event classification
    event_type VARCHAR(50) NOT NULL,              -- 'Qualification', 'Assignment', 'Return'

    -- Budget inputs
    budgeted_car_count INTEGER NOT NULL,
    avg_cost_per_car DECIMAL(10,2) NOT NULL,

    -- Calculated budget (will be computed in application)
    total_budget DECIMAL(14,2),

    -- Optional segmentation
    customer_code VARCHAR(20),                    -- NULL = all customers
    fleet_segment VARCHAR(50),                    -- NULL = all fleets
    car_type VARCHAR(50),                         -- NULL = all car types

    -- Audit
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_se_budget_year_type ON service_event_budget(fiscal_year, event_type);

-- ============================================================================
-- DEMANDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name VARCHAR(100) NOT NULL,                   -- "Q2 2026 Tank Qualifications"
    description TEXT,

    -- Timing
    fiscal_year INTEGER NOT NULL,
    target_month VARCHAR(7) NOT NULL,             -- "2026-04"

    -- Volume
    car_count INTEGER NOT NULL,

    -- Classification (links to budget)
    event_type VARCHAR(50) NOT NULL,              -- 'Qualification', 'Assignment', 'Return', 'Running Repair'
    car_type VARCHAR(50),                         -- 'General Service Tank', etc.

    -- Default car attributes (for allocation engine)
    default_lessee_code VARCHAR(20),
    default_material_type VARCHAR(50) DEFAULT 'Carbon Steel',
    default_lining_type VARCHAR(50),
    default_commodity VARCHAR(100),

    -- Constraints
    priority VARCHAR(20) DEFAULT 'Medium',        -- 'Critical', 'High', 'Medium', 'Low'
    required_network VARCHAR(20),                 -- 'AITX', 'Primary', 'Secondary', 'Any'
    required_region VARCHAR(50),
    max_cost_per_car DECIMAL(10,2),
    excluded_shops TEXT[],

    -- Status
    status VARCHAR(20) DEFAULT 'Forecast',        -- 'Forecast', 'Confirmed', 'Allocating', 'Allocated', 'Complete'

    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demands_year_month ON demands(fiscal_year, target_month);
CREATE INDEX IF NOT EXISTS idx_demands_status ON demands(status);
CREATE INDEX IF NOT EXISTS idx_demands_event_type ON demands(event_type);

-- ============================================================================
-- SHOP MONTHLY CAPACITY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS shop_monthly_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code),
    month VARCHAR(7) NOT NULL,                    -- "2026-04"

    -- Capacity
    total_capacity INTEGER NOT NULL,              -- Max cars this month
    allocated_count INTEGER DEFAULT 0,            -- Cars with status IN ('Planned', 'Enroute', 'Arrived')
    completed_count INTEGER DEFAULT 0,            -- Cars with status = 'Complete'

    -- Audit
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_code, month)
);

CREATE INDEX IF NOT EXISTS idx_shop_capacity_month ON shop_monthly_capacity(month);
CREATE INDEX IF NOT EXISTS idx_shop_capacity_shop_code ON shop_monthly_capacity(shop_code);

-- ============================================================================
-- SCENARIOS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Scoring weights (should sum to 100)
    weights JSONB NOT NULL DEFAULT '{
        "cost": 40,
        "cycle_time": 20,
        "aitx_preference": 20,
        "capacity_balance": 10,
        "quality_score": 10
    }',

    -- Constraints
    constraints JSONB DEFAULT '{}',

    -- Flags
    is_default BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,

    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default scenarios
INSERT INTO scenarios (name, description, weights, is_default, is_system) VALUES
    ('Cost Optimized', 'Minimize total cost',
     '{"cost": 70, "cycle_time": 10, "aitx_preference": 10, "capacity_balance": 5, "quality_score": 5}',
     false, true),
    ('AITX First', 'Maximize internal shop utilization',
     '{"cost": 15, "cycle_time": 15, "aitx_preference": 50, "capacity_balance": 10, "quality_score": 10}',
     false, true),
    ('Speed Optimized', 'Minimize cycle time',
     '{"cost": 15, "cycle_time": 55, "aitx_preference": 10, "capacity_balance": 10, "quality_score": 10}',
     false, true),
    ('Balanced', 'Equal weight across factors',
     '{"cost": 30, "cycle_time": 25, "aitx_preference": 20, "capacity_balance": 15, "quality_score": 10}',
     true, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ALLOCATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    demand_id UUID REFERENCES demands(id),
    scenario_id UUID REFERENCES scenarios(id),

    -- Car identification
    car_id VARCHAR(15) NOT NULL,                  -- "SHQX006002"
    car_number VARCHAR(10),                       -- "006002" (for BRC matching)

    -- Assignment
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code),
    target_month VARCHAR(7) NOT NULL,

    -- Status (mirrors CSV Current Status)
    status VARCHAR(30) DEFAULT 'Planned Shopping',
    -- Values: 'Need Shopping', 'To Be Routed', 'Planned Shopping', 'Enroute', 'Arrived', 'Complete', 'Released'

    -- Cost tracking
    estimated_cost DECIMAL(10,2),                 -- From RailSync cost calculator
    estimated_cost_breakdown JSONB,               -- {labor, material, freight, abatement}

    actual_cost DECIMAL(10,2),                    -- From BRC when complete
    actual_cost_breakdown JSONB,                  -- {labor, material, job_codes: [...]}

    -- BRC reference
    brc_number VARCHAR(50),
    brc_received_at TIMESTAMP WITH TIME ZONE,

    -- Dates
    planned_arrival_date DATE,
    actual_arrival_date DATE,
    planned_completion_date DATE,
    actual_completion_date DATE,

    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_allocations_demand ON allocations(demand_id);
CREATE INDEX IF NOT EXISTS idx_allocations_car ON allocations(car_id);
CREATE INDEX IF NOT EXISTS idx_allocations_shop_month ON allocations(shop_code, target_month);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);
CREATE INDEX IF NOT EXISTS idx_allocations_car_number ON allocations(car_number);

-- ============================================================================
-- BRC IMPORTS TABLE (Track imported BRC files)
-- ============================================================================
CREATE TABLE IF NOT EXISTS brc_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER,
    record_count INTEGER NOT NULL,
    matched_count INTEGER DEFAULT 0,
    running_repair_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB,
    imported_by UUID REFERENCES users(id),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brc_imports_date ON brc_imports(imported_at);

-- ============================================================================
-- DASHBOARD WIDGETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,                -- 'Budget', 'Capacity', 'Operations', 'Performance'
    default_width INTEGER DEFAULT 1,
    default_height INTEGER DEFAULT 1,
    config_schema JSONB,                          -- JSON schema for widget settings
    data_endpoint VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE
);

-- Seed widgets
INSERT INTO dashboard_widgets (id, name, description, category, default_width, default_height, data_endpoint) VALUES
    ('forecast-summary', 'Maintenance Forecast', 'Budget vs Planned vs Actual', 'Budget', 2, 1, '/api/dashboard/forecast-summary'),
    ('budget-gauge', 'Budget Utilization', 'Gauge showing % consumed', 'Budget', 1, 1, '/api/dashboard/budget-gauge'),
    ('variance-tracker', 'Cost Variance', 'Actual vs Estimated trends', 'Budget', 2, 1, '/api/dashboard/variance-tracker'),
    ('capacity-heatmap', 'Capacity Heatmap', '18-month shop capacity view', 'Capacity', 3, 2, '/api/dashboard/capacity-heatmap'),
    ('network-utilization', 'Network Utilization', 'AITX vs 3P breakdown', 'Capacity', 2, 1, '/api/dashboard/network-utilization'),
    ('monthly-demand', 'Monthly Demand', 'Demand by month chart', 'Operations', 2, 2, '/api/dashboard/monthly-demand'),
    ('allocation-status', 'Allocation Status', 'Cars by status', 'Operations', 2, 1, '/api/dashboard/allocation-status'),
    ('recent-completions', 'Recent Completions', 'Cars with BRCs received', 'Operations', 2, 2, '/api/dashboard/recent-completions'),
    ('top-shops', 'Top Shops', 'Shops by cost efficiency', 'Performance', 1, 2, '/api/dashboard/top-shops'),
    ('cycle-time-trends', 'Cycle Time Trends', 'Avg cycle time by shop', 'Performance', 2, 2, '/api/dashboard/cycle-time-trends')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- DASHBOARD CONFIGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS dashboard_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,

    -- Layout
    layout JSONB NOT NULL,
    -- Example: {
    --   "columns": 3,
    --   "widgets": [
    --     { "id": "forecast-summary", "x": 0, "y": 0, "w": 2, "h": 1, "settings": {} }
    --   ]
    -- }

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- ============================================================================
-- MAINTENANCE FORECAST VIEW
-- ============================================================================
CREATE OR REPLACE VIEW v_maintenance_forecast AS
-- Running Repairs
SELECT
    rrb.fiscal_year,
    'Running Repairs' AS budget_type,
    NULL::VARCHAR AS event_type,
    SUM(rrb.monthly_budget) AS total_budget,
    0::DECIMAL AS planned_cost,
    0::INTEGER AS planned_car_count,
    SUM(rrb.actual_spend) AS actual_cost,
    SUM(rrb.actual_car_count) AS actual_car_count,
    SUM(rrb.remaining_budget) AS remaining_budget
FROM running_repairs_budget rrb
GROUP BY rrb.fiscal_year

UNION ALL

-- Service Events (by event type)
SELECT
    seb.fiscal_year,
    'Service Event' AS budget_type,
    seb.event_type,
    SUM(seb.total_budget) AS total_budget,
    COALESCE(planned.total_cost, 0) AS planned_cost,
    COALESCE(planned.car_count, 0) AS planned_car_count,
    COALESCE(actual.total_cost, 0) AS actual_cost,
    COALESCE(actual.car_count, 0) AS actual_car_count,
    SUM(seb.total_budget) - COALESCE(planned.total_cost, 0) - COALESCE(actual.total_cost, 0) AS remaining_budget
FROM service_event_budget seb

-- Planned (not yet complete)
LEFT JOIN (
    SELECT
        d.fiscal_year,
        d.event_type,
        SUM(a.estimated_cost) AS total_cost,
        COUNT(*) AS car_count
    FROM allocations a
    JOIN demands d ON a.demand_id = d.id
    WHERE a.status IN ('Planned Shopping', 'Enroute', 'Arrived')
    GROUP BY d.fiscal_year, d.event_type
) planned ON seb.fiscal_year = planned.fiscal_year AND seb.event_type = planned.event_type

-- Actual (complete with BRC)
LEFT JOIN (
    SELECT
        d.fiscal_year,
        d.event_type,
        SUM(a.actual_cost) AS total_cost,
        COUNT(*) AS car_count
    FROM allocations a
    JOIN demands d ON a.demand_id = d.id
    WHERE a.status IN ('Complete', 'Released') AND a.actual_cost IS NOT NULL
    GROUP BY d.fiscal_year, d.event_type
) actual ON seb.fiscal_year = actual.fiscal_year AND seb.event_type = actual.event_type

GROUP BY seb.fiscal_year, seb.event_type, planned.total_cost, planned.car_count, actual.total_cost, actual.car_count;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE TRIGGER update_running_repairs_budget_updated_at BEFORE UPDATE ON running_repairs_budget
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_event_budget_updated_at BEFORE UPDATE ON service_event_budget
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_demands_updated_at BEFORE UPDATE ON demands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_monthly_capacity_updated_at BEFORE UPDATE ON shop_monthly_capacity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenarios_updated_at BEFORE UPDATE ON scenarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allocations_updated_at BEFORE UPDATE ON allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_configs_updated_at BEFORE UPDATE ON dashboard_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
