# Car Lifecycle Correction Plan

**Status**: Draft v2 — Pending Review
**Date**: 2026-02-11
**Scope**: Car asset lifecycle, shopping process, assignment model, fleet status derivation, cost/profitability tracking, **contracts lifecycle (lease hierarchy, rider car lifecycle, amendments, billing sync)**

---

## Problem Statement

The current car lifecycle model has six structural issues that cause data inconsistency, limit profitability analysis, and create operational blind spots:

1. `operational_status_group` is a stored column manually synchronized by 5+ code paths — a single source of truth violation
2. `car_assignments` and `shopping_events` are two independent state machines tracking the same physical process (car going to shop), with no coupling
3. The term "assignment" means "shop order" in the code but "putting a car on rent" in the business — a naming collision
4. "Active" (`is_active`) means "not scrapped" in the code but "on lease" in the business — a semantic mismatch
5. Customer-level profitability cannot be computed: no transportation cost tracking, no idle cost tracking, no book value
6. The "pending" status conflates multiple situations (lease expiring, scrap cancelled, bad order) into one bucket with no reason or resolution audit

Additionally, the contracts lifecycle has four structural issues that must be corrected in coordination:

7. `rider_cars` has no lifecycle status — only a boolean `is_active` and `is_on_rent`, with no intermediate states between "added" and "billing"
8. Master lease and lease rider state transitions are not DB-enforced — application code is the only guard
9. Amendment conflict detection references deprecated `car_assignments` table, and rate cascade has no mid-month proration
10. `car_releases` references `car_assignments(id)` which is being absorbed into `shopping_events_v2`

This plan corrects all ten issues in a phased migration that preserves existing data and functionality.

---

## Part 1: Target Conceptual Model

### The Three Truths About a Car

At any moment, a car has three independent facts:

| Truth | Question | Source of Truth |
|---|---|---|
| **Fleet Membership** | Does this car exist in our fleet? | `cars.fleet_status` |
| **Lease Status** | Is this car earning revenue? (= "active") | `rider_cars.status = 'on_rent'` |
| **Operational Disposition** | What is physically happening to this car? | Derived from sub-process records |

These are independent axes. A car can be ON_LEASE and IN_SHOP simultaneously (customer's car at a repair facility — lease doesn't stop). A car can be OFF_LEASE and IN_SHOP (fleet maintenance). The model must not force a single status — it must show all three truths.

### Entity Relationships (Target State)

```
CAR (asset record)
  │
  ├── SHOPPING EVENT (full shop lifecycle: event → closed)
  │     Belongs to: Project (always)
  │     Links to: Rider Car assignment (when source = lease_prep)
  │     Has: Estimates, SOW, transport costs
  │
  ├── RIDER CAR (assignment = car → customer)
  │     Lifecycle: DECIDED → PREP_REQUIRED → ON_RENT → RELEASING → OFF_RENT
  │     Has: on_rent_history, abatement_periods, invoice_lines
  │     Links to: Shopping Event (when prep required)
  │     Links to: Lease Rider (parent)
  │
  ├── IDLE PERIOD (tracked idle duration + cost)
  │     Has: reason, location, daily_rate, computed total
  │
  ├── CAR MOVEMENT (transport events + cost)
  │     Links to: Shopping Event or Rider Car (for attribution)
  │
  ├── SCRAP (decommissioning workflow — unchanged)
  │
  └── TRIAGE QUEUE ENTRY (replaces "pending" status)
        Has: reason, resolution, audit trail

CONTRACTS HIERARCHY
  CUSTOMER
    └── MASTER LEASE (Active → Expired → Terminated)
          Guard: Cannot terminate with non-terminal rider_cars
          └── LEASE RIDER (Active → Expired/Superseded)
                Guard: Cannot expire with on_rent/releasing cars
                Has: Amendments (Draft → Pending → Approved → Active → Superseded)
                └── RIDER CARS (see above — one active per car)

PROJECT (tracking container)
  Contains: Shopping Events, Releases, Qualifications, Engineering Directives

FLEET STATUS VIEW (derived, never stored)
  Computes: fleet_membership, lease_status, operational_disposition, workflow_flags
```

---

## Part 2: Detailed Entity Specifications

### 2A. Cars Table Changes

**Rename and expand `is_active`:**

```sql
-- Replace is_active boolean with fleet_status enum
ALTER TABLE cars ADD COLUMN fleet_status VARCHAR(20) NOT NULL DEFAULT 'in_fleet'
  CHECK (fleet_status IN ('onboarding', 'in_fleet', 'disposed'));

-- Backfill from is_active
UPDATE cars SET fleet_status = CASE
  WHEN is_active = FALSE THEN 'disposed'
  ELSE 'in_fleet'
END;

-- Add asset financial fields
ALTER TABLE cars ADD COLUMN acquisition_cost DECIMAL(14,2);
ALTER TABLE cars ADD COLUMN acquisition_date DATE;
ALTER TABLE cars ADD COLUMN book_value DECIMAL(14,2);
ALTER TABLE cars ADD COLUMN book_value_as_of DATE;
ALTER TABLE cars ADD COLUMN salvage_floor DECIMAL(14,2);

-- Add ready_to_load as an explicit flag with audit
ALTER TABLE cars ADD COLUMN ready_to_load BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN ready_to_load_at TIMESTAMPTZ;
ALTER TABLE cars ADD COLUMN ready_to_load_by UUID;
```

**Drop after migration complete:**
- `operational_status_group` column
- `is_active` column (replaced by `fleet_status`)

**Audit legacy columns (Phase 3):**
- `current_status` — determine owner/reader, migrate or drop
- `adjusted_status` — determine owner/reader, migrate or drop
- `plan_status` — if planning-only, move to planning table
- `scheduled_status` — if planning-only, move to planning table

**Guard trigger for fleet_status = 'disposed':**

```sql
CREATE OR REPLACE FUNCTION guard_car_disposal() RETURNS TRIGGER AS $$
BEGIN
  -- Cannot dispose without completed scrap
  IF OLD.fleet_status != 'disposed' AND NEW.fleet_status = 'disposed' THEN
    IF NOT EXISTS (
      SELECT 1 FROM scraps WHERE car_id = NEW.id AND status = 'completed'
    ) THEN
      RAISE EXCEPTION 'Cannot dispose car without completed scrap record';
    END IF;
  END IF;

  -- Cannot un-dispose
  IF OLD.fleet_status = 'disposed' AND NEW.fleet_status != 'disposed' THEN
    RAISE EXCEPTION 'Cannot reactivate a disposed car';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### 2B. Unified Shopping Event

**Absorbs `car_assignments`. One table, one state machine, one process.**

The current `car_assignments` fields (shop_code, target_month, priority, source, cost tracking, project links) move onto the shopping event. The `car_assignments` table is deprecated and eventually dropped.

#### State Machine

```
EVENT → PACKET → SOW → SHOP_ASSIGNED → DISPO_TO_SHOP →
ENROUTE → ARRIVED → ESTIMATE_RECEIVED → ESTIMATE_APPROVED →
WORK_IN_PROGRESS → FINAL_ESTIMATE_RECEIVED → FINAL_APPROVED →
DISPO_TO_DESTINATION → CLOSED

Any non-terminal state → CANCELLED

MRU shortcut: FINAL_APPROVED → CLOSED (no dispo required)
```

**14 states + CANCELLED.** Down from 7 + 16 across two tables.

#### Transition Rules

1. **Forward skip allowed.** Any state can transition to any later state in the sequence. Handles MRU (skip logistics states), quick shops (skip PACKET/SOW), and other fast-track scenarios.
2. **No backward movement** except two estimate review loops:
   - `ESTIMATE_APPROVED → ESTIMATE_RECEIVED` (estimate rejected, shop resubmits)
   - `FINAL_APPROVED → FINAL_ESTIMATE_RECEIVED` (final rejected, shop resubmits)
3. **DISPO_TO_DESTINATION gated:** Must come from FINAL_APPROVED. Cannot be reached from any other state.
4. **MRU exception:** FINAL_APPROVED → CLOSED allowed only when `shopping_type_code = 'MRU'`. Non-MRU events must go through DISPO_TO_DESTINATION.
5. **CLOSED requires:** Either DISPO_TO_DESTINATION (normal) or FINAL_APPROVED (MRU only).
6. **Terminal states are final:** CLOSED and CANCELLED cannot transition.

#### Schema

```sql
CREATE TABLE shopping_events_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_number VARCHAR(50) UNIQUE NOT NULL,

  -- CAR IDENTITY
  car_id UUID NOT NULL REFERENCES cars(id),
  car_number VARCHAR(20) NOT NULL,

  -- STATE
  state VARCHAR(30) NOT NULL DEFAULT 'EVENT' CHECK (state IN (
    'EVENT', 'PACKET', 'SOW', 'SHOP_ASSIGNED', 'DISPO_TO_SHOP',
    'ENROUTE', 'ARRIVED', 'ESTIMATE_RECEIVED', 'ESTIMATE_APPROVED',
    'WORK_IN_PROGRESS', 'FINAL_ESTIMATE_RECEIVED', 'FINAL_APPROVED',
    'DISPO_TO_DESTINATION', 'CLOSED', 'CANCELLED'
  )),

  -- WHY THIS EVENT EXISTS
  source VARCHAR(30) NOT NULL CHECK (source IN (
    'lease_prep', 'bad_order', 'qualification', 'triage',
    'demand_plan', 'service_plan', 'master_plan', 'project_plan',
    'quick_shop', 'manual', 'import', 'migration'
  )),
  source_reference_id UUID,
  source_reference_type VARCHAR(30),

  -- CUSTOMER LINK (when source = lease_prep or time-attributed)
  rider_car_id UUID,  -- nullable: links to rider_cars when triggered by customer assignment

  -- LOGISTICS (absorbed from car_assignments)
  shop_code VARCHAR(20) REFERENCES shops(shop_code),
  shop_name VARCHAR(100),
  target_month VARCHAR(7),          -- YYYY-MM
  target_date DATE,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
  is_expedited BOOLEAN DEFAULT FALSE,
  expedite_reason TEXT,
  expedited_at TIMESTAMPTZ,
  expedited_by_id UUID,

  -- WORK DETAIL
  shopping_type_code VARCHAR(50),   -- MRU, QUAL_REG, BAD_ORDER, etc.
  shopping_reason_code VARCHAR(50),
  scope_of_work_id UUID,
  batch_id UUID,                    -- For batch shopping

  -- COST (summary level — detail in estimate_submissions)
  estimated_cost DECIMAL(14,2),     -- Initial estimate (planning)
  approved_cost DECIMAL(14,2),      -- Approved final estimate (projection)
  invoiced_cost DECIMAL(14,2),      -- Actual shop invoice amount (profitability)
  cost_variance DECIMAL(14,2) GENERATED ALWAYS AS (invoiced_cost - approved_cost) STORED,

  -- TRANSPORTATION COST
  transport_to_shop_cost DECIMAL(12,2),
  transport_from_shop_cost DECIMAL(12,2),

  -- DISPOSITION (filled at DISPO_TO_DESTINATION)
  disposition VARCHAR(30) CHECK (disposition IN (
    'to_customer',      -- Goes on rent (completes linked assignment)
    'to_storage',       -- Back to idle
    'to_another_shop',  -- Re-shop (new shopping event)
    'to_scrap'          -- Enters scrap workflow
  )),
  disposition_reference_id UUID,  -- Next shopping_event ID, scrap ID, rider_car ID
  disposition_notes TEXT,

  -- PROJECT INTEGRATION
  project_id UUID,
  project_assignment_id UUID,

  -- MODIFICATION TRACKING
  original_shop_code VARCHAR(20),
  original_target_month VARCHAR(7),
  modification_reason TEXT,

  -- CANCELLATION
  cancelled_at TIMESTAMPTZ,
  cancelled_by_id UUID,
  cancellation_reason TEXT,

  -- STATUS TIMESTAMPS (one per significant state)
  event_at TIMESTAMPTZ DEFAULT NOW(),
  packet_at TIMESTAMPTZ,
  sow_at TIMESTAMPTZ,
  shop_assigned_at TIMESTAMPTZ,
  dispo_to_shop_at TIMESTAMPTZ,
  enroute_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  estimate_received_at TIMESTAMPTZ,
  estimate_approved_at TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ,
  final_estimate_received_at TIMESTAMPTZ,
  final_approved_at TIMESTAMPTZ,
  dispo_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- AUDIT
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_id UUID
);

-- CRITICAL: One active shopping event per car
CREATE UNIQUE INDEX idx_se_v2_one_active_per_car
  ON shopping_events_v2(car_number)
  WHERE state NOT IN ('CLOSED', 'CANCELLED');

-- Disposition required when in DISPO_TO_DESTINATION state
ALTER TABLE shopping_events_v2 ADD CONSTRAINT chk_dispo_required
  CHECK (
    (state = 'DISPO_TO_DESTINATION' AND disposition IS NOT NULL)
    OR (state != 'DISPO_TO_DESTINATION')
  );
```

#### Estimate Approval Sub-Workflow

Estimates are records on `estimate_submissions`, not states on the shopping event. The shopping event sees ESTIMATE_RECEIVED → ESTIMATE_APPROVED. The review/rejection cycle lives on the estimate:

```sql
-- Add repair limit context to estimates
ALTER TABLE estimate_submissions ADD COLUMN car_book_value_at_estimate DECIMAL(14,2);
ALTER TABLE estimate_submissions ADD COLUMN economic_repair_limit DECIMAL(14,2);
ALTER TABLE estimate_submissions ADD COLUMN exceeds_repair_limit BOOLEAN
  GENERATED ALWAYS AS (
    CASE WHEN economic_repair_limit IS NOT NULL AND total_cost IS NOT NULL
    THEN total_cost > economic_repair_limit
    ELSE FALSE END
  ) STORED;
```

When an estimate is submitted, the system snapshots the car's current book value and computed repair limit onto the estimate record. If `exceeds_repair_limit = TRUE`, the UI surfaces a mandatory acknowledgment during review.

---

### 2C. Rider Cars Lifecycle (Assignment = Car → Customer)

**The `rider_cars` table gains a lifecycle status.** This is what "assignment" means in business terms.

```sql
ALTER TABLE rider_cars ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'decided'
  CHECK (status IN (
    'decided',          -- Car committed to this rider, not yet on rent
    'prep_required',    -- Waiting for shopping event to complete
    'on_rent',          -- Car is on rent, billing active
    'releasing',        -- Release initiated, billing stops, car in transit/return process
    'off_rent',         -- Car returned / removed (terminal)
    'cancelled'         -- Cancelled before going on rent (terminal)
  ));

ALTER TABLE rider_cars ADD COLUMN shopping_event_id UUID;
  -- nullable: links to prep shopping event when status = prep_required

ALTER TABLE rider_cars ADD COLUMN decided_at TIMESTAMPTZ;
ALTER TABLE rider_cars ADD COLUMN decided_by UUID;
ALTER TABLE rider_cars ADD COLUMN on_rent_at TIMESTAMPTZ;
ALTER TABLE rider_cars ADD COLUMN releasing_at TIMESTAMPTZ;
ALTER TABLE rider_cars ADD COLUMN off_rent_at TIMESTAMPTZ;
```

**Critical constraint — one active rider per car:**

```sql
-- A car can only be on one non-terminal rider at a time
CREATE UNIQUE INDEX idx_one_active_rider_per_car
  ON rider_cars(car_number)
  WHERE status NOT IN ('off_rent', 'cancelled');
```

**Transition rules:**
```
decided → prep_required (shopping event created with source='lease_prep')
decided → on_rent (car is ready, no shop work needed)
decided → cancelled (customer changed mind before on-rent)
prep_required → on_rent (shopping event dispo = 'to_customer')
prep_required → cancelled (prep cancelled before on-rent)
on_rent → releasing (release initiated — billing stops, return process begins)
releasing → off_rent (car physically returned, release complete)
```

**Why `releasing` exists:** There is a gap between "we decided to take the car back" and "the car is physically returned." During this gap, billing should stop but the car is not yet available for reassignment. The `releasing` state captures this reality:
- Billing stops when `on_rent → releasing` (last billable day recorded)
- Car remains attributed to this customer for cost tracking until `off_rent`
- Idle period does NOT open until `off_rent` (car is still in transit)
- `off_rent` triggers: idle period opens, triage entry created if no next assignment

**State transition trigger:**

```sql
CREATE OR REPLACE FUNCTION enforce_rider_car_transition() RETURNS TRIGGER AS $$
DECLARE
  allowed_transitions JSONB := '{
    "decided":        ["prep_required", "on_rent", "cancelled"],
    "prep_required":  ["on_rent", "cancelled"],
    "on_rent":        ["releasing"],
    "releasing":      ["off_rent"]
  }'::JSONB;
  allowed TEXT[];
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Terminal states cannot transition
  IF OLD.status IN ('off_rent', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot transition from terminal state: %', OLD.status;
  END IF;

  -- Check allowed transition
  SELECT ARRAY(SELECT jsonb_array_elements_text(allowed_transitions -> OLD.status))
    INTO allowed;

  IF NEW.status != ALL(allowed) THEN
    RAISE EXCEPTION 'Invalid rider_car transition: % → %', OLD.status, NEW.status;
  END IF;

  -- Set timestamps
  IF NEW.status = 'on_rent' AND OLD.status != 'on_rent' THEN
    NEW.on_rent_at := NOW();
  END IF;
  IF NEW.status = 'releasing' THEN
    NEW.releasing_at := NOW();
  END IF;
  IF NEW.status = 'off_rent' THEN
    NEW.off_rent_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rider_car_transition
  BEFORE UPDATE OF status ON rider_cars
  FOR EACH ROW EXECUTE FUNCTION enforce_rider_car_transition();
```

**Guard trigger — prevent active rider_car on non-Active rider/lease:**

```sql
CREATE OR REPLACE FUNCTION guard_rider_car_parent() RETURNS TRIGGER AS $$
BEGIN
  -- When transitioning to on_rent, parent rider and lease must be Active
  IF NEW.status = 'on_rent' AND (OLD.status IS NULL OR OLD.status != 'on_rent') THEN
    IF NOT EXISTS (
      SELECT 1 FROM lease_riders lr
      JOIN master_leases ml ON ml.id = lr.master_lease_id
      WHERE lr.id = NEW.rider_id
        AND lr.status = 'Active'
        AND ml.status = 'Active'
    ) THEN
      RAISE EXCEPTION 'Cannot put car on rent: parent rider or lease is not Active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rider_car_parent_guard
  BEFORE UPDATE OF status ON rider_cars
  FOR EACH ROW EXECUTE FUNCTION guard_rider_car_parent();
```

**"Active" = `status = 'on_rent'`.** This is the single definition of "active" in the system.

**Within on_rent**, the existing `is_on_rent` boolean toggles billing eligibility (for abatement periods, temporary holds). The `on_rent_history` table continues to track day-level changes for billing calculation.

---

### 2D. Triage Queue (Replaces "Pending" Status)

```sql
CREATE TABLE triage_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id),
  car_number VARCHAR(20) NOT NULL,

  reason VARCHAR(30) NOT NULL CHECK (reason IN (
    'lease_expiring',       -- Auto-flagged: lease within 30 days
    'lease_expired',        -- Auto-flagged: lease past expiration
    'scrap_cancelled',      -- Re-entered from cancelled scrap
    'customer_return',      -- Car returned from customer
    'bad_order',            -- Bad order report received
    'qualification_due',    -- Qualification approaching due date
    'manual'                -- Planner manually flagged
  )),

  source_reference_id UUID,   -- Link to lease, scrap, return, etc.
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
  notes TEXT,

  -- Resolution
  resolved_at TIMESTAMPTZ,    -- NULL = still in queue
  resolution VARCHAR(30) CHECK (resolution IN (
    'assigned_to_shop',   -- Shopping event created
    'assigned_to_customer', -- Direct to rider (no prep needed)
    'released_to_idle',   -- No action needed, back to idle
    'scrap_proposed',     -- Scrap workflow initiated
    'dismissed'           -- False alarm, no action
  )),
  resolution_reference_id UUID,  -- Shopping event ID, rider_car ID, scrap ID
  resolved_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- One active triage entry per car
CREATE UNIQUE INDEX idx_triage_one_active
  ON triage_queue(car_id) WHERE resolved_at IS NULL;
```

---

### 2E. Fleet Status View (Derived, Never Stored)

```sql
CREATE OR REPLACE VIEW v_car_fleet_status AS
SELECT
  c.car_number,
  c.id AS car_id,
  c.fleet_status,
  c.car_type,
  c.owner_code,
  c.book_value,

  -- LEASE STATUS (this is "active")
  CASE
    WHEN rc.id IS NOT NULL AND rc.status = 'on_rent' THEN TRUE
    ELSE FALSE
  END AS is_active,

  rc.rider_id AS active_rider_id,
  rc.status AS assignment_status,

  -- OPERATIONAL DISPOSITION (derived from sub-process facts)
  CASE
    WHEN sc.id IS NOT NULL THEN 'SCRAP_WORKFLOW'
    WHEN se.id IS NOT NULL THEN 'IN_SHOP'
    ELSE 'IDLE'
  END AS operational_disposition,

  -- SHOPPING EVENT DETAIL (when in shop)
  se.id AS active_shopping_event_id,
  se.state AS shopping_event_state,
  se.shop_code AS current_shop,
  se.shopping_type_code,
  se.source AS shopping_source,

  -- SCRAP DETAIL (when in scrap workflow)
  sc.id AS active_scrap_id,
  sc.status AS scrap_status,

  -- WORKFLOW FLAGS
  c.ready_to_load,
  c.ready_to_load_at,
  tq.id AS triage_entry_id,
  tq.reason AS triage_reason,
  tq.priority AS triage_priority,

  -- IDLE TRACKING
  ip.id AS active_idle_period_id,
  ip.start_date AS idle_since,
  ip.reason AS idle_reason,
  ip.total_days AS idle_days,
  ip.total_cost AS idle_cost

FROM cars c

-- Active rider assignment (decided, prep, or on_rent)
LEFT JOIN rider_cars rc
  ON rc.car_number = c.car_number
  AND rc.status IN ('decided', 'prep_required', 'on_rent')

-- Active shopping event
LEFT JOIN shopping_events_v2 se
  ON se.car_number = c.car_number
  AND se.state NOT IN ('CLOSED', 'CANCELLED')

-- Active scrap
LEFT JOIN scraps sc
  ON sc.car_number = c.car_number
  AND sc.status NOT IN ('completed', 'cancelled')

-- Active triage entry
LEFT JOIN triage_queue tq
  ON tq.car_id = c.id
  AND tq.resolved_at IS NULL

-- Active idle period
LEFT JOIN idle_periods ip
  ON ip.car_number = c.car_number
  AND ip.end_date IS NULL

WHERE c.fleet_status != 'disposed';
```

**Fleet dashboard query (replaces current fleet-summary endpoint):**

```sql
SELECT
  -- Operational disposition
  COUNT(*) FILTER (WHERE operational_disposition = 'IN_SHOP') AS in_shop,
  COUNT(*) FILTER (WHERE operational_disposition = 'IDLE'
                     AND NOT ready_to_load
                     AND triage_reason IS NULL) AS idle_storage,
  COUNT(*) FILTER (WHERE ready_to_load = TRUE
                     AND operational_disposition = 'IDLE') AS ready_to_load,
  COUNT(*) FILTER (WHERE triage_reason IS NOT NULL) AS pending_triage,
  COUNT(*) FILTER (WHERE operational_disposition = 'SCRAP_WORKFLOW') AS scrap_in_progress,

  -- Lease status
  COUNT(*) FILTER (WHERE is_active = TRUE) AS on_lease,
  COUNT(*) FILTER (WHERE is_active = FALSE
                     AND operational_disposition = 'IDLE') AS off_lease_idle,

  -- Total
  COUNT(*) AS total_fleet
FROM v_car_fleet_status;
```

---

### 2F. Portfolio Repair Limits

```sql
CREATE TABLE portfolio_repair_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_code VARCHAR(20) NOT NULL,
  limit_type VARCHAR(20) NOT NULL CHECK (limit_type IN (
    'percentage_of_book',
    'fixed_amount',
    'lesser_of'
  )),
  percentage DECIMAL(5,2),
  fixed_amount DECIMAL(14,2),
  effective_date DATE NOT NULL,
  superseded_date DATE,
  set_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_one_active_limit_per_portfolio
  ON portfolio_repair_limits(portfolio_code)
  WHERE superseded_date IS NULL;

-- Function to compute limit for a specific car
CREATE OR REPLACE FUNCTION get_economic_repair_limit(p_car_number VARCHAR)
RETURNS DECIMAL(14,2) AS $$
DECLARE
  v_book DECIMAL(14,2);
  v_type VARCHAR(20);
  v_pct DECIMAL(5,2);
  v_fixed DECIMAL(14,2);
BEGIN
  SELECT c.book_value, prl.limit_type, prl.percentage, prl.fixed_amount
  INTO v_book, v_type, v_pct, v_fixed
  FROM cars c
  JOIN portfolio_repair_limits prl
    ON prl.portfolio_code = c.owner_code AND prl.superseded_date IS NULL
  WHERE c.car_number = p_car_number;

  IF v_book IS NULL THEN RETURN NULL; END IF;

  RETURN CASE v_type
    WHEN 'percentage_of_book' THEN v_book * (v_pct / 100)
    WHEN 'fixed_amount' THEN v_fixed
    WHEN 'lesser_of' THEN LEAST(v_book * (v_pct / 100), v_fixed)
  END;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

### 2G. Idle Periods

```sql
CREATE TABLE idle_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id),
  car_number VARCHAR(20) NOT NULL,

  start_date DATE NOT NULL,
  end_date DATE,  -- NULL = still idle

  location_code VARCHAR(20),
  reason VARCHAR(30) CHECK (reason IN (
    'between_leases',
    'awaiting_prep',
    'awaiting_triage',
    'market_conditions',
    'hold',
    'new_to_fleet',
    'unknown'
  )),

  daily_rate DECIMAL(10,2),  -- Snapshot from storage_rates at period start

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One active idle period per car
CREATE UNIQUE INDEX idx_one_active_idle_per_car
  ON idle_periods(car_id) WHERE end_date IS NULL;

-- Computed columns for reporting
-- (PostgreSQL doesn't support generated columns referencing CURRENT_DATE,
--  so these are computed at query time in the view)
```

**Idle period open triggers:**
- Shopping event reaches CLOSED with disposition `to_storage` → open idle period (reason: `between_leases`)
- Rider car transitions to `off_rent` with no pending shopping event → open idle period (reason: `between_leases`)
- Scrap cancelled with no active lease → open idle period (reason: `awaiting_triage`)
- Car added to fleet (new record) → open idle period (reason: `new_to_fleet`)

**Idle period close triggers:**
- Shopping event created for this car → close idle period
- Rider car transitions to `on_rent` → close idle period
- Scrap proposed for this car → close idle period

---

### 2H. Storage Rates

```sql
CREATE TABLE storage_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code VARCHAR(20) NOT NULL,
  rate_per_day DECIMAL(10,2) NOT NULL,
  rate_type VARCHAR(20) NOT NULL CHECK (rate_type IN (
    'yard_fee', 'insurance', 'regulatory', 'combined'
  )),
  effective_date DATE NOT NULL,
  superseded_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_one_active_rate_per_loc_type
  ON storage_rates(location_code, rate_type)
  WHERE superseded_date IS NULL;
```

---

### 2I. Car Movements (Transportation Cost Tracking)

```sql
CREATE TABLE car_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),
  car_id UUID NOT NULL REFERENCES cars(id),

  movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN (
    'to_customer',
    'customer_return',
    'yard_transfer',
    'to_shop',
    'from_shop'
  )),

  origin_code VARCHAR(20),
  destination_code VARCHAR(20),

  transport_cost DECIMAL(12,2),
  carrier VARCHAR(100),
  waybill_number VARCHAR(50),

  dispatched_date DATE,
  arrival_date DATE,

  -- Attribution
  shopping_event_id UUID,   -- If part of a shop visit
  rider_car_id UUID,        -- If delivering to/from customer

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);
```

---

### 2J. Customer Profitability Model

No new table required. This is a computed function/view that joins existing data:

**Revenue (per car, per customer, per period):**
- `outbound_invoice_lines.line_total` WHERE `line_type IN ('rental', 'mileage', 'chargeback')`
- Joined via `car_number` + `rider_id`

**Costs attributed to a customer (three buckets):**
1. **Direct:** Shopping events WHERE `rider_car_id` = customer's rider_car record
2. **Time-overlap:** Shopping events created during the customer's lease period for that car
3. **Transport:** `car_movements` WHERE `rider_car_id` = customer's rider_car record
4. **Idle (pre-rent):** `idle_periods` WHERE reason = `awaiting_prep` during the decided→on_rent gap

**Costs NOT attributed to any customer (fleet overhead):**
- Shopping events with no customer link during an off-lease period
- Idle periods between customers
- Transportation for yard transfers

---

### 2K. Contracts Lifecycle (Lease Hierarchy State Enforcement)

The contracts hierarchy is: **Customer → Master Lease → Lease Rider → Rider Cars → Car**

Currently, master_lease and lease_rider status transitions are enforced only in application code. This plan adds DB-level enforcement to match the car lifecycle rigor.

#### Master Lease State Machine

```sql
-- Allowed states (already defined in schema)
-- master_leases.status IN ('Active', 'Expired', 'Terminated')

CREATE OR REPLACE FUNCTION enforce_master_lease_transition() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Only allowed transitions
  CASE OLD.status
    WHEN 'Active' THEN
      IF NEW.status NOT IN ('Expired', 'Terminated') THEN
        RAISE EXCEPTION 'Invalid master_lease transition: % → %', OLD.status, NEW.status;
      END IF;
    WHEN 'Expired' THEN
      -- Expired can be reactivated (renewal) or terminated
      IF NEW.status NOT IN ('Active', 'Terminated') THEN
        RAISE EXCEPTION 'Invalid master_lease transition: % → %', OLD.status, NEW.status;
      END IF;
    WHEN 'Terminated' THEN
      RAISE EXCEPTION 'Cannot transition from Terminated: terminal state';
  END CASE;

  -- Guard: Cannot terminate with active rider_cars
  IF NEW.status = 'Terminated' THEN
    IF EXISTS (
      SELECT 1 FROM lease_riders lr
      JOIN rider_cars rc ON rc.rider_id = lr.id
      WHERE lr.master_lease_id = NEW.id
        AND rc.status NOT IN ('off_rent', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Cannot terminate lease with active rider_cars — release all cars first';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_master_lease_transition
  BEFORE UPDATE OF status ON master_leases
  FOR EACH ROW EXECUTE FUNCTION enforce_master_lease_transition();
```

#### Lease Rider State Machine

```sql
-- Allowed states (already defined in schema)
-- lease_riders.status IN ('Active', 'Expired', 'Superseded')

CREATE OR REPLACE FUNCTION enforce_lease_rider_transition() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  CASE OLD.status
    WHEN 'Active' THEN
      IF NEW.status NOT IN ('Expired', 'Superseded') THEN
        RAISE EXCEPTION 'Invalid lease_rider transition: % → %', OLD.status, NEW.status;
      END IF;
    WHEN 'Expired' THEN
      -- Expired can be reactivated (extension) or superseded
      IF NEW.status NOT IN ('Active', 'Superseded') THEN
        RAISE EXCEPTION 'Invalid lease_rider transition: % → %', OLD.status, NEW.status;
      END IF;
    WHEN 'Superseded' THEN
      RAISE EXCEPTION 'Cannot transition from Superseded: terminal state';
  END CASE;

  -- Guard: Cannot expire/supersede with on_rent cars
  IF NEW.status IN ('Expired', 'Superseded') THEN
    IF EXISTS (
      SELECT 1 FROM rider_cars rc
      WHERE rc.rider_id = NEW.id
        AND rc.status IN ('on_rent', 'releasing')
    ) THEN
      RAISE EXCEPTION 'Cannot expire/supersede rider with on_rent or releasing cars';
    END IF;
  END IF;

  -- Guard: Cannot activate rider on non-Active lease
  IF NEW.status = 'Active' AND OLD.status != 'Active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM master_leases ml
      WHERE ml.id = NEW.master_lease_id AND ml.status = 'Active'
    ) THEN
      RAISE EXCEPTION 'Cannot activate rider: parent master_lease is not Active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lease_rider_transition
  BEFORE UPDATE OF status ON lease_riders
  FOR EACH ROW EXECUTE FUNCTION enforce_lease_rider_transition();
```

#### Lease Expiry → Triage Queue Integration

When a lease or rider approaches expiration, the system must proactively surface this for planning. This integrates with the triage queue (Section 2D):

```sql
-- Scheduled job or application cron (runs daily)
-- Finds rider_cars that are on_rent on riders expiring within 30 days
INSERT INTO triage_queue (car_id, car_number, reason, source_reference_id, priority, notes)
SELECT
  c.id, c.car_number,
  CASE
    WHEN lr.end_date < CURRENT_DATE THEN 'lease_expired'
    ELSE 'lease_expiring'
  END,
  lr.id,  -- source_reference = the expiring rider
  CASE
    WHEN lr.end_date < CURRENT_DATE THEN 1  -- Expired = urgent
    ELSE 2  -- Expiring = high
  END,
  FORMAT('Rider %s expires %s', lr.rider_number, lr.end_date)
FROM rider_cars rc
JOIN lease_riders lr ON lr.id = rc.rider_id
JOIN cars c ON c.car_number = rc.car_number
WHERE rc.status = 'on_rent'
  AND lr.end_date <= CURRENT_DATE + INTERVAL '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM triage_queue tq
    WHERE tq.car_id = c.id AND tq.resolved_at IS NULL
  );
```

This replaces the soft rule S3 with an actual implementation. Cars with expiring leases enter the triage queue automatically, ensuring planners make an explicit decision (renew, release, or reassign).

#### Amendment Lifecycle (Already DB-Enforced)

The amendment state machine (Draft → Pending → Approved → Active → Superseded) is already enforced by the `enforce_amendment_status_transition()` trigger in migration 073. No changes needed to the state machine itself.

**Changes needed for sync with car lifecycle:**
1. **Conflict detection**: Currently queries `car_assignments` to detect active shop work on amendment cars. Must be updated to query `shopping_events_v2` WHERE state NOT IN ('CLOSED', 'CANCELLED').
2. **Rate cascade on activation**: When an amendment activates with rate changes, must check if any affected rider_cars have `status = 'on_rent'`. If yes, record the rate change effective date for billing proration.
3. **Car addition via amendment**: When an amendment adds a car to a rider, the rider_car should be created with `status = 'decided'` (not directly `on_rent`), entering the standard rider_car lifecycle.

#### car_releases Foreign Key Update

```sql
-- car_releases currently references car_assignments(id)
-- After migration, update to reference shopping_events_v2 when applicable
ALTER TABLE car_releases ADD COLUMN shopping_event_id UUID REFERENCES shopping_events_v2(id);
-- The existing assignment_id column remains for historical records during migration
-- Phase 4: drop assignment_id after all releases reference shopping_events_v2 or are historical
```

#### Abatement Service Alignment

The abatement service (`computeAbatementPeriods()`) derives abatement from shopping event state history. It currently references old state names:

| Current (old states) | New states (shopping_events_v2) |
|---|---|
| INBOUND | ENROUTE |
| INSPECTION | ARRIVED |
| ESTIMATE_SUBMITTED | ESTIMATE_RECEIVED |
| WORK_AUTHORIZED | WORK_IN_PROGRESS |
| RELEASED | CLOSED |

The abatement window is: first qualifying state (ENROUTE or later) through CLOSED. The qualifying shopping types are controlled by `shopping_types.qualifies_for_abatement`.

**Billing eligibility during `releasing` state:** When a rider_car transitions to `releasing`, billing stops. The last billable day is the day the release was initiated (`releasing_at`). The abatement service should NOT generate abatement periods for the releasing → off_rent gap, because abatement only applies to cars that are on_rent with active shop work.

---

### 2L. Sync Points Between Car Lifecycle and Contracts Lifecycle

These are the critical handoff points where the two domains must coordinate:

| # | Trigger | Car Side Effect | Contract Side Effect |
|---|---|---|---|
| 1 | `rider_car.status → on_rent` | Close idle period. Close triage entry. | Billing starts. `on_rent_history` record created. |
| 2 | `rider_car.status → releasing` | (No change — car still attributed) | Billing stops. Last billable day recorded. |
| 3 | `rider_car.status → off_rent` | Open idle period. Create triage entry (`customer_return`). | Final billing reconciliation. Cost attribution window closes. |
| 4 | Shopping event CLOSED, dispo = `to_customer` | Close idle period. | `rider_car.status → on_rent` (auto-transition when prep completes). |
| 5 | Shopping event created for on_rent car | (No fleet status change — IN_SHOP + ON_LEASE simultaneously) | Abatement period opens if qualifying type. Billing continues. |
| 6 | Lease rider expires | (No direct effect) | Auto-triage entries for on_rent cars. Planners must release or renew. |
| 7 | Amendment activates with car additions | Rider_car created (`decided`). Triage entry resolved if applicable. | New rider_car enters lifecycle. Rate history recorded. |
| 8 | Amendment activates with car removals | Release initiated (`on_rent → releasing`). | Removal effective date drives last billable day. |
| 9 | Master lease terminated | All rider_cars must be `off_rent`/`cancelled` first (guard trigger). | Cascade: riders → Expired/Superseded. |
| 10 | Scrap completed | `fleet_status → disposed`. All rider_cars must already be terminal. | No active leases allowed (guard_car_disposal ensures this). |

---

## Part 3: Real-World Pressure Tests and Tweaks

### Test 1: MRU Event — Mobile Repair Comes to the Car

**Scenario:** Car SHQX006002 is at a storage yard. A mobile repair unit is dispatched for a minor fix.

**Path through model:**
```
EVENT (bad_order detected) →
  skip PACKET, SOW, DISPO_TO_SHOP, ENROUTE, ARRIVED (car doesn't move) →
SHOP_ASSIGNED (mobile unit assigned) →
ESTIMATE_RECEIVED → ESTIMATE_APPROVED →
WORK_IN_PROGRESS →
FINAL_ESTIMATE_RECEIVED → FINAL_APPROVED →
CLOSED (MRU shortcut, no dispo — car stays where it is)
```

**Verification:** Forward-skip handles the logistics bypass. MRU exception allows FINAL_APPROVED → CLOSED. Car's idle period is NOT interrupted (MRU comes to the car, car doesn't leave storage). Shopping event cost is still tracked.

**Tweak needed:** When an MRU closes without dispo, the system should not close any active idle period. The idle period continues because the car didn't physically move. Add to idle period close triggers: "Shopping event created for this car → close idle period **unless shopping_type_code = 'MRU'**."

### Test 2: Lease Prep — Car Needs Work Before Going to Customer

**Scenario:** Planner commits Car SHQX006018 to Acme Chemical. Car needs qualification work first.

**Path through model:**
```
1. rider_cars record created: status = 'decided', decided_at = NOW()
2. Planner evaluates: car needs qual work
3. rider_cars.status → 'prep_required'
4. Shopping event created:
     source = 'lease_prep'
     rider_car_id = (links to Acme assignment)
     shopping_type_code = 'QUAL_REG'
     state = EVENT
5. Shopping event progresses through full lifecycle
6. At DISPO_TO_DESTINATION: disposition = 'to_customer'
7. System auto-transitions rider_cars.status → 'on_rent'
8. Billing starts
```

**Verification:** The prep cost ($12,400) is directly attributed to Acme Chemical's profitability via `rider_car_id` on the shopping event. The idle period (reason: `awaiting_prep`) from step 1 to step 7 is tracked with a daily cost. The gap between "decided" and "on_rent" is visible.

**No tweak needed.** Model handles this correctly.

### Test 3: Bad Order During Active Lease

**Scenario:** Car SHQX006002 is on Acme's lease. Railroad reports a bad order — car needs emergency repair.

**Path through model:**
```
1. Shopping event created:
     source = 'bad_order'
     rider_car_id = NULL (not triggered by assignment — triggered by railroad)
     shopping_type_code = 'BAD_ORDER'
     is_expedited = TRUE, priority = 1
     state = EVENT
2. Event progresses (may skip PACKET/SOW for emergency)
3. During estimate review: book value = $38K, repair limit = $30.4K
   Estimate = $6,800 — within limit, approved
4. Work completes, final approved
5. DISPO_TO_DESTINATION: disposition = 'to_customer' (back to Acme)
6. Car returns to Acme, lease continues
```

**Cost attribution:** No `rider_car_id` on the shopping event, but the event was created while Acme had an active rider_cars record. Time-overlap attribution catches this: event created during Acme's lease period → attributed to Acme's profitability. Cost allocation determines owner vs. lessee responsibility.

**Tweak needed:** The `rider_car_id` field on shopping events should be populated in TWO cases, not just one:
1. When `source = 'lease_prep'` (direct attribution — prep for this customer)
2. When the car has an active `on_rent` rider_car at event creation time (time attribution — happened during their lease)

This makes the attribution explicit rather than requiring a time-overlap join at query time. The profitability query becomes simpler and more reliable.

### Test 4: Car Goes to Shop, Estimate Exceeds Repair Limit

**Scenario:** Old car SHQX001234, book value $18K. Portfolio limit = 80%. Estimate comes in at $22K.

**Path through model:**
```
1. Shopping event progresses to ESTIMATE_RECEIVED
2. estimate_submissions record created:
     total_cost = $22,000
     car_book_value_at_estimate = $18,000
     economic_repair_limit = $14,400 (80% of $18K)
     exceeds_repair_limit = TRUE (auto-computed)
3. UI shows red flag: "ESTIMATE EXCEEDS ECONOMIC REPAIR LIMIT"
     Estimate: $22,000
     Book value: $18,000
     Repair limit (80%): $14,400
     Overage: $7,600
4. Reviewer options:
   a. Approve anyway (document justification)
   b. Request changes (negotiate lower scope)
   c. Route to scrap evaluation
5. If routed to scrap: shopping event CANCELLED, scrap proposed
```

**Verification:** Book value snapshot on the estimate means the audit trail shows what the reviewer saw at decision time, even if book value is updated later.

**No tweak needed.** Model handles this correctly.

### Test 5: Chain Shopping — Car Needs Two Shops

**Scenario:** Car needs general repair at Shop A, then specialized qualification at Shop B.

**Path through model:**
```
1. Shopping event #1 created (Shop A, source = 'triage')
   Belongs to Project P-2026-042
2. Event #1 progresses through full lifecycle
3. At DISPO_TO_DESTINATION:
     disposition = 'to_another_shop'
     disposition_reference_id = (event #2 ID)
4. Shopping event #2 created (Shop B, source = 'qualification')
   Belongs to same Project P-2026-042
5. Event #2 progresses through full lifecycle
6. At DISPO_TO_DESTINATION:
     disposition = 'to_storage' (or 'to_customer')
```

**Verification:** Both events belong to the same project, giving planners visibility into the full chain. The `to_another_shop` disposition with `disposition_reference_id` links the chain. Total cost = sum of both events. One-active-per-car constraint is satisfied because event #1 reaches CLOSED before event #2 begins.

**Tweak needed:** There may be a brief gap between event #1 closing and event #2 starting. During this gap, the view would show the car as IDLE, which is incorrect — it's in transit between shops. Two options:
- Event #2 is created before event #1 closes (in DISPO_TO_DESTINATION state). But this violates one-active-per-car.
- Add a `next_event_id` field and allow the view to recognize "CLOSED with disposition = 'to_another_shop' AND next event exists" as still operationally in-shop.

**Resolution:** When event #1 disposition is set to `to_another_shop`, event #2 is created immediately (before event #1 transitions to CLOSED). Modify the unique constraint to allow this specific overlap:

```sql
-- Allow one active event OR one event in DISPO_TO_DESTINATION + one in EVENT/PACKET/SOW
CREATE UNIQUE INDEX idx_se_v2_one_active_per_car
  ON shopping_events_v2(car_number)
  WHERE state NOT IN ('CLOSED', 'CANCELLED', 'DISPO_TO_DESTINATION');
```

This allows a second shopping event to be created while the first is in DISPO_TO_DESTINATION (the handoff state). The first event then transitions to CLOSED.

### Test 6: Idle Car for 90 Days — What Does It Cost?

**Scenario:** Car SHQX006099 has been in storage yard Y-HOUSTON for 90 days.

**Path through model:**
```
idle_periods record:
  car_number = SHQX006099
  start_date = 2025-11-12
  end_date = NULL (still idle)
  location_code = Y-HOUSTON
  reason = 'between_leases'
  daily_rate = $12.50 (from storage_rates for Y-HOUSTON)

Computed at query time:
  total_days = 92
  total_cost = $1,150.00
```

**In fleet status view:**
```
SHQX006099:
  is_active = FALSE (not on lease)
  operational_disposition = IDLE
  idle_since = 2025-11-12
  idle_days = 92
  idle_cost = $1,150.00
  triage_reason = NULL (no one has flagged it yet)
```

**Tweak needed:** There should be an automatic triage flag when idle days exceed a threshold. Add a system rule:

> **S4:** If a car has been idle for more than 60 days with no active triage entry, auto-create a triage entry with reason = `market_conditions` and priority = 3.

This prevents cars from sitting indefinitely without someone making a decision.

### Test 7: Full Lifecycle — Acquisition to Scrap

**Scenario:** Trace every financial event for Car SHQX006002 over its 15-year life.

```
Year 0:   Acquired ($85,000) → idle_period (new_to_fleet)
          Shopping event #1: initial qualification ($8,200)
          → CLOSED, dispo: to_customer
          rider_car #1: Acme Chemical, ON_RENT

Year 0-3: On Acme lease
          Revenue: $108,000 (3 years × $3,000/mo)
          MRU event: $1,200 (mobile repair)
          Bad order event: $6,800 (Shop A)
          → chargeback: $4,500 (Acme responsibility)

Year 3:   Acme lease expires
          rider_car #1: OFF_RENT
          idle_period: between_leases (45 days × $12.50 = $562)
          Triage: lease_expired → assigned_to_shop

Year 3-4: Shopping event #2: re-prep for new customer ($14,800)
          → CLOSED, dispo: to_customer
          rider_car #2: Delta Petrochem, ON_RENT

Year 4-8: On Delta lease
          Revenue: $192,000
          3 shop events: $28,400 total
          → chargebacks: $12,200

Year 8:   Delta voluntary return
          rider_car #2: OFF_RENT
          idle_period: between_leases (120 days × $12.50 = $1,500)
          Triage: market_conditions → scrap evaluation

Year 8-9: Book value: $22,000
          No customer prospect
          Estimate for needed repairs: $26,000
          → Exceeds repair limit ($17,600)
          → Scrap proposed → approved → completed
          → Salvage: $8,500

LIFETIME SUMMARY:
  Revenue:     $300,000 + $16,700 chargebacks = $316,700
  Shop costs:  $59,400
  Transport:   $4,800
  Idle costs:  $2,062
  Total cost:  $66,262
  Net op margin: $250,438

  Acquisition:  $85,000
  Salvage:      $8,500
  Net capital:  -$76,500

  Lifetime ROI: ($250,438 - $76,500) / $85,000 = 204.6%

  By customer:
    Acme:  Revenue $112,500 / Cost $16,200 → Margin 85.6%
    Delta: Revenue $204,200 / Cost $28,400 → Margin 86.1%
    Fleet overhead (idle periods, scrap): $21,662
```

**Verification:** Every number in that summary traces to a specific record in the model. No gaps, no blind spots, no manually synchronized columns.

### Test 8: Amendment Adds Car Mid-Month with Rate Change

**Scenario:** Amendment #A-2026-003 on Rider R-5012 activates on Feb 15. It adds Car SHQX006050 and changes the base rate from $2,800/mo to $3,100/mo for all existing cars.

**Path through model:**
```
1. Amendment in 'Approved' status, awaiting activation
2. Operator activates amendment:
   a. Amendment status → 'Active'
   b. Previous amendment (if any) → 'Superseded'
   c. Rate cascade: all rider rate fields updated to $3,100
   d. rate_history record created (old_rate=$2,800, new_rate=$3,100, effective=Feb 15)
   e. New rider_car created for SHQX006050:
      - status = 'decided' (NOT directly on_rent)
      - decided_at = NOW()
3. Planner evaluates SHQX006050 — car is ready, no prep needed
4. rider_car.status → 'on_rent' (guard checks rider is Active + lease is Active — ✓)
5. Billing run for February:
   - Existing cars: 14 days at $2,800 + 14 days at $3,100 (prorated)
   - SHQX006050: on_rent_at = Feb 15, so 14 billable days at $3,100
```

**Verification:** The `rate_history` table captures the exact effective date. The billing service uses `rate_history` to prorate: it finds the rate change on Feb 15 and splits the month. The new car enters the standard rider_car lifecycle (`decided → on_rent`) rather than being silently injected as billing-active.

**No tweak needed.** Model handles this correctly because the rider_car lifecycle prevents billing-before-decision.

### Test 9: Release Process — Car Returns from Customer

**Scenario:** Delta Petrochem is returning Car SHQX006018. Release #REL-2026-008 initiated.

**Path through model:**
```
1. Release initiated:
   car_releases.status = 'INITIATED'
   rider_car.status → 'releasing' (billing stops)
   releasing_at = Feb 3
   Last billable day = Feb 3

2. Release approved:
   car_releases.status = 'APPROVED'
   Destination determined (to storage yard Y-DALLAS)

3. Car in transit:
   car_releases.status = 'EXECUTING'
   car_movement created (type = 'customer_return', destination = Y-DALLAS)

4. Car arrives at destination:
   car_releases.status = 'COMPLETED'
   rider_car.status → 'off_rent'
   off_rent_at = Feb 8

5. System auto-effects on off_rent:
   - idle_period opened (start = Feb 8, location = Y-DALLAS, reason = 'between_leases')
   - triage_queue entry created (reason = 'customer_return', priority = 2)
   - Abatement period (if any) closed
   - Final billing reconciliation: Feb has 3 billable days for this car

6. Cost attribution:
   Transport cost ($1,800 to Y-DALLAS) attributed to Delta via car_movement.rider_car_id
   Gap Feb 3-8 (in transit) is NOT idle time — car was in 'releasing' state
   Idle tracking starts Feb 8 (actual arrival at storage)
```

**Verification:** The `releasing` state cleanly separates "billing stopped" from "car available for reuse." The 5-day transit gap is correctly NOT counted as idle (it's part of the release process). Transport cost is attributed to Delta because the rider_car link still exists during `releasing`.

**No tweak needed.** The `releasing` state was the missing piece that makes this work correctly.

### Test 10: Lease Expiry Auto-Triage

**Scenario:** Rider R-4088 for Atlas Transport expires March 15, 2026. It has 3 cars on_rent.

**Path through model:**
```
1. Daily triage job runs on Feb 14 (30 days before expiry)
2. Finds 3 rider_cars with status='on_rent' on expiring rider
3. Creates 3 triage_queue entries:
   - SHQX006010: reason='lease_expiring', priority=2, note='Rider R-4088 expires 2026-03-15'
   - SHQX006011: reason='lease_expiring', priority=2
   - SHQX006012: reason='lease_expiring', priority=2

4. Planners see 3 entries in triage queue with clear reason
5. Decision options per car:
   a. Renew: Create amendment extending rider, resolve triage as 'dismissed'
   b. Transfer: Create rider_car on different customer, initiate release from Atlas
   c. Return to storage: Initiate release, resolve triage as 'released_to_idle'
   d. Shop: Resolve as 'assigned_to_shop'

6. If March 15 passes with no action:
   - Daily job re-flags any remaining cars as 'lease_expired' (priority 1)
   - Billing continues until explicit release (lease auto-renewal is a business decision, not system behavior)
```

**Verification:** No car silently falls off a lease. Every expiring car forces an explicit decision through the triage queue. The system never auto-terminates a lease — it surfaces the situation and waits for human intent. This aligns with the design philosophy of "require human intent at risk points."

---

## Part 4: Implementation Plan

### Phase 1: Foundation (New Tables, No Breaking Changes)

**Goal:** Create all new tables and the derived view alongside existing tables. Nothing is deleted or renamed yet. Existing functionality continues unchanged.

**Migration 075: Car Lifecycle Foundation**

| Step | Action | Risk |
|---|---|---|
| 1a | Add `fleet_status` column to `cars` (backfill from `is_active`) | None — additive |
| 1b | Add `acquisition_cost`, `acquisition_date`, `book_value`, `book_value_as_of`, `salvage_floor` to `cars` | None — nullable new columns |
| 1c | Add `ready_to_load`, `ready_to_load_at`, `ready_to_load_by` to `cars` | None — additive |
| 1d | Create `triage_queue` table | None — new table |
| 1e | Create `portfolio_repair_limits` table | None — new table |
| 1f | Create `storage_rates` table | None — new table |
| 1g | Create `idle_periods` table | None — new table |
| 1h | Create `car_movements` table | None — new table |
| 1i | Add `status`, `shopping_event_id`, `decided_at`, `decided_by`, `on_rent_at`, `releasing_at`, `off_rent_at` to `rider_cars` (backfill existing active records as `on_rent`) | Low — backfill preserves existing behavior |
| 1j | Create `guard_car_disposal()` trigger on `cars` | Low — enforces existing invariant |
| 1k | Create `idx_one_active_rider_per_car` unique partial index on `rider_cars` | Low — verify no existing conflicts first |
| 1l | Create `enforce_rider_car_transition()` trigger on `rider_cars` | Low — enforces new lifecycle |
| 1m | Create `guard_rider_car_parent()` trigger on `rider_cars` | Low — prevents orphaned on_rent records |
| 1n | Create `enforce_master_lease_transition()` trigger on `master_leases` | Low — enforces existing states at DB level |
| 1o | Create `enforce_lease_rider_transition()` trigger on `lease_riders` | Low — enforces existing states at DB level |
| 1p | Add `shopping_event_id` column to `car_releases` (nullable FK to `shopping_events_v2`) | None — additive |

**Migration 076: Unified Shopping Event**

| Step | Action | Risk |
|---|---|---|
| 2a | Create `shopping_events_v2` table with full schema | None — new table |
| 2b | Create state transition trigger on `shopping_events_v2` | None — new trigger |
| 2c | Add `car_book_value_at_estimate`, `economic_repair_limit` to `estimate_submissions` | None — nullable new columns |
| 2d | Create `v_car_fleet_status` view | None — new view, doesn't affect existing queries |

**Migration 077: Data Backfill**

| Step | Action | Risk |
|---|---|---|
| 3a | Backfill `rider_cars.status` from existing records | Low — all active records → `on_rent` |
| 3b | Migrate existing `car_assignments` + `shopping_events` into `shopping_events_v2` | Medium — data mapping required. See mapping table below. |
| 3c | Create initial `idle_periods` for cars currently in `idle_storage` | Low — snapshot of current state |
| 3d | Backfill `cars.ready_to_load` from `operational_status_group = 'ready_to_load'` | Low |
| 3e | Create `triage_queue` entries from `operational_status_group = 'pending'` | Low |

**Data mapping: car_assignments + shopping_events → shopping_events_v2:**

| Current State | Target State |
|---|---|
| Assignment Planned, no shopping event | EVENT or SHOP_ASSIGNED (based on whether shop is assigned) |
| Assignment Scheduled, no shopping event | SHOP_ASSIGNED |
| Assignment Enroute / shopping event INBOUND | ENROUTE |
| Assignment Arrived / shopping event INSPECTION | ARRIVED |
| Shopping event ESTIMATE_SUBMITTED | ESTIMATE_RECEIVED |
| Shopping event ESTIMATE_UNDER_REVIEW | ESTIMATE_RECEIVED (review is sub-workflow) |
| Shopping event ESTIMATE_APPROVED | ESTIMATE_APPROVED |
| Shopping event CHANGES_REQUIRED | ESTIMATE_RECEIVED (in review loop) |
| Shopping event WORK_AUTHORIZED | WORK_IN_PROGRESS |
| Shopping event IN_REPAIR | WORK_IN_PROGRESS |
| Shopping event QA_COMPLETE | WORK_IN_PROGRESS |
| Shopping event FINAL_ESTIMATE_SUBMITTED | FINAL_ESTIMATE_RECEIVED |
| Shopping event FINAL_ESTIMATE_APPROVED | FINAL_APPROVED |
| Shopping event READY_FOR_RELEASE | FINAL_APPROVED |
| Shopping event RELEASED | CLOSED |
| Assignment Complete (no shopping event) | CLOSED |
| Either CANCELLED | CANCELLED |

---

### Phase 2: Service Layer Migration

**Goal:** Update all backend services to read from new tables and write to new tables. Old tables become read-only shadows.

| Service | Changes |
|---|---|
| **assignment.service.ts** | Rename to `shopping-event-v2.service.ts`. Create/transition unified shopping events. Remove all `operational_status_group` writes. |
| **shopping-event.service.ts** | Merge into unified service. State transitions use new state machine. |
| **scrap.service.ts** | Update `completeScrap()` to set `fleet_status = 'disposed'` instead of `is_active = false`. Remove `operational_status_group` writes. On cancel, create triage_queue entry instead of setting `operational_status_group`. Guard: verify all rider_cars are terminal before completing scrap. |
| **contracts.service.ts** | `addCarToRider()` creates rider_car with `status = 'decided'`. New `transitionRiderCar()` function for lifecycle (`decided → prep_required → on_rent → releasing → off_rent`). `removeCarFromRider()` transitions through `releasing → off_rent` (not direct delete). Amendment conflict detection queries `shopping_events_v2` instead of `car_assignments`. Amendment car additions create rider_car with `status = 'decided'`. |
| **billing.service.ts** | Query `rider_cars.status = 'on_rent'` instead of `rider_cars.is_active = TRUE` for billing eligibility. Use `rate_history` for mid-month proration when rate changes occur. Billing stop date = `releasing_at` (not `off_rent_at`). |
| **abatement.service.ts** | Update `computeAbatementPeriods()` to use new shopping event state names (ENROUTE, ARRIVED, ESTIMATE_RECEIVED, WORK_IN_PROGRESS, CLOSED). No abatement during `releasing` state. |
| **carDetail.service.ts** | `getProfitability()` updated to include idle costs, transport costs, book value, and customer attribution. |
| **release.service.ts** | Two-step transition: `on_rent → releasing` when release initiated (billing stops). `releasing → off_rent` when release completed (idle period opens, triage entry created). Update car_releases to use `shopping_event_id` FK instead of `assignment_id`. |
| **routes/index.ts** | Fleet summary queries `v_car_fleet_status` view. Delete `PUT /api/cars/:carNumber/status-group`. Add `PUT /api/cars/:carNumber/ready-to-load`. Add triage queue CRUD routes. Add rider_car lifecycle transition endpoint. |

---

### Phase 3: Frontend Migration

**Goal:** Update all frontend components to use new APIs and display model.

| Component | Changes |
|---|---|
| **Cars Home** | Fleet summary cards query derived view. "Pending" card shows triage queue count with reason breakdown. |
| **Car Drawer** | Status badge derived from view (is_active + operational_disposition). Context-aware actions updated for new states. |
| **Car Detail** | Profitability tab shows full model: revenue, shop costs, idle costs, transport costs, book value, customer attribution. |
| **Triage Page** | Queries `triage_queue` table instead of filtering by `operational_status_group = 'pending'`. Shows reason column. Resolution actions. |
| **Shopping Event UI** | Updated state machine display. Estimate review shows repair limit flag. Disposition step at end. |
| **Rider Assignment UI** | Shows rider_car lifecycle (decided → prep → on_rent → releasing → off_rent). Links to prep shopping event when applicable. Status badge color-coded per state. |
| **Contracts Page** | Amendment conflict detection uses `shopping_events_v2` states. Car addition via amendment shows rider_car status. Lease/rider expiry warnings integrated with triage count. |
| **Amendment Modal** | Rate change effective date visible. Car additions show lifecycle entry point (`decided`). Conflict badges reference new shopping event states. |
| **Release UI** | Two-step flow: "Initiate Release" (on_rent → releasing) and "Complete Release" (releasing → off_rent). Transit period visible between states. |
| **Customer Profitability** | New view: revenue vs. costs per customer, per car, per period. Drill-down to individual cost events. |

---

### Phase 4: Cleanup and Legacy Removal

**Goal:** Drop deprecated columns, tables, and code paths.

| Step | Action | Prerequisite |
|---|---|---|
| 4a | Drop `operational_status_group` column from `cars` | All reads migrated to view |
| 4b | Drop `is_active` column from `cars` | All reads migrated to `fleet_status` |
| 4c | Drop `car_assignments` table | All data migrated, all services updated |
| 4d | Drop old `shopping_events` table | All data migrated, all services updated |
| 4e | Audit and drop/migrate `current_status`, `adjusted_status`, `plan_status`, `scheduled_status` | Impact analysis complete |
| 4f | Remove `PUT /api/cars/:carNumber/status-group` endpoint | Replaced by specific actions |
| 4g | Remove assignment.service.ts | Replaced by unified shopping event service |
| 4h | Drop `is_active` and `is_on_rent` booleans from `rider_cars` | All reads migrated to `status` column |
| 4i | Drop `car_releases.assignment_id` column | All releases reference `shopping_event_id` or are historical |
| 4j | Drop legacy abatement state mappings | Abatement service uses new state names |

---

## Part 5: System Rules (Complete)

### Must (Hard Rules — Enforced at DB or Application Level)

| ID | Rule | Enforcement |
|---|---|---|
| R1 | One active shopping event per car (except DISPO handoff) | DB unique partial index |
| R2 | Shopping event forward-skip only (no backward except estimate loops) | DB trigger |
| R3 | DISPO_TO_DESTINATION gated on FINAL_APPROVED | DB trigger |
| R4 | MRU events may skip dispo; non-MRU events must not | DB trigger |
| R5 | `fleet_status = 'disposed'` requires completed scrap record | DB trigger |
| R6 | `fleet_status = 'disposed'` is irreversible | DB trigger |
| R7 | Cannot create shopping event for disposed car | Application validation |
| R8 | Cannot propose scrap if car has active shopping event | Application validation |
| R9 | Cannot cancel scrap from `in_progress` | DB trigger (existing) |
| R10 | `ready_to_load` can only be TRUE if car is IDLE with no active scrap or triage entry | Application validation |
| R11 | One active triage entry per car | DB unique partial index |
| R12 | One active idle period per car | DB unique partial index |
| R13 | Estimate exceeding repair limit must be flagged (not blocked) during review | Application + UI |
| R14 | Book value and repair limit snapshotted onto estimate at submission time | Application logic |
| R15 | One active (non-terminal) rider_car per car at any time | DB unique partial index |
| R16 | rider_car state transitions are forward-only per allowed graph | DB trigger |
| R17 | rider_car cannot reach `on_rent` unless parent rider AND master_lease are both Active | DB trigger |
| R18 | Master lease cannot be Terminated with non-terminal rider_cars | DB trigger |
| R19 | Lease rider cannot be Expired/Superseded with on_rent or releasing cars | DB trigger |
| R20 | Master lease state transitions follow: Active→Expired/Terminated, Expired→Active/Terminated, Terminated=final | DB trigger |
| R21 | Lease rider state transitions follow: Active→Expired/Superseded, Expired→Active/Superseded, Superseded=final | DB trigger |
| R22 | Amendment state transitions follow existing trigger (Draft→Pending→Approved→Active→Superseded) | DB trigger (existing) |
| R23 | Billing stop date = `releasing_at`, NOT `off_rent_at` — billing stops when release is initiated | Application logic |

### Must Not (Prohibitions)

| ID | Rule |
|---|---|
| N1 | Must not auto-set `ready_to_load` — always requires human action |
| N2 | Must not allow disposition before final estimate approval |
| N3 | Must not close non-MRU event without explicit disposition |
| N4 | Must not allow rider_car to reach `on_rent` without either direct decision or completed prep shopping event |
| N5 | Must not store `operational_status_group` as a column — it is derived only |
| N6 | Must not delete a rider_car record — use `off_rent` or `cancelled` status (data is permanent) |
| N7 | Must not auto-terminate a lease — lease continuation/termination requires human intent |
| N8 | Must not allow rider_car `on_rent` on a non-Active rider or non-Active master_lease |
| N9 | Must not generate abatement periods during `releasing` state — abatement is for on_rent cars with active shop work |

### Should (Soft Rules — Warnings and Automation)

| ID | Rule |
|---|---|
| S1 | Car has overdue qualifications → warn at shopping event creation, suggest qualification type |
| S2 | Car has open bad order → surface in triage view, recommend expedited priority |
| S3 | Lease expires within 30 days → auto-create triage entry (reason: `lease_expiring`) |
| S4 | Car idle > 60 days with no triage entry → auto-create triage entry (reason: `market_conditions`) |
| S5 | Shopping event in ESTIMATE_RECEIVED for > 5 business days → alert planning team |
| S6 | Scrap cancelled → auto-create triage entry (reason: `scrap_cancelled`) |
| S7 | Customer return processed → auto-create triage entry (reason: `customer_return`) |
| S8 | rider_car reaches `off_rent` → auto-create triage entry (reason: `customer_return`) if no next assignment exists |
| S9 | Amendment activation with rate change → surface effective date in billing preview before confirming |
| S10 | rider_car in `decided` status for > 14 days → warn planner (prep may be stalled or decision needs follow-up) |

---

## Part 6: Migration Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Data loss during car_assignments → shopping_events_v2 migration | Low | High | Run migration in transaction, verify row counts match, keep old tables read-only until verified |
| View performance on large fleet (800+ cars, thousands of historical records) | Low | Medium | Partial indexes on active records limit join sizes. At 800 cars, each LEFT JOIN hits at most 800 rows. Monitor query time; materialize if needed. |
| Services writing to old tables during migration window | Medium | Medium | Phase 2 deploys service changes atomically. Feature flag for gradual rollout if needed. |
| Existing code reading `is_active` breaks | Medium | Medium | `fleet_status != 'disposed'` is equivalent to `is_active = TRUE`. Add computed column `is_active` as alias during transition. |
| Estimate approval workflow disrupted | Low | High | Estimate sub-workflow is mostly unchanged — just adding repair limit fields. Shopping event state changes are the bigger risk. |
| Third-party integrations depending on `car_assignments` table | Low | High | Audit all external consumers before Phase 4 cleanup. |
| rider_cars backfill conflicts with one-active-per-car constraint | Medium | Medium | Run pre-migration audit: `SELECT car_number, COUNT(*) FROM rider_cars WHERE is_active = TRUE GROUP BY car_number HAVING COUNT(*) > 1`. Fix duplicates before applying unique index. |
| Existing rider_cars with no status column | Low | Low | Backfill: active + is_on_rent=TRUE → `on_rent`, active + is_on_rent=FALSE → `decided`, inactive → `off_rent`. Verify with business stakeholders. |
| Lease/rider trigger blocks existing bad data | Medium | Medium | Run transition validation against current data before creating triggers. Fix any invalid states first (e.g., Active rider on Expired lease). |
| Billing service mid-month rate change proration | Medium | Medium | Build proration logic with extensive test coverage. Compare outputs against manual billing calculations for historical months. |
| Release service two-step transition disrupts existing workflow | Low | Medium | Current `completeRelease()` does a single atomic operation. Refactor to two steps with clear UX for the gap. Train operators. |
| Abatement service state name mismatch during migration window | Medium | High | Deploy abatement service update in same release as shopping_events_v2 migration. No gap between old and new state names. |

---

## Part 7: Deliverable Sequence

```
Phase 1: Foundation (2 sprints)
  ├── Migration 075: New tables + columns (cars, triage, idle, storage, movements, repair limits)
  ├── Migration 076: Unified shopping event + fleet status view
  ├── Migration 077: Contracts lifecycle (rider_car status + timestamps, one-active constraint,
  │                  rider_car/lease/rider state triggers, guard triggers, car_releases FK)
  ├── Migration 078: Data backfill (rider_cars status, shopping events, idle periods, triage)
  ├── Pre-migration audit: rider_cars duplicates, invalid lease/rider states
  └── Verification: Old and new tables consistent, triggers fire correctly

Phase 2: Service Layer (2 sprints)
  ├── Unified shopping event service (replaces assignment + shopping-event services)
  ├── Rider car lifecycle service (decided → prep → on_rent → releasing → off_rent)
  ├── Triage queue service + lease expiry auto-detection
  ├── Idle period automation (open/close triggers)
  ├── Updated scrap service (fleet_status, guard checks)
  ├── Updated release service (two-step: releasing → off_rent)
  ├── Updated billing service (status-based eligibility, rate proration)
  ├── Updated abatement service (new state names, no abatement during releasing)
  ├── Updated contracts service (amendment conflict detection, car addition lifecycle)
  ├── Fleet summary on derived view
  └── Updated profitability service (idle + transport + book value + customer attribution)

Phase 3: Frontend (2 sprints)
  ├── Fleet dashboard on derived view
  ├── Triage queue UI (replaces pending filter, includes lease expiry entries)
  ├── Shopping event UI (new states, estimate repair limit flag, disposition step)
  ├── Rider assignment lifecycle UI (5-state lifecycle badges)
  ├── Contracts page (amendment conflicts use new states, car status visible)
  ├── Amendment modal (rate effective dates, car additions show lifecycle entry)
  ├── Release UI (two-step flow: initiate → complete)
  ├── Customer profitability view (revenue vs. real costs per customer per period)
  └── Estimate review with repair limit flag

Phase 4: Cleanup (1 sprint)
  ├── Drop deprecated columns (operational_status_group, is_active on cars, is_active/is_on_rent on rider_cars)
  ├── Drop deprecated tables (car_assignments, old shopping_events)
  ├── Drop car_releases.assignment_id column
  ├── Legacy status column audit (current_status, adjusted_status, plan_status, scheduled_status)
  └── Final verification + integration tests
```

**Total: 7 sprints.**
