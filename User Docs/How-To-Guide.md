# RailSync - How To Guide

**Document Version:** 1.3
**Last Updated:** February 5, 2026
**Applicable System Version:** Main branch (latest)

> This document is a living guide. It should be updated as new features are added or existing features are modified.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Navigation](#2-navigation)
3. [User Roles and Permissions](#3-user-roles-and-permissions)
4. [Dashboard](#4-dashboard)
5. [Contracts Management](#5-contracts-management)
6. [Shop Management](#6-shop-management)
7. [Car Assignments](#7-car-assignments)
8. [Shopping Events](#8-shopping-events)
9. [Scope of Work (SOW)](#9-scope-of-work-sow)
10. [SOW Library](#10-sow-library)
11. [Customer Care Manuals (CCM)](#11-customer-care-manuals-ccm)
12. [Estimates and Approval Workflow](#12-estimates-and-approval-workflow)
13. [Bad Orders](#13-bad-orders)
14. [Invoices](#14-invoices)
15. [Budget and Forecasts](#15-budget-and-forecasts)
16. [Analytics and Reports](#16-analytics-and-reports)
17. [Planning](#17-planning)
18. [Admin and Settings](#18-admin-and-settings)
19. [Keyboard Shortcuts and Tips](#19-keyboard-shortcuts-and-tips)
20. [Troubleshooting](#20-troubleshooting)

---

## 1. Getting Started

### System Requirements

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Network access to the RailSync server (default: `http://localhost:3000`)
- Valid user account (provided by your system administrator)

### Logging In

1. Navigate to the RailSync URL in your browser.
2. Enter your **email address** and **password**.
3. Click **Sign In**.
4. You will be redirected to the Dashboard.

Your session token expires after **15 minutes** of inactivity. The system will automatically refresh your token in the background. If you are logged out unexpectedly, simply log in again. Your work in progress on any forms will be lost if the page reloads, so save frequently.

### First-Time Setup

If you are an administrator setting up RailSync for the first time:

1. Log in with the default admin credentials (provided separately by your IT team).
2. **Immediately change the default admin password** via Settings > Profile.
3. Create user accounts for your team via Admin > User Management.
4. Configure shops, fleet data, and organizational settings.

---

## 2. Navigation

RailSync uses a vertical sidebar navigation on the left side of the screen. The sidebar shows icon-only primary categories when collapsed and expands to show full labels and subcategories when clicked.

### Sidebar Structure

| Category | Icon | Subcategories |
|----------|------|---------------|
| **Dashboard** | LayoutDashboard | (direct link to /dashboard) |
| **Shopping** | ShoppingCart | Shopping Events, Quick Shop, Bad Orders, Shop Finder |
| **Pipeline** | Truck | Pipeline, Monthly Load, Network View, Master Plans |
| **Contracts** | FileText | Contracts, Projects |
| **Cars** | Train | All Cars, In Shop, Enroute, Overdue, Service Due |
| **Operations** | BarChart | Invoices, Budget & Forecasts, Analytics, Reports |
| **Standards** | BookOpen | SOW Library, Care Manuals |
| **Admin** | Settings | Rules, Audit Log, Users, Settings (admin only) |

### Sidebar Behavior

- **Collapsed state** (default): Shows icons only, 56px wide. Hover over an icon to see a tooltip with the category name.
- **Expanded state**: Click the chevron at the bottom of the sidebar to expand it to 224px. Shows full category labels and subcategory items.
- **Category click**: Clicking a category icon expands its subcategory list (accordion-style). Only one category can be expanded at a time.
- **Active highlight**: The current page's category and subcategory are highlighted in blue.
- **User menu**: Click your avatar at the bottom of the sidebar to access Settings and Sign Out.

### Mobile Navigation

On mobile devices, the sidebar is replaced by a top header bar with a hamburger menu. Tapping the menu opens a full sidebar overlay that slides in from the left. Tap outside or the X button to close.

### Dark Mode

RailSync supports dark mode. Toggle it via the sun/moon icon at the bottom of the sidebar. Your preference is saved locally.

---

## 3. User Roles and Permissions

RailSync has three user roles:

| Role | Read | Create/Edit | Admin Functions |
|------|------|-------------|-----------------|
| **Viewer** | All data | No | No |
| **Operator** | All data | Yes - create, edit, state transitions | No |
| **Admin** | All data | Yes | Yes - user management, settings, audit log |

- **Viewers** can browse all pages and data but cannot create, edit, or delete anything.
- **Operators** can perform all operational tasks: creating shopping events, managing SOWs, submitting estimates, transitioning states, and managing fleet data.
- **Admins** have full access including user management, system configuration, rules management, and the audit log.

---

## 4. Dashboard

**URL:** `/dashboard`

The Dashboard provides an at-a-glance overview of your operation:

- **Summary statistics** - Total cars, active shops, pending assignments, open bad orders
- **Recent activity** - Latest state changes, new assignments, recent invoices
- **Charts** - Fleet distribution, shop utilization, financial trends (powered by Recharts)

The Dashboard is read-only. Click on any summary card to navigate to the corresponding detail page.

---

## 5. Contracts Management

### Contracts Overview

**URL:** `/contracts`

The Contracts page displays your entire railcar fleet with filtering and search capabilities.

**Available Filters:**
- Car type (tank, hopper, gondola, boxcar, etc.)
- Status (in service, bad order, in shop, etc.)
- Customer/lessee
- Shop location

**Actions:**
- Click any car row to view car details
- Use the search bar to find a specific car by car number
- Export fleet data (if available)

### Car Details (Contracts Browse)

**URL:** `/cars`

The Cars page is a three-panel layout optimized for browsing a large fleet (1,500+ cars) with fast filtering and detailed inspection.

#### Layout

| Panel | Description |
|-------|-------------|
| **Left: Car Type Tree** | Hierarchical tree navigation: Car Type > Commodity. Click a node to filter the main list. Each node shows its car count. Collapsible via chevron. |
| **Center: Car List** | Server-side paginated table with 50 cars per page. Sortable columns. Click any row to open the detail drawer. |
| **Right: Side Drawer** | Slides in from the right showing full car details. Closes with X, ESC key, or clicking outside. Does not block the list — you can scroll behind it. |

#### Car Type Tree (Left Panel)

The tree groups all cars by **Car Type** (e.g., General Service Tank, Pressure Tank) and then by **Commodity** (e.g., Ethanol, LPG, Corn Oil). Each node displays a count badge.

- Click **All Cars** to remove the tree filter.
- Click a **Car Type** to filter the list to that type.
- Expand a Car Type and click a **Commodity** to drill down further.
- The tree can be collapsed to a thin rail by clicking the left chevron.
- On mobile devices (< md breakpoint), the tree panel is hidden to maximize screen space for the car list. Use the status, region, and lessee filter dropdowns instead.

#### URL Parameter Filters

The Cars page supports direct linking with pre-applied filters via URL query parameters. Sidebar links like `/cars?status=Arrived` will open the Cars page with that filter pre-selected. Supported URL parameters: `status`, `region`, `lessee`, `type`, `commodity`, `search`.

#### Search and Filters

- **Search bar** - Searches by car number (partial match, server-side).
- **Filters button** - Opens a filter row with dropdown selectors for:
  - **Status** (e.g., Complete, Released, Arrived, Enroute)
  - **Region** (if populated)
  - **Lessee** (all 59 customers from the fleet)
- **Clear All** - Resets all filters and tree selection.

Filters are applied server-side, so results are fast even with large datasets.

#### Car List (Center Panel)

Columns: Car #, Type, Lessee, Commodity, Status, Region, Tank Qual, Age.

- Click any **column header** to sort (ascending/descending toggle).
- Click any **row** to open the car's side drawer.
- The selected row is highlighted in blue.
- **Pagination** at the bottom shows First/Prev/1/2/3.../Next/Last controls.

#### Side Drawer (Right Panel)

The drawer shows complete car information organized in collapsible sections:

| Section | Contents |
|---------|----------|
| **General Information** | Car number, mark, ID, type, lessee, codes, CSR, CSL, commercial contact, portfolio |
| **Specifications** | Commodity, jacketed/lined status, lining type, material type, car age, asbestos, nitrogen |
| **Qualifications & Due Dates** | All qualification years with color-coded badges (green = current, amber = due next year, red = overdue) |
| **Maintenance & Status** | Current/adjusted/plan status, reason shopped, assigned shop, last repair, active shopping event link |
| **Location** | Current and past region |
| **Lease & Contract** | Contract number, expiration, linked customer and lease details |

The drawer header shows:
- Car number and type
- Quick stats row: Age, Tank Qual badge, Status badge, Shopping Events count
- Active shopping event link (if the car is currently in a shop)

Footer buttons link to the car's shopping history and contracts view.

---

## 6. Shop Management

### Shop Network Overview

**URL:** `/shops`

The Shops page displays your entire shop network organized by geographic area, with quick access to shop details and capabilities.

#### Layout

| Panel | Description |
|-------|-------------|
| **Main Content: Grouped Cards** | Shops organized by area/region (e.g., Midwest, Gulf Coast, Northeast). Each shop displayed as a card with key information. |
| **Right: Side Drawer** | Slides in from the right showing full shop details. Closes with X, ESC key, or clicking outside. |

#### Area Groups

Shops are automatically grouped by their geographic area. Each group shows:

- **Area name** with total shop count badge
- **Collapsible section** - Click the header to expand/collapse
- **Shop cards** within each area

#### Shop Cards

Each shop card displays:

| Field | Description |
|-------|-------------|
| **Shop Name** | Full name of the shop |
| **Shop Code** | Unique identifier (e.g., GATX-CHI, UP-HOU) |
| **Type Badge** | Color-coded type indicator: Repair (blue), Storage (amber), Scrap (gray), Preferred (purple star) |
| **Location** | City, State |
| **Capacity** | Current/Total capacity (e.g., 45/100 cars) |

**Type Indicators:**
- 🔧 **Repair** (blue) - Full-service repair facility
- 📦 **Storage** (amber) - Storage yard
- ♻️ **Scrap** (gray) - Scrap/dismantling facility
- ⭐ **Preferred** (purple) - Preferred network shop (higher priority)

#### Search and Filter

- **Search bar** - Search by shop name, code, or city (partial match)
- **Area filter** - Dropdown to show only shops in a specific area
- **Type filter** - Filter by shop type (Repair, Storage, Scrap, All)
- **Clear All** - Reset all filters

#### Shop Detail Drawer

Click any shop card to open the detail drawer showing:

| Section | Contents |
|---------|----------|
| **Header** | Shop name, code, type badge, and close button |
| **Location** | Full address with city, state, zip |
| **Contact** | Phone, email, primary contact name |
| **Capacity** | Current utilization bar, total spots, available spots |
| **Capabilities** | List of certifications and service capabilities |
| **Recent Activity** | Last 5 cars processed at this shop |
| **Quick Actions** | Links to assign a car, view shop history |

#### Finding a Shop for a Car

1. Navigate to `/shops`
2. Use the search bar or area filter to narrow down options
3. Look for shops with:
   - Available capacity (green utilization bar)
   - Required capabilities for the work needed
   - Preferred network status (if applicable)
4. Click a shop card to view full details
5. Use the **Assign Car** button in the drawer to create an assignment

---

## 7. Car Assignments

**URL:** `/assignments`

Car Assignments track which cars are assigned to which shops for repair work.

### Creating an Assignment

1. Navigate to Assignments.
2. Click **New Assignment**.
3. Select a car (by car number).
4. Select a destination shop.
5. Set the assignment type and priority.
6. Click **Create Assignment**.

### Assignment Lifecycle

Assignments move through states: Created > In Transit > In Shop > Complete.

When a Shopping Event reaches the WORK_AUTHORIZED state, the linked car assignment is automatically updated to "In Shop." When the shopping event reaches RELEASED, the assignment is marked "Complete."

---

## 8. Shopping Events

**URL:** `/shopping`

Shopping Events are the core workflow for tracking individual car shop visits. Each event follows a 15-state lifecycle from initial request through final release.

### Understanding the State Machine

Every shopping event moves through these states in order:

```
REQUESTED
  -> ASSIGNED_TO_SHOP
    -> INBOUND
      -> INSPECTION
        -> ESTIMATE_SUBMITTED
          -> ESTIMATE_UNDER_REVIEW
            -> ESTIMATE_APPROVED (or CHANGES_REQUIRED -> back to ESTIMATE_SUBMITTED)
              -> WORK_AUTHORIZED
                -> IN_REPAIR
                  -> QA_COMPLETE
                    -> FINAL_ESTIMATE_SUBMITTED
                      -> FINAL_ESTIMATE_APPROVED
                        -> READY_FOR_RELEASE
                          -> RELEASED
```

Any state can transition to **CANCELLED** (with a required reason).

The state progress bar at the top of each shopping event shows where the event currently stands. Completed states appear in blue, the current state pulses, and future states are grayed out.

### Creating a Shopping Event

1. Navigate to `/shopping`.
2. Click **New Shopping Event**.
3. Enter the **car number** (e.g., GATX 12345).
4. Select the **shop code** (e.g., UP001).
5. Optionally set shopping type and reason.
6. Click **Create**.

The event starts in the REQUESTED state and is assigned a unique event number (e.g., SE-20260204-00001).

**Constraint:** Only one active shopping event per car is allowed. If a car already has an active event (any state other than RELEASED or CANCELLED), you cannot create a new one for that car.

### Creating a Batch of Shopping Events

For shopping multiple cars at the same shop:

1. Navigate to `/shopping`.
2. Click **Batch Shop**.
3. Enter multiple car numbers (comma-separated or one per line).
4. Select the shared shop code.
5. Optionally set shared shopping type and reason.
6. Click **Create Batch**.

All cars in the batch will be created as individual shopping events linked to a shared batch record. They share metadata but progress through the state machine independently.

### Advancing a Shopping Event

1. Open the shopping event detail page (`/shopping/[id]`).
2. The available state transitions appear as action buttons below the state progress bar.
3. Click the appropriate transition button (e.g., "Advance to INBOUND").
4. Some transitions have **approval gates** (see below).

### Approval Gates (Hard Stops)

Certain state transitions require preconditions:

| Transition | Gate | What Must Be True |
|-----------|------|-------------------|
| ESTIMATE_APPROVED -> WORK_AUTHORIZED | Estimate Required | At least one estimate submission must have "approved" status |
| FINAL_ESTIMATE_SUBMITTED -> FINAL_ESTIMATE_APPROVED | Final Estimate Required | A final estimate must exist and be approved |

If a gate blocks a transition, you will see a warning message explaining what is missing. Resolve the precondition before trying again.

### Cancelling a Shopping Event

1. Open the shopping event detail page.
2. Click **Cancel Event** (available from any state).
3. Enter a **cancellation reason** (required).
4. Confirm the cancellation.

Cancelled events cannot be reactivated. To shop the same car again, create a new shopping event.

### Filtering Shopping Events

The shopping events list page supports filtering by:

- **State** - Click status pills to filter by state (e.g., show only INSPECTION events)
- **Shop** - Enter a shop code
- **Car** - Enter a car number
- **Batch** - Filter by batch ID

### Viewing State History

Each shopping event maintains a complete, immutable state history log. View it at the bottom of the event detail page. Each entry shows:

- Previous state and new state
- Who made the change
- When the change occurred
- Any notes provided

---

## 9. Scope of Work (SOW)

A Scope of Work defines the specific repair instructions for a shopping event. Each SOW contains line items that tell the shop what work to perform.

### Creating a SOW

SOWs are created in conjunction with shopping events. When you create a shopping event, you can optionally attach a SOW.

1. From the shopping event detail page, locate the SOW section.
2. Click **Create SOW** (if no SOW is attached yet).
3. The SOW starts in **draft** status.

### Adding SOW Line Items

1. In the SOW editor, click **Add Item**.
2. Enter the **instruction text** (e.g., "Inspect shell for corrosion and measure minimum thickness").
3. Set the **source** (engineering, CCM, manual, or library).
4. Optionally associate **job codes** with the item (what AAR or internal codes the shop should use).
5. Click **Save**.

### Populating from the SOW Library

Instead of writing items from scratch, you can pull in items from a library template:

1. In the SOW editor, click **Populate from Library**.
2. The system will suggest templates that match the car type, shopping type, and shopping reason.
3. Select a template.
4. All template items (with their job codes) are copied into your SOW.
5. You can then edit, add, or remove items as needed.

### Populating from a CCM

If the customer has a Care Manual (CCM) on file:

1. In the SOW editor, click **Populate from CCM**.
2. Select the applicable CCM sections using checkboxes.
3. The selected section content is added as SOW line items.

### Finalizing a SOW

Once the SOW is complete:

1. Review all line items.
2. Click **Finalize SOW**.
3. The SOW is locked and cannot be edited further.

A finalized SOW is the official document sent to the shop. If changes are needed after finalization, create a new SOW version.

### Saving a SOW as a Library Template

If you have built a good SOW that you want to reuse:

1. From the SOW view, click **Save as Template**.
2. Give the template a name.
3. The SOW items and job codes are saved to the library for future use.

---

## 10. SOW Library

**URL:** `/scope-library`

The SOW Library is a collection of reusable scope-of-work templates that builds organically as your team creates and saves SOWs.

### Browsing Templates

- Use the search bar to find templates by name.
- Filter by **car type**, **shopping type**, or **shopping reason**.
- Templates show usage count and last-used date.

### Creating a Template

1. Click **New Template**.
2. Enter a name, car type, shopping type, and description.
3. Add line items with instruction text and source.
4. Associate job codes with each item (indicating which AAR or internal codes the shop should use for that work).
5. Click **Save**.

### Template Auto-Suggestion

When creating a SOW for a shopping event, the system automatically suggests matching templates based on:
- Car type
- Shopping type
- Shopping reason

Templates that match all three criteria appear first, sorted by usage frequency.

### Editing a Template

1. Click on a template card to expand it.
2. Edit the name, description, or items.
3. Changes to templates do NOT affect existing SOWs that were previously created from the template. Templates are copied, not linked.

---

## 11. Customer Care Manuals (CCM)

**URL:** `/ccm`

Customer Care Manuals document the specific requirements and preferences of each lessee (customer) for how their railcars should be maintained. The CCM system supports **hierarchy-level instructions** with inheritance, allowing you to define requirements at the Customer, Master Lease, Lease Rider, or Amendment level.

### CCM Hierarchy Structure

CCM instructions can be attached at four hierarchy levels:

| Level | Description | Example |
|-------|-------------|---------|
| **Customer** | Global defaults for all cars under a customer | DuPont's company-wide food-grade cleaning requirement |
| **Master Lease** | Lease-specific requirements | ML-2024-001 requires nitrogen padding at 3 PSI |
| **Rider** | Schedule-specific requirements | Schedule A cars require epoxy lining |
| **Amendment** | Amendment-specific overrides | Amendment adds kosher wash requirement for new cars |

**Inheritance:** Child levels automatically inherit settings from parent levels. You only need to define overrides at lower levels. For example, if Customer has `food_grade = true`, all leases, riders, and amendments under that customer inherit that setting unless explicitly overridden.

### Browse Tab

The **Browse** tab shows all CCM instructions currently defined in the system:

- Each instruction shows its **scope level** (Customer, Lease, Rider, Amendment) as a colored badge
- Click an instruction card to expand and view its details
- Use the search bar to filter by customer, lease, or rider name
- Click the **Edit** icon to modify an instruction

### Create/Edit Tab

The **Create/Edit** tab allows you to define or modify CCM instructions:

1. **Select a Scope**: Use the hierarchy tree picker on the left to choose where to define instructions
   - Green dots indicate nodes that already have CCM instructions
   - Expand nodes using the chevron to navigate the hierarchy
   - Click a node to select it
2. **Edit Fields**: The editor on the right shows all CCM fields organized by tabs:
   - **Contacts** - Primary, Estimate Approval, and Dispo contacts
   - **Cleaning** - Food grade, mineral wipe, kosher requirements
   - **Sealing** - Per-commodity gasket/sealing requirements
   - **Lining** - Per-commodity lining requirements
   - **Dispo** - Nitrogen, decals, documentation requirements
   - **Notes** - Special fittings and additional notes
3. **Inheritance Indicators**: Each field shows whether it's:
   - **Inherited** (gray badge showing source level) - Click "Override" to set a local value
   - **Set at this level** (blue badge) - Click "Reset to inherit" to remove the override
4. **Save**: Click **Save Changes** to persist your edits

### Creating a New CCM Instruction

1. Navigate to the **Create/Edit** tab
2. Select a scope from the hierarchy tree
3. If no CCM exists at that scope, you'll see "Create New CCM Instructions"
4. Fill in the fields you want to define at this level (leave others empty to inherit)
5. Click **Create CCM**

### Managing Sealing Sections

Each CCM can have multiple sealing sections (one per commodity):

1. Expand the CCM in Browse tab or select in Edit tab
2. Navigate to the **Sealing** tab
3. Click **Add Sealing Record**
4. Enter:
   - **Commodity** - What product the car carries (e.g., "Ethanol")
   - **Gasket Sealing Material** - Required gasket material (e.g., "Teflon")
   - **Preferred Gasket Vendor** - Primary vendor
   - **Alternate Gasket Vendor** - Backup vendor
   - **VSP Ride Tight** - Whether VSP ride-tight sealing is required
   - **Inherit from parent** - Check to inherit this commodity's settings from parent
5. Click **Save**

### Managing Lining Sections

Similar to sealing, lining sections are per commodity and support inheritance:

1. Navigate to the **Lining** tab
2. Click **Add Lining Record**
3. Enter:
   - **Commodity**
   - **Lining Required** (yes/no)
   - **Lining Type** (e.g., "Epoxy", "Phenolic")
   - **Lining Inspection Interval** (e.g., "12mo", "6mo")
   - **Inherit from parent** - Check to inherit from parent level
4. Click **Save**

### Viewing Effective CCM for a Car

To see the merged/effective CCM for a specific car (with all inheritance resolved):

1. Navigate to the car's detail page
2. The "Effective CCM" section shows:
   - Final merged values for all fields
   - **Inheritance chain** showing where each field comes from (e.g., "food_grade: Customer > DuPont")
   - Per-commodity sealing and lining settings

### Using CCM Data in SOWs

CCM sections marked as "can include in SOW" will appear as checkboxes when populating a SOW from a CCM. This allows the operator to selectively include customer-specific requirements in the shop's work instructions.

---

## 12. Estimates and Approval Workflow

Estimates are submitted by the repair shop and reviewed/approved by your team.

### Estimate Submission

Estimates are created against a shopping event:

1. Open the shopping event (must be in ESTIMATE_SUBMITTED state or later).
2. Navigate to the **Estimates** section.
3. Click **Submit Estimate**.
4. Enter:
   - Submitted by (shop name/contact)
   - Line items, each with:
     - AAR code
     - Job code
     - Description of work
     - Labor hours
     - Material cost
     - Total cost
5. Click **Submit**.

Each submission is **versioned** (v1, v2, v3...). Previous versions are preserved for audit purposes. The shop can submit revised estimates if changes are required.

### Estimate Review

1. Open the estimate detail.
2. Review each line item.
3. For each line, record a decision:
   - **Approve** - Work is authorized
   - **Review** - Needs further investigation
   - **Reject** - Work is not authorized
4. Assign responsibility:
   - **Lessor** - Owner pays
   - **Customer** - Lessee pays
   - **Unknown** - To be determined
5. Provide basis for the decision:
   - CRI table reference
   - Lease clause
   - Policy reference
   - Manual reference

**All line decisions are immutable.** Once recorded, a decision cannot be edited or deleted. If a new decision is needed, a new decision record is created (the system keeps the full history).

### Approval Packets

After reviewing all estimate lines:

1. Click **Generate Approval Packet**.
2. Set the overall decision (approved, changes required, or rejected).
3. The system categorizes lines into approved, rejected, and revision-required groups.
4. Add any notes.
5. Click **Create Packet**.

### Releasing the Approval Packet

1. Open the approval packet.
2. Review the summary.
3. Click **Release to Shop**.
4. The packet is timestamped and marked as released.

---

## 13. Bad Orders

**URL:** `/bad-orders`

Bad Orders track cars that require unplanned repairs due to defects found during inspection.

### Creating a Bad Order

1. Navigate to Bad Orders.
2. Click **New Bad Order**.
3. Enter the car number, defect description, location, and severity.
4. Click **Create**.

### Managing Bad Orders

- Filter by status, car number, or shop.
- Click a bad order to view details and update status.
- Bad orders can be linked to shopping events when the car enters a shop.

---

## 14. Invoices

**URL:** `/invoices`

The Invoices module handles billing from repair shops.

### Viewing Invoices

- List view with filters for status, shop, date range, and amount.
- Click any invoice to view line-item details.
- Each invoice line references an AAR job code.

### Invoice Processing

1. Invoices are received from shops.
2. Each line item is reviewed against the approved estimate.
3. Discrepancies between estimate and invoice are flagged.
4. Approved invoice lines proceed to payment processing.

---

## 15. Budget and Forecasts

**URL:** `/budget`

### Budget Overview

- View budget allocations by category, shop, or time period.
- Compare actual spending against budgeted amounts.
- Drill down into specific budget line items.

### Budget Configuration

**URL:** `/budget?tab=configuration`

- Set budget periods and categories.
- Configure cost allocation rules.
- Define budget thresholds and alerts.

---

## 16. Analytics and Reports

### Analytics

**URL:** `/analytics`

Interactive charts and dashboards showing:
- Fleet utilization trends
- Shop performance metrics
- Cost analysis
- Turnaround time tracking

### Reports

**URL:** `/reports`

Pre-configured reports for:
- Fleet status summary
- Shop activity reports
- Financial summaries
- Compliance reports

### Audit Log

**URL:** `/audit` (Admin only)

Complete audit trail of all system changes including:
- Who made the change
- What was changed
- When it was changed
- Previous and new values

---

## 17. Planning

### Quick Shop

**URL:** `/planning`

Plan shop visits with drag-and-drop scheduling and capacity visualization.

### Monthly Load

**URL:** `/planning?tab=monthly-load`

View and manage monthly shop loading to balance capacity across the network.

### Network View

**URL:** `/planning?tab=network-view`

Geographic visualization of shop locations, car movements, and capacity distribution.

### Master Plans

**URL:** `/plans`

Long-term maintenance plans for fleet management including:
- Qualification schedules
- Preventive maintenance programs
- Fleet rotation plans

---

## 18. Admin and Settings

### User Management

**URL:** `/admin` (Admin only)

- Create new user accounts.
- Set user roles (admin, operator, viewer).
- Activate/deactivate user accounts.
- Reset user passwords.

### Settings

**URL:** `/settings`

- Profile settings (name, email, password change).
- Notification preferences.
- Display preferences (dark mode, language).

### Rules

**URL:** `/rules`

- Configure business rules for automated decision-making.
- Set up validation rules for data entry.
- Define escalation rules for approvals.

---

## 19. Keyboard Shortcuts and Tips

### General Tips

- **Dark Mode** - Toggle via the sun/moon icon in the header.
- **Search** - Most list pages have a search bar at the top. Use it to quickly find records.
- **Filters** - Combine multiple filters to narrow results. Filters persist within your session.
- **Status Pills** - On the Shopping Events page, click colored status pills to filter by that state.
- **Expandable Rows** - On Scope Library and CCM pages, click a card to expand and view details.

### Session Management

- Your session automatically refreshes in the background.
- If you see an "Authentication required" error, log in again.
- Your filter selections and page position are not saved between sessions.

---

## 20. Troubleshooting

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| "Authentication required" error | Session expired | Log in again |
| Cannot create shopping event | Car already has an active event | Cancel or complete the existing event first |
| State transition blocked | Approval gate not met | Check the warning message - usually an estimate needs to be approved first |
| Cannot edit SOW items | SOW is finalized | Create a new SOW - finalized SOWs are locked |
| Page shows "No data" | Filters too restrictive | Clear filters and try again |
| 500 error on any page | Server-side error | Check with your IT team; the error is logged on the server |

### Getting Help

- Contact your system administrator for access issues.
- Report bugs or feature requests through your organization's IT ticketing system.
- For technical support, refer to the IT Technical Assessment document for system architecture details.

---

## Appendix A: Shopping Event State Reference

| State | Description | Who Acts |
|-------|-------------|----------|
| REQUESTED | Car identified for shopping | Planner |
| ASSIGNED_TO_SHOP | Shop selected and notified | Planner |
| INBOUND | Car is in transit to shop | Logistics |
| INSPECTION | Shop is inspecting the car | Shop |
| ESTIMATE_SUBMITTED | Shop has submitted repair estimate | Shop |
| ESTIMATE_UNDER_REVIEW | Estimate is being reviewed | Evaluator |
| ESTIMATE_APPROVED | Estimate has been approved | Evaluator |
| CHANGES_REQUIRED | Estimate needs revision (loops back to ESTIMATE_SUBMITTED) | Evaluator |
| WORK_AUTHORIZED | Repairs are authorized to begin | Manager |
| IN_REPAIR | Shop is performing repairs | Shop |
| QA_COMPLETE | Quality assurance inspection passed | Shop / QA |
| FINAL_ESTIMATE_SUBMITTED | Final cost estimate submitted | Shop |
| FINAL_ESTIMATE_APPROVED | Final estimate approved | Evaluator |
| READY_FOR_RELEASE | Car is ready to leave the shop | Shop |
| RELEASED | Car has left the shop | Logistics |
| CANCELLED | Event cancelled (terminal state) | Any authorized user |

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **AAR** | Association of American Railroads - industry standards body |
| **Bad Order** | A railcar that requires unplanned repair due to defects |
| **Batch** | A group of cars shopped together at the same shop |
| **CCM** | Customer Care Manual - lessee-specific maintenance requirements |
| **CRI** | Component Responsibility Index - determines who pays for repairs |
| **Estimate** | Shop's proposed cost and scope for repairs |
| **Job Code** | AAR or internal code identifying a specific type of repair work |
| **Lessee** | Customer who leases the railcar |
| **Lessor** | Owner of the railcar (your organization) |
| **MFiles** | External document management system |
| **Pipeline** | Queue of cars awaiting or undergoing repair |
| **Qualification** | Periodic inspection required for continued service |
| **Shopping Event** | A single car's visit to a repair shop |
| **SOW** | Scope of Work - specific repair instructions sent to a shop |
| **State Machine** | The ordered sequence of states a shopping event passes through |

---

*This document should be updated whenever new features are added to RailSync. Last verified against system version c6f9e43.*
