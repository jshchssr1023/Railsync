# Railph Loop — Build Verification Prompt (Claude)

## Role
You are a **Senior Staff Software Engineer & Quality Gatekeeper**.

Your responsibility is to **verify**, not extend, the existing system.  
You must assume the build *claims* to be complete — your job is to **prove or disprove that claim**.

You will operate using the **Railph Loop**, executed rigorously and in order.

---

## The Railph Loop (MANDATORY)

You MUST complete **all six phases** before concluding.

---

### 1️⃣ READ (No Writing)
- Read **all provided artifacts**:
  - Source code
  - Tests
  - Database migrations
  - API routes
  - Frontend components
  - Documentation, TODOs, comments
- Do **not** propose changes yet
- Build a complete mental model of:
  - System intent
  - Data flow
  - State ownership
  - Failure paths

**Output:**
- High-level architecture summary  
- Component responsibility map  

---

### 2️⃣ EXPECTATION LOCK
Infer the **intended scope** of the build using:
- Commit history
- PR descriptions
- Feature names
- TODOs
- UI affordances
- API contracts

Explicitly define:
- What the system claims to do
- What “done” means for this build

**Output:**
- ✅ Intended Features List  
- ❌ Out-of-Scope / Explicitly Excluded Items  

---

### 3️⃣ VERIFY IMPLEMENTATION
For **each intended feature**, verify:

- Logic correctness
- Edge case handling
- Error handling
- Input validation
- State consistency
- Idempotency
- Determinism

Flag:
- Partial implementations
- Silent failures
- Hidden coupling
- Assumptions without safeguards

**Output (Table):**

| Feature | Status (Pass / Fail / Partial) | Evidence | Risk Level |
|-------|-------------------------------|----------|------------|

---

### 4️⃣ VERIFY TESTING
For each feature and critical path, confirm:

- Unit tests exist
- Edge cases are covered
- Failure modes are tested
- Tests assert **behavior**, not implementation
- Tests fail when logic breaks

Explicitly identify:
- Untested logic
- Weak or false-positive tests
- Gaps between production logic and test logic

**Output:**
- Test Coverage Map  
- Missing / Weak Tests List  

---

### 5️⃣ SYSTEM-LEVEL FAILURE REVIEW
Evaluate system robustness against:

- Invalid or malformed input
- Missing or partial data
- Concurrency or race conditions
- Partial writes or transaction issues
- API misuse
- Frontend / backend contract mismatches
- “Looks fine but breaks in production” scenarios

**Output:**
- 🔴 Critical Risks  
- 🟠 Medium Risks  
- 🟢 Acceptable Risks  

---

### 6️⃣ VERDICT & NEXT ACTIONS
You must issue a **binary verdict**:

> **READY FOR MERGE**  
> **NOT READY**

If **NOT READY**, provide:
- Exact gaps
- Why each gap matters
- Minimum work required to reach “Ready”

No vague advice.  
No refactors unless required for correctness or safety.

**Output:**
- Final Verdict  
- Required Fixes Checklist (ordered, minimal)  

---

## Hard Rules
- ❌ Do NOT write new code unless explicitly instructed
- ❌ Do NOT refactor for style or cleanliness
- ❌ Do NOT assume missing elements are acceptable
- ❌ If something is unclear, treat it as a risk
- ✅ Precision over politeness
- ❌ Silence equals failure — every feature must be evaluated

---

## Start Condition
Begin immediately once code or artifacts are provided.  
Do **not** ask clarifying questions unless a missing artifact blocks verification.# Railsync Development Tasks – Clean-Slate v2 (GitHub: jshchssr1023/Railsync)
**Version:** 2.2 | **Updated:** February 01, 2026  
**Repo Status:** Fresh monorepo initialized Jan 31, 2026 • Core shop selection foundation complete • MIT licensed • 0 stars/forks • Recent PR: claude/web-architecture-design  
**Current Focus:** Stabilize tactical Quick Shop flow → progressively add capacity-aware planning & confirmed/planned separation

## Development Guardrails

| Rule                        | Description                                                                 |
|-----------------------------|-----------------------------------------------------------------------------|
| Read before write           | Always study existing code/comments before modifying                        |
| Small, atomic commits       | One logical change per commit (~200–500 LOC max)                            |
| Compile & lint first        | Run `npm run build` + `npm run lint` after every change                     |
| Test incrementally          | Verify new behavior works **before** starting next task                     |
| Reuse existing code         | Search for matching services/utils/types/hooks before creating new ones     |
| Zero hanging artifacts      | No `TODO:`, `FIXME:`, `// @ts-ignore`, loose `any` — resolve or issue       |

### Core Validation Commands (run after every non-trivial change)

```bash
# Backend
cd backend
npm run build          # Must succeed – 0 TS errors
npm run lint           # Must be clean (0 errors/warnings)
npm test               # ≥ current passing count (add more over time)

# Frontend
cd frontend
npm run build          # Next.js production build must succeed
npm run lint           # 0 errors (strict + typescript-eslint)
npm run typecheck      # tsc --noEmit must pass
Current Status – Completed Foundation (as of Feb 1, 2026)

You are implementing Phase 11 of Railsync (repo: https://github.com/jshchssr1023/Railsync).

Current task: [paste ONE numbered sub-task, e.g. 11.2.1]

Rules:
- Read ALL existing related files first (list which ones you considered)
- Make minimal changes — reuse services/controllers/patterns
- Add only what's needed for this task
- After code: show git diff summary (files changed + key lines)
- End with: "How to test this manually? What happens if I do X?"
- Commit message suggestion: "..."

Implement now.
Complete Phase 10 tasks Phase 10: Capacity-Aware Unification & Production Polish
Goal: Make Quick Shop production-ready with real capacity impact → lay foundation for monthly planning / confirmed-vs-planned logic.

10.1 – Baseline Hygiene & Verification (1–2 hours)
#TaskAcceptance Criteria / Test10.1.1Run full stack locally (docker-compose up -d or manual)Frontend loads @ localhost:3000, backend @ 3001, DB connected10.1.2Apply schema.sql + seed.sql → test car lookup & evaluate endpointsGET /api/cars/valid-number returns data
POST /api/shops/evaluate returns ranked shops10.1.3Lint + build both sides → fix all warnings/errors immediatelylint:all and build:all clean (add root scripts if missing)10.1.4Add root package.json convenience scripts"dev:backend", "dev:frontend", "build:all", "lint:all"10.1.5Add .github/workflows/ci.yml (Node.js lint/build/test on push/PR)CI passes on next push
Commit message example: chore: baseline hygiene + CI setup + zero lint warnings

10.2 – Quick Shop Enhancements – Confirm vs Plan (2–4 days)
#TaskAcceptance Criteria / Test10.2.1Add migration: create allocations table (minimal: car_id, shop_code, status ['confirmed','planned','proposed'], month, created_at, version)Migration runs, table exists10.2.2Add migration: create shop_monthly_capacity (shop_code, month [YYYY-MM], confirmed_railcars, planned_railcars, limit, version)Table exists + unique(shop_code, month)10.2.3After "Select This Shop" in UI → show modal: Confirm (customer agreed) vs Plan / HoldConfirm → POST to new endpoint → increments confirmed_railcars
Plan → increments planned_railcars10.2.4Add 3-month capacity preview columns in results gridAvail Next Mo, % Util Next Mo (green <75%, yellow 75–95%, red >95%), At Risk icon10.2.5Implement optimistic locking (version check) on capacity updatesConcurrent confirms → conflict error toast + retry prompt

Commit examples:
feat(allocations): add initial allocations & shop_monthly_capacity tables
feat(quick-shop): add Confirm vs Plan modal with capacity deduction

10.3 – Capacity Engine Reliability (2–4 days)
#TaskAcceptance Criteria / Test10.3.1Use transactions for confirm/plan operationsPartial failure → rollback (no partial deduct)10.3.2Add basic overcommit allowance (hardcode 10% for now)Confirm beyond limit → warning + admin override flag10.3.3Implement calculated fields (remaining = limit - confirmed)Via view or service method – always fresh10.3.4Add endpoint GET /api/shops/:shopCode/capacity?months=3Returns next 3 months with confirmed/planned/remaining
10.4 – Alerts & Qualification Basics (3–5 days, parallelizable)
#TaskAcceptance Criteria / Test10.4.1Add node-cron job: daily qual-due scan (cars with exp in 30/60/90d)Creates proposed allocations in eligible Tier-1 shops10.4.2Add simple in-app alerts (toast/banner component)Shows qual due soon, shop >95% util, demurrage risk (in-transit timer)10.4.3Add "Shop This Car Now" button on car master / search resultsPre-fills Quick Shop form
10.5 – Final Polish & Zero-Friction Checklist

 Entire codebase: 0 lint errors/warnings, strict TS, no any / @ts-ignore (or justified)
 Full flow test: Lookup car → evaluate → select shop → Confirm → refresh capacity shows deduction
 Mobile: Quick Shop form + results usable on phone
 Error handling: All API failures → friendly toast + console debug
 Update README: Add Phase 10 features, new endpoints, capacity notes

"Phase 11 – Bring It To Life.md").
Each sub-phase is sized for 1–3 focused AI sessions (≈5–15k tokens total per phase).
Markdown# Railsync – Phase 11: Bring It To Life (Capacity-Aware Planning Foundation)
**Version:** 2.3 | **Updated:** February 01, 2026  
**Objective:** Turn tactical shop-selection tool → real planning system with confirmed/planned assignments + visible capacity impact.  
**Token Discipline Rules for AI Implementation:**
- One numbered task per prompt/session (max 2–3 related subtasks)
- Always: "Read existing code first → show diff summary after each change"
- Enforce: zero lint errors, strict TS, small commits
- After each task: "How to manually test this? What endpoint/UI change occurred?"
- Never implement more than one major table/endpoint/UI screen per session

## Phase 11 Guardrails (repeat in every prompt)
- Prefer existing patterns (controllers/services/types/lib)
- Add Prisma **only** if you decide to migrate from raw SQL — otherwise stay SQL
- Use transactions for any capacity-modifying writes
- No magic numbers — prefer constants / config
- Every new endpoint → OpenAPI comment block (for future Swagger)
- Commit message format: "feat/allocations: add confirmed/planned status + deduction logic"

## 11.1 – Minimal Schema Additions (1–2 sessions)

Goal: Add just enough tables to support "I assigned this car → capacity changes"

Tables to add (via new migration file: database/migrations/001_capacity.sql or ALTER in schema.sql)

1. **allocations** (core assignment record)
   ```sql
   CREATE TABLE allocations (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       car_id UUID NOT NULL REFERENCES cars(id),
       shop_code VARCHAR(10) NOT NULL REFERENCES shops(code),
       month DATE NOT NULL,                    -- first-of-month e.g. '2026-02-01'
       status VARCHAR(20) NOT NULL             -- 'proposed' | 'planned' | 'confirmed' | 'completed' | 'cancelled'
           CHECK (status IN ('proposed','planned','confirmed','completed','cancelled')),
       work_type VARCHAR(20),                  -- 'QUAL' | 'ASSIGN' | 'RELEASE' | 'BAD_ORDER' etc.
       estimated_days INT DEFAULT 0,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW(),
       created_by UUID,                        -- reference to users if auth exists
       version INT DEFAULT 0                   -- for optimistic locking
   );
   CREATE INDEX idx_allocations_car_month ON allocations(car_id, month);
   CREATE INDEX idx_allocations_shop_month ON allocations(shop_code, month);

shop_monthly_capacity (per-shop per-month bucket)SQLCREATE TABLE shop_monthly_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(code),
    month DATE NOT NULL,                    -- '2026-02-01'
    capacity_limit INT NOT NULL DEFAULT 0,
    confirmed_count INT NOT NULL DEFAULT 0,
    planned_count INT NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    version INT DEFAULT 0,
    UNIQUE(shop_code, month)
);
-- Optional generated columns (PostgreSQL 12+)
ALTER TABLE shop_monthly_capacity
    ADD COLUMN remaining_count INT GENERATED ALWAYS AS (capacity_limit - confirmed_count) STORED;

Migration steps to implement:

Create new file in migrations/
Run psql -f it
Update seed.sql with 2–3 example months + shops
Test: insert manual row → query shows correct remaining

11.2 – Backend Integration: Assignment Endpoints & Logic (2–4 sessions)

New service: services/assignment.service.ts
createAssignment(data: {carId, shopCode, month, status, workType?})
Use transaction:
Insert allocation
If status === 'confirmed' → increment shop_monthly_capacity.confirmed_count
If 'planned' → increment planned_count
Optimistic lock: WHERE version = oldVersion THEN UPDATE ... RETURNING *


New controller/routes:TypeScriptPOST /api/allocations               → create (body: carNumber, shopCode, month, confirm: boolean)
GET  /api/allocations?carId=...     → list for car
GET  /api/shops/:shopCode/capacity?months=3 → next N months with counts/remaining
Update existing /api/shops/evaluate response:
Add per-shop: nextThreeMonths: [{month, remaining, utilizationPercent, isAtRisk}]


11.3 – Frontend: Confirm / Plan Choice + Capacity Preview (3–5 sessions)

In Results grid (where shops are ranked):
Add columns: "Feb Avail", "Mar Avail", "% Util Feb" (color-coded)
Use new GET /api/shops/:shopCode/capacity endpoint

After "Select This Shop" button:
Modal:
"Confirm Assignment" (customer agreed → deducts confirmed)
"Plan / Hold Space" (visibility only → planned count)
Optional: work type dropdown + estimated days

On submit → POST /api/allocations → refresh results + show success toast

Add simple "My Assignments" page/tab
List allocations for current user/fleet
Filter by month / status


11.4 – Qualification Alert Basics (2 sessions – parallel)

Add node-cron job (backend/src/jobs/qual-due.job.ts)
Daily: SELECT cars WHERE qual_date BETWEEN NOW() AND NOW() + 90
For each → find eligible Tier-1 shops with remaining > 0
Insert allocation with status='proposed'

Simple frontend alert component (global banner/toast queue)
Show "3 cars need quals in <30 days" → link to list


11.5 – Polish & Acceptance Checklist (final 1–2 sessions)

 Zero lint / type errors
 Full flow: lookup car → evaluate → select shop → Confirm → see capacity drop in preview
 Concurrent test: two tabs confirm same month → one fails with conflict message
 README update: add new endpoints, screenshots of modal + capacity columns
 Seed 5 cars + 3 shops + 2 months capacity → demo works out-of-box

AreaStatusKey Deliverables / NotesArchitectureCompleteThree-tier: Next.js frontend ↔ Express backend ↔ PostgreSQLCar LookupCompleteGET /api/cars/:carNumber → attributes + active service eventShop EvaluationCompletePOST /api/shops/evaluate → ranked eligible shops with costs (40+ criteria)Rules EngineCompleteJSON-based, DB-stored (eligibility_rules table), configurable via APIResults UICompleteGrid with expand/collapse, cost breakdown, backlog/capacity metrics hintsOverridesCompletePaint, lining, blast, kosher, network preferenceDocker + SetupCompletedocker-compose.yml, .env.example, schema.sql + seed.sqlCapacity/BacklogPartialMentioned in README (backlog endpoint, capacity by work type) – tables not yet visible

Repo Notes:
All major files created/committed Jan 31, 2026 via single PR ("claude/web-architecture-desig…")
No Prisma ORM yet → using raw SQL migrations
No evidence of allocations, shop_monthly_capacity, demands, scenarios, or BRC parser → Phase 9 not yet ported here
Capacity is referenced in features ("capacity by work type", backlog metrics) but likely placeholder

