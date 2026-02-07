# RailSync Platform — Updated Build Roadmap

## Full CIPROTS Replacement — Sprint-by-Sprint Execution Plan

**12 Sprints | 24 Weeks | 3 Phases + Go-Live**

Fleet Operations | AITX | February 2026

---

## What Changed From the Original Roadmap

The original 20-sprint / 40-week roadmap was written before the current codebase was inventoried. A thorough audit reveals that **the majority of Release 1 and Release 2 are already built and functional**. This updated roadmap eliminates completed work, focuses the team on real gaps, and compresses the timeline from 40 weeks to 24 weeks.

### Codebase Reality (as of February 2026)

| Original Module | Status | Notes |
|---|---|---|
| Car Master | **COMPLETE** | CRUD, UMLER import, 8,271 cars loaded, search/filter, asset history |
| Qualifications | **PARTIAL** | Rules engine exists for shop eligibility. Missing: AAR/FRA compliance tables, alerting, per-car qualification tracking |
| Contracts | **COMPLETE** | Customer -> Lease -> Rider -> Cars hierarchy, amendments, versioning |
| Assignments/Releases | **COMPLETE** | Full state machine (Planned -> Scheduled -> Enroute -> Arrived -> InShop -> Complete), audit trail, revert capability |
| Shopping Workflow | **COMPLETE** | 12-state event lifecycle, packets, batches, estimates, approval workflow, cancellation |
| Projects | **COMPLETE** | Project planning, car assignment, lock/relock, bundling, audit trail |
| BRC Processing | **COMPLETE** | 500-byte parser, job codes, Julian dates, import pipeline |
| Invoice Processing | **COMPLETE** | Invoice cases, validation, matching, line items, multi-type support, state machine |
| Cost Allocation | **COMPLETE** | Allocations, line items, budget tracking, master plan integration, planned vs committed split |
| S&OP / Demand Planning | **COMPLETE** | Demands, master plans, versioning, capacity planning, scenarios, forecasting |
| Reporting/Analytics | **COMPLETE** | Dashboard framework, analytics pages, widget system |
| RBAC/Auth | **COMPLETE** | JWT, role-based auth, user management, groups, permissions |
| Notifications | **COMPLETE** | Email queue, preferences, templates |
| Audit Trail | **COMPLETE** | Multi-layer: general audit, state transitions, entity-specific logs |
| CI/CD | **COMPLETE** | GitHub Actions, Docker builds, schema validation |
| SAP Integration | **STUB** | Interface defined, no connectivity |
| Salesforce Integration | **NOT STARTED** | — |
| CLM / Telegraph | **NOT STARTED** | — |
| Billing Engine (Outbound) | **NOT STARTED** | Inbound invoice processing exists, but generating outbound rental/chargeback invoices to customers does not |
| Mileage Processing | **NOT STARTED** | — |
| CIPROTS Data Migration | **NOT STARTED** | CSV import utilities exist, but no CIPROTS ETL pipeline |
| Parallel Run Tooling | **NOT STARTED** | — |
| Railinc / EDI | **PARTIAL** | File upload only, no EDI message parsing or Railinc API |

### Tech Stack (Actual — Correct the Original)

| Layer | Actual | Original (Incorrect) |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + TailwindCSS | ~~React 18 + Vite~~ |
| Backend | Node.js + Express + TypeScript + raw SQL (pg pool) | ~~Prisma ORM~~ |
| Database | PostgreSQL (49 migrations, 110+ tables) | PostgreSQL |
| Auth | JWT + RBAC (admin/operator/viewer) | JWT + RBAC |
| DevOps | Docker Compose + GitHub Actions | Docker + GitHub Actions |

---

## Team Structure & Roles (Unchanged)

| Role | Focus Area | Responsibilities |
|---|---|---|
| Dev 1 (BE) | Backend Lead | Business logic, billing engine, SAP integration, data migration |
| Dev 2 (BE) | Backend + Integration | External integrations (Salesforce, CLM, Railinc), mileage processing, parallel run tooling |
| Dev 3 (FE) | Frontend Lead | All UI (Next.js/TypeScript/Tailwind). New pages, dashboards, forms |
| UI/QA Mgr | Quality + Process | Test strategy, QA passes, stakeholder demos, training materials, go-live coordination |

---

## Updated Release Timeline

| Phase | Sprints | Duration | Focus | Business Value |
|---|---|---|---|---|
| Phase 1: Gap Fill | S1-S4 (Wk 1-8) | 8 weeks | Qualifications engine, billing engine, mileage, rate management | Compliance tracking live. Outbound billing automated. Revenue-generating. |
| Phase 2: Integrations | S5-S8 (Wk 9-16) | 8 weeks | SAP, Salesforce, CLM/Telegraph, Railinc EDI, reporting hardening | External systems connected. Data flows automated. Operational visibility. |
| Phase 3: Migration + Go-Live Prep | S9-S10 (Wk 17-20) | 4 weeks | CIPROTS data migration, parallel run tooling, validation | Legacy data migrated. Side-by-side comparison validates accuracy. |
| Go-Live | S11-S12 (Wk 21-24) | 4 weeks | Parallel run, cutover, stabilization, training | CIPROTS retired. RailSync is operational SSoT. |

---

## Sprint-by-Sprint Execution Plan

Each sprint = 2 weeks. Tasks are ordered by dependency.

---

### PHASE 1: GAP FILL (Sprints 1-4 | Weeks 1-8)

Existing modules work. This phase fills the gaps that block compliance tracking and revenue generation.

---

#### SPRINT 1 | Weeks 1-2 | Qualifications Engine + Compliance Tables

| Task | Owner | Deliverable |
|---|---|---|
| Qualification data model: `qualifications` table with types (tank requalification, air brake, safety appliance, hazmat), intervals, due dates, status | Dev 1 (BE) | Migration file. Qualification CRUD API. Status calculation service (Current/Due/Overdue). |
| AAR/FRA rules library: `qualification_rules` table with regulatory intervals, exemption conditions, type-specific requirements | Dev 1 (BE) | Rules library with seed data for all AAR/FRA qualification types. Lookup API. |
| Compliance alerting: 90/60/30-day warnings, overdue escalation, batch fleet calculation. Scheduled job. | Dev 2 (BE) | `calculate_qualification_status` scheduled job. Alert generation. `GET /qualifications/alerts` endpoint. |
| Qual-to-scheduling integration: qualification due dates feed existing RailSync priority scoring | Dev 2 (BE) | Integration: `evaluateCar()` weights `qual_due_date` in existing scoring engine. |
| Qualification dashboard: fleet-wide status, cars due by month, overdue list. Filter by type, SPV, customer | Dev 3 (FE) | `/qualifications` page: KPI cards, due-by-month chart, overdue table with filters. |
| Per-car qualification tab: all types, dates, next due, completion history. Plugs into existing Car detail | Dev 3 (FE) | QualificationTab component added to Car detail page. QualificationUpdateForm. |
| Qualification QA: test interval calculations, alerting thresholds, regulatory rules | UI/QA Mgr | Test matrix for all qualification types. Edge cases (expired, near-expiry, exempt). |

---

#### SPRINT 2 | Weeks 3-4 | Billing Engine — Monthly Rental Invoicing

| Task | Owner | Deliverable |
|---|---|---|
| Monthly rental invoicing: generate per contract. Pro-rata calculations for mid-month adds/removes. Pre-flight checks. | Dev 1 (BE) | `BillingService`: `generate_monthly_invoices()`. Pro-rata engine. Pre-flight validator. |
| Pending adjustments engine: auto-generate from lifecycle events (release, renewal, shop entry). Approval workflow. | Dev 1 (BE) | `AdjustmentService`: `generate_from_event()`. Approval queue. Must-clear enforcement before billing run. |
| Mileage processing: Railinc file ingestion, reconciliation, staging. Replace manual 27-step process. | Dev 2 (BE) | `MileageService`: `ingest_railinc_file()`, `reconcile()`, `stage()`. Automated pipeline. |
| Chargeback invoicing: generate from approved BRCs. Group by customer. Auto-attach 500-byte BRC file. | Dev 2 (BE) | `ChargebackInvoiceService`: `generate_invoices()`. 500-byte attachment. Customer grouping. |
| Rate management: escalation calculations, abatement rules, rate changes per contract version | Dev 2 (BE) | `rates` table or extension to `lease_riders`. Escalation calculation. Abatement logic. |
| Billing dashboard UI: month-end orchestration, pre-flight checklist, batch generation, review tabs | Dev 3 (FE) | `/billing` page: PreFlightChecklist, BatchGenerator, ReviewTabs (Contracts, Adjustments, Mileage). |
| Pending adjustments UI: review, approve, reject. Filter by type (release, renewal, shop). Batch approve. | Dev 3 (FE) | AdjustmentsQueue component. AdjustmentDetail with approve/reject. BatchApprove action. |
| Billing QA: month-end simulation, adjustment calculations, mileage processing validation | UI/QA Mgr | Full month-end simulation. Compare sample outputs to CIPROTS for validation. |

---

#### SPRINT 3 | Weeks 5-6 | Billing Engine — Distribution + Existing Module Hardening

| Task | Owner | Deliverable |
|---|---|---|
| Invoice distribution: automated email delivery to customer contacts. Template per customer. Bounce handling. | Dev 1 (BE) | `InvoiceDistributionService`: `send_invoices()`. Email templates. Delivery tracking. |
| Component registry: serial number tracking for valves, BOVs, fittings. Component-level maintenance history. | Dev 1 (BE) | `components` table, `component_history` table. CRUD API with serial number validation. |
| Commodity/cleaning auto-population: commodity from active rider, cleaning class from AITX matrix | Dev 2 (BE) | `CommodityService`: `get_cleaning_requirements()`. Commodity-to-cleaning mapping. |
| Shopping packet email: send assembled packet to shops. Configurable recipients. Delivery tracking. | Dev 2 (BE) | `EmailService`: `send_shopping_packet()`. Template engine. Delivery status tracking. |
| Invoice history UI: posted invoices and credit memos. Search. PDF view. Resend capability. | Dev 3 (FE) | InvoiceHistory page: searchable list, detail view, resend action, PDF viewer. |
| Shopping flow polish: commodity display, email status indicators, packet preview | Dev 3 (FE) | CommodityPanel in shopping detail. EmailStatusBadge. PacketPreview component. |
| Billing + shopping email QA: end-to-end invoice distribution, packet email delivery | UI/QA Mgr | Email delivery tests. Template rendering. Bounce handling verification. |

---

#### SPRINT 4 | Weeks 7-8 | Phase 1 Integration + Stabilization

| Task | Owner | Deliverable |
|---|---|---|
| Cross-module integration testing: qualification -> scheduling -> shopping -> invoice -> billing pipeline | Dev 1 (BE) | Integration tests across Qualification -> Assignment -> Shopping -> Invoice -> Billing. |
| Bulk qualification update: range update for groups of cars. Regulatory validation on date changes. | Dev 1 (BE) | `POST /qualifications/bulk-update`. Validates against regulatory interval rules. |
| Duplicate/copy shopping: template-based batch creation. Copy scope, projects, docs. Per-car validation. | Dev 2 (BE) | `DuplicateShoppingService`: `copy_from_template()`. Unique requirements per car. |
| Performance optimization: query profiling for new billing/qualification tables. Index strategy. | Dev 2 (BE) | Index strategy. Query profiling. API response < 200ms for standard queries. |
| Phase 1 UI polish: consistent patterns across billing, qualifications, existing modules | Dev 3 (FE) | UI review pass. Loading states, error boundaries, empty states across all modules. |
| Phase 1 regression testing: full QA pass across all existing + new modules | UI/QA Mgr | QA report. P1 bug count = 0. Known issues documented. |
| Stakeholder demo: show qualifications dashboard, billing run, month-end workflow | UI/QA Mgr | Demo script. Feedback collected and triaged. |

**MILESTONE: PHASE 1 COMPLETE** — Qualification compliance tracking live. Monthly billing engine operational. All core CIPROTS functions have a RailSync equivalent.

---

### PHASE 2: INTEGRATIONS (Sprints 5-8 | Weeks 9-16)

Core system works end-to-end. This phase connects external systems and hardens reporting.

---

#### SPRINT 5 | Weeks 9-10 | SAP Integration

| Task | Owner | Deliverable |
|---|---|---|
| SAP push — approved costs: SPV allocation with line-item detail. RFC/BAPI or REST endpoint. Error handling + retry. | Dev 1 (BE) | `SAPIntegration`: `push_approved_costs()`. Payload per SAP spec. Retry queue. |
| SAP push — billing triggers: rental invoices, adjustments, chargebacks for accounts receivable | Dev 1 (BE) | `SAPIntegration`: `push_billing_triggers()`. Batch and real-time modes. |
| SAP push — mileage invoices and cash application data | Dev 2 (BE) | `SAPIntegration`: `push_mileage()`. Cash application data format. |
| Salesforce integration: pull customer master, contacts, deal stages. Scheduled sync. Conflict resolution. | Dev 2 (BE) | `SalesforceSync`: `pull_customers()`, `pull_contacts()`. Scheduled job. Conflict rules. |
| Integration monitoring UI: sync status per system, last run time, error counts, manual retry buttons | Dev 3 (FE) | `/integrations` page: status cards, error log, retry controls. |
| SAP payload validation dashboard: review pending pushes, error details, resubmit | Dev 3 (FE) | SAPDashboard: pending queue, error detail, resubmit action. |
| Integration QA: mock SAP/SF endpoints. Payload schema validation. Error scenario tests. | UI/QA Mgr | Mock endpoint test suite. Payload format verification. |

**NOTE:** SAP API access must be requested from IT immediately (Sprint 1). Build with mock adapters first; swap to real endpoints when access granted.

---

#### SPRINT 6 | Weeks 11-12 | CLM + Railinc + EDI

| Task | Owner | Deliverable |
|---|---|---|
| CLM / Telegraph integration: car location data. Read current positions. Location history. Scheduled sync. | Dev 1 (BE) | `CLMIntegration`: `get_car_locations()`. Scheduled sync. Location history table. |
| Railinc EDI processing: full EDI message parsing for mileage files. Transaction set mapping. | Dev 1 (BE) | `RailincEDI`: `parse_mileage_edi()`. Transaction set 404/417 support. |
| Notification system hardening: email + in-app alerts for qualification warnings, SLA breaches, billing exceptions | Dev 2 (BE) | `NotificationService` enhancements: qualification alerts, SLA breach alerts, billing exception alerts. |
| Configurable report builder: user-defined reports, export to PDF/Excel, scheduled distribution | Dev 2 (BE) | `ReportBuilder`: template system, filter configuration, export engine, email scheduler. |
| Car location display: map/table view of fleet positions. Integration with CLM data. | Dev 3 (FE) | Fleet location page or Car detail tab showing current/historical positions. |
| Report builder UI: template selection, filter configuration, preview, export, schedule | Dev 3 (FE) | ReportBuilder page: drag-and-drop fields, preview pane, export buttons, schedule dialog. |
| CLM + Railinc QA: location data accuracy, EDI parsing validation, notification delivery | UI/QA Mgr | Location data spot-check. EDI sample file testing. Notification delivery verification. |

---

#### SPRINT 7 | Weeks 13-14 | Cost Analytics + Shop Performance

| Task | Owner | Deliverable |
|---|---|---|
| Cost analytics: actual vs estimated by shop. Trends. Budget vs actual. Variance reporting. | Dev 1 (BE) | `CostAnalyticsService`: `variance_report()`, `trend_analysis()`. Historical comparison. |
| Shop performance metrics: cycle time, defect rates, OTD, cost performance. Feed scoring model. | Dev 1 (BE) | `ShopPerformanceService`: `calculate_metrics()`. Historical data feeds RailSync scoring. |
| AI/ML estimate assistant: rule-based pre-review. Line-by-line accept/reject suggestions. Confidence scoring. | Dev 2 (BE) | `EstimateAIService`: `pre_review()`. Rule library. Confidence scores per line. (Phase 1 — rules only.) |
| Scenario comparison hardening: same rigor as shop comparison — all 25 rules, all cost variables. Custom weights. | Dev 2 (BE) | Enhanced `ScenarioService`: `compare_scenarios()` with full rule evaluation. |
| Cost analytics UI: variance charts, trend lines, budget tracker, drill-down by shop/customer | Dev 3 (FE) | `/cost-analytics` page: interactive charts, period selectors, drill-down tables. |
| Shop performance UI: scorecards, cycle time trends, cost performance comparison | Dev 3 (FE) | ShopPerformance page: scorecard grid, trend charts, ranking table. |
| Analytics QA: KPI accuracy validation, report export formatting, cross-validate with manual calculations | UI/QA Mgr | Cross-validate KPIs. Report format testing. Performance benchmark. |

---

#### SPRINT 8 | Weeks 15-16 | Phase 2 Integration + Stabilization

| Task | Owner | Deliverable |
|---|---|---|
| End-to-end integration testing: shopping -> BRC -> invoice -> billing -> SAP push pipeline | Dev 1 (BE) | Integration tests: shopping authorized -> estimate -> approved -> invoiced -> allocated -> SAP pushed. |
| External system error recovery: retry queues, circuit breakers, fallback behavior for SAP/SF/CLM | Dev 2 (BE) | Resilience patterns: retry with backoff, circuit breaker, dead letter queue. |
| Phase 2 UI polish: integration status consistency, analytics dashboard cohesion | Dev 3 (FE) | UI review pass. Consistent patterns across integration, analytics, reporting modules. |
| Phase 2 regression testing: full QA pass. All integrations + existing modules. | UI/QA Mgr | QA report. End-to-end scenario validation. Performance benchmarks. |
| Stakeholder demo: show complete pipeline from shopping through SAP push. Show analytics. | UI/QA Mgr | Demo: create shopping -> estimate -> approve -> invoice -> allocate -> SAP push. Analytics drill-down. |
| Seed realistic integration data: SAP push samples, SF sync data, CLM locations for testing | Dev 3 (FE) | Seed data update with integration test data. |

**MILESTONE: PHASE 2 COMPLETE** — SAP receives cost and billing data. Salesforce synced. CLM locations visible. Analytics operational. Full CIPROTS operational replacement.

---

### PHASE 3: MIGRATION + GO-LIVE PREP (Sprints 9-10 | Weeks 17-20)

System is feature-complete. This phase migrates legacy data and validates accuracy.

---

#### SPRINT 9 | Weeks 17-18 | CIPROTS Data Migration

| Task | Owner | Deliverable |
|---|---|---|
| Data migration — car master: full CIPROTS extraction. 150K cars mapped to permanent identity model. Reconciliation report. | Dev 1 (BE) | Migration pipeline: extract -> transform -> validate -> load. Reconciliation report. |
| Data migration — contracts: riders, car assignments, rate history. Active and recent-year data. | Dev 1 (BE) | Contract migration: map CIPROTS master/rider to new schema. Validate car-to-lease links. |
| Data migration — shopping events: BRC history, estimate approvals. Active + 2-year history. | Dev 2 (BE) | Shopping migration: map types, statuses, financials. BRC line-item migration. |
| Data migration — qualifications: from CIS. Component serial numbers. Inspection history. | Dev 2 (BE) | Qualification migration: map CIS fields to new schema. Component serial validation. |
| Parallel run tooling: side-by-side comparison engine. Auto-compare CIPROTS vs RailSync outputs. | Dev 2 (BE) | `ParallelRunService`: `compare_invoices()`, `compare_statuses()`. Discrepancy report. |
| Data migration validation UI: reconciliation dashboards, record counts, discrepancy drill-down | Dev 3 (FE) | MigrationDashboard: progress bars, reconciliation tables, error drill-down. |
| Migration QA: validate every migrated record category. Reconciliation against CIPROTS source. | UI/QA Mgr | Record count validation. Sample verification (100 random cars, 50 contracts, 50 shoppings). |

---

#### SPRINT 10 | Weeks 19-20 | Parallel Run + Go-Live Preparation

| Task | Owner | Deliverable |
|---|---|---|
| Parallel run: execute billing in both systems. Compare outputs. Daily discrepancy review. | Dev 1 (BE) | 30-day parallel run begins. Daily discrepancy review. Issue triage. |
| Bug fixes + discrepancy resolution: address issues found during parallel run | Dev 1+2 | P1 issues resolved within 24 hours. P2 within sprint. |
| User training materials: role-based training for Fleet Ops, Maintenance Coordinators, Billing, Engineering | UI/QA Mgr | Training materials: video walkthroughs, quick reference guides, role-specific SOPs. |
| Training environment: sandbox with realistic migrated data for hands-on practice | Dev 3 (FE) | Training instance deployed. Seed data from migration. User accounts provisioned. |
| Go-live runbook: step-by-step cutover plan. Rollback procedures. Support escalation contacts. | UI/QA Mgr | Runbook document. Tested rollback. War room plan for go-live week. |

**MILESTONE: PHASE 3 COMPLETE** — Data migrated. Parallel run validates accuracy. Team trained. Ready for cutover.

---

### GO-LIVE + STABILIZATION (Sprints 11-12 | Weeks 21-24)

---

#### SPRINT 11 | Weeks 21-22 | CUTOVER WEEK + Early Stabilization

| Task | Owner | Deliverable |
|---|---|---|
| Final data sync: last migration run to capture CIPROTS changes during parallel period | Dev 1 (BE) | Delta migration: extract changes since last full migration. Apply + validate. |
| DNS/URL redirect: point users to new system. CIPROTS set to read-only archive. | Dev 2 (BE) | Cutover executed per runbook. CIPROTS access restricted to read-only. |
| Go-live support: war room for first week. Real-time issue triage and hotfix deployment. | All | War room active. Issue tracker monitored. Hotfix deployment pipeline tested. |
| User support: dedicated help channel. Quick-response for blocked users. | UI/QA Mgr | Support channel monitored. FAQ document updated daily. |

---

#### SPRINT 12 | Weeks 23-24 | Post Go-Live Stabilization

| Task | Owner | Deliverable |
|---|---|---|
| Performance tuning: address scaling issues under real production load | Dev 1 (BE) | Query optimization. Index adjustments. Cache tuning based on real usage. |
| Bug fixes: address issues found in first 2 weeks of production use | Dev 1+2 | P1/P2 issues resolved. Known issues documented with workarounds. |
| User feedback integration: collect and triage enhancement requests from production users | Dev 3 (FE) | Feedback collection. Prioritized backlog of enhancements. |
| Post-mortem + retrospective: document lessons learned, update processes, plan next phase | UI/QA Mgr | Post-mortem document. Process improvements. V2 roadmap drafted. |

**MILESTONE: CIPROTS REPLACED** — RailSync Platform is the operational system of record for AITX Fleet Operations.

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| SAP/Salesforce API access delayed by IT | Billing and customer data integration blocked. Phase 2 delayed. | Start API access requests in Sprint 1. Build with mock adapters. Integration layer is swappable. |
| Data migration complexity from CIPROTS | Dirty data, unmapped fields, orphan records. Migration takes longer than planned. | Start requesting CIPROTS data extracts in Sprint 1. Get sample files early. Budget extra week if needed. |
| Scope creep during stakeholder demos | New requirements surface. Sprint commitments at risk. | Strict change control. New requests go to backlog. Demos show plan vs delivered. |
| Qualification rules complexity | AAR/FRA rules have edge cases not captured in initial model. Compliance gaps. | Get complete AAR/FRA rule set from Fleet Ops in Sprint 1. Validate with compliance team. |
| Billing parity with CIPROTS | Monthly billing outputs differ from CIPROTS. Trust eroded. Go-live delayed. | Parallel run comparison (Sprint 10). Daily discrepancy review. Root cause + fix protocol. |
| Team member turnover | Knowledge concentrated. Velocity drops if someone leaves. | Code reviews required on all PRs. Documentation standards enforced. No single-owner modules. |

---

## Immediate Action Items (Before Sprint 1 Starts)

These must happen in parallel with sprint planning:

1. **Request SAP API access from IT** — lead time is typically 4-8 weeks. Must start now.
2. **Request Salesforce API credentials** — need Connected App setup and OAuth configuration.
3. **Request CLM/Telegraph API documentation** — need endpoint specs and auth requirements.
4. **Get CIPROTS data extract samples** — need representative car, contract, shopping, and qualification data files to design migration ETL.
5. **Get complete AAR/FRA qualification rule set** — need the full regulatory matrix from Fleet Ops or compliance team.
6. **Get 50+ real BRC samples** — although the parser works, need production-variety samples to validate edge cases before billing goes live.
7. **Get SAP payload format specification** — need exact field mapping for cost push, billing triggers, and mileage data.
8. **Confirm Railinc EDI transaction set versions** — need spec for mileage file format (404/417 or proprietary).

---

## Sprint Cadence & Ceremonies (Unchanged)

- **Sprint Duration:** 2 weeks (Monday to Friday)
- **Sprint Planning:** Monday morning of sprint start (2 hours). Josh attends to validate priorities.
- **Daily Standup:** 15 minutes. Blockers surfaced immediately.
- **Code Reviews:** All PRs require 1 approval. No direct pushes to main.
- **Sprint Demo:** Friday afternoon of sprint end. Stakeholders invited at milestone sprints (S4, S8, S10, S12).
- **Retrospective:** Friday after demo. Process improvements documented and acted on.
- **Release Gates:** Each phase requires QA sign-off, stakeholder approval, and Josh's go/no-go.

---

## Comparison: Original vs Updated

| Metric | Original Roadmap | Updated Roadmap | Delta |
|---|---|---|---|
| Total sprints | 20 | 12 | -8 sprints saved |
| Total weeks | 40 | 24 | -16 weeks saved |
| Car Master sprints | 2 | 0 (done) | -2 |
| Contracts sprints | 1.5 | 0 (done) | -1.5 |
| Assignments/Releases sprints | 1.5 | 0 (done) | -1.5 |
| Shopping Workflow sprints | 2 | 0.5 (hardening only) | -1.5 |
| Projects sprints | 1 | 0 (done) | -1 |
| BRC Processing sprints | 1 | 0 (done) | -1 |
| Invoice Processing sprints | 1 | 0 (done) | -1 |
| Cost Allocation sprints | 0.5 | 0 (done) | -0.5 |
| S&OP / Planning sprints | 1 | 0 (done) | -1 |
| RBAC/Auth sprints | 0.5 | 0 (done) | -0.5 |
| Qualifications sprints | 1 | 1 (gap fill) | 0 |
| Billing Engine sprints | 2 | 2 (new) | 0 |
| SAP Integration sprints | 1 | 1 (new) | 0 |
| Salesforce/CLM/Railinc sprints | 1 | 1 (new) | 0 |
| Analytics/Reporting sprints | 1 | 1 (hardening) | 0 |
| Data Migration sprints | 1 | 1 (new) | 0 |
| Parallel Run + Go-Live sprints | 4 | 4 | 0 |

---

*Updated: February 2026*
*Based on codebase audit of 49 database migrations, 110+ tables, 29 controllers, 54 services, 434 API routes, 53 frontend pages*
