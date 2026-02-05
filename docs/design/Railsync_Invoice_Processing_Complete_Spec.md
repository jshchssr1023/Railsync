
# Railsync — Invoice Processing Module
## Complete Developer Specification (SSOT)

Version: 1.0  
Status: Build‑Ready  
Scope: Shop Invoices + MRU (Mobile Repair Unit) Invoices

---

## 1. Purpose

Railsync shall act as a deterministic enforcement engine for all invoice processing.
If the SOP stops work, Railsync must stop work.

---

## 2. Invoice Types

enum InvoiceType:
- SHOP
- MRU

Rules:
- MRU invoices default to MRU rules
- If an MRU Shopping exists in FMS, treat as SHOP

---

## 3. Core Data Model

### InvoiceCase
- id
- invoiceType
- status
- assignedAdminId
- vendorName
- shopId
- invoiceNumber
- invoiceDate
- currency
- totalAmount
- carMarks[]
- lessee
- specialLesseeApprovalConfirmed (bool)
- fmsShoppingId
- fmsWorkflowId
- receivedAt

### Attachment
- id
- invoiceCaseId
- type (PDF, TXT, SUPPORT)
- filenameOriginal
- filenameCanonical
- hash

Rules:
- PDF + TXT required
- BRC files ignored
- Filenames normalized to invoice number

### AuditEvent (immutable)
- timestamp
- actor
- action
- beforeState
- afterState
- notes

---

## 4. Workflow States

RECEIVED  
ASSIGNED  
WAITING_ON_SHOPPING  
WAITING_ON_CUSTOMER_APPROVAL  
READY_FOR_IMPORT  
IMPORTED  
ADMIN_REVIEW  
SUBMITTED  
APPROVER_REVIEW  
APPROVED  
BILLING_REVIEW  
BILLING_APPROVED  
SAP_STAGED  
SAP_POSTED  
PAID  
CLOSED  
BLOCKED  

---

## 5. Validation Engine Contract

validateInvoice(caseId, targetStatus) →
- blockingErrors[]
- warnings[]
- owningRoleByError
- fixPath
- canTransition

No BLOCK may be overridden.

---

## 6. Validation Rules Matrix (Summary)

### Files
- Missing PDF → BLOCK (Admin)
- Missing TXT → BLOCK (Admin)
- BRC present → IGNORE

### Special Lessees (Overrides All)
- ExxonMobil, Imperial Oil, Marathon → BLOCK until Maintenance confirms approval

### SHOP
- Shopping must exist
- Final Docs must be approved
- Allowed mismatch only:
  - Invoice < Estimate (CB unchanged)
  - Invoice > Estimate ≤ $100 (CB unchanged)
- Responsibility normalization:
  - 7,4,0,W → 1
  - 8 ≡ 9
- Financial Manual out of sync → BLOCK (Maintenance Manager)

### MRU
- Multi‑car allowed
- Parent location required if site missing
- ≤ $1500 → auto RSPD = 1
- ≥ $1501 → Maintenance review required
- Multi‑page with repeated car → merge required

### Car Remarking
- Car not found → BLOCK until prior stencil resolved

### Month End
- Past entry cutoff → BLOCK
- Past approval cutoff → BLOCK

---

## 7. Validator Pseudocode (Authoritative)

[See embedded pseudocode section — unchanged from prior delivery]

---

## 8. Test Case Matrix (QA)

Covers:
- File handling
- Special lessee holds
- SHOP gating
- Estimate mismatch tolerances
- Responsibility normalization
- MRU thresholds
- Multi‑page merge logic
- State transition enforcement
- Month‑end locks

(Full Given / When / Then matrix embedded from prior delivery)

---

## 9. Architecture

Railsync is the SSOT and enforcement layer.

Flow:
Outlook → Railsync → FMS → Billing → SAP/AP → Paid

Railsync:
- Owns validation, state, audit
- Reads/writes FMS where possible
- Reads SAP/AP for status + payment confirmation

---

## 10. Definition of Done

- All rules enforced
- No BLOCK bypass
- Full audit trail
- Unit tests per rule
- MRU + SHOP isolation

---

## Final Constraint

Railsync is not advisory.
It is authoritative.
