# Railsync Tasks

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

---

## Phase 2 — Hardening (Complete)

1. [x] Add backend unit tests for rules engine
2. [x] Add API validation (Zod) with user-friendly errors
3. [x] Add frontend error boundary + loading states
4. [x] Add seed data coverage for edge commodities/capabilities
5. [x] Reduce ESLint warnings to zero

---

## Phase 3 — Excel Parity (UI-First)

### Phase 3 — UI Now (Top 5)

> **Rule:** UI comes first.  
> Backend work is allowed **only** to support UI contracts (mock or minimal).

1. [x] **Car Input Form Redesign**
   - Quick Mode vs Advanced Mode toggle
   - Sectioned layout (Identity, Attributes, Commodity, Lining, Compliance, Special)
   - Field help tooltips
   - Overrides panel (collapsible)
   - Persist mode preference in localStorage

2. [x] **Results Grid Redesign**
   - Default view: 8 key columns
   - Expandable column groups (Cost, Capacity, Hours by Type)
   - Column visibility toggles
   - Sortable headers with indicators
   - Horizontal scroll support

3. [x] **"Why This Shop" UI Enhancement**
   - Grouped rule display (Car Type, Material, Lining, Blast, Compliance, Special)
   - Pass / Fail / N/A indicators with color coding
   - Rule reason text
   - Highlight failed rules for disqualified shops

4. [x] **Shop Detail Drawer**
   - Right-side drawer (not modal)
   - Cost breakdown card
   - Capacity metrics card
   - Hours-by-work-type visualization
   - Rules evaluation list (25-rule grouped view)

5. [x] **Comparison Mode (UI)**
   - Pin up to 3 shops
   - Side-by-side comparison view
   - Highlight differences in cost, capacity, rule results
   - “Select This Shop” action

---

### Phase 3 — Backend (Deferred)

Backend work during Phase 3 should:
- Be **additive only**
- Support UI contracts
- Use mock or placeholder values when needed
- Avoid full Excel-parity logic until UI is locked

---

## Phase 4 — Backend Excel Parity

1. [x] **Eligibility rules expansion (25 rules)**
   - Added 9 new rules: RULE_MATERIAL_03, RULE_LINING_05, RULE_CERT_02, RULE_CERT_03, RULE_SERVICE_04, RULE_CAPACITY_02, RULE_NETWORK_02, RULE_COMMODITY_02, RULE_NITROGEN_02
   - Covers: carbon steel, epoxy lining, AAR/DOT certifications, mechanical service, en-route capacity, railroad access, RC1 commodity restriction
   - Added computed field support (cars_en_route_total)
   - 22 unit tests for rules engine

2. [ ] Shop capabilities schema (58 columns)
3. [ ] Cost calculation engine
4. [ ] Commodity restriction matrix
5. [ ] Full /evaluate response schema

---

## Phase 5 — Operational & Lookup Integration (Later)

- Shop backlog feeds
- En-route car feeds
- Weekly throughput
- Car lookup integration

---

## Later

- Auth
- Audit logs
- Admin rules editor UI
- Freight/routing calculation
- ML work hours model
- Dark mode
- Mobile responsive layout
- Export to CSV / Excel
