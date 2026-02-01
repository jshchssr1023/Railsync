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
## Phase 12: Fleet Visibility & Budget Tracking Dashboard
**Version:** 2.4 | **Updated:** February 01, 2026  
**Objective:** Provide complete fleet visibility (in-shop, planned, scheduled/enroute, disposition) with budget vs actual tracking. Replicate high-level dashboard style: metric cards, monthly volume bars (plan vs actual), tier pies. Dashboard opens via **single persistent floating icon** (bottom-right) — one click reveals everything in an overlay modal. Uses shadcn/ui for polished UI + Recharts for charts + SWR for real data fetching. Builds directly on Phase 11 allocations & capacity tables.

**Prerequisites (Run Once – before implementing):**
- shadcn/ui initialized: `npx shadcn@latest init` (if not already done)
- Install dependencies:
  ```bash
  npm install swr recharts lucide-react framer-motion
  npx shadcn@latest add card button select badge skeleton

Ensure Phase 11 tables (allocations, shop_monthly_capacity) exist and contain sample data with varied statuses.

Token Discipline: One numbered sub-task per AI session. Read existing files first. Zero lint errors. Small commits.
Phase 12 Guardrails (repeat in prompts):

Reuse shadcn/ui Card, Button, Select, Badge, Skeleton patterns.
Use Recharts for bar + pie charts.
Floating icon + overlay uses Lucide + framer-motion.
Prefer raw SQL views for aggregates.
Commit format: "feat(dashboard): add fleet visibility cards + real data fetching"

12.1 – Schema & View Extensions for Visibility (1–2 Sessions)
Extend allocations for detailed status tracking + budget integration.

Migration file: database/migrations/003_fleet_visibility.sqlSQL-- Extend allocations
ALTER TABLE allocations
    ADD COLUMN IF NOT EXISTS current_status VARCHAR(20) DEFAULT 'planned'
        CHECK (current_status IN ('planned','scheduled','enroute','in_shop','dispo','completed')),
    ADD COLUMN IF NOT EXISTS enroute_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispo_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(10,2) DEFAULT 0.00;

-- Budget table (running repairs – monthly pool)
CREATE TABLE IF NOT EXISTS running_repairs_budget (
    month DATE PRIMARY KEY,
    active_cars INT NOT NULL DEFAULT 0,
    budget_per_car DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_budget DECIMAL(10,2) GENERATED ALWAYS AS (active_cars * budget_per_car) STORED,
    actual_spend DECIMAL(10,2) DEFAULT 0.00
);

-- Aggregation views
CREATE OR REPLACE VIEW v_fleet_summary AS
SELECT
    COUNT(*) FILTER (WHERE current_status = 'in_shop') AS in_shop_count,
    COUNT(*) FILTER (WHERE current_status IN ('planned','proposed')) AS planned_count,
    COUNT(*) FILTER (WHERE current_status = 'enroute') AS enroute_count,
    COUNT(*) FILTER (WHERE current_status = 'dispo') AS dispo_count,
    COUNT(*) FILTER (WHERE current_status = 'scheduled') AS scheduled_count,
    COUNT(*) AS total_fleet
FROM allocations;

CREATE OR REPLACE VIEW v_monthly_volumes AS
SELECT
    a.month,
    COUNT(*) FILTER (WHERE current_status = 'in_shop') AS in_shop,
    COUNT(*) FILTER (WHERE current_status = 'planned') AS planned,
    COUNT(*) FILTER (WHERE current_status = 'scheduled') AS scheduled,
    rb.total_budget AS budget_volume,
    SUM(a.actual_cost) AS actual_spend
FROM allocations a
LEFT JOIN running_repairs_budget rb ON a.month = rb.month
GROUP BY a.month, rb.total_budget
ORDER BY a.month;Test: SELECT * FROM v_fleet_summary; and SELECT * FROM v_monthly_volumes WHERE month LIKE '2026%';

12.2 – Backend Endpoints (2 Sessions)
Add to existing routes or create routes/fleet.ts
TypeScript// Example in routes/fleet.ts or index.ts
router.get('/api/fleet/metrics', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM v_fleet_summary LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

router.get('/api/fleet/monthly-volumes', async (req, res) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  try {
    const result = await db.query(
      'SELECT * FROM v_monthly_volumes WHERE EXTRACT(YEAR FROM month) = $1 ORDER BY month',
      [year]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch volumes' });
  }
});
12.3 – Frontend Dashboard with shadcn/ui + Real Data Fetching + Single Floating Icon (4–6 Sessions)

Dashboard Wrapper – components/DashboardWrapper.tsxtsx"use client";

import { useState } from "react";
import { LayoutDashboard, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-all duration-300"
        aria-label={isOpen ? "Close TQ Dashboard" : "Open TQ Dashboard"}
      >
        {isOpen ? <X size={32} /> : <LayoutDashboard size={32} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-4 md:inset-8 overflow-hidden rounded-2xl border bg-background shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <h1 className="text-2xl font-bold tracking-tight">TQ Plan Performance</h1>
                  <button onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-muted">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">{children}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
Dashboard Page – app/dashboard/page.tsxtsx"use client";

import useSWR from "swr";
import { DashboardWrapper } from "@/components/DashboardWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Fetch failed");
  return res.json();
});

const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

export default function TQDashboardPage() {
  const { data: metrics, error: metricsError, isLoading: metricsLoading } = useSWR(
    "/api/fleet/metrics",
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: monthlyVolumes, error: volumesError, isLoading: volumesLoading } = useSWR(
    "/api/fleet/monthly-volumes?year=2026",
    fetcher,
    { refreshInterval: 60000 }
  );

  // Derive tier data from metrics or separate endpoint in future
  const tierData = [
    { name: "Tier 1", value: metrics?.in_shop_tier1 || 425 },
    { name: "Tier 2", value: metrics?.in_shop_tier2 || 190 },
    { name: "Tier 3", value: metrics?.in_shop_tier3 || 352 },
  ];

  if (metricsError || volumesError) {
    return (
      <DashboardWrapper>
        <div className="flex flex-col items-center justify-center h-full text-destructive">
          <AlertCircle className="h-12 w-12 mb-4" />
          <h2 className="text-xl font-semibold">Failed to load data</h2>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper>
      <div className="space-y-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <Select defaultValue="all">
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Tier / Shop Network" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="tier1">Tier 1</SelectItem>
              <SelectItem value="tier2">Tier 2</SelectItem>
              <SelectItem value="tier3">Tier 3</SelectItem>
            </SelectContent>
          </Select>
          {/* Add car type select similarly */}
          <Badge variant="outline" className="ml-auto">
            Updated: {new Date().toLocaleTimeString()}
          </Badge>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          {metricsLoading ? Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          )) : (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total TQ Planned</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{metrics?.total_planned?.toLocaleString() ?? "—"}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Planned Volume</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{metrics?.planned_volume?.toLocaleString() ?? "—"}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">TQ Cars In Shop</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{metrics?.in_shop_count ?? "—"}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cars Enroute</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{metrics?.enroute_count ?? "—"}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cars in Dispo</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{metrics?.dispo_count ?? "—"}</div></CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader><CardTitle>2026 Arrivals Volume by Month</CardTitle></CardHeader>
            <CardContent className="h-80">
              {volumesLoading ? <Skeleton className="h-full rounded-xl" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyVolumes || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="month" tickFormatter={v => v.split('-')[1]} />
                    <YAxis />
                    <Tooltip formatter={v => `${v} cars`} />
                    <Bar dataKey="planned" fill="#3b82f6" name="Plan" radius={[4,4,0,0]} />
                    <Bar dataKey="in_shop" fill="#10b981" name="Actual" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>TQ Cars In Shop by Tier</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    dataKey="value"
                    label={({name, percent}) => `${name} ${(percent*100).toFixed(1)}%`}
                  >
                    {tierData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index]} />)}
                  </Pie>
                  <Tooltip formatter={v => `${v} cars`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardWrapper>
  );
}

Next Steps – Important Follow-On Tasks (Prioritized)

Immediate (1–2 days after 12.3)
Add error boundaries + retry button on fetch failure.
Make filters functional: pass ?tier=1 to endpoints → update backend queries.
Add variance indicators (e.g., red badge if actual_spend > total_budget).

Short-Term (1 week)
Add "Shipment Volume by Month" bar chart (similar to arrivals).
Add "Planned Volume by Tier" pie chart.
Implement CSV export button (use papaparse or native Blob).

Medium-Term (2–4 weeks)
Dynamic tier/car-type options from API (new endpoint /api/filters/options).
Add refresh button + last-updated timestamp with real server time.
Mobile optimizations: ensure modal is full-screen, charts responsive.

Longer-Term Polish
Auth protection: only show icon / dashboard to logged-in users.
Dark mode consistency (shadcn handles most of this).
Performance: add debounce to filter changes if needed.
Testing: add simple Cypress test for open/close + data load.

Documentation & Cleanup
Update README: add screenshot of dashboard + "Click bottom-right icon to open TQ Dashboard".
Lint + build clean pass.
Commit all as "feat(phase-12): full fleet dashboard with real data + floating icon access".
