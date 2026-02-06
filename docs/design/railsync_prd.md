# Railsync Product Requirements Document

**Version:** 2.1
**Updated:** February 6, 2026
**Status:** Implemented

---

## 1. Product Vision

Railsync is a comprehensive railroad car maintenance management system that optimizes the assignment of railcars to repair shops, manages the full lifecycle of maintenance events, and provides financial controls for invoicing and budgeting.

---

## 2. Users & Roles

| Role | Responsibilities |
|------|-----------------|
| **Fleet Operations / Schedulers** | Evaluate shops, assign cars, manage pipeline, plan capacity |
| **Maintenance Managers** | Review service plans, approve estimates, manage projects |
| **Finance / Billing** | Process invoices, manage budgets, approve payments |
| **Contract Administrators** | Manage customer leases, riders, amendments |
| **System Administrators** | User management, permissions, system configuration |

All roles authenticate via JWT with role-based access control (RBAC). Permissions are granted at the role, group, and individual override levels.

---

## 3. Core Domains

### 3.1 Shop Evaluation Engine
- User enters car/event inputs in web UI
- System evaluates eligible shops based on configurable JSON rules
- Factors: capabilities, commodity constraints, proximity, capacity, cost
- Results displayed in ranked grid with explanations and overrides

### 3.2 Pipeline Management
- Four-bucket lifecycle: Backlog > Pipeline > Active > Healthy
- Real-time capacity sync via SSE
- Drag-and-drop shop loading tool

### 3.3 Contract Hierarchy
- Customer > Master Lease > Rider > Cars data model
- Amendment tracking with conflict detection
- Bulk schedule re-sync on rider changes
- Car shopping validation against contract terms

### 3.4 Shopping Workflow
- 18 shopping types with 59 classification reasons
- Shopping events with state machine transitions
- Estimates with multi-option proposals
- Approval packets with customer release workflow
- Shopping packets for document bundling
- **Shopping Requests**: Comprehensive 11-section intake form (customer info, car info, car status, lining preferences, mobile repair, reason for shopping, return disposition, attachments, one-time movement, comments)
  - Request numbering: SR-YYYYMMDD-NNNNN
  - Status workflow: draft → submitted → under_review → approved/rejected/cancelled
  - On approval: auto-creates shopping event in REQUESTED state
  - File attachments with document type classification (SDS, cleaning certificate, other)
  - Pre-fill from Bad Orders page with car number and bad order linkage

### 3.5 Invoice Processing
Two invoice systems:
1. **Legacy BRC Matching**: Invoice ingestion, line-by-line BRC comparison, auto/manual approval
2. **Invoice Case Workflow**: 17-state deterministic machine (RECEIVED through PAID/CLOSED/BLOCKED) with:
   - SHOP and MRU invoice types
   - Automated validation engine (estimate variance, document checks, lessee rules)
   - Attachment management with server-side validation
   - Full audit trail with expandable context

### 3.6 Capacity & Planning
- Demand forecasting with scenario optimization
- Capacity reservations with confirm/cancel/rollover
- Master plan versioning with snapshot comparisons
- S&OP planning with budget impact analysis

### 3.7 Budget & Finance
- Running repairs budget by month
- Service event budget tracking
- Budget vs actual comparison analytics
- Cost allocation by shopping type and reason

### 3.8 Car Condition Monitoring (CCM)
- CCM forms with sealing and lining specifications
- Hierarchy-level instructions (customer > lease > rider > car)
- Scope library with reusable templates
- Scope-of-work builder with job code mapping

### 3.9 Projects
- Project creation with car planning integration
- Plan/lock/relock workflow for car assignments
- BRC review tracking per car
- Project communications log

### 3.10 Analytics & Reporting
- Capacity forecasting and utilization trends
- Cost analytics with budget comparison
- Operations KPIs (dwell time, throughput)
- Demand forecasting by region and customer
- Qualification reports and trends

---

## 4. System Constraints

### 4.1 Single Source of Truth (SSOT)
The `cars` table with immutable `id UUID` is the authoritative identity source. The `car_assignments` table is the authoritative source for all car-to-shop assignments. All modules (Quick Shop, Service Plans, Bad Orders, Pipeline) defer to these tables. The `asset_events` ledger provides an append-only lifecycle audit trail.

### 4.2 State Management
- Invoice cases use a deterministic 17-state machine with validation gates
- Shopping events use a state machine with allowed transitions
- All state changes are audited with actor, timestamp, and context

### 4.3 Irreversible Actions
- Confirmed capacity reservations require explicit cancellation
- Finalized scopes of work cannot be edited
- Sealed CCM instructions lock downstream modifications
- Invoice case terminal states (PAID, CLOSED) prevent further edits

### 4.4 Audit Requirements
- Every meaningful change increments a version and records who/when/what
- Audit log viewer with filtering by action type and actor
- Validation context preserved on state transitions

---

## 5. Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| Backend | Express.js, TypeScript, JWT authentication |
| Database | PostgreSQL with raw SQL queries |
| Deployment | Docker Compose (4 containers: DB, API, UI, Nginx) |
| Real-time | Server-Sent Events (SSE) |
| UI | Dark mode, responsive, ARIA accessible, keyboard navigable |

---

## 6. Quality Attributes

- **Security**: Sanitized error messages, hidden credentials, JWT expiry, RBAC
- **Accessibility**: ARIA roles on all dialogs/modals, keyboard navigation on cards, screen reader labels
- **Responsiveness**: Mobile-optimized layouts with dedicated card components
- **Performance**: Loading skeletons on all pages, virtual grids for large datasets
- **Reliability**: Toast notifications (not alert/confirm), ConfirmDialog for destructive actions
