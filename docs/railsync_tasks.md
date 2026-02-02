# Railsync Phas 15 

You are a **Senior Staff Software Engineer & Quality Gatekeeper**.

Your responsibility is to **verify**, not extend, the existing system.  
You must assume the build *claims* to be complete — your job is to **prove or disprove that claim**.

You will operate using the **Railph Loop**, executed rigorously and in order.

---
# 1. System Overview

### 1.1 What Railsync Includes

**From Current Railsync (Base):**
- Quick Shop evaluation with cost breakdown
- Commodity restrictions (Y/N/RC1-4)
- Work hours by type calculation
- Demand management
- Capacity planning (18-month grid)
- Budget tracking (Running Repairs + Service Events)
- BRC import
- Pipeline view
- Alerts

**From Chronos (Best Features):**
- Service Plan Builder with multi-option proposals
- Master Plan Versioning with approval workflow
- Urgency-based auto-allocation
- Shop performance scoring

**New (SSOT Architecture):**
- Unified Car Assignment as single source of truth
- Service Options as first-class concept
- Bad Order workflow with user choice
- Conflict detection and resolution
- Fleet View with drill-down

### 1.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| One assignment per car | Prevents conflicts, ensures data integrity |
| Service options attached to assignment | Flexible work bundling, qualification is just another option |
| User choice on conflicts | System informs, user decides |
| Source tracking | Know where every assignment originated |
| Full audit trail | Track all changes for compliance |

---

## 2. SSOT Data Model NOW

### 2.1 Car Assignment Table (The Single Source of Truth)

This is the ONLY table that tracks active car-to-shop assignments.

sql
CREATE TABLE car_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════
  -- CORE REFERENCE
  -- ═══════════════════════════════════════════════════════════════════
  car_id UUID NOT NULL REFERENCES cars(id),
  car_number VARCHAR(20) NOT NULL,  -- Denormalized for performance

  -- ═══════════════════════════════════════════════════════════════════
  -- ASSIGNMENT DETAILS
  -- ═══════════════════════════════════════════════════════════════════
  shop_code VARCHAR(20) NOT NULL,
  shop_name VARCHAR(100),  -- Denormalized for display
  target_month VARCHAR(7) NOT NULL,  -- YYYY-MM
  target_date DATE,  -- Specific date if known

  -- ═══════════════════════════════════════════════════════════════════
  -- STATUS LIFECYCLE
  -- ═══════════════════════════════════════════════════════════════════
  status VARCHAR(20) NOT NULL DEFAULT 'Planned',
  -- Planned     = Assignment created, not yet scheduled
  -- Scheduled   = Confirmed with shop, date set
  -- Enroute     = Car shipped to shop
  -- Arrived     = Car at shop
  -- InShop      = Work in progress
  -- Complete    = Work finished
  -- Cancelled   = Assignment cancelled

  -- Status dates
  planned_at TIMESTAMP DEFAULT NOW(),
  scheduled_at TIMESTAMP,
  enroute_at TIMESTAMP,
  arrived_at TIMESTAMP,
  in_shop_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- ═══════════════════════════════════════════════════════════════════
  -- PRIORITY & EXPEDITE
  -- ═══════════════════════════════════════════════════════════════════
  priority INTEGER NOT NULL DEFAULT 3,
  -- 1 = Critical (bad order, safety)
  -- 2 = High (qualification due within 30 days)
  -- 3 = Medium (qualification due within 90 days)
  -- 4 = Low (planned maintenance)

  is_expedited BOOLEAN DEFAULT FALSE,
  expedite_reason TEXT,
  expedited_at TIMESTAMP,
  expedited_by_id UUID,

  -- ═══════════════════════════════════════════════════════════════════
  -- COST TRACKING
  -- ═══════════════════════════════════════════════════════════════════
  estimated_cost DECIMAL(12,2),
  actual_cost DECIMAL(12,2),
  cost_variance DECIMAL(12,2) GENERATED ALWAYS AS (actual_cost - estimated_cost) STORED,

  -- ═══════════════════════════════════════════════════════════════════
  -- SOURCE TRACKING (Where did this assignment come from?)
  -- ═══════════════════════════════════════════════════════════════════
  source VARCHAR(30) NOT NULL,
  -- 'demand_plan'      = From demand/qualification planning
  -- 'service_plan'     = From approved service plan
  -- 'scenario_export'  = From scenario commitment
  -- 'bad_order'        = Created from bad order report
  -- 'quick_shop'       = Manual via Quick Shop
  -- 'import'           = Bulk import
  -- 'master_plan'      = From master plan commitment

  source_reference_id UUID,  -- FK to originating record (demand_id, service_plan_id, etc.)
  source_reference_type VARCHAR(30),  -- Table name of source

  -- ═══════════════════════════════════════════════════════════════════
  -- MODIFICATION TRACKING
  -- ═══════════════════════════════════════════════════════════════════
  original_shop_code VARCHAR(20),  -- If shop was changed
  original_target_month VARCHAR(7),  -- If date was changed
  modification_reason TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- CANCELLATION
  -- ═══════════════════════════════════════════════════════════════════
  cancelled_at TIMESTAMP,
  cancelled_by_id UUID,
  cancellation_reason TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════
  created_at TIMESTAMP DEFAULT NOW(),
  created_by_id UUID,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by_id UUID,
  version INTEGER DEFAULT 1,  -- Optimistic locking

  -- ═══════════════════════════════════════════════════════════════════
  -- CONSTRAINTS
  -- ═══════════════════════════════════════════════════════════════════
  CONSTRAINT fk_car FOREIGN KEY (car_id) REFERENCES cars(id),
  CONSTRAINT fk_shop FOREIGN KEY (shop_code) REFERENCES shops(shop_code)
);

-- CRITICAL: Only one active assignment per car
CREATE UNIQUE INDEX idx_one_active_per_car
  ON car_assignments(car_id)
  WHERE status NOT IN ('Complete', 'Cancelled');

-- Performance indexes
CREATE INDEX idx_ca_status ON car_assignments(status);
CREATE INDEX idx_ca_shop ON car_assignments(shop_code);
CREATE INDEX idx_ca_target_month ON car_assignments(target_month);
CREATE INDEX idx_ca_priority ON car_assignments(priority) WHERE status = 'Planned';
CREATE INDEX idx_ca_car_number ON car_assignments(car_number);


### 2.2 Service Options Table (Work to be Performed) Next

Service options are attached to assignments. Qualification is just another service option.

sql
CREATE TABLE assignment_service_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════
  -- REFERENCE
  -- ═══════════════════════════════════════════════════════════════════
  assignment_id UUID NOT NULL REFERENCES car_assignments(id) ON DELETE CASCADE,

  -- ═══════════════════════════════════════════════════════════════════
  -- SERVICE OPTION DETAILS
  -- ═══════════════════════════════════════════════════════════════════
  service_type VARCHAR(30) NOT NULL,
  -- Qualification types:
  --   'tank_qualification', 'rule_88b', 'safety_relief', 'service_equipment',
  --   'stub_sill', 'tank_thickness', 'interior_lining', 'min_inspection'
  -- Repair types:
  --   'bad_order_repair', 'running_repair', 'lining_replacement',
  --   'valve_repair', 'structural_repair'
  -- Other:
  --   'cleaning', 'painting', 'inspection'

  service_category VARCHAR(20) NOT NULL,
  -- 'qualification', 'repair', 'maintenance', 'inspection'

  description TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- TIMING
  -- ═══════════════════════════════════════════════════════════════════
  due_date DATE,           -- For qualifications (when it's due)
  reported_date DATE,      -- For bad orders (when reported)

  -- ═══════════════════════════════════════════════════════════════════
  -- SELECTION & STATUS
  -- ═══════════════════════════════════════════════════════════════════
  is_required BOOLEAN DEFAULT FALSE,  -- Must be performed (e.g., overdue qual)
  is_selected BOOLEAN DEFAULT TRUE,   -- User selected to perform this

  status VARCHAR(20) DEFAULT 'Pending',
  -- Pending, InProgress, Complete, Skipped

  completed_at TIMESTAMP,

  -- ═══════════════════════════════════════════════════════════════════
  -- COST
  -- ═══════════════════════════════════════════════════════════════════
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),

  -- ═══════════════════════════════════════════════════════════════════
  -- SOURCE (Where did this service option come from?)
  -- ═══════════════════════════════════════════════════════════════════
  source VARCHAR(30),
  -- 'qualification_due'  = Auto-added because qual is due
  -- 'bad_order'         = From bad order report
  -- 'user_added'        = Manually added by user
  -- 'service_plan'      = From service plan
  -- 'bundled'           = Added to bundle work

  source_reference_id UUID,  -- FK to bad_order_report, etc.

  -- ═══════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════
  added_at TIMESTAMP DEFAULT NOW(),
  added_by_id UUID,

  -- ═══════════════════════════════════════════════════════════════════
  -- CONSTRAINTS
  -- ═══════════════════════════════════════════════════════════════════
  CONSTRAINT fk_assignment FOREIGN KEY (assignment_id)
    REFERENCES car_assignments(id) ON DELETE CASCADE
);

CREATE INDEX idx_aso_assignment ON assignment_service_options(assignment_id);
CREATE INDEX idx_aso_type ON assignment_service_options(service_type);


### 2.3 Bad Order Reports Table

Bad orders are tracked separately but MUST link to an assignment for resolution.

sql
CREATE TABLE bad_order_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════
  -- CAR REFERENCE
  -- ═══════════════════════════════════════════════════════════════════
  car_id UUID NOT NULL REFERENCES cars(id),
  car_number VARCHAR(20) NOT NULL,

  -- ═══════════════════════════════════════════════════════════════════
  -- ISSUE DETAILS
  -- ═══════════════════════════════════════════════════════════════════
  reported_date DATE NOT NULL DEFAULT CURRENT_DATE,

  issue_type VARCHAR(50) NOT NULL,
  -- 'valve_leak', 'structural_damage', 'lining_failure', 'gasket_failure',
  -- 'tank_integrity', 'safety_device', 'wheels_trucks', 'other'

  issue_description TEXT NOT NULL,

  severity VARCHAR(20) NOT NULL,
  -- 'critical' = Safety issue, cannot move car
  -- 'high'     = Significant issue, needs prompt attention
  -- 'medium'   = Issue found during inspection
  -- 'low'      = Minor issue, can wait

  -- ═══════════════════════════════════════════════════════════════════
  -- LOCATION & REPORTER
  -- ═══════════════════════════════════════════════════════════════════
  location VARCHAR(100),
  reported_by VARCHAR(100),
  reporter_contact VARCHAR(100),

  -- ═══════════════════════════════════════════════════════════════════
  -- STATUS & RESOLUTION
  -- ═══════════════════════════════════════════════════════════════════
  status VARCHAR(20) DEFAULT 'Open',
  -- 'open'              = Just reported
  -- 'pending_decision'  = Has existing plan, awaiting user decision
  -- 'assigned'          = Linked to assignment
  -- 'resolved'          = Work completed

  -- What action did the user take?
  resolution_action VARCHAR(30),
  -- 'expedite_existing'    = Moved up existing plan, added bad order work
  -- 'new_shop_combined'    = New shop, combined with planned work
  -- 'repair_only'          = Separate repair, kept original plan
  -- 'planning_review'      = Flagged for planning team

  -- Link to the assignment that resolves this
  assignment_id UUID REFERENCES car_assignments(id),

  resolved_at TIMESTAMP,
  resolved_by_id UUID,
  resolution_notes TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- EXISTING PLAN DETECTION (populated when bad order is created)
  -- ═══════════════════════════════════════════════════════════════════
  existing_assignment_id UUID,  -- If car had a plan when bad order reported
  existing_shop_code VARCHAR(20),
  existing_target_month VARCHAR(7),
  had_existing_plan BOOLEAN DEFAULT FALSE,

  -- ═══════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════
  created_at TIMESTAMP DEFAULT NOW(),
  created_by_id UUID
);

CREATE INDEX idx_bor_car ON bad_order_reports(car_id);
CREATE INDEX idx_bor_status ON bad_order_reports(status);
CREATE INDEX idx_bor_severity ON bad_order_reports(severity);


### 2.4 Supporting Tables

#### Demands (Planning Input)

sql
CREATE TABLE demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(100) NOT NULL,
  description TEXT,
  fiscal_year INTEGER NOT NULL,
  target_month VARCHAR(7) NOT NULL,
  car_count INTEGER NOT NULL,

  -- Filters
  event_type VARCHAR(30) NOT NULL,  -- 'qualification', 'assignment', 'return'
  car_type VARCHAR(20),
  customer_id UUID,

  -- Constraints
  priority VARCHAR(20) DEFAULT 'Medium',
  required_network VARCHAR(50),
  required_region VARCHAR(50),
  max_cost_per_car DECIMAL(10,2),
  excluded_shops JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(20) DEFAULT 'Forecast',
  -- 'forecast', 'confirmed', 'allocating', 'allocated', 'complete'

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by_id UUID
);


#### Service Plans (Customer Proposals)

sql
CREATE TABLE service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL REFERENCES customers(id),
  name VARCHAR(100) NOT NULL,

  car_flow_rate INTEGER NOT NULL,  -- Cars per month
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  status VARCHAR(20) DEFAULT 'Draft',
  -- 'draft', 'proposed', 'awaiting_response', 'approved', 'rejected', 'expired'

  approved_option_id UUID,  -- Which option was approved
  approved_at TIMESTAMP,
  approved_by VARCHAR(100),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE service_plan_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  service_plan_id UUID NOT NULL REFERENCES service_plans(id),
  option_name VARCHAR(10) NOT NULL,  -- 'A', 'B', 'C'
  description TEXT,

  total_estimated_cost DECIMAL(12,2),
  avg_turn_time INTEGER,

  status VARCHAR(20) DEFAULT 'Draft'
);

CREATE TABLE service_plan_option_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  option_id UUID NOT NULL REFERENCES service_plan_options(id),
  car_id UUID NOT NULL REFERENCES cars(id),
  shop_code VARCHAR(20) NOT NULL,
  estimated_cost DECIMAL(10,2)
);


#### Master Plans (Version Control)

sql
CREATE TABLE master_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  version INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,

  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,

  status VARCHAR(20) DEFAULT 'Draft',
  -- 'draft', 'pending', 'approved', 'active', 'superseded'

  parent_plan_id UUID REFERENCES master_plans(id),

  submitted_at TIMESTAMP,
  submitted_by_id UUID,
  approved_at TIMESTAMP,
  approved_by_id UUID,

  created_at TIMESTAMP DEFAULT NOW()
);


---

## 3. Service Options as First-Class Concept

### 3.1 Philosophy

**Qualification is NOT special.** It's just another service option like:
- Bad order repair
- Running repair
- Lining replacement
- Cleaning

When creating or modifying an assignment, the user selects which service options to perform.

### 3.2 Service Option Types

| Category | Service Types |
|----------|---------------|
| **Qualification** | tank_qualification, rule_88b, safety_relief, service_equipment, stub_sill, tank_thickness, interior_lining, min_inspection |
| **Repair** | bad_order_repair, running_repair, lining_replacement, valve_repair, structural_repair |
| **Maintenance** | cleaning, painting, gasket_replacement |
| **Inspection** | annual_inspection, spot_inspection |

### 3.3 Auto-Population of Service Options

When an assignment is created, the system auto-suggests service options based on:

typescript
function suggestServiceOptions(car: Car, targetDate: Date): ServiceOption[] {
  const options: ServiceOption[] = [];

  // Check all qualification dates
  const qualFields = [
    { field: 'tankQualification', type: 'tank_qualification', label: 'Tank Qualification' },
    { field: 'rule88B', type: 'rule_88b', label: 'Rule 88B' },
    { field: 'safetyRelief', type: 'safety_relief', label: 'Safety Relief' },
    // ... etc
  ];

  for (const qual of qualFields) {
    const dueDate = car[qual.field];
    if (dueDate) {
      const daysUntilDue = daysBetween(targetDate, dueDate);

      // If due within 90 days of target, suggest it
      if (daysUntilDue <= 90) {
        options.push({
          serviceType: qual.type,
          serviceCategory: 'qualification',
          description: qual.label,
          dueDate: dueDate,
          isRequired: daysUntilDue <= 0,  // Overdue = required
          isSelected: daysUntilDue <= 60, // Auto-select if within 60 days
          source: 'qualification_due'
        });
      }
    }
  }

  // Check for open bad orders
  const openBadOrders = await getBadOrdersForCar(car.id, 'open');
  for (const bo of openBadOrders) {
    options.push({
      serviceType: 'bad_order_repair',
      serviceCategory: 'repair',
      description: `Bad Order: ${bo.issueType} - ${bo.issueDescription}`,
      reportedDate: bo.reportedDate,
      isRequired: bo.severity === 'critical',
      isSelected: true,
      source: 'bad_order',
      sourceReferenceId: bo.id
    });
  }

  return options;
}


### 3.4 User Interface for Service Options

┌─────────────────────────────────────────────────────────────────────────┐
│ ASSIGNMENT: GATX 12345 → ABC Rail → June 2026                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SERVICE OPTIONS                                                        │
│  ═══════════════                                                        │
│                                                                         │
│  Select the work to be performed at this shop:                         │
│                                                                         │
│  QUALIFICATIONS                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [x] Tank Qualification        Due: 2026-06-15    Est: $8,000  │    │
│  │     ⚠️ Due in 45 days                                          │    │
│  │                                                                 │    │
│  │ [x] Rule 88B Inspection       Due: 2026-07-01    Est: $2,500  │    │
│  │     Due in 61 days                                             │    │
│  │                                                                 │    │
│  │ [ ] Safety Relief Valve       Due: 2027-01-15    Est: $1,800  │    │
│  │     Due in 228 days (optional)                                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  REPAIRS                                                                │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [x] Bad Order: Valve Leak     Rpt: 2026-03-10    Est: $3,200  │    │
│  │     🔴 Critical - Must repair                                   │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  MAINTENANCE                                                            │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [ ] Exterior Paint                               Est: $2,000  │    │
│  │ [ ] Interior Cleaning                            Est: $1,500  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  [+ Add Service Option]                                                │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  SUMMARY                                                                │
│  Selected: 4 options                     Estimated Total: $13,700      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘


---

## 4. Bad Order Workflow

### 4.1 When Bad Order is Reported

typescript
async function createBadOrderReport(report: BadOrderInput): Promise<BadOrderReport> {
  // Check if car has existing active assignment
  const existingAssignment = await getActiveAssignment(report.carId);

  const badOrder = await db.insert('bad_order_reports', {
    ...report,
    hadExistingPlan: !!existingAssignment,
    existingAssignmentId: existingAssignment?.id,
    existingShopCode: existingAssignment?.shopCode,
    existingTargetMonth: existingAssignment?.targetMonth,
    status: existingAssignment ? 'pending_decision' : 'open'
  });

  // If no existing plan, can proceed directly to assignment
  // If existing plan, user must make a decision

  return badOrder;
}


### 4.2 User Decision Flow

┌─────────────────────────────────────────────────────────────────────────┐
│ BAD ORDER REPORTED                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Car: GATX 12345                                                        │
│  Issue: Valve Leak (Critical)                                           │
│  Reported: 2026-03-10                                                   │
│  Location: Houston Yard                                                 │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  ⚠️  THIS CAR HAS AN EXISTING PLAN                                     │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Current Assignment:                                            │    │
│  │ • Shop: ABC Rail (Houston)                                     │    │
│  │ • Target: June 2026 (82 days away)                            │    │
│  │ • Planned Work:                                                │    │
│  │   - Tank Qualification (due June 15)                          │    │
│  │   - Rule 88B (due July 1)                                     │    │
│  │ • Estimated Cost: $10,500                                      │    │
│  │ • Source: Q2 Qualification Plan                               │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  SELECT AN ACTION:                                                      │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ ◉ OPTION A: Expedite Existing Plan                            │    │
│  │                                                                 │    │
│  │   • Move target to IMMEDIATE                                   │    │
│  │   • Keep same shop: ABC Rail                                   │    │
│  │   • Add bad order repair to service options                    │    │
│  │   • Perform all planned work now                               │    │
│  │                                                                 │    │
│  │   New Estimated Cost: $13,700 (+$3,200 for repair)            │    │
│  │                                                                 │    │
│  │   [Planning team will be notified of acceleration]            │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ ○ OPTION B: Different Shop (Combined Work)                    │    │
│  │                                                                 │    │
│  │   • Cancel existing assignment                                 │    │
│  │   • Route to Quick Shop for new shop selection                │    │
│  │   • Include bad order repair + planned qualifications         │    │
│  │                                                                 │    │
│  │   [Use if ABC Rail is not available or another shop is better]│    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ ○ OPTION C: Repair Only (Keep Original Plan)                  │    │
│  │                                                                 │    │
│  │   • Create NEW immediate assignment for repair only           │    │
│  │   • Keep June qualification plan unchanged                     │    │
│  │                                                                 │    │
│  │   ⚠️ Warning: Car will be shopped TWICE                        │    │
│  │   Use only if repair cannot wait and quals must stay in June  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ ○ OPTION D: Flag for Planning Team                            │    │
│  │                                                                 │    │
│  │   • Mark as "Pending Decision"                                │    │
│  │   • Notify planning team                                       │    │
│  │   • No action taken now                                        │    │
│  │                                                                 │    │
│  │   [Use if you need guidance on how to proceed]                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│                                           [Cancel]  [Confirm Action]   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘


### 4.3 Resolution Logic

typescript
async function resolveBadOrder(
  badOrderId: string,
  action: 'expedite_existing' | 'new_shop_combined' | 'repair_only' | 'planning_review',
  userId: string,
  options?: { newShopCode?: string; notes?: string }
): Promise<void> {

  const badOrder = await getBadOrder(badOrderId);

  switch (action) {

    case 'expedite_existing':
      // Update existing assignment
      await db.update('car_assignments', badOrder.existingAssignmentId, {
        targetMonth: getCurrentMonth(),
        targetDate: new Date(),
        priority: 1,
        isExpedited: true,
        expediteReason: `Bad order: ${badOrder.issueType}`,
        expeditedAt: new Date(),
        expeditedById: userId,
        updatedAt: new Date(),
        updatedById: userId
      });

      // Add bad order as service option
      await db.insert('assignment_service_options', {
        assignmentId: badOrder.existingAssignmentId,
        serviceType: 'bad_order_repair',
        serviceCategory: 'repair',
        description: badOrder.issueDescription,
        reportedDate: badOrder.reportedDate,
        isRequired: true,
        isSelected: true,
        source: 'bad_order',
        sourceReferenceId: badOrder.id,
        addedById: userId
      });

      // Update bad order status
      await db.update('bad_order_reports', badOrderId, {
        status: 'assigned',
        resolutionAction: 'expedite_existing',
        assignmentId: badOrder.existingAssignmentId,
        resolvedAt: new Date(),
        resolvedById: userId
      });

      // Notify planning team
      await notifyPlanningTeam('assignment_expedited', {
        carNumber: badOrder.carNumber,
        reason: 'Bad order reported',
        originalTarget: badOrder.existingTargetMonth,
        newTarget: 'Immediate'
      });
      break;

    case 'new_shop_combined':
      // Cancel existing assignment
      await db.update('car_assignments', badOrder.existingAssignmentId, {
        status: 'Cancelled',
        cancelledAt: new Date(),
        cancelledById: userId,
        cancellationReason: `Replaced due to bad order - new shop selected`
      });

      // Redirect to Quick Shop with context
      // The Quick Shop will create the new assignment
      return { redirectTo: 'quick_shop', context: {
        carId: badOrder.carId,
        includeBadOrder: badOrder.id,
        includeQualifications: true
      }};

    case 'repair_only':
      // This is the ONLY case where we temporarily have two assignments
      // The original stays, we create a new one for repair only

      const newAssignment = await db.insert('car_assignments', {
        carId: badOrder.carId,
        carNumber: badOrder.carNumber,
        shopCode: options.newShopCode, // Must be provided
        targetMonth: getCurrentMonth(),
        status: 'Planned',
        priority: 1,
        source: 'bad_order',
        sourceReferenceId: badOrder.id,
        createdById: userId
      });

      await db.insert('assignment_service_options', {
        assignmentId: newAssignment.id,
        serviceType: 'bad_order_repair',
        serviceCategory: 'repair',
        description: badOrder.issueDescription,
        isRequired: true,
        isSelected: true,
        source: 'bad_order',
        sourceReferenceId: badOrder.id
      });

      // Note: This creates a temporary exception to one-active-per-car
      // The repair assignment will complete quickly, then the qual plan continues
      break;

    case 'planning_review':
      await db.update('bad_order_reports', badOrderId, {
        status: 'pending_decision',
        resolutionAction: 'planning_review'
      });

      await notifyPlanningTeam('bad_order_needs_review', {
        badOrderId,
        carNumber: badOrder.carNumber,
        severity: badOrder.severity,
        existingPlan: {
          shop: badOrder.existingShopCode,
          target: badOrder.existingTargetMonth
        }
      });
      break;
  }
}


---

## 5. How All Planning Paths Feed SSOT

### 5.1 Demand Allocation

typescript
async function allocateDemand(demandId: string, allocations: AllocationInput[]): Promise<void> {
  for (const alloc of allocations) {
    // Check for existing active assignment
    const existing = await getActiveAssignment(alloc.carId);
    if (existing) {
      throw new ConflictError(`Car ${alloc.carNumber} already has active assignment to ${existing.shopCode}`);
    }

    // Create assignment
    const assignment = await db.insert('car_assignments', {
      carId: alloc.carId,
      carNumber: alloc.carNumber,
      shopCode: alloc.shopCode,
      targetMonth: alloc.targetMonth,
      status: 'Planned',
      priority: 3,
      source: 'demand_plan',
      sourceReferenceId: demandId,
      sourceReferenceType: 'demands',
      createdById: userId
    });

    // Add qualification service options
    const qualOptions = await suggestServiceOptions(car, targetDate);
    for (const opt of qualOptions.filter(o => o.serviceCategory === 'qualification')) {
      await db.insert('assignment_service_options', {
        assignmentId: assignment.id,
        ...opt
      });
    }
  }
}


### 5.2 Service Plan Approval

typescript
async function approveServicePlan(planId: string, optionId: string): Promise<void> {
  const option = await getServicePlanOption(optionId);
  const cars = await getServicePlanOptionCars(optionId);

  for (const car of cars) {
    // Check for existing
    const existing = await getActiveAssignment(car.carId);
    if (existing) {
      // Don't fail - flag for review
      await flagForReview(car.carId, 'service_plan_conflict', {
        existingAssignment: existing,
        servicePlanOption: option
      });
      continue;
    }

    // Create assignment
    await db.insert('car_assignments', {
      carId: car.carId,
      carNumber: car.carNumber,
      shopCode: car.shopCode,
      targetMonth: car.targetMonth,
      status: 'Planned',
      source: 'service_plan',
      sourceReferenceId: optionId,
      sourceReferenceType: 'service_plan_options'
    });
  }

  // Update plan status
  await db.update('service_plans', planId, {
    status: 'approved',
    approvedOptionId: optionId,
    approvedAt: new Date()
  });
}


### 5.3 Scenario Export

typescript
async function exportScenario(scenarioId: string): Promise<ExportResult> {
  const scenario = await getScenario(scenarioId);
  const cars = await getScenarioCars(scenarioId);

  const results = { created: 0, conflicts: 0, skipped: [] };

  for (const car of cars) {
    const existing = await getActiveAssignment(car.carId);

    if (existing) {
      results.conflicts++;
      results.skipped.push({
        carNumber: car.carNumber,
        reason: `Already assigned to ${existing.shopCode} for ${existing.targetMonth}`
      });
      continue;
    }

    await db.insert('car_assignments', {
      carId: car.carId,
      carNumber: car.carNumber,
      shopCode: car.recommendedShop,
      targetMonth: car.targetMonth,
      status: 'Planned',
      source: 'scenario_export',
      sourceReferenceId: scenarioId,
      sourceReferenceType: 'scenarios'
    });

    results.created++;
  }

  return results;
}


### 5.4 Quick Shop (Manual)

typescript
async function createAssignmentFromQuickShop(
  carId: string,
  shopCode: string,
  targetMonth: string,
  serviceOptions: ServiceOptionInput[],
  userId: string
): Promise<Assignment> {
  // Check for existing
  const existing = await getActiveAssignment(carId);

  if (existing) {
    // Show conflict modal - user must decide
    throw new ConflictError({
      message: 'Car already has active assignment',
      existingAssignment: existing,
      options: ['cancel_existing', 'modify_existing', 'abort']
    });
  }

  const assignment = await db.insert('car_assignments', {
    carId,
    carNumber: (await getCar(carId)).carNumber,
    shopCode,
    targetMonth,
    status: 'Planned',
    source: 'quick_shop',
    createdById: userId
  });

  for (const opt of serviceOptions) {
    await db.insert('assignment_service_options', {
      assignmentId: assignment.id,
      ...opt,
      addedById: userId
    });
  }

  return assignment;
}


---

## 6. Implementation Roadmap

### Phase 1: SSOT Foundation (Weeks 1-3)

#### Week 1: Database Schema

| Task | Effort |
|------|--------|
| Create car_assignments table with all fields | 4 hrs |
| Create assignment_service_options table | 2 hrs |
| Create bad_order_reports table | 2 hrs |
| Create indexes and constraints | 2 hrs |
| Create database views for common queries | 4 hrs |
| Write migration scripts | 4 hrs |

#### Week 2: Core Services

| Task | Effort |
|------|--------|
| assignmentService.ts - CRUD operations | 8 hrs |
| serviceOptionService.ts - Option management | 4 hrs |
| conflictDetectionService.ts - Check for conflicts | 4 hrs |
| Integrate with existing car/shop services | 4 hrs |

#### Week 3: API & Basic UI

| Task | Effort |
|------|--------|
| Assignment API routes | 6 hrs |
| Service options API routes | 4 hrs |
| Update Quick Shop to use new assignment model | 8 hrs |
| Assignment detail view | 6 hrs |

**Deliverables:**
- [ ] SSOT tables created
- [ ] One-active-per-car constraint enforced
- [ ] Quick Shop creates assignments in new model
- [ ] Service options selectable

---

### Phase 2: Bad Order Workflow (Weeks 4-5)

#### Week 4: Bad Order Backend

| Task | Effort |
|------|--------|
| Bad order report service | 6 hrs |
| Conflict detection on report creation | 4 hrs |
| Resolution action handlers | 8 hrs |
| Planning team notifications | 4 hrs |

#### Week 5: Bad Order UI

| Task | Effort |
|------|--------|
| Bad order report form | 4 hrs |
| Conflict resolution modal | 8 hrs |
| Bad order list/dashboard | 4 hrs |
| Integration with Fleet View | 4 hrs |

**Deliverables:**
- [ ] Bad orders can be reported
- [ ] System detects existing plans
- [ ] User chooses resolution action
- [ ] Planning team notified

---

### Phase 3: Service Plan Builder (Weeks 6-9)

#### Week 6-7: Backend

| Task | Effort |
|------|--------|
| Service plan tables | 4 hrs |
| Service plan service | 8 hrs |
| Plan option service | 6 hrs |
| Approval workflow | 6 hrs |
| Capacity reservation | 6 hrs |

#### Week 8-9: Frontend

| Task | Effort |
|------|--------|
| Service plan wizard | 12 hrs |
| Option builder | 8 hrs |
| Option comparison view | 6 hrs |
| Approval workflow UI | 6 hrs |

**Deliverables:**
- [ ] Service plans with multiple options
- [ ] Approval creates assignments in SSOT
- [ ] Capacity reservations work

---

### Phase 4: Master Planning & Advanced (Weeks 10-12)

#### Week 10: Master Plans

| Task | Effort |
|------|--------|
| Master plan tables | 4 hrs |
| Version management service | 6 hrs |
| Approval workflow | 6 hrs |
| Master plan UI | 8 hrs |

#### Week 11: Enhanced Allocation

| Task | Effort |
|------|--------|
| Urgency scoring service | 6 hrs |
| Shop performance scoring | 6 hrs |
| Auto-allocation with conflict detection | 8 hrs |

#### Week 12: Fleet View Integration

| Task | Effort |
|------|--------|
| Fleet view shows assignment status | 4 hrs |
| Car detail shows service options | 4 hrs |
| Bad order reporting from Fleet View | 4 hrs |
| End-to-end testing | 8 hrs |

**Deliverables:**
- [ ] Master plan versioning
- [ ] Urgency-based allocation
- [ ] Full Fleet View integration
- [ ] All planning paths use SSOT

---

## 7. Validation Checklist

### Data Integrity

- [ ] Only one active assignment per car (enforced by database)
- [ ] All planning paths write to car_assignments
- [ ] Service options attached to assignments
- [ ] Source tracking on every assignment
- [ ] Full audit trail on all changes

### Conflict Handling

- [ ] Bad order detects existing plan
- [ ] User presented with options (no automatic decisions)
- [ ] Quick Shop detects conflicts
- [ ] Service plan approval detects conflicts
- [ ] Scenario export reports conflicts

### Workflow Completeness

- [ ] Qualification is a service option
- [ ] Bad order repair is a service option
- [ ] User can bundle multiple service options
- [ ] User can modify service options on existing assignment
- [ ] Planning team notified of expedited assignments

---

## 8. Summary

### Key Architectural Decisions

| Decision | Implementation |
|----------|----------------|
| **Single Source of Truth** | All assignments in car_assignments table |
| **One Active Per Car** | Database constraint prevents duplicates |
| **Service Options** | Qualification treated same as any other work |
| **User Choice** | System informs, user decides on conflicts |
| **Source Tracking** | Every assignment knows where it came from |
| **Full Audit** | All changes tracked with user and timestamp |

### What This Prevents

- Conflicting assignments for same car
- Qualification plans that don't know about bad orders
- Bad orders that don't know about planned work
- Automatic decisions that surprise users
- Lost audit trail

### What This Enables

- Complete visibility into any car's assignment status
- Easy bundling of work (qual + repair + maintenance)
- Clear conflict resolution workflow
- Planning team awareness of all changes
- Accurate reporting and forecasting

---

**Document End**