# RailSync - How To Guide

**Document Version:** 1.0
**Last Updated:** February 3, 2026
**Applicable System Version:** Commit c6f9e43 (Main branch)

> This document is a living guide. It should be updated as new features are added or existing features are modified.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Navigation](#2-navigation)
3. [User Roles and Permissions](#3-user-roles-and-permissions)
4. [Dashboard](#4-dashboard)
5. [Fleet Management](#5-fleet-management)
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

RailSync uses a top navigation bar with dropdown menus organized by function.

### Desktop Navigation

| Menu | Items |
|------|-------|
| **Assets** | Fleet, Cars, Projects |
| **Maintenance** | Pipeline, Active Pipeline, Shopping Events, Bad Orders, Quick Shop, Monthly Load, Network, Shop Finder, Master Plans |
| **Financial** | Invoices, Budget & Forecasts, Budget Config, Analytics |
| **Standards** | SOW Library, Care Manuals |
| **Compliance** | Rules, Reports, Audit Log (admin only), Admin (admin only) |

### Mobile Navigation

On mobile devices, tap the hamburger menu icon to access the same navigation sections in a slide-out menu.

### Dark Mode

RailSync supports dark mode. Toggle it via the sun/moon icon in the top navigation bar. Your preference is saved locally.

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

## 5. Fleet Management

### Fleet Overview

**URL:** `/fleet`

The Fleet page displays your entire railcar fleet with filtering and search capabilities.

**Available Filters:**
- Car type (tank, hopper, gondola, boxcar, etc.)
- Status (in service, bad order, in shop, etc.)
- Customer/lessee
- Shop location

**Actions:**
- Click any car row to view car details
- Use the search bar to find a specific car by car number
- Export fleet data (if available)

### Car Details

**URL:** `/cars`

The Cars page provides detailed information for individual railcars including:

- Car specifications (type, capacity, build date, etc.)
- Current status and location
- Assignment history
- Shopping history (all prior shop visits with SOW links)
- Associated invoices

---

## 6. Shop Management

### Shop Finder

**URL:** `/shops`

The Shop Finder helps locate repair shops based on:

- Geographic location (if geo filtering is enabled)
- Shop capabilities and designations
- Current capacity and utilization
- AAR certifications

**Actions:**
- Search shops by name or code
- Filter by capability or geographic region
- View shop details including capacity information

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

Customer Care Manuals document the specific requirements and preferences of each lessee (customer) for how their railcars should be maintained. The CCM form structure mirrors the AITX Customer Care Manual Form V5.

### Viewing CCM Forms

- The CCM page lists all care manual forms.
- Click on a form to expand and view its details.
- Forms are organized by sections: Company Info, Contacts, Sealing, Cleaning, Lining, Disposition, Special Fittings.

### Creating a CCM Form

1. Click **New CCM Form**.
2. Fill in the required fields:
   - **Company Name** - The lessee's company name
   - **Lessee Code** - Short code identifying the lessee (required)
   - **Lessee Name** - Full lessee name
3. Set optional fields:
   - Food grade requirements (yes/no)
   - Nitrogen application requirements (yes/no, PSI if yes)
   - Mineral wipe, kosher wash/wipe requirements
4. Click **Create**.

### Managing Sealing Sections

Each CCM form can have multiple sealing sections (one per commodity):

1. Expand the CCM form.
2. Navigate to the **Sealing** section.
3. Click **Add Sealing Record**.
4. Enter:
   - **Commodity** - What product the car carries (e.g., "Ethanol")
   - **Gasket Sealing Material** - Required gasket material (e.g., "Teflon")
   - **Preferred Gasket Vendor** - Primary vendor
   - **Alternate Gasket Vendor** - Backup vendor
   - **VSP Ride Tight** - Whether VSP ride-tight sealing is required
5. Click **Save**.

### Managing Lining Sections

Similar to sealing, lining sections are per commodity:

1. Navigate to the **Lining** section.
2. Click **Add Lining Record**.
3. Enter:
   - **Commodity**
   - **Lining Required** (yes/no)
   - **Lining Type** (e.g., "Epoxy", "Phenolic")
   - **Lining Inspection Interval** (e.g., "12mo", "6mo")
4. Click **Save**.

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
