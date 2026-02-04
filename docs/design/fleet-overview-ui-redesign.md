# Contracts Overview UI Redesign & Shopping Classification  
**Audience:** Railsync / Fleet Ops Development Team  
**Goal:** Scale UI and data model from ~137 cars to **100,000+ assets** while preserving performance, usability, and governance.

---

## 1. Core Design Principle

To scale meaningfully, we must move **away from a flat table** toward a **hierarchical, drill-down architecture** that mirrors the real-world relationships:

**Customer → Lease → Rider → Amendment → Cars**

“**Shopping Needs**” remains the **primary actionable layer**, but it must sit on top of this hierarchy—not replace it.

---

## 2. Contracts Overview – Structural Redesign

### 2.1 Top-Level Global Analytics (“Snapshot”)

Replace simple counts with **Actionable Trend Cards** that provide immediate fleet health context.

**Snapshot Metrics:**
- **Shopping Health (Stoplight)**
  - In-Shop
  - Enroute
  - Overdue
- **Utilization**
  - % Assigned vs. No Assignment
- **Contractual Risk**
  - Riders expiring < 90 days
  - Pending Amendments

> Purpose: Let users understand fleet risk **before** drilling into cars.

---

## 3. Navigation Hierarchy (Master → Detail)

Designed to scale to **1,000+ customers** and **7,000+ riders**.

### Level 1 – Customer Account (Parent)
**View:** Searchable customer directory  
**Key Fields:**
- Total cars under lease
- % of fleet in shop
- Active lease count

---

### Level 2 – Lease / Rider / Amendment (Contractual Layer)

**Lease**
- Active leases per customer

**Riders**
- Nested under each lease
- Where technical specs and service terms live

**Amendments**
- Accessed via version history icon or sub-tab
- Represents changes to original Rider terms

---

### Level 3 – Car List (Asset Layer)

- Existing car table
- Automatically filtered by Customer → Lease → Rider selections
- No global, unfiltered car dumps

---

## 4. Advanced Filtering & Search (Required for 100k+ Assets)

A single search box is insufficient.

### Faceted Sidebar (E-commerce style)

**Commercial Filters**
- Customer
- Lease ID
- Rider Number

**Technical Filters**
- Car Type (Tank / Hopper)
- Material (Stainless / Carbon)
- Commodity

**Shop Status Filters**
- Shop location (AITX-MIL, AITX-BRK, etc.)
- Days until next required test

---

## 5. UI Layout Changes (Current vs Scalable)

| Feature | Current Layout | New Scalable Layout |
|------|---------------|-------------------|
| Search | Single text box | Global Command Bar (Customer / Lease / Car) |
| Grouping | Flat list | Nested accordions (Customer → Lease → Rider → Cars) |
| Actions | Single “Shop” button | Bulk Actions (Select 50 cars → Assign to Shop) |
| Density | High whitespace | Compact, configurable data grid |
| Paging | Page 1 of N | Infinite / Virtual scrolling |

> **Pro Tip:** Infinite or virtual scrolling is mandatory at scale—pagination will not survive user load.

---

## 6. Visualizing “Shopping Needs”

### Timeline / Gantt Toggle

Add a **Timeline View** alongside table view.

- Visualize shopping windows instead of static dates
- Identify “clumping” where many cars from one Rider hit the shop simultaneously
- Critical for customer impact analysis and capacity planning

---

## 7. Railsync Field Definitions (Authoritative)

### Shopping Type (Required)
High-level classification used for:
- Allocation rules (Tier 1 vs Tier 2)
- Planned vs unplanned logic
- Default cost owner
- Budget rollups

---

### Shopping Reason (Required)
Specific reason tied to Shopping Type:
- Deeper analytics
- Exception routing
- Future ML classification
- Budget sub-rollups

**Rule:** Shopping Reason options load **only after** Shopping Type selection.

---

## 8. Canonical Lists

### 8.1 Shopping Types (12)

- Qualification / Regulatory
- Bad Order / Mechanical Failure
- Preventive / Planned Maintenance
- Release / End of Lease
- Upmarket / Commercial Upgrade
- Assignment-Driven
- Damage / Incident
- Cleaning / Decontamination
- Storage / Reactivation
- Inspection / Evaluation Only
- Customer-Driven (Non-Standard)
- Other / Administrative

---

### 8.2 Shopping Reasons (Dependent)

Rename **Sub-Category → Shopping Reason**.

**Example:**

**Shopping Type:** Bad Order / Mechanical Failure  
**Shopping Reasons:**
- Leak – Product
- Leak – Non-Product
- Valve Failure
- Manway / Hatch Issue
- Brake System Failure
- Running Gear Defect
- Coupler / Draft Gear Issue
- Structural Defect
- Shell / Head Damage
- Thermal Protection Damage
- Heater / Coil Failure

(Repeat pattern for each Shopping Type.)

---

## 9. UI Behavior (Exact Requirements)

### Shopping Type Dropdown (Required)
- Clears Shopping Reason on change
- Reloads dependent Shopping Reasons
- Updates defaults:
  - Planned flag
  - Default cost owner

### Shopping Reason Dropdown (Required)
- Disabled until Shopping Type selected
- Filtered strictly by selected Type

### Estimate Lines Table
Each line includes:
- `[ ] Allocate cost estimate to customer`

**Rule:**
- If checkbox ≠ default → **override reason required**

---

## 10. Data Model – Renames Only

| Old Name | New Name |
|--------|---------|
| ReasonCategory | ShoppingType |
| ReasonSubcategory | ShoppingReason |
| reasonCategoryId | shoppingTypeId |
| reasonSubcategoryId | shoppingReasonId |

_No structural changes beyond renaming._

---

## 11. Prisma Schema (Renamed)

```prisma
enum CostOwnerDefault {
  OWNER
  CUSTOMER
  MIXED
}

enum ShopEventStatus {
  DRAFT
  PLANNED
  CONFIRMED
  FINAL_CONFIRMED
  CLOSED
}

model ShoppingType {
  id               String           @id @default(cuid())
  code             String           @unique
  name             String
  description      String?
  defaultCostOwner CostOwnerDefault @default(OWNER)
  active           Boolean          @default(true)
  sortOrder        Int              @default(0)

  reasons          ShoppingReason[]

  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
}

model ShoppingReason {
  id               String           @id @default(cuid())
  shoppingTypeId   String
  code             String           @unique
  name             String
  description      String?
  defaultCostOwner CostOwnerDefault?
  active           Boolean          @default(true)
  sortOrder        Int              @default(0)

  shoppingType     ShoppingType     @relation(fields: [shoppingTypeId], references: [id])

  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
}

model ShopEvent {
  id               String          @id @default(cuid())
  carId            String
  status           ShopEventStatus @default(DRAFT)

  shoppingTypeId   String?
  shoppingReasonId String?

  shoppingLockedAt DateTime?
  shoppingLockedBy String?

  shoppingType     ShoppingType?   @relation(fields: [shoppingTypeId], references: [id])
  shoppingReason   ShoppingReason? @relation(fields: [shoppingReasonId], references: [id])

  estimateLines    EstimateLine[]

  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
}

model EstimateLine {
  id                      String   @id @default(cuid())
  shopEventId             String

  description             String
  estimatedCostCents      Int
  laborHours              Float?
  materialsCostCents      Int?

  allocateToCustomer      Boolean  @default(false)
  allocationOverrideReason String?

  shopEvent               ShopEvent @relation(fields: [shopEventId], references: [id])

  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}
