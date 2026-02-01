# Railsync Tasks

---

## Development Guardrails

### Token Efficiency Rules
1. **Read before write** - Always read existing code before modifying
2. **Small commits** - Commit after each logical unit of work
3. **Compile check** - Run `npm run build` after code changes before moving on
4. **Test incrementally** - Test each feature before starting the next
5. **Reuse existing** - Check for existing services/utilities before creating new ones

### Testing Requirements
Before marking any task complete:
1. **Unit tests** - All new services must have tests (min 80% coverage)
2. **API tests** - All endpoints tested via curl/httpie
3. **Integration** - Verify database operations work end-to-end
4. **Error cases** - Test validation, auth failures, not-found scenarios

### Test Commands
```bash
# Backend
cd backend && npm run build          # TypeScript compile check
cd backend && npm test               # Run unit tests
cd backend && npm run test:coverage  # Coverage report

# API smoke tests (requires running server)
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@railsync.com","password":"admin123"}'

# Frontend
cd frontend && npm run build         # Next.js build check
cd frontend && npm run lint          # ESLint check
```

### Phase 9 Test Checklist
- [x] Migration runs without errors
- [ ] Budget endpoints return data
- [ ] Car import parses CSV correctly
- [x] Demand CRUD works
- [x] Capacity initialization works
- [ ] Allocation engine produces results
- [x] BRC parser handles 500-byte format (25 unit tests)
- [x] Forecast calculations are accurate

---

## Phase 1 — Core (Complete)
1. [x] Make API endpoint: POST /evaluate return ranked shops
2. [x] Wire frontend form -> API call -> render results grid
3. [x] Create DB schema + seed: shops, capabilities, commodities, rules
4. [x] Implement rules engine v1: filter + score + explanation strings
5. [x] Add `npm run verify` to run lint/test/build across web+api
6. [x] Add overrides support (checkboxes)
7. [x] Add "why this shop" explanation in UI
8. [x] Add validation + user-friendly errors

## Phase 2 — Hardening (Complete)
1. [x] Add backend unit tests for rules engine (11 tests: happy paths, edge cases, commodity restrictions)
2. [x] Add API validation (Zod) with user-friendly errors
3. [x] Add frontend error boundary + loading states
4. [x] Add seed data coverage for edge commodities/capabilities
5. [x] Reduce ESLint warnings to zero

## Phase 3 — Excel Parity (Complete)

### 3.1 Eligibility Rules Expansion (Backend) ✓
- [x] Implement all 25 eligibility rules from Implementation Spec Section 2:
  - [x] Car Type rules: Tank, Hopper, Boxcar, Gondola (via capability matching)
  - [x] Material rules (3): Aluminum, Stainless, Carbon Steel
  - [x] Lining rules (5): High Bake, Plasite, Rubber, Vinyl Ester, Epoxy
  - [x] Paint/Blast rules: Paint, Blast services (via overrides)
  - [x] Compliance rules (3): HM201, AAR, DOT certifications
  - [x] Special rules: Asbestos Abatement, Kosher, Nitrogen stages 1-9, Primary Network
  - [x] Commodity Restriction rules (2): N blocked, RC1 blocked with approval
- [x] Each rule returns 1 (pass), 0 (fail), or 'NA' (not applicable)
- [x] Shop eligible ONLY if ALL rules return 1 or NA (any 0 = disqualified)
- [x] Unit tests: 22 rules engine tests covering all rule categories

### 3.2 Shop Capabilities Schema (Backend + Seed Data) ✓
Note: Using EAV pattern (shop_capabilities table) instead of 58 columns for flexibility.
- [x] Capability types implemented via shop_capabilities table:
  - [x] Lining: High Bake, Plasite, Rubber, Vinyl Ester, Epoxy
  - [x] Blast: Brush, Commercial, White Metal (via blast capability values)
  - [x] Car types: Tank, Hopper, Covered Hopper, Boxcar, Gondola, Flatcar, Autorack
  - [x] Materials: Carbon Steel, Stainless, Aluminum
  - [x] Special: Kosher, Asbestos Abatement, Nitrogen stages 1-9
  - [x] Compliance: HM201, AAR, DOT certifications
  - [x] Cost factors: labor_rate, material_multiplier on shops table
- [x] Seed with 15 shops (BNSF, UP, NS, CSX, CN, KCS, CPKC, IND)

### 3.3 Cost Calculation (Backend) ✓
- [x] Implement cost formula:
  - [x] Labor: `hours × hourly_rate` (with minimum hours enforcement)
  - [x] Material: Commodity-based cleaning + lining-specific costs
  - [x] Cleaning class multipliers: A=1.0x, B=1.25x, C=1.5x, D=2.0x
  - [x] Lining-specific costs: High Bake ($1800), Plasite ($3200), Rubber ($4500), Vinyl Ester ($3800), Epoxy ($2200)
  - [x] Kosher cleaning premium: $500 when required
  - [x] Abatement: $5000 flat rate when asbestos abatement required
  - [x] Freight: distance-based with fuel surcharge, or default $500
  - [x] Total: sum of all components
- [x] Shop material_multiplier applied to all material costs
- [x] 19 unit tests covering all cost scenarios

### 3.4 Commodity Restrictions Matrix (Backend + Seed Data) ✓
- [x] Create commodity_restrictions table: (cin_code, shop_code, restriction_code)
- [x] Restriction codes: Y (allowed), N (blocked), RC1-RC4 (restricted cleaning)
- [x] Seed with 50-100 common CINs from AITX fleet (55 commodities, 140+ restrictions)

### 3.5 Input Data Model (Backend + 🖥️ UI)
**Backend:** ✓
- [x] Extend car input schema to capture all 16 attributes from Spec Section 1
- [x] Add derived field calculations (is_covered_hopper from product_code)
- [x] Update Zod validation for new fields (26 tests)

**🖥️ UI - Car Input Form Redesign:** ✓
- [x] Reorganize form into sections/tabs:
  - [x] **Car Identity**: car_number, product_code, stencil_class_code, product_code_group
  - [x] **Car Attributes**: car_material dropdown (Aluminum/Stainless/Standard)
  - [x] **Commodity**: commodity_cin, nitrogen_pad_stage dropdown (0-9)
  - [x] **Lining**: car_lining_type dropdown
  - [x] **Compliance**: asbestos indicators (has_asbestos, asbestos_abatement_required)
  - [x] **Ownership**: owner_code, lessee_code
- [x] **Overrides Panel**: Existing OverrideOptions component supports paint, lining, blast, kosher, primary_network
- [x] DirectCarInput component with Quick/Advanced mode support
- [x] Add field help tooltips explaining each input (HelpTooltip component)
- [ ] Consider wizard/stepper for first-time users vs. compact form for power users (later)

### 3.6 Output Grid Parity (🖥️ UI) ✓
**🖥️ UI - Results Grid Redesign:**
- [x] Expand grid to show all columns from Spec Section 5.1:
  - [x] **Core columns** (always visible): Shop Name, Code, Total $, Preferred?, Hours Backlog
  - [x] **Cost breakdown** (expandable): Labor $, Material $, Abatement $, Freight $
  - [x] **Capacity metrics**: Current Backlog, En Route 0-6, En Route 7-14, This Week IB, This Week OB
  - [x] **Hours by work type** (expandable): Cleaning, Flare, Mechanical, Blast, Lining, Paint, Other
  - [x] **Restriction**: RC Code, Railroad
- [x] Implement column groups with expand/collapse:
  - [x] Default view: ~8 key columns
  - [x] Expanded view: All 20+ columns with horizontal scroll ("Show all columns" toggle)
- [x] Add column visibility toggle (show all columns toggle)
- [x] **Sorting**: Clickable column headers with sort indicators
  - [x] Default sort: En Route 0-6 ascending (available capacity first)
  - [x] Support: Total Cost, Hours Backlog, Shop Name, Railroad, En Route 0-6
- [x] **Row expansion**: Click row to see full "why this shop" breakdown (rules display)

### 3.7 Rules Explanation UI (🖥️ UI) ✓
**🖥️ UI - "Why This Shop" Enhancement:**
- [x] Redesign explanation panel to show all 25 rules:
  - [x] Group by category: Car Type, Material, Lining, Blast, Compliance, Special
  - [x] Show rule name, result (checkmark Pass / X Fail / dash N/A), and reason
  - [x] Color coding: green (pass), red (fail), gray (N/A)
- [x] For disqualified shops (if shown): highlight which rule(s) failed (failed_rules display)
- [x] Add "Compare Shops" mode: side-by-side comparison for 2-3 shops (ShopComparisonModal)

### 3.8 API Response Schema Update (Backend) ✓
- [x] Update /evaluate response to include:
  ```json
  {
    "shops": [{
      "shop_code": "ARIG",
      "shop_name": "ARI Goodrich",
      "is_preferred": true,
      "railroad": "BNSF",
      "costs": {
        "labor": 1500,
        "material": 2100,
        "abatement": 0,
        "freight": 450,
        "total": 4050
      },
      "capacity": {
        "hours_backlog": 120,
        "cars_backlog": 15,
        "en_route_0_6": 3,
        "en_route_7_14": 5,
        "weekly_inbound": 8,
        "weekly_outbound": 6
      },
      "hours_by_type": {
        "cleaning": 4,
        "flare": 2,
        "mechanical": 8,
        "blast": 6,
        "lining": 12,
        "paint": 4,
        "other": 0
      },
      "restriction_code": "Y",
      "rules": [
        {"rule": "TankCar", "result": 1, "reason": "Shop handles tank cars"},
        {"rule": "HighBakeLining", "result": "NA", "reason": "Car doesn't need high bake"},
        ...
      ]
    }]
  }
  ```

## Phase 4 — Operational Data Integration ✓
- [x] Shop backlog feed (daily): hours_backlog, cars_backlog per shop
- [x] En-route cars feed: cars arriving in 0-6 days, 7-14 days per shop
- [x] Weekly throughput: weekly_inbound, weekly_outbound counts per shop
- [x] Capacity by work type hours available
- [x] API endpoints: PUT /shops/:code/backlog, PUT /shops/:code/capacity, POST /shops/backlog/batch
- [x] 🖥️ UI: Add "last updated" timestamp for operational data
- [x] 🖥️ UI: Add refresh button to pull latest backlog data

## Phase 5 — Car Lookup Integration ✓
- [x] Car lookup API: GET /api/cars/:carNumber → returns all attributes + commodity + service event
- [x] 🖥️ UI: Car number input with "Lookup" button (CarLookup component)
- [x] 🖥️ UI: Show car details card after lookup (product code, lining, customer, etc.)
- [x] 🖥️ UI: Allow manual override via Direct Input mode toggle

## Phase 6 — Enterprise Features ✓
- [x] Auth (JWT-based authentication with roles: admin, operator, viewer)
  - [x] Users table with bcrypt password hashing
  - [x] JWT access tokens (15min) + refresh tokens (7 days)
  - [x] Auth middleware for protected routes
  - [x] Login/Register/Logout/Me endpoints
  - [x] Role-based authorization (admin, operator, viewer)
- [x] Audit logs (who/when/what tracking)
  - [x] audit_logs table with entity tracking
  - [x] Audit service for logging actions
  - [x] Admin endpoint to query audit logs
  - [x] Login/logout/failed login tracking
- [x] Admin rules editor UI
  - [x] Rule list with category/status filters
  - [x] Create/Edit/Toggle rules
  - [x] JSON condition editor
  - [x] Admin-only access control
- [x] Freight/routing calculation (distance-based)
  - [x] origin_locations table with lat/long
  - [x] freight_rates table with tiered pricing
  - [x] Haversine distance calculation
  - [x] Fuel surcharge calculation
- [x] Work hours ML model (factor-based estimation)
  - [x] work_hours_factors table with coefficients
  - [x] Car type base hours
  - [x] Material type multipliers
  - [x] Lining-specific hours
  - [x] Cleaning class multipliers
  - [x] Special requirements (kosher, asbestos, nitrogen)
- [x] "Select This Shop" action button
  - [x] service_events table
  - [x] Create service event API
  - [x] SelectShopModal component
  - [x] Service event list/detail endpoints
- [x] Wizard/stepper for first-time users
  - [x] EvaluationWizard component
  - [x] Multi-step guided flow
  - [x] localStorage flag for returning users
  - [x] Skip option for power users
- [x] 🖥️ UI: Dark mode (ThemeProvider with system/light/dark toggle)
- [x] 🖥️ UI: Mobile responsive layout (responsive breakpoints throughout)
- [x] 🖥️ UI: Export results to CSV/Excel (CSV export button in ResultsGrid)

---

## UI Component Summary

| Component | Current State | Phase 3 Target |
|-----------|--------------|----------------|
| Car Input Form | Simple fields | Sectioned form with 16 fields + 5 overrides |
| Results Grid | ~5 columns | 20+ columns with expand/collapse groups |
| Sorting | None or basic | Multi-column sort with clickable headers |
| Why This Shop | Basic text | 25-rule breakdown with pass/fail/NA indicators |
| Cost Display | Total only | Breakdown: Labor + Material + Abatement + Freight |

## UI Approach: Progressive Disclosure ✓

### Quick Mode (Default)
**Input:** Car number + 4 key overrides (paint, lining, blast, primary network)
**Output:** 8-column grid: Shop Name, Code, Total $, Preferred, Hours Backlog, En Route 0-6, Railroad, RC Code

### Advanced Mode (Toggle)
**Input:** All 16 car attributes + 5 overrides in sectioned form
**Output:** Full 20+ column grid with expandable column groups

### UI Implementation Tasks

#### 3.9 Quick/Advanced Mode Toggle (🖥️ UI) ✓
- [x] Add "Advanced Mode" toggle switch in form header
- [x] Quick Mode form fields (Direct Input):
  - [x] product_code (text input)
  - [x] material_type (dropdown: Carbon Steel/Stainless/Aluminum)
  - [x] lining_type (dropdown: None/High Bake/Plasite/Rubber/Vinyl Ester/Epoxy)
- [x] Advanced Mode: Reveals full sectioned form (car identity, commodity, compliance, ownership)
- [x] Input Mode toggle (Car Lookup vs Direct Input)
- [x] Persist user's mode preference in localStorage

#### 3.10 Results Grid Modes (🖥️ UI) ✓
- [x] Quick Mode grid columns (always visible):
  1. Shop Name
  2. Shop Code
  3. Total Cost ($)
  4. Preferred (Y/N badge)
  5. Hours Backlog
  6. En Route 0-6
  7. Railroad
  8. RC Code
- [x] "Show all columns" toggle → reveals all column groups
  - [x] Cost Breakdown: Labor $, Material $, Abatement $, Freight $
  - [x] Capacity: Current Backlog, En Route 7-14, Weekly IB, Weekly OB
  - [x] Hours by Type: Cleaning, Flare, Mechanical, Blast, Lining, Paint, Other
- [x] Column groups with headers
- [x] Remember expanded state in localStorage

#### 3.11 Shop Detail Drawer (🖥️ UI) ✓
- [x] Click row → opens right-side drawer (not modal, keeps context)
- [x] Drawer contents:
  - [x] Shop header: Name, Code, Railroad, Preferred badge
  - [x] Eligibility status with failed rules summary
  - [x] Cost breakdown card with horizontal bar chart
  - [x] Capacity metrics card (6 key metrics in grid)
  - [x] Hours by work type (horizontal bar chart)
  - [x] Rules evaluation list (grouped by category with pass/fail/NA)
- [x] "Compare" button → pins shop for comparison (max 3)
- [x] Close drawer → back to grid
- [x] Comparison indicator bar shows selected shops

#### 3.12 Comparison Mode (🖥️ UI) ✓
- [x] Compare 2-3 pinned shops side-by-side (ShopComparisonModal)
- [x] Highlight differences in costs, capacity, rule results (best/worst value coloring)
- [x] "Select This Shop" action button (SelectShopModal + service_events API)# RailSync Phase 9 — Planning, Budgeting & Forecasting

**Version:** 2.0  
**Last Updated:** January 2026  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Model from Qual Planner Master](#2-data-model-from-qual-planner-master)
3. [Budget Model](#3-budget-model)
4. [Maintenance Forecast Formula](#4-maintenance-forecast-formula)
5. [Database Schema](#5-database-schema)
6. [BRC Import (AAR 500-Byte)](#6-brc-import-aar-500-byte)
7. [API Endpoints](#7-api-endpoints)
8. [Backend Services](#8-backend-services)
9. [Frontend Components](#9-frontend-components)
10. [Task List](#10-task-list)

---

## 1. Overview

Phase 9 extends RailSync from a single-car shop selector into a full planning and budget management system.

### What This Phase Adds

| Capability | Description |
|------------|-------------|
| **Budget Management** | Running Repairs pool + Service Event budgets |
| **Demand Management** | Track qualification, assignment, return work by month |
| **Capacity Planning** | 18-month shop loading view |
| **Allocation Engine** | Reuses RailSync's `evaluateShops()` for batch planning |
| **Scenario Comparison** | Compare allocation strategies with different weights |
| **Maintenance Forecast** | `Remaining = Budget - Planned - Actual` |
| **BRC Import** | Parse AAR 500-byte files, record actual costs |
| **Configurable Dashboards** | User-defined widget layouts |

### Key Principle

**The allocation engine calls your existing `evaluateShops()` function.** Same 25 rules. Same cost calculation. Just applied to batches of cars over time.

---

## 2. Data Model from Qual Planner Master

Based on your `Qual_Planner_Master.csv` (8,281 cars, 137 columns), here's the mapping:

### 2.1 Car Master Fields

| CSV Column | DB Field | Type | Notes |
|------------|----------|------|-------|
| `Car Mark` | `car_id` | VARCHAR(15) | Full car ID (e.g., "SHQX006002") |
| `Mark` | `car_mark` | VARCHAR(4) | Mark only (e.g., "SHQX") |
| `Number` | `car_number` | VARCHAR(10) | Number only (e.g., "006002") |
| `Car Type Level 2` | `car_type` | VARCHAR(50) | "General Service Tank", etc. |
| `Lessee Name` | `lessee_name` | VARCHAR(100) | Customer name |
| `FMS Lessee Number` | `lessee_code` | VARCHAR(20) | FMS customer code |
| `Contract` | `contract_number` | VARCHAR(20) | Lease contract ID |
| `Contract Expiration` | `contract_expiration` | DATE | Lease end date |
| `Primary Commodity` | `commodity` | VARCHAR(100) | What car carries |
| `Jacketed` | `is_jacketed` | BOOLEAN | Has thermal jacket |
| `Lined` | `is_lined` | BOOLEAN | Has interior lining |
| `Lining Type` | `lining_type` | VARCHAR(50) | Type of lining |
| `Car Age` | `car_age` | INTEGER | Years old |

### 2.2 Compliance/Qualification Fields

| CSV Column | DB Field | Type | Notes |
|------------|----------|------|-------|
| `Min (no lining)` | `min_no_lining_year` | INTEGER | Next min inspection (unlined) |
| `Min w lining` | `min_lining_year` | INTEGER | Next min inspection (lined) |
| `Interior Lining` | `interior_lining_year` | INTEGER | Next lining inspection |
| `Rule 88B` | `rule_88b_year` | INTEGER | Next 88B due |
| `Safety Relief` | `safety_relief_year` | INTEGER | Next safety valve due |
| `Service Equipment` | `service_equipment_year` | INTEGER | Next service equip due |
| `Stub Sill` | `stub_sill_year` | INTEGER | Next stub sill due |
| `Tank Thickness` | `tank_thickness_year` | INTEGER | Next thickness test due |
| `Tank Qualification` | `tank_qual_year` | INTEGER | Next full TQ due |

### 2.3 Status Fields

| CSV Column | DB Field | Type | Values |
|------------|----------|------|--------|
| `Portfolio` | `portfolio_status` | VARCHAR(20) | "On Lease", year (2025, 2026, etc.) |
| `Current Status` | `current_status` | VARCHAR(30) | See below |
| `Adjusted Status` | `adjusted_status` | VARCHAR(30) | Year or status |
| `Plan Status` | `plan_status` | VARCHAR(20) | Planning year |

**Current Status Values (from your data):**

| Status | Count | Meaning |
|--------|-------|---------|
| `Planned Shopping` | 2,812 | Scheduled, shop TBD or assigned |
| `To Be Routed` | 1,415 | Needs shop assignment |
| `Complete` | 1,283 | Work finished |
| `Arrived` | 893 | At shop |
| `Need Shopping` | 724 | Identified, not yet planned |
| `Upmarketed` | 194 | Reassigned to different customer |
| `To Be Scrapped` | 164 | End of life |
| `Enroute` | 148 | In transit to shop |
| `Released` | 56 | Released from shop |

### 2.4 Shop Assignment Columns

Columns 40-137 are shop names with dates. If a cell has a date, the car is/was assigned to that shop.

**Shop List (from CSV headers):**

```
AITX Fleet Services of Canada Inc. (Sarnia)
AITX Railcar Services LLC (N Kansas City)
AITX Mini/Mobile Unit 93 (Mounds)
AITX Mobile Headquarters (LaPorte)
AITX Mobile Operations (Houston)
AITX Railcar Services LLC (Brookhaven)
AITX Railcar Services LLC (Bude)
AITX Railcar Services LLC (Longview)
AITX Railcar Services LLC (Tennille)
... (70+ shops total)
```

### 2.5 Active Cars Definition

**Active = `Portfolio` = "On Lease"**

From your data: **4,213 cars currently on lease** (active fleet for running repairs budget)

---

## 3. Budget Model

### 3.1 Two Budget Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MAINTENANCE BUDGET MODEL                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  RUNNING REPAIRS (Pool-Based)                                       │   │
│  │  ─────────────────────────────                                      │   │
│  │  • Monthly allocation per active car                                │   │
│  │  • Budget = $/car/month × cars on lease × 12                        │   │
│  │  • Actuals come from unplanned BRCs                                 │   │
│  │                                                                     │   │
│  │  Example:                                                           │   │
│  │    $150/car/month × 4,213 active cars = $631,950/month              │   │
│  │    Annual: $7,583,400                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SERVICE EVENTS (Event-Based)                                       │   │
│  │  ─────────────────────────────                                      │   │
│  │  • Specific cars with known work needs                              │   │
│  │  • Planned via RailSync shop selection                              │   │
│  │  • Types: Qualification, Assignment, Return                         │   │
│  │                                                                     │   │
│  │  From your CSV:                                                     │   │
│  │    Qualifications: ~2,500 cars/year                                 │   │
│  │    Assignments: ~3,600 cars/year (S&OP driven)                      │   │
│  │    Returns: ~4,000 cars/year (lease expirations)                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 S&OP Integration

On/off lease planning changes monthly. The S&OP process updates:

1. **Active car count** → Affects running repairs budget
2. **Assignment forecasts** → New cars going to customers
3. **Return forecasts** → Cars coming back from customers

```
S&OP Meeting (Monthly)
        │
        ▼
┌───────────────────┐
│ Update Forecasts  │
│ • Lease counts    │
│ • Assignments     │
│ • Returns         │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Budget Auto-Calc  │
│ • Running repairs │
│ • Service events  │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Demands Created   │
│ • By month        │
│ • By work type    │
└───────────────────┘
```

---

## 4. Maintenance Forecast Formula

### 4.1 The Core Calculation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MAINTENANCE FORECAST FORMULA                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Remaining Budget = Annual Budget                                          │
│                      - Σ(Planned Costs for cars not yet complete)           │
│                      - Σ(Actual Costs from completed BRCs)                  │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   RUNNING REPAIRS:                                                          │
│     Budget:     $7,583,400  (4,213 cars × $150 × 12)                       │
│     Planned:    $0          (running repairs are unplanned)                 │
│     Actual:     $3,200,000  (BRCs received YTD)                            │
│     Remaining:  $4,383,400                                                  │
│                                                                             │
│   SERVICE EVENTS:                                                           │
│     Budget:     $87,500,000 (2,500 quals × $35,000)                        │
│     Planned:    $42,000,000 (1,200 cars scheduled, not complete)           │
│     Actual:     $18,000,000 (500 cars complete, BRC received)              │
│     Remaining:  $27,500,000                                                 │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   TOTAL REMAINING = $4,383,400 + $27,500,000 = $31,883,400                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Cost Lifecycle States

| State | Definition | Cost Source | Status Values |
|-------|------------|-------------|---------------|
| **Budget** | Annual allocation | Manual entry or S&OP | — |
| **Planned** | Car scheduled to shop | RailSync cost estimate | `Planned Shopping`, `Enroute`, `Arrived` |
| **Actual** | Work complete, BRC received | AAR 500-byte BRC | `Complete`, `Released` |

### 4.3 State Transitions (from your CSV statuses)

```
Need Shopping
      │
      ▼
To Be Routed ──────► RailSync assigns shop
      │
      ▼
Planned Shopping ──► estimated_cost set
      │
      ▼
Enroute ───────────► Car in transit
      │
      ▼
Arrived ───────────► Car at shop
      │
      ▼
Complete ──────────► BRC received, actual_cost set
      │
      ▼
Released ──────────► Car back in service
```

---

## 5. Database Schema

### 5.1 Car Master (Seed from CSV)

```sql
-- Car master table (seed from Qual_Planner_Master.csv)
CREATE TABLE cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    car_id VARCHAR(15) NOT NULL UNIQUE,           -- "SHQX006002"
    car_mark VARCHAR(4) NOT NULL,                 -- "SHQX"
    car_number VARCHAR(10) NOT NULL,              -- "006002"
    car_type VARCHAR(50),                         -- "General Service Tank"
    
    -- Customer/Lease
    lessee_name VARCHAR(100),
    lessee_code VARCHAR(20),
    contract_number VARCHAR(20),
    contract_expiration DATE,
    portfolio_status VARCHAR(20),                 -- "On Lease", "2026", etc.
    
    -- Commodity
    commodity VARCHAR(100),
    
    -- Physical attributes
    is_jacketed BOOLEAN DEFAULT FALSE,
    is_lined BOOLEAN DEFAULT FALSE,
    lining_type VARCHAR(50),
    car_age INTEGER,
    
    -- Compliance dates (year of next due)
    min_no_lining_year INTEGER,
    min_lining_year INTEGER,
    interior_lining_year INTEGER,
    rule_88b_year INTEGER,
    safety_relief_year INTEGER,
    service_equipment_year INTEGER,
    stub_sill_year INTEGER,
    tank_thickness_year INTEGER,
    tank_qual_year INTEGER,
    
    -- Planning
    current_status VARCHAR(30),                   -- "Planned Shopping", "To Be Routed", etc.
    adjusted_status VARCHAR(30),
    plan_status VARCHAR(20),
    assigned_shop_code VARCHAR(20),
    assigned_date DATE,
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cars_car_id ON cars(car_id);
CREATE INDEX idx_cars_portfolio ON cars(portfolio_status);
CREATE INDEX idx_cars_status ON cars(current_status);
CREATE INDEX idx_cars_lessee ON cars(lessee_code);
CREATE INDEX idx_cars_tq_year ON cars(tank_qual_year);
```

### 5.2 Running Repairs Budget

```sql
-- Running repairs budget (pool-based, per active car)
CREATE TABLE running_repairs_budget (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,
    month VARCHAR(7) NOT NULL,                    -- "2026-01"
    
    -- Budget inputs
    cars_on_lease INTEGER NOT NULL,               -- Count of active cars
    allocation_per_car DECIMAL(10,2) NOT NULL,    -- $/car/month
    
    -- Calculated budget
    monthly_budget DECIMAL(14,2) GENERATED ALWAYS AS (
        cars_on_lease * allocation_per_car
    ) STORED,
    
    -- Actuals (from unmatched BRCs)
    actual_spend DECIMAL(14,2) DEFAULT 0,
    actual_car_count INTEGER DEFAULT 0,
    
    -- Remaining
    remaining_budget DECIMAL(14,2) GENERATED ALWAYS AS (
        (cars_on_lease * allocation_per_car) - actual_spend
    ) STORED,
    
    -- Audit
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(fiscal_year, month)
);

CREATE INDEX idx_rr_budget_year_month ON running_repairs_budget(fiscal_year, month);
```

### 5.3 Service Event Budget

```sql
-- Service event budget (event-based: qualifications, assignments, returns)
CREATE TABLE service_event_budget (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL,              -- 'Qualification', 'Assignment', 'Return'
    
    -- Budget inputs
    budgeted_car_count INTEGER NOT NULL,
    avg_cost_per_car DECIMAL(10,2) NOT NULL,
    
    -- Calculated budget
    total_budget DECIMAL(14,2) GENERATED ALWAYS AS (
        budgeted_car_count * avg_cost_per_car
    ) STORED,
    
    -- Optional segmentation
    customer_code VARCHAR(20),                    -- NULL = all customers
    fleet_segment VARCHAR(50),                    -- NULL = all fleets
    car_type VARCHAR(50),                         -- NULL = all car types
    
    -- Audit
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(fiscal_year, event_type, COALESCE(customer_code, ''), COALESCE(fleet_segment, ''), COALESCE(car_type, ''))
);

CREATE INDEX idx_se_budget_year_type ON service_event_budget(fiscal_year, event_type);
```

### 5.4 Demands (Work Batches)

```sql
-- Demand forecasts (batches of cars needing work)
CREATE TABLE demands (
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_demands_year_month ON demands(fiscal_year, target_month);
CREATE INDEX idx_demands_status ON demands(status);
CREATE INDEX idx_demands_event_type ON demands(event_type);
```

### 5.5 Shop Monthly Capacity

```sql
-- Shop capacity by month
CREATE TABLE shop_monthly_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_code VARCHAR(20) NOT NULL REFERENCES shops(code),
    month VARCHAR(7) NOT NULL,                    -- "2026-04"
    
    -- Capacity
    total_capacity INTEGER NOT NULL,              -- Max cars this month
    allocated_count INTEGER DEFAULT 0,            -- Cars with status IN ('Planned', 'Enroute', 'Arrived')
    completed_count INTEGER DEFAULT 0,            -- Cars with status = 'Complete'
    
    -- Calculated
    available_capacity INTEGER GENERATED ALWAYS AS (
        total_capacity - allocated_count
    ) STORED,
    
    utilization_pct DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_capacity > 0 
             THEN (allocated_count::DECIMAL / total_capacity) * 100 
             ELSE 0 
        END
    ) STORED,
    
    -- Audit
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(shop_code, month)
);

CREATE INDEX idx_shop_capacity_month ON shop_monthly_capacity(month);
CREATE INDEX idx_shop_capacity_shop ON shop_monthly_capacity(shop_code);
```

### 5.6 Allocations (Planned & Actual Work)

```sql
-- Car allocations to shops (planned and actual)
CREATE TABLE allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    demand_id UUID REFERENCES demands(id),
    scenario_id UUID REFERENCES scenarios(id),
    
    -- Car identification
    car_id VARCHAR(15) NOT NULL,                  -- "SHQX006002"
    car_number VARCHAR(10),                       -- "006002" (for BRC matching)
    
    -- Assignment
    shop_code VARCHAR(20) NOT NULL REFERENCES shops(code),
    target_month VARCHAR(7) NOT NULL,
    
    -- Status (mirrors your CSV Current Status)
    status VARCHAR(30) DEFAULT 'Planned Shopping',
    -- Values: 'Need Shopping', 'To Be Routed', 'Planned Shopping', 'Enroute', 'Arrived', 'Complete', 'Released'
    
    -- Cost tracking (THE KEY FIELDS)
    estimated_cost DECIMAL(10,2),                 -- From RailSync cost calculator
    estimated_cost_breakdown JSONB,               -- {labor, material, freight, abatement}
    
    actual_cost DECIMAL(10,2),                    -- From BRC when complete
    actual_cost_breakdown JSONB,                  -- {labor, material, job_codes: [...]}
    
    -- BRC reference
    brc_number VARCHAR(50),
    brc_received_at TIMESTAMP,
    
    -- Variance (auto-calculated)
    cost_variance DECIMAL(10,2) GENERATED ALWAYS AS (
        actual_cost - estimated_cost
    ) STORED,
    
    cost_variance_pct DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN estimated_cost > 0 
             THEN ((actual_cost - estimated_cost) / estimated_cost) * 100 
             ELSE NULL 
        END
    ) STORED,
    
    -- Dates
    planned_arrival_date DATE,
    actual_arrival_date DATE,
    planned_completion_date DATE,
    actual_completion_date DATE,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_allocations_demand ON allocations(demand_id);
CREATE INDEX idx_allocations_car ON allocations(car_id);
CREATE INDEX idx_allocations_shop_month ON allocations(shop_code, target_month);
CREATE INDEX idx_allocations_status ON allocations(status);
CREATE INDEX idx_allocations_car_number ON allocations(car_number);
```

### 5.7 Scenarios

```sql
-- Allocation scenarios for comparison
CREATE TABLE scenarios (
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed default scenarios
INSERT INTO scenarios (id, name, description, weights, is_default, is_system) VALUES
    (gen_random_uuid(), 'Cost Optimized', 'Minimize total cost', 
     '{"cost": 70, "cycle_time": 10, "aitx_preference": 10, "capacity_balance": 5, "quality_score": 5}', 
     false, true),
    (gen_random_uuid(), 'AITX First', 'Maximize internal shop utilization', 
     '{"cost": 15, "cycle_time": 15, "aitx_preference": 50, "capacity_balance": 10, "quality_score": 10}', 
     false, true),
    (gen_random_uuid(), 'Speed Optimized', 'Minimize cycle time', 
     '{"cost": 15, "cycle_time": 55, "aitx_preference": 10, "capacity_balance": 10, "quality_score": 10}', 
     false, true),
    (gen_random_uuid(), 'Balanced', 'Equal weight across factors', 
     '{"cost": 30, "cycle_time": 25, "aitx_preference": 20, "capacity_balance": 15, "quality_score": 10}', 
     true, true);
```

### 5.8 Maintenance Forecast View

```sql
-- Materialized view for fast forecast queries
CREATE MATERIALIZED VIEW maintenance_forecast AS

-- Running Repairs
SELECT 
    rrb.fiscal_year,
    'Running Repairs' AS budget_type,
    NULL AS event_type,
    SUM(rrb.monthly_budget) AS total_budget,
    0 AS planned_cost,                            -- Running repairs are unplanned
    0 AS planned_car_count,
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

-- Index for fast queries
CREATE UNIQUE INDEX idx_mf_year_type ON maintenance_forecast(fiscal_year, budget_type, COALESCE(event_type, ''));

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_maintenance_forecast()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY maintenance_forecast;
END;
$$ LANGUAGE plpgsql;
```

### 5.9 Dashboard Configuration

```sql
-- User dashboard configurations
CREATE TABLE dashboard_configs (
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
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Available dashboard widgets
CREATE TABLE dashboard_widgets (
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
    ('cycle-time-trends', 'Cycle Time Trends', 'Avg cycle time by shop', 'Performance', 2, 2, '/api/dashboard/cycle-time-trends');
```

---

## 6. BRC Import (AAR 500-Byte)

### 6.1 AAR BRC Record Layout

The AAR 500-byte Billing Repair Card is a fixed-width format:

```
Position   Length   Field                          Example
────────   ──────   ─────                          ───────
1-4        4        Car Initial (Mark)             "SHQX"
5-10       6        Car Number                     "006002"
11-17      7        Billing Date (YYYYDDD)         "2026032"  (Feb 1, 2026)
18-24      7        Shop Completion Date           "2026030"
25-28      4        Repairing Railroad/Shop        "BUDE"
29-30      2        Card Type                      "01"
31-32      2        Why Made Code                  "H1"
33-40      8        Total Labor Amount (cents)     "00015234"  ($152.34)
41-48      8        Total Material Amount (cents)  "00021500"  ($215.00)
49-56      8        Total Applied Charges (cents)  "00036734"  ($367.34)
57-63      7        Labor Hours (hundredths)       "0001250"   (12.50 hrs)
64-66      3        Job Code 1                     "B10"
67-74      8        Job 1 Amount (cents)           "00005000"
75-77      3        Job Code 2                     "P20"
78-85      8        Job 2 Amount (cents)           "00003500"
...        ...      (Up to 10 job codes)           
493-500    8        Record Sequence Number         "00000001"
```

### 6.2 BRC Parser Service

```typescript
// services/brcParser.ts

export interface BRCRecord {
  car_mark: string;                    // "SHQX"
  car_number: string;                  // "006002"
  car_id: string;                      // "SHQX006002"
  billing_date: Date;
  completion_date: Date;
  shop_code: string;
  card_type: string;
  why_made_code: string;
  labor_amount: number;                // In dollars
  material_amount: number;
  total_amount: number;
  labor_hours: number;
  job_codes: { code: string; amount: number }[];
  raw_record: string;
}

export function parseBRCFile(fileBuffer: Buffer): BRCRecord[] {
  const RECORD_LENGTH = 500;
  const records: BRCRecord[] = [];
  const recordCount = Math.floor(fileBuffer.length / RECORD_LENGTH);
  
  for (let i = 0; i < recordCount; i++) {
    const record = fileBuffer
      .slice(i * RECORD_LENGTH, (i + 1) * RECORD_LENGTH)
      .toString('ascii');
    records.push(parseBRCRecord(record));
  }
  
  return records;
}

function parseBRCRecord(record: string): BRCRecord {
  const car_mark = record.substring(0, 4).trim();
  const car_number = record.substring(4, 10).trim();
  
  return {
    car_mark,
    car_number,
    car_id: `${car_mark}${car_number}`,
    billing_date: parseJulianDate(record.substring(10, 17)),
    completion_date: parseJulianDate(record.substring(17, 24)),
    shop_code: record.substring(24, 28).trim(),
    card_type: record.substring(28, 30).trim(),
    why_made_code: record.substring(30, 32).trim(),
    labor_amount: parseInt(record.substring(32, 40)) / 100,
    material_amount: parseInt(record.substring(40, 48)) / 100,
    total_amount: parseInt(record.substring(48, 56)) / 100,
    labor_hours: parseInt(record.substring(56, 63)) / 100,
    job_codes: parseJobCodes(record.substring(63, 173)),
    raw_record: record
  };
}

function parseJulianDate(julian: string): Date {
  const year = parseInt(julian.substring(0, 4));
  const dayOfYear = parseInt(julian.substring(4, 7));
  const date = new Date(year, 0, 1);
  date.setDate(dayOfYear);
  return date;
}

function parseJobCodes(segment: string): { code: string; amount: number }[] {
  const codes: { code: string; amount: number }[] = [];
  const JOB_LENGTH = 11;
  
  for (let i = 0; i < 10; i++) {
    const job = segment.substring(i * JOB_LENGTH, (i + 1) * JOB_LENGTH);
    const code = job.substring(0, 3).trim();
    const amount = parseInt(job.substring(3, 11)) / 100;
    
    if (code && amount > 0) {
      codes.push({ code, amount });
    }
  }
  
  return codes;
}
```

### 6.3 BRC Import Logic

```typescript
// services/brcImportService.ts

interface BRCImportResult {
  total: number;
  matched_to_allocation: number;
  created_running_repair: number;
  errors: string[];
}

export async function importBRCFile(fileBuffer: Buffer): Promise<BRCImportResult> {
  const brcRecords = parseBRCFile(fileBuffer);
  
  const result: BRCImportResult = {
    total: brcRecords.length,
    matched_to_allocation: 0,
    created_running_repair: 0,
    errors: []
  };
  
  for (const brc of brcRecords) {
    try {
      // Try to match to existing allocation
      const allocation = await db.query(`
        SELECT id, estimated_cost, demand_id
        FROM allocations
        WHERE car_id = $1
          AND status IN ('Planned Shopping', 'Enroute', 'Arrived')
        ORDER BY created_at DESC
        LIMIT 1
      `, [brc.car_id]);
      
      if (allocation.rows.length > 0) {
        // Update existing allocation with actual cost
        await updateAllocationWithBRC(allocation.rows[0].id, brc);
        result.matched_to_allocation++;
      } else {
        // No allocation found - this is a running repair
        await createRunningRepairAllocation(brc);
        result.created_running_repair++;
      }
    } catch (err) {
      result.errors.push(`${brc.car_id}: ${err.message}`);
    }
  }
  
  // Refresh forecast view
  await db.query('SELECT refresh_maintenance_forecast()');
  
  // Update running repairs budget actuals
  await updateRunningRepairsActuals(brcRecords);
  
  return result;
}

async function updateAllocationWithBRC(allocationId: string, brc: BRCRecord): Promise<void> {
  await db.query(`
    UPDATE allocations SET
      actual_cost = $1,
      actual_cost_breakdown = $2,
      brc_number = $3,
      brc_received_at = NOW(),
      actual_completion_date = $4,
      status = 'Complete',
      updated_at = NOW()
    WHERE id = $5
  `, [
    brc.total_amount,
    JSON.stringify({
      labor: brc.labor_amount,
      material: brc.material_amount,
      labor_hours: brc.labor_hours,
      job_codes: brc.job_codes
    }),
    `${brc.car_id}-${brc.billing_date.toISOString().slice(0, 10)}`,
    brc.completion_date,
    allocationId
  ]);
  
  // Update shop capacity
  await updateShopCapacityForCompletion(allocationId);
}

async function createRunningRepairAllocation(brc: BRCRecord): Promise<void> {
  const month = brc.completion_date.toISOString().slice(0, 7);
  const fiscalYear = parseInt(month.slice(0, 4));
  
  // Find or create running repair demand for this month
  let demand = await db.query(`
    SELECT id FROM demands
    WHERE event_type = 'Running Repair'
      AND target_month = $1
    LIMIT 1
  `, [month]);
  
  if (demand.rows.length === 0) {
    demand = await db.query(`
      INSERT INTO demands (name, fiscal_year, target_month, car_count, event_type, status)
      VALUES ($1, $2, $3, 0, 'Running Repair', 'Allocated')
      RETURNING id
    `, [`Running Repairs - ${month}`, fiscalYear, month]);
  }
  
  // Create allocation with actual = estimated (unplanned)
  await db.query(`
    INSERT INTO allocations (
      demand_id, car_id, car_number, shop_code, target_month,
      estimated_cost, actual_cost, actual_cost_breakdown,
      brc_number, brc_received_at, actual_completion_date, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, NOW(), $9, 'Complete')
  `, [
    demand.rows[0].id,
    brc.car_id,
    brc.car_number,
    brc.shop_code,
    month,
    brc.total_amount,
    JSON.stringify({
      labor: brc.labor_amount,
      material: brc.material_amount,
      labor_hours: brc.labor_hours,
      job_codes: brc.job_codes
    }),
    `${brc.car_id}-${brc.billing_date.toISOString().slice(0, 10)}`,
    brc.completion_date
  ]);
  
  // Increment demand car count
  await db.query(`
    UPDATE demands SET car_count = car_count + 1, updated_at = NOW()
    WHERE id = $1
  `, [demand.rows[0].id]);
}

async function updateRunningRepairsActuals(brcRecords: BRCRecord[]): Promise<void> {
  // Group by month
  const byMonth = new Map<string, { cost: number; count: number }>();
  
  for (const brc of brcRecords) {
    const month = brc.completion_date.toISOString().slice(0, 7);
    const existing = byMonth.get(month) || { cost: 0, count: 0 };
    existing.cost += brc.total_amount;
    existing.count += 1;
    byMonth.set(month, existing);
  }
  
  // Update running repairs budget
  for (const [month, data] of byMonth) {
    await db.query(`
      UPDATE running_repairs_budget SET
        actual_spend = actual_spend + $1,
        actual_car_count = actual_car_count + $2,
        updated_at = NOW()
      WHERE month = $3
    `, [data.cost, data.count, month]);
  }
}
```

---

## 7. API Endpoints

### 7.1 Budget APIs

```typescript
// Budget - Running Repairs
GET    /api/budget/running-repairs?fiscal_year=2026
PUT    /api/budget/running-repairs/:month
POST   /api/budget/running-repairs/calculate          // Auto-calc from active car count

// Budget - Service Events
GET    /api/budget/service-events?fiscal_year=2026&event_type=Qualification
POST   /api/budget/service-events
PUT    /api/budget/service-events/:id
DELETE /api/budget/service-events/:id
```

### 7.2 Demand APIs

```typescript
GET    /api/demands?fiscal_year=2026&target_month=2026-04&status=Forecast
POST   /api/demands
PUT    /api/demands/:id
DELETE /api/demands/:id
PUT    /api/demands/:id/status                        // Update status
POST   /api/demands/import                            // Bulk import from CSV
```

### 7.3 Capacity APIs

```typescript
GET    /api/capacity?start_month=2026-01&end_month=2027-06&network=AITX
GET    /api/capacity/:shopCode
PUT    /api/capacity/:shopCode/:month
POST   /api/capacity/initialize                       // Seed 18 months from shop defaults
```

### 7.4 Allocation APIs

```typescript
GET    /api/allocations?demand_id=X&shop_code=Y&status=Z
POST   /api/allocations/generate                      // Run allocation engine
PUT    /api/allocations/:id
PUT    /api/allocations/:id/status                    // Update status
DELETE /api/allocations/:id
```

### 7.5 BRC APIs

```typescript
POST   /api/brc/import                                // Upload 500-byte file
GET    /api/brc/history?start_date=X&end_date=Y
GET    /api/brc/:id                                   // Single BRC details
```

### 7.6 Scenario APIs

```typescript
GET    /api/scenarios
POST   /api/scenarios
PUT    /api/scenarios/:id
DELETE /api/scenarios/:id
POST   /api/scenarios/compare                         // Compare 2-4 scenarios
```

### 7.7 Forecast APIs

```typescript
GET    /api/forecast?fiscal_year=2026
GET    /api/forecast/by-month?fiscal_year=2026
GET    /api/forecast/trends?fiscal_year=2026
```

### 7.8 Dashboard APIs

```typescript
GET    /api/dashboard/configs
POST   /api/dashboard/configs
PUT    /api/dashboard/configs/:id
DELETE /api/dashboard/configs/:id
GET    /api/dashboard/widgets
GET    /api/dashboard/:widgetId/data                  // Widget-specific data
```

### 7.9 Car APIs

```typescript
GET    /api/cars?portfolio_status=On%20Lease&current_status=To%20Be%20Routed
GET    /api/cars/:carId
GET    /api/cars/active-count?month=2026-04           // Count of cars on lease
POST   /api/cars/import                               // Import from CSV
```

---

## 8. Backend Services

### 8.1 Planning Service

```typescript
// services/planningService.ts

import { evaluateShops } from './shopEvaluator';  // EXISTING RailSync function

interface AllocationRequest {
  demand_ids: string[];
  scenario_id?: string;
  preview_only?: boolean;
}

interface AllocationResult {
  allocations: Allocation[];
  summary: {
    total_cars: number;
    total_cost: number;
    avg_cost_per_car: number;
    by_network: { network: string; count: number; cost: number }[];
    unallocated_cars: number;
  };
  warnings: string[];
}

export async function generateAllocations(request: AllocationRequest): Promise<AllocationResult> {
  const demands = await getDemands(request.demand_ids);
  const scenario = await getScenario(request.scenario_id);
  const capacityMap = await loadMonthlyCapacity();
  
  const allocations: Allocation[] = [];
  const warnings: string[] = [];
  
  for (const demand of demands) {
    // Build car input from demand defaults
    const carInput = buildCarInputFromDemand(demand);
    
    // Call EXISTING RailSync evaluation - same 25 rules, same cost calc
    const shopResults = await evaluateShops(carInput);
    
    // Filter to eligible shops with capacity
    const eligibleShops = shopResults
      .filter(s => s.is_eligible)
      .filter(s => getAvailableCapacity(capacityMap, s.shop_code, demand.target_month) > 0);
    
    if (eligibleShops.length === 0) {
      warnings.push(`No eligible shops with capacity for "${demand.name}"`);
      continue;
    }
    
    // Apply scenario weights to rank
    const rankedShops = applyScenarioWeights(eligibleShops, scenario.weights);
    
    // Apply scenario constraints
    const constrainedShops = applyConstraints(rankedShops, scenario.constraints);
    
    // Distribute cars to shops
    let remainingCars = demand.car_count;
    
    for (const shop of constrainedShops) {
      if (remainingCars <= 0) break;
      
      const available = getAvailableCapacity(capacityMap, shop.shop_code, demand.target_month);
      const toAllocate = Math.min(remainingCars, available);
      
      if (toAllocate > 0) {
        // Create allocation for each car
        for (let i = 0; i < toAllocate; i++) {
          allocations.push({
            demand_id: demand.id,
            scenario_id: scenario.id,
            car_id: `${demand.name}-${i + 1}`,  // Placeholder until specific cars assigned
            shop_code: shop.shop_code,
            target_month: demand.target_month,
            estimated_cost: shop.costs.total,
            estimated_cost_breakdown: shop.costs,
            status: 'Planned Shopping'
          });
        }
        
        decrementCapacity(capacityMap, shop.shop_code, demand.target_month, toAllocate);
        remainingCars -= toAllocate;
      }
    }
    
    if (remainingCars > 0) {
      warnings.push(`${remainingCars} cars unallocated for "${demand.name}"`);
    }
  }
  
  // Save if not preview
  if (!request.preview_only) {
    await saveAllocations(allocations);
    await updateCapacityTable(capacityMap);
    await updateDemandStatuses(request.demand_ids, 'Allocated');
    await db.query('SELECT refresh_maintenance_forecast()');
  }
  
  return {
    allocations,
    summary: calculateSummary(allocations),
    warnings
  };
}

function applyScenarioWeights(shops: ShopResult[], weights: ScenarioWeights): ShopResult[] {
  return shops
    .map(shop => ({
      ...shop,
      weighted_score: calculateWeightedScore(shop, weights)
    }))
    .sort((a, b) => b.weighted_score - a.weighted_score);
}

function calculateWeightedScore(shop: ShopResult, weights: ScenarioWeights): number {
  // Normalize each factor to 0-100, apply weights
  const costScore = 100 - normalizeValue(shop.costs.total, 20000, 50000);
  const cycleScore = 100 - normalizeValue(shop.avg_cycle_time || 20, 10, 40);
  const aitxScore = shop.network === 'AITX' ? 100 : shop.network === 'Primary' ? 50 : 25;
  const capacityScore = 100 - (shop.utilization_pct || 50);
  const qualityScore = shop.quality_rating || 70;
  
  return (
    (costScore * weights.cost / 100) +
    (cycleScore * weights.cycle_time / 100) +
    (aitxScore * weights.aitx_preference / 100) +
    (capacityScore * weights.capacity_balance / 100) +
    (qualityScore * weights.quality_score / 100)
  );
}
```

### 8.2 Forecast Service

```typescript
// services/forecastService.ts

interface ForecastResult {
  fiscal_year: number;
  summary: {
    total_budget: number;
    total_planned: number;
    total_actual: number;
    remaining_budget: number;
    budget_consumed_pct: number;
  };
  by_type: ForecastLine[];
  by_month: MonthlyForecast[];
}

export async function getMaintenanceForecast(fiscalYear: number): Promise<ForecastResult> {
  // Query materialized view
  const forecast = await db.query(`
    SELECT * FROM maintenance_forecast WHERE fiscal_year = $1
  `, [fiscalYear]);
  
  // Calculate summary
  const totalBudget = sum(forecast.rows, 'total_budget');
  const totalPlanned = sum(forecast.rows, 'planned_cost');
  const totalActual = sum(forecast.rows, 'actual_cost');
  
  return {
    fiscal_year: fiscalYear,
    summary: {
      total_budget: totalBudget,
      total_planned: totalPlanned,
      total_actual: totalActual,
      remaining_budget: totalBudget - totalPlanned - totalActual,
      budget_consumed_pct: ((totalPlanned + totalActual) / totalBudget) * 100
    },
    by_type: forecast.rows,
    by_month: await getMonthlyForecast(fiscalYear)
  };
}

async function getMonthlyForecast(fiscalYear: number): Promise<MonthlyForecast[]> {
  const result = await db.query(`
    SELECT 
      target_month,
      SUM(CASE WHEN status IN ('Planned Shopping', 'Enroute', 'Arrived') 
               THEN estimated_cost ELSE 0 END) AS planned_cost,
      SUM(CASE WHEN status IN ('Complete', 'Released') 
               THEN actual_cost ELSE 0 END) AS actual_cost
    FROM allocations a
    JOIN demands d ON a.demand_id = d.id
    WHERE d.fiscal_year = $1
    GROUP BY target_month
    ORDER BY target_month
  `, [fiscalYear]);
  
  // Add cumulative values
  let cumPlanned = 0;
  let cumActual = 0;
  
  return result.rows.map(row => {
    cumPlanned += row.planned_cost;
    cumActual += row.actual_cost;
    return {
      ...row,
      cumulative_planned: cumPlanned,
      cumulative_actual: cumActual
    };
  });
}
```

### 8.3 Seed Service

```typescript
// services/seedService.ts

/**
 * Import cars from Qual_Planner_Master.csv
 */
export async function seedCarsFromCSV(csvPath: string): Promise<void> {
  const rows = await parseCSV(csvPath);
  
  for (const row of rows) {
    await db.query(`
      INSERT INTO cars (
        car_id, car_mark, car_number, car_type,
        lessee_name, lessee_code, contract_number, contract_expiration,
        portfolio_status, commodity, is_jacketed, is_lined, lining_type, car_age,
        tank_qual_year, current_status, adjusted_status, plan_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (car_id) DO UPDATE SET
        current_status = $16,
        adjusted_status = $17,
        updated_at = NOW()
    `, [
      row['Car Mark'],
      row['Mark'],
      row['Number'],
      row['Car Type Level 2'],
      row['Lessee Name'],
      row['FMS Lessee Number'],
      row['Contract'],
      parseDate(row['Contract Expiration']),
      row['Portfolio'],
      row['Primary Commodity'],
      row['Jacketed'] === 'Jacketed',
      row['Lined'] !== 'Unlined',
      row['Lining Type'],
      parseInt(row['Car Age']) || null,
      parseInt(row['Tank Qualification']) || null,
      row['Current Status'],
      row['Adjusted Status'],
      row['Plan Status']
    ]);
  }
}

/**
 * Calculate active car count by month
 */
export async function getActiveCarCountByMonth(fiscalYear: number): Promise<Map<string, number>> {
  const result = await db.query(`
    SELECT 
      TO_CHAR(m.month_date, 'YYYY-MM') AS month,
      COUNT(*) FILTER (WHERE c.portfolio_status = 'On Lease') AS active_count
    FROM generate_series(
      '${fiscalYear}-01-01'::date,
      '${fiscalYear}-12-01'::date,
      '1 month'::interval
    ) AS m(month_date)
    CROSS JOIN cars c
    GROUP BY m.month_date
    ORDER BY m.month_date
  `);
  
  return new Map(result.rows.map(r => [r.month, r.active_count]));
}

/**
 * Initialize running repairs budget from active car counts
 */
export async function initializeRunningRepairsBudget(
  fiscalYear: number,
  allocationPerCar: number = 150
): Promise<void> {
  const activeByMonth = await getActiveCarCountByMonth(fiscalYear);
  
  for (const [month, count] of activeByMonth) {
    await db.query(`
      INSERT INTO running_repairs_budget (fiscal_year, month, cars_on_lease, allocation_per_car)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (fiscal_year, month) DO UPDATE SET
        cars_on_lease = $3,
        updated_at = NOW()
    `, [fiscalYear, month, count, allocationPerCar]);
  }
}
```

---

## 9. Frontend Components

### 9.1 Component List

| Component | Purpose | Location |
|-----------|---------|----------|
| `BudgetOverview` | Running repairs + service events summary | `/pages/Budget.tsx` |
| `RunningRepairsBudgetGrid` | Monthly RR budget table | `/components/budget/` |
| `ServiceEventBudgetForm` | Add/edit service event budget | `/components/budget/` |
| `DemandList` | List of demand forecasts | `/components/planning/` |
| `DemandGrid` | Month × event type matrix | `/components/planning/` |
| `DemandForm` | Create/edit demand | `/components/planning/` |
| `PlanningGrid` | Shop × month capacity grid | `/components/planning/` |
| `ScenarioBuilder` | Weight sliders + constraints | `/components/planning/` |
| `ScenarioComparison` | Side-by-side scenario results | `/components/planning/` |
| `ForecastSummary` | Budget vs Planned vs Actual | `/components/dashboard/` |
| `BRCImportModal` | Upload BRC file | `/components/brc/` |
| `ConfigurableDashboard` | Drag-drop widget layout | `/components/dashboard/` |

### 9.2 Forecast Summary Widget

```tsx
// components/dashboard/ForecastSummary.tsx

export function ForecastSummary({ fiscalYear }: { fiscalYear: number }) {
  const { data: forecast } = useForecast(fiscalYear);
  
  if (!forecast) return <Skeleton />;
  
  const { summary } = forecast;
  
  return (
    <div className="forecast-summary">
      <h3>Maintenance Forecast - FY{fiscalYear}</h3>
      
      <div className="summary-cards">
        <Card title="Annual Budget" value={formatCurrency(summary.total_budget)} />
        <Card title="Planned" value={formatCurrency(summary.total_planned)} subtitle="In Progress" />
        <Card title="Actual" value={formatCurrency(summary.total_actual)} subtitle="Complete" />
        <Card 
          title="Remaining" 
          value={formatCurrency(summary.remaining_budget)} 
          variant={summary.remaining_budget < 0 ? 'danger' : 'success'}
        />
      </div>
      
      {/* Budget consumption bar */}
      <div className="budget-bar">
        <div className="actual" style={{ width: `${(summary.total_actual / summary.total_budget) * 100}%` }} />
        <div className="planned" style={{ width: `${(summary.total_planned / summary.total_budget) * 100}%` }} />
      </div>
      
      <div className="legend">
        <span className="actual">Actual (Complete)</span>
        <span className="planned">Planned (In Progress)</span>
        <span className="remaining">Remaining</span>
      </div>
    </div>
  );
}
```

### 9.3 Planning Grid

```tsx
// components/planning/PlanningGrid.tsx

export function PlanningGrid({ fiscalYear }: { fiscalYear: number }) {
  const months = generateMonths(fiscalYear, 18);
  const { data: capacity } = useCapacity({ start: months[0], end: months[17] });
  
  const shopsByNetwork = groupBy(capacity?.shops || [], 'network');
  
  return (
    <div className="planning-grid">
      <table>
        <thead>
          <tr>
            <th>Shop</th>
            {months.map(m => <th key={m}>{formatMonth(m)}</th>)}
          </tr>
        </thead>
        <tbody>
          {['AITX', 'Primary', 'Secondary'].map(network => (
            <React.Fragment key={network}>
              <tr className="network-header">
                <td colSpan={months.length + 1}>{network}</td>
              </tr>
              {shopsByNetwork[network]?.map(shop => (
                <tr key={shop.shop_code}>
                  <td>{shop.shop_name}</td>
                  {shop.months.map(m => (
                    <td 
                      key={m.month}
                      className={getUtilClass(m.utilization_pct)}
                    >
                      {m.allocated_count}/{m.total_capacity}
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getUtilClass(pct: number): string {
  if (pct >= 95) return 'critical';  // Red
  if (pct >= 85) return 'high';      // Orange
  if (pct >= 70) return 'medium';    // Yellow
  return 'low';                       // Green
}
```

---

## 10. Task List

Add to your existing `tasks.md`:

```markdown
## Phase 9 — Planning, Budgeting & Forecasting

### 9.1 Car Master (Backend) ✓
- [x] Create `cars` table extension (migration 002)
- [x] API: GET /api/cars-master with filters
- [x] API: GET /api/cars-master/:carId
- [x] API: GET /api/cars/active-count
- [x] API: POST /api/cars/import (CSV)
- [ ] Seed from Qual_Planner_Master.csv
- [ ] Unit tests

### 9.2 Running Repairs Budget (Backend) ✓
- [x] Create `running_repairs_budget` table (migration 002)
- [x] API: GET /api/budget/running-repairs
- [x] API: PUT /api/budget/running-repairs/:month
- [x] API: POST /api/budget/running-repairs/calculate
- [x] Auto-calculate from active car count
- [ ] Unit tests

### 9.3 Service Event Budget (Backend) ✓
- [x] Create `service_event_budget` table (migration 002)
- [x] API: GET/POST /api/budget/service-events
- [x] Support customer/fleet/car_type segmentation
- [ ] Unit tests

### 9.4 Budget UI
- [ ] BudgetOverview page
- [ ] RunningRepairsBudgetGrid component
- [ ] ServiceEventBudgetForm component
- [ ] Budget navigation section

### 9.5 Demands (Backend) ✓
- [x] Create `demands` table (migration 002)
- [x] API: GET/POST/PUT/DELETE /api/demands
- [x] API: PUT /api/demands/:id/status
- [ ] API: POST /api/demands/import
- [ ] Unit tests

### 9.6 Demands UI
- [ ] DemandList component
- [ ] DemandForm modal
- [ ] DemandGrid (month × event type)
- [ ] Demand import modal

### 9.7 Shop Monthly Capacity (Backend) ✓
- [x] Create `shop_monthly_capacity` table (migration 002)
- [x] API: GET /api/capacity
- [x] API: PUT /api/capacity/:shopCode/:month
- [x] API: POST /api/capacity/initialize
- [x] Update capacity on allocation changes
- [ ] Unit tests

### 9.8 Allocations (Backend) ✓
- [x] Create `allocations` table (migration 002)
- [x] API: GET /api/allocations
- [x] API: POST /api/allocations/generate
- [x] API: PUT /api/allocations/:id/status
- [ ] Unit tests

### 9.9 Planning Service (Backend) ✓
- [x] Create `services/planning.service.ts`
- [x] `generateAllocations()` - calls existing evaluateShops()
- [x] `applyScenarioWeights()` - rank by scenario
- [ ] `applyConstraints()` - filter by constraints
- [ ] Unit tests (10+ scenarios)

### 9.10 Planning UI
- [ ] PlanningGrid component (shop × month)
- [ ] Cell click drill-down
- [ ] Utilization color coding
- [ ] "Generate Plan" button

### 9.11 Scenarios (Backend) ✓
- [x] Create `scenarios` table (migration 002)
- [x] Seed default scenarios (4 scenarios seeded)
- [x] API: GET/POST/PUT /api/scenarios
- [ ] API: POST /api/scenarios/compare
- [ ] Unit tests

### 9.12 Scenarios UI
- [ ] ScenarioBuilder component (sliders)
- [ ] ScenarioComparison component
- [ ] Apply scenario button

### 9.13 BRC Import (Backend) ✓
- [x] Create `services/brc.service.ts`
- [x] Parse AAR 500-byte format
- [x] API: POST /api/brc/import
- [x] Match BRC to allocation or create running repair
- [x] Update actual costs
- [x] API: GET /api/brc/history
- [x] Unit tests (25 tests: BRC parser, Julian dates, job codes, costs)

### 9.14 BRC Import UI
- [ ] BRCImportModal component
- [ ] File upload + preview
- [ ] Match/unmatch summary
- [ ] BRC history list

### 9.15 Maintenance Forecast (Backend) ✓
- [x] Create `v_maintenance_forecast` view (migration 002)
- [x] API: GET /api/forecast
- [x] API: GET /api/forecast/trends
- [ ] Unit tests

### 9.16 Maintenance Forecast UI
- [ ] ForecastSummary widget
- [ ] Budget consumption bar
- [ ] By-type breakdown
- [ ] Monthly trend chart

### 9.17 Dashboard Configuration (Backend) ✓
- [x] Create `dashboard_configs` table (migration 002)
- [x] Create `dashboard_widgets` table + seed (10 widgets)
- [ ] API: GET/POST/PUT/DELETE /api/dashboard/configs
- [ ] API: GET /api/dashboard/widgets
- [ ] Widget data endpoints
- [ ] Unit tests

### 9.18 Dashboard UI
- [ ] ConfigurableDashboard component
- [ ] Edit mode (drag/resize)
- [ ] WidgetPicker component
- [ ] Save/load layouts
- [ ] 10 widget components

### 9.19 Navigation Updates
- [ ] Add "Planning" section (Demands, Capacity, Scenarios)
- [ ] Add "Budget" section (Allocations, Forecast)
- [ ] Update dashboard to configurable

---

## Testing Checklist - Phase 9

- [ ] Import cars from CSV → cars table populated
- [ ] Active car count matches "On Lease" filter (4,213)
- [x] Create demand → appears in demand grid (TESTED)
- [ ] Generate allocations → cars assigned to shops
- [x] Capacity initialization works (270 records created)
- [x] Scenario list returns 4 seeded scenarios (TESTED)
- [x] BRC Parser unit tests (25 tests covering all fields, edge cases)
- [ ] Import BRC → matches to allocation, actual_cost set
- [ ] Unmatched BRC → creates running repair allocation
- [x] Maintenance forecast endpoint works (TESTED)
- [ ] Forecast refreshes after allocation/BRC changes
- [ ] Dashboard widgets load correct data
- [ ] Dashboard layout saves and loads
```

---

## Summary

This specification adds:

| Capability | Implementation |
|------------|----------------|
| **Car Master** | Seed from Qual_Planner_Master.csv (8,281 cars) |
| **Running Repairs Budget** | $150/car/month × active cars (4,213) |
| **Service Event Budget** | By event type: Qualification, Assignment, Return |
| **Demands** | Batches of cars by month and event type |
| **Allocations** | Reuses `evaluateShops()` for shop selection |
| **BRC Import** | AAR 500-byte parser, matches to allocations |
| **Maintenance Forecast** | `Budget - Planned - Actual = Remaining` |
| **Dashboards** | Configurable widget layouts |

**Key Files:**
- 9 new database tables + 1 materialized view
- 22 migrations
- `brcParser.ts` - AAR 500-byte parser
- `planningService.ts` - Calls existing `evaluateShops()`
- `forecastService.ts` - Budget tracking
- 12 new UI components

### Data Integration Notes

The database schema is **source-agnostic**. Import services map external field names 
to internal schema. When connecting to production systems:

1. Create a new mapper function for each source (FMS, CIPROTS, etc.)
2. Add field translation tables if source uses different codes/values
3. The core schema, business logic, and UI remain unchanged
