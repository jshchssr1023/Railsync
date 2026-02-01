# Railsync Development Tasks

**Version:** 2.1 | **Updated:** February 2026

---

## Development Guardrails

| Rule | Description |
|------|-------------|
| Read before write | Always read existing code before modifying |
| Small commits | Commit after each logical unit of work |
| Compile check | Run `npm run build` after code changes |
| Test incrementally | Test each feature before starting the next |
| Reuse existing | Check for existing services/utilities before creating new ones |

### Test Commands

```bash
# Backend
cd backend && npm run build          # TypeScript compile
cd backend && npm test               # Unit tests (92 passing)

# Frontend
cd frontend && npm run build         # Next.js build
cd frontend && npm run lint          # ESLint
```

---

## Completed Phases

### Phase 1-3: Core Shop Selection (Complete)

- 25 eligibility rules engine (car type, material, lining, compliance, special)
- Cost calculation (labor, material, freight, abatement)
- Shop capabilities via EAV pattern (15 shops seeded)
- Results grid with expand/collapse columns
- Car input form with Quick/Advanced modes
- Shop detail drawer with comparison mode

### Phase 4: Operational Data (Complete)

- Shop backlog/capacity feeds
- En-route car tracking
- API endpoints for batch backlog updates

### Phase 5: Car Lookup (Complete)

- Car lookup API: GET /api/cars/:carNumber
- CarLookup component with Direct Input toggle

### Phase 6: Enterprise Features (Complete)

- JWT authentication with roles (admin, operator, viewer)
- Audit logging (who/when/what)
- Admin rules editor UI
- Freight/routing calculation (distance-based)
- Work hours estimation (factor-based)
- "Select This Shop" with service_events
- Dark mode + mobile responsive
- CSV export

---

## Phase 9: Planning, Budgeting & Forecasting (Complete)

### Overview

Phase 9 extends RailSync into a full planning and budget management system:

| Capability | Description |
|------------|-------------|
| Budget Management | Running Repairs pool + Service Event budgets |
| Demand Management | Track work by month and event type |
| Capacity Planning | 18-month shop loading view |
| Allocation Engine | Batch planning using existing evaluateShops() |
| Scenario Comparison | Compare strategies with different weights |
| Maintenance Forecast | Budget - Planned - Actual = Remaining |
| BRC Import | Parse AAR 500-byte files for actual costs |
| Dashboards | Configurable widget layouts |

---

### Backend Tasks (Complete)

#### 9.1 Car Master
- [x] `cars` table (migration 002)
- [x] API: GET /api/cars-master (filters)
- [x] API: GET /api/cars-master/:carId
- [x] API: GET /api/cars/active-count
- [x] API: POST /api/cars/import

#### 9.2 Running Repairs Budget
- [x] `running_repairs_budget` table
- [x] API: GET /api/budget/running-repairs
- [x] API: PUT /api/budget/running-repairs/:month
- [x] API: POST /api/budget/running-repairs/calculate

#### 9.3 Service Event Budget
- [x] `service_event_budget` table
- [x] API: GET/POST /api/budget/service-events
- [x] Customer/fleet/car_type segmentation

#### 9.5 Demands
- [x] `demands` table
- [x] API: GET/POST/PUT/DELETE /api/demands
- [x] API: PUT /api/demands/:id/status

#### 9.7 Shop Monthly Capacity
- [x] `shop_monthly_capacity` table
- [x] API: GET /api/capacity
- [x] API: PUT /api/capacity/:shopCode/:month
- [x] API: POST /api/capacity/initialize

#### 9.8 Allocations
- [x] `allocations` table
- [x] API: GET /api/allocations
- [x] API: POST /api/allocations/generate
- [x] API: PUT /api/allocations/:id/status

#### 9.9 Planning Service
- [x] `services/planning.service.ts`
- [x] `generateAllocations()` using evaluateShops()
- [x] `applyScenarioWeights()`

#### 9.11 Scenarios
- [x] `scenarios` table + 4 default scenarios
- [x] API: GET/POST/PUT /api/scenarios

#### 9.13 BRC Import
- [x] `services/brc.service.ts`
- [x] AAR 500-byte parser (25 unit tests)
- [x] API: POST /api/brc/import
- [x] API: GET /api/brc/history
- [x] Match to allocation or create running repair

#### 9.15 Maintenance Forecast
- [x] `v_maintenance_forecast` view
- [x] API: GET /api/forecast
- [x] API: GET /api/forecast/trends

#### 9.17 Dashboard Configuration
- [x] `dashboard_configs` table
- [x] `dashboard_widgets` definitions (8 widgets)
- [x] `services/dashboard.service.ts`
- [x] API: GET /api/dashboard/widgets
- [x] API: GET/POST/PUT/DELETE /api/dashboard/configs

---

### Frontend Tasks (Complete)

#### 9.4 Budget UI
- [x] BudgetOverview (summary cards, RR/SE tabs)
- [x] RunningRepairsBudgetGrid
- [x] ServiceEventBudgetForm

#### 9.6 Demands UI
- [x] DemandList with filters/CRUD
- [x] DemandFormModal
- [x] Demand import modal (CSV)

#### 9.10 Capacity UI
- [x] CapacityGrid (shop × month)
- [x] Utilization color coding
- [x] Network filter

#### 9.12 Scenarios UI
- [x] ScenarioBuilder (weight sliders)
- [x] ScenarioComparison (side-by-side)

#### 9.14 BRC Import UI
- [x] BRCImportModal (drag-drop)
- [x] Data Import tab in Admin
- [x] BRC history list

#### 9.16 Forecast UI
- [x] ForecastSummary (cards + bar)
- [x] Compact mode for widgets

#### 9.18 Dashboard UI
- [x] ConfigurableDashboard
- [x] Edit mode (add/remove)
- [x] WidgetPicker modal
- [x] Save/load layouts (localStorage)
- [x] 8 widget components:
  - ForecastWidget
  - BudgetGaugeWidget
  - AllocationStatusWidget
  - CapacityHeatmapWidget
  - DemandChartWidget
  - RecentCompletionsWidget
  - TopShopsWidget
  - ScenarioComparisonWidget

#### 9.19 Navigation
- [x] Planning link in header
- [x] Planning page with 5 tabs
- [x] Data Import in Admin

---

### Testing Checklist

| Test | Status |
|------|--------|
| Migration runs without errors | PASS |
| Demand CRUD works | PASS |
| Capacity initialization (270 records) | PASS |
| Scenario list returns 4 defaults | PASS |
| BRC parser unit tests (25) | PASS |
| Maintenance forecast endpoint | PASS |
| Frontend build passes | PASS |
| Backend tests pass (92) | PASS |

---

## Database Schema (Phase 9)

### Tables

| Table | Purpose |
|-------|---------|
| `cars` | Car master (8,281 cars from CSV) |
| `running_repairs_budget` | Pool-based budget per active car |
| `service_event_budget` | Event-based budget (qual/assign/return) |
| `demands` | Work batches by month |
| `shop_monthly_capacity` | 18-month capacity per shop |
| `allocations` | Planned and actual work |
| `scenarios` | Allocation weight configurations |
| `dashboard_configs` | User dashboard layouts |

### Key Relationships

```
demands (1) ──► (n) allocations
scenarios (1) ──► (n) allocations
shops (1) ──► (n) allocations
shops (1) ──► (n) shop_monthly_capacity
users (1) ──► (n) dashboard_configs
```

---

## BRC Import (AAR 500-Byte Format)

Fixed-width record layout:

| Position | Length | Field |
|----------|--------|-------|
| 1-4 | 4 | Car Mark |
| 5-10 | 6 | Car Number |
| 11-17 | 7 | Billing Date (YYYYDDD) |
| 18-24 | 7 | Completion Date |
| 25-28 | 4 | Shop Code |
| 33-40 | 8 | Labor Amount (cents) |
| 41-48 | 8 | Material Amount (cents) |
| 49-56 | 8 | Total Amount (cents) |
| 57-63 | 7 | Labor Hours (×100) |
| 64-173 | 110 | Up to 10 job codes |

Import logic:
1. Match car to existing allocation → update with actual cost
2. No match → create running repair allocation
3. Update running repairs budget actuals
4. Refresh maintenance forecast view

---

## API Routes Summary

### Budget
```
GET    /api/budget/running-repairs
PUT    /api/budget/running-repairs/:month
POST   /api/budget/running-repairs/calculate
GET    /api/budget/service-events
POST   /api/budget/service-events
GET    /api/budget/summary
```

### Planning
```
GET    /api/demands
POST   /api/demands
PUT    /api/demands/:id
DELETE /api/demands/:id
PUT    /api/demands/:id/status

GET    /api/capacity
PUT    /api/capacity/:shopCode/:month
POST   /api/capacity/initialize

GET    /api/scenarios
POST   /api/scenarios
PUT    /api/scenarios/:id

GET    /api/allocations
POST   /api/allocations/generate
PUT    /api/allocations/:id/status
```

### BRC & Forecast
```
POST   /api/brc/import
GET    /api/brc/history
GET    /api/forecast
GET    /api/forecast/trends
```

### Dashboard
```
GET    /api/dashboard/widgets
GET    /api/dashboard/configs
POST   /api/dashboard/configs
PUT    /api/dashboard/configs/:id
DELETE /api/dashboard/configs/:id
```

### Cars
```
GET    /api/cars-master
GET    /api/cars-master/:carId
GET    /api/cars/active-count
POST   /api/cars/import
```

---

## Project Status: COMPLETE

All Phase 9 features have been implemented:
- Backend: 92 tests passing
- Frontend: Builds successfully
- All UI components functional
- Dashboard with 8 configurable widgets
- BRC import with history tracking
- Demand management with CSV import
- Capacity planning grid
- Scenario comparison
- Maintenance forecast visualization
