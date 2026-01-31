# Railsync Tasks

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

## Phase 3 — Excel Parity (Current)

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
- [ ] Add field help tooltips explaining each input (later)
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
- [ ] **Sorting**: Clickable column headers with sort indicators (later)
  - [ ] Default sort: En Route 0-6 ascending (available capacity first)
  - [ ] Support: Total Cost, Hours Backlog, Current Backlog, Shop Name, Railroad
- [x] **Row expansion**: Click row to see full "why this shop" breakdown (rules display)

### 3.7 Rules Explanation UI (🖥️ UI) ✓
**🖥️ UI - "Why This Shop" Enhancement:**
- [x] Redesign explanation panel to show all 25 rules:
  - [x] Group by category: Car Type, Material, Lining, Blast, Compliance, Special
  - [x] Show rule name, result (checkmark Pass / X Fail / dash N/A), and reason
  - [x] Color coding: green (pass), red (fail), gray (N/A)
- [x] For disqualified shops (if shown): highlight which rule(s) failed (failed_rules display)
- [ ] Add "Compare Shops" mode: side-by-side rule comparison for 2-3 shops (later)

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

## Later
- [ ] Auth
- [ ] Audit logs  
- [ ] Admin rules editor UI
- [ ] Freight/routing calculation (distance-based)
- [ ] Work hours ML model (replace lookup table)
- [ ] 🖥️ UI: Dark mode
- [ ] 🖥️ UI: Mobile responsive layout
- [ ] 🖥️ UI: Export results to CSV/Excel

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
- [ ] Persist user's mode preference in localStorage (later)

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
- [ ] Remember expanded state in localStorage (later)

#### 3.11 Shop Detail Drawer (🖥️ UI)
- [ ] Click row → opens right-side drawer (not modal, keeps context)
- [ ] Drawer contents:
  - [ ] Shop header: Name, Code, Railroad, Address
  - [ ] Cost breakdown card (pie chart or bar)
  - [ ] Capacity metrics card
  - [ ] Hours by work type (horizontal bar chart)
  - [ ] Rules evaluation list (25 rules, grouped, with pass/fail/NA)
- [ ] "Compare" button → pins shop for comparison (max 3)
- [ ] Close drawer → back to grid

#### 3.12 Comparison Mode (🖥️ UI - Later)
- [ ] Compare 2-3 pinned shops side-by-side
- [ ] Highlight differences in costs, capacity, rule results
- [ ] "Select This Shop" action button
