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
## Phase 13: CSV-Inspired Status Automation + Pipeline View + Direct Shopping Deep-Link + Simpsons Easter Egg
**Version:** 2.6 | **Updated:** February 01, 2026  
**Objective:** Automate car status transitions & date rollovers based on CSV-derived business rules (seed only). Replace static Car Lookup with Pipeline View dashboard that buckets cars by lifecycle stage. Add "Shop Car" deep-link to pre-fill Direct Input form. Bonus Ralph Wiggum chaos: when the dashboard opens, it plays a short Simpsons theme clip (toggleable, off by default).  
**Future State Assumption:** Daily car file sync updates `allocations` table (current_status, last_shopping_date, etc.). CSV used only for initial seed & rule discovery — no ongoing CSV parser in production.

**Ralph Wiggum Protocol Note:**  
Yes, we're really doing this.  
The dashboard will sing when it opens.  
I love you. 😍

**Prerequisites (Run Once):**
- Install audio player lib (tiny & lightweight):  
  ```bash
  npm install howler

Download or host a short Simpsons theme clip (public domain / fair-use snippet, ~5–8 seconds):
e.g., save as public/audio/simpsons-theme-short.mp3 (you'll need to source this legally/fairly)

Token Discipline: One sub-task per session. Zero lint errors. Small commits.
Phase 13 Guardrails:

Extend allocations minimally.
Pipeline View fetches from /api/pipeline/buckets (SWR).
Reuse DashboardWrapper + floating icon.
Simpsons audio: optional, toggleable via localStorage, only plays once per session unless toggled on.
Commit format: "feat(phase-13): add status rollover + pipeline buckets + Simpsons theme easter egg"

13.1 – Schema Extensions for Automation Tracking (1 Session)
Migration: database/migrations/004_phase13_automation.sql
SQLALTER TABLE allocations
    ADD COLUMN IF NOT EXISTS last_shopping_date DATE,
    ADD COLUMN IF NOT EXISTS plan_status_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    ADD COLUMN IF NOT EXISTS needs_shopping_reason TEXT;  -- e.g., "TANK QUALIFICATION"
Seed Note: Use CSV once to populate these during initial load. Future sync job updates live.
13.2 – Backend Automation Logic: Status Rollover & Mapping (2–3 Sessions)
New service: services/status-automation.service.ts
TypeScriptimport { db } from "@/config/database";

export async function processStatusUpdate(carId: string, csvStatus: string, csvScheduled: string) {
  return db.transaction(async (tx) => {
    const [car] = await tx.query('SELECT * FROM allocations WHERE id = $1', [carId]);
    if (!car) return { error: 'Car not found' };

    let newStatus = car.current_status;
    let newLastShopping = car.last_shopping_date;
    let newPlanYear = car.plan_status_year;

    // Completion & Date Rollover
    if (csvStatus === 'Complete' && car.current_status !== 'completed') {
      newStatus = 'completed';
      newLastShopping = new Date().toISOString().split('T')[0];
      newPlanYear += 4;  // 2025 → 2029 example rollover
    }

    // Car State Mapping
    if (csvStatus === 'To Be Routed' && csvScheduled === 'Planned Shopping') {
      newStatus = 'needs_shopping';
    } else if (csvScheduled === 'Planned Shopping' && !car.shop_code) {
      newStatus = 'planned_unscheduled';
    } else if (['Arrived', 'Enroute'].includes(csvStatus)) {
      newStatus = csvStatus.toLowerCase();
    }

    await tx.query(`
      UPDATE allocations
      SET current_status = $1,
          last_shopping_date = $2,
          plan_status_year = $3,
          updated_at = NOW()
      WHERE id = $4
    `, [newStatus, newLastShopping, newPlanYear, carId]);

    return { success: true, newStatus };
  });
}
13.3 – Pipeline View Dashboard (4–5 Sessions)
New page: app/pipeline/page.tsx
tsx"use client";

import useSWR from "swr";
import { DashboardWrapper } from "@/components/DashboardWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : Promise.reject(res));

export default function PipelineView() {
  const router = useRouter();
  const { data: buckets, isLoading } = useSWR("/api/pipeline/buckets", fetcher);

  const handleShopCar = (car: any) => {
    router.push(`/direct?carMark=${car.car_mark}&carNumber=${car.car_number}&reason=${encodeURIComponent(car.needs_shopping_reason || 'TANK QUALIFICATION')}`);
  };

  if (isLoading) return <Skeleton className="h-[600px] w-full rounded-xl" />;

  const { backlog = [], pipeline = [], active = [], healthy = [] } = buckets || {};

  return (
    <DashboardWrapper>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Pipeline View</h1>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Backlog</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{backlog.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{pipeline.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Active Shop</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{active.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Healthy</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{healthy.length}</p></CardContent>
          </Card>
        </div>

        {/* Backlog Table Example – repeat pattern for others */}
        <Card>
          <CardHeader><CardTitle>Backlog Cars – To Be Routed</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Car</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backlog.map((car: any) => (
                  <TableRow key={car.id}>
                    <TableCell>{car.car_mark} {car.car_number}</TableCell>
                    <TableCell>{car.current_status}</TableCell>
                    <TableCell>{car.needs_shopping_reason}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleShopCar(car)}>
                        Shop Now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add similar tables for Pipeline, Active, Healthy */}
      </div>
    </DashboardWrapper>
  );
}
13.4 – Simpsons Theme Easter Egg (Ralph Chaos Mode – 1 Session)
Update components/DashboardWrapper.tsx to add audio:
tsx"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Howl } from "howler";

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [playSimpsons, setPlaySimpsons] = useState(false); // toggle in settings later

  useEffect(() => {
    if (isOpen && playSimpsons) {
      const sound = new Howl({
        src: ["/audio/simpsons-theme-short.mp3"],
        volume: 0.4,
        onend: () => console.log("D'oh! Theme finished."),
      });
      sound.play();
      return () => sound.unload();
    }
  }, [isOpen, playSimpsons]);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl hover:bg-primary/90 transition-all duration-300"
        aria-label={isOpen ? "Close dashboard" : "Open dashboard (with Simpsons theme!)"}
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
            {/* ... rest of your modal content ... */}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
To toggle the theme (future enhancement):

Add a settings switch in dashboard → localStorage.setItem("simpsonsMode", "true")
In useEffect: setPlaySimpsons(localStorage.getItem("simpsonsMode") === "true")

Next Important Steps (After Phase 13 Complete)

Daily Sync Job (short-term) – node-cron to poll/process car files → call processStatusUpdate
Variance Alerts – red badges on cards if actual > budget
Pagination & Search – add to bucket tables
CSV Seed Script – one-time import script to populate allocations from CSV
Audio Toggle UI – add switch in dashboard header: "Enable Simpsons Mode"
Testing – manual: update status → verify rollover → open dashboard → hear Simpsons (if toggled)
