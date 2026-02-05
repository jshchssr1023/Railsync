# RailSync - IT Technical Assessment

**Document Version:** 1.3
**Assessment Date:** February 3, 2026
**Last Updated:** February 5, 2026
**Assessor:** Automated Build Verification + Manual Code Review
**System Version:** Main branch (latest)

---

## Executive Summary

RailSync is a railcar fleet management system with 93 database tables, 360+ API endpoints, 43 backend services, and 24 frontend modules. It covers fleet tracking, shop management, car assignments, invoicing, bad orders, capacity planning, and a shopping event/estimate approval workflow. Recent additions include a contracts browse page with server-side pagination, a car type hierarchy tree, a side-drawer car detail view, and CCM (Customer Care Manual) hierarchy-level instructions with cascade inheritance.

**Overall Verdict: NOT production-ready.** The system is a functional prototype suitable for internal demonstration and iterative development. It is not yet suitable for deployment to a production environment where data integrity, security, and uptime are non-negotiable. Specific blockers are detailed below.

---

## 1. Architecture Overview

### Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Database | PostgreSQL | 14 (Alpine) |
| Backend API | Node.js + Express + TypeScript | Express 4.x |
| Frontend | Next.js + React + TypeScript | Next.js 14 |
| Containerization | Docker Compose | 3 containers |
| CSS | Tailwind CSS | With custom design system |
| Auth | JWT (jsonwebtoken) + bcrypt | 15-minute access tokens |

### Scale

| Metric | Count |
|--------|-------|
| Database tables | 93 |
| Migration files | 34 (030 numbered, some duplicate numbers) |
| API endpoints | 360+ |
| Backend services | 43 |
| Backend controllers | 26 |
| Frontend page modules | 24 |
| Backend dependencies | 15 production, 21 dev |
| Frontend dependencies | 8 production, 17 dev |

### Data Flow

```
Browser -> Next.js (port 3000) -> Express API (port 3001) -> PostgreSQL (port 5432)
```

All three services run as Docker containers on a single host. There is no reverse proxy, load balancer, or CDN in front of them.

---

## 2. Security Assessment

### CRITICAL ISSUES

#### 2.1 Hardcoded JWT Secret Fallback
**File:** `backend/src/middleware/auth.ts:14`
```
const JWT_SECRET = process.env.JWT_SECRET || 'railsync-secret-change-in-production';
```
**Risk:** If the `JWT_SECRET` environment variable is not set (and it is NOT set in `docker-compose.yml`), every installation uses the same predictable secret. Anyone who reads the source code can forge valid JWT tokens for any user, including admin accounts.

**Status:** The `docker-compose.yml` does NOT set `JWT_SECRET`. This means the hardcoded fallback is currently active in every deployment.

**Severity:** CRITICAL. This is the single most dangerous issue in the codebase.

#### 2.2 Database Credentials in docker-compose.yml
**File:** `docker-compose.yml:7-9`
```yaml
POSTGRES_USER: railsync
POSTGRES_PASSWORD: railsync_password
```
**Risk:** Database credentials are committed to source control in plaintext. The `DATABASE_URL` with the same credentials is also hardcoded on line 66.

**Severity:** HIGH. These should be in a `.env` file excluded from version control, or managed via a secrets manager.

#### 2.3 No Rate Limiting
There is no rate limiting middleware on any endpoint, including:
- `/api/auth/login` (password brute-force vector)
- `/api/auth/register` (account creation abuse)
- All 344 API endpoints

**Severity:** HIGH. A single client can hammer the login endpoint with unlimited password attempts.

#### 2.4 All Ports Exposed to Host
```yaml
ports:
  - "5432:5432"  # PostgreSQL directly accessible
  - "3001:3001"  # Backend API directly accessible
  - "3000:3000"  # Frontend directly accessible
```
**Risk:** PostgreSQL is exposed to the host network (and potentially beyond). In production, only the frontend should be exposed; the database and API should be on internal networks only.

**Severity:** HIGH for database exposure. Medium for API direct access.

### MODERATE ISSUES

#### 2.5 No HTTPS / TLS
The system runs on plain HTTP. No TLS certificates are configured. All traffic, including JWT tokens and passwords, is transmitted in cleartext.

**Mitigation path:** Deploy behind a reverse proxy (nginx/Traefik) with TLS termination.

#### 2.6 CORS Configuration
CORS is configured via environment variable `FRONTEND_URL` (set to `http://localhost:3000`). This is correct for development. For production, this must be changed to the actual frontend domain with HTTPS.

#### 2.7 No Input Sanitization Layer
While SQL injection is prevented (parameterized queries are used consistently throughout all 42 services), there is no centralized input validation middleware. Some controllers use Zod schemas for validation, but this is not consistent across all endpoints. Many controllers destructure `req.body` directly without validation.

#### 2.8 No CSRF Protection
The API uses JWT Bearer tokens (not cookies) for authentication, which provides natural CSRF resistance. However, if cookies are ever introduced, CSRF protection will need to be added.

### POSITIVE FINDINGS

| Control | Status | Notes |
|---------|--------|-------|
| SQL Injection Protection | PASS | Parameterized queries (`$1, $2, ...`) used consistently |
| Password Hashing | PASS | bcrypt with salt rounds 10-12 |
| Helmet.js | PASS | Security headers applied globally |
| CORS | PASS | Configured with explicit origin |
| Role-Based Authorization | PASS | `authorize('admin', 'operator')` middleware on write endpoints |
| Token Expiry | PASS | 15-minute access tokens, 7-day refresh tokens |
| Refresh Token Rotation | PASS | SHA256-hashed refresh tokens with rotation on use |
| Deactivated User Check | PASS | Auth middleware verifies user is still active on every request |
| Request ID Tracing | PASS | X-Request-ID header on all responses |
| XSS Protection | PASS | No `dangerouslySetInnerHTML`, no `eval()`, no `innerHTML` in frontend |
| Non-Root Containers | PASS | Backend runs as `railsync` (uid 1001), frontend as `nextjs` (uid 1001) |
| Multi-Stage Docker Builds | PASS | Optimized image sizes, Alpine base images |
| File Upload Restrictions | PASS | Multer limits: PDF/EDI/TXT/.500 only, 10MB max |

---

## 3. Database Assessment

### Schema Quality

**Migration Numbering:** There are duplicate migration numbers (010, 016, 017, 018, 024 each appear twice with different filenames). This creates confusion about execution order and makes it unclear which migration should run first. The `docker-compose.yml` manually sequences them with numbered prefixes (`01-schema.sql` through `35-ccm-form-structure.sql`), which works but is fragile.

**No Migration Framework:** Migrations are raw SQL files loaded by PostgreSQL's `docker-entrypoint-initdb.d` mechanism. This means:
- Migrations only run on first database creation (empty data directory)
- There is no way to apply a new migration to an existing database without manual intervention
- There is no rollback capability
- There is no migration state tracking (no `schema_migrations` table)

**This is the second most critical issue.** If the database already exists and a new migration is added, the development team must either: (a) destroy the database and recreate it, losing all data, or (b) manually run the SQL against the existing database.

### Constraints and Indexes

The shopping workflow migration (`027_shopping_workflow.sql`) demonstrates proper use of:
- Primary keys (UUID)
- Foreign key constraints with proper references
- Unique constraints (e.g., one active shopping event per car)
- Composite indexes for common query patterns
- CHECK constraints for enum-like fields (state machine states)
- Database-level trigger for state machine transition validation

### Data Integrity Controls

| Control | Status |
|---------|--------|
| State machine enforcement via DB trigger | PASS |
| Immutable estimate decisions (INSERT only) | PASS (trigger prevents UPDATE/DELETE) |
| SOW finalization lock | PASS |
| Audit logging | PARTIAL - audit_logs table exists but not all operations write to it |
| Soft deletes | NOT IMPLEMENTED - records are hard-deleted |
| Cascading deletes | CAUTION - some FK constraints use ON DELETE CASCADE |

### Contracts Browse API (New)

Four new endpoints added for the Cars page contracts browse feature:

| Endpoint | Purpose | Key Features |
|----------|---------|-------------|
| `GET /api/contracts-browse/types` | Car type hierarchy tree | Groups by car_type + commodity with counts. Returns tree structure for navigation. |
| `GET /api/contracts-browse/cars` | Paginated car list | Server-side pagination (max 200/page), filtering (car_type, commodity, status, region, lessee ILIKE, search ILIKE), sorting (8 allowed columns, SQL injection safe via whitelist). Parameterized queries. |
| `GET /api/contracts-browse/car/:carNumber` | Car detail for side drawer | Returns all car columns + shopping events count + active shopping event + lease hierarchy join (rider_cars -> lease_riders -> master_leases -> customers). |
| `GET /api/contracts-browse/filters` | Distinct filter values | Returns unique statuses, regions, and lessee names for dropdown population. |

**Performance:** Server-side pagination means the frontend never loads all 1,500+ cars at once. The `/types` endpoint aggregates with `GROUP BY` (single query), and the `/cars` endpoint uses `LIMIT/OFFSET` with dynamic `WHERE` clause construction. Sort column injection is prevented via a whitelist of 8 allowed column names.

### CCM Hierarchy-Level Instructions (New)

Three new tables added for hierarchy-level CCM instructions with cascade inheritance:

| Table | Purpose | Key Features |
|-------|---------|-------------|
| `ccm_instructions` | Main CCM data at any hierarchy level | Polymorphic scope (exactly one of customer_id, master_lease_id, rider_id, amendment_id set). All CCM fields nullable (NULL = inherit from parent). Versioning with `version`, `is_current`, `supersedes_id`. Constraint enforces one current instruction per scope entity. |
| `ccm_instruction_sealing` | Per-commodity sealing instructions | FK to `ccm_instructions`. Per-commodity sealing rules with `inherit_from_parent` flag. |
| `ccm_instruction_lining` | Per-commodity lining instructions | FK to `ccm_instructions`. Per-commodity lining rules with `inherit_from_parent` flag. |

**Inheritance Model:**
- Four hierarchy levels: Customer → Master Lease → Rider → Amendment
- NULL values in child levels inherit from parent
- Non-null values override parent settings
- Per-commodity sections can explicitly inherit or override

**New API Endpoints (12 total):**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/ccm-instructions/hierarchy-tree` | Nested tree of customers→leases→riders→amendments with `hasCCM` flags |
| `GET /api/ccm-instructions` | List instructions with optional scope filter |
| `GET /api/ccm-instructions/:id` | Get single instruction by ID |
| `POST /api/ccm-instructions` | Create new instruction at any scope level |
| `PUT /api/ccm-instructions/:id` | Update instruction |
| `DELETE /api/ccm-instructions/:id` | Delete instruction |
| `GET /api/ccm-instructions/by-scope/:type/:id` | Get instruction by scope (customer/lease/rider/amendment) |
| `GET /api/ccm-instructions/parent/:type/:id` | Get parent's effective CCM for inheritance display |
| `GET /api/cars/:carNumber/effective-ccm` | Resolved CCM with inheritance chain showing field sources |
| `POST/PUT/DELETE /api/ccm-instructions/:id/sealing` | CRUD for sealing sections |
| `POST/PUT/DELETE /api/ccm-instructions/:id/lining` | CRUD for lining sections |

**SQL Function:** `get_effective_ccm_for_car(car_number)` - Database-level function that walks the hierarchy path (rider_cars → lease_riders → master_leases → customers) and merges CCM fields from top to bottom, returning effective values with source tracking.

**Data Integrity:**
- CHECK constraint ensures exactly one scope ID is set per instruction
- Unique constraint on `(scope_level, customer_id, master_lease_id, rider_id, amendment_id) WHERE is_current = true`
- Cascade delete on sealing/lining sections when parent instruction deleted
- Migration includes data migration from legacy `ccm_forms` table

### Performance Concerns

- No connection pooling configuration visible (using `pg` default pool)
- No query performance monitoring
- No database indexes on some high-traffic columns (e.g., `created_at` for time-range queries)
- 90 tables with no partitioning strategy for tables that will grow large (e.g., `audit_logs`, `shopping_event_state_history`)

---

## 4. Backend Assessment

### Architecture Pattern

The backend follows a consistent Controller -> Service -> Database pattern:
- Controllers handle HTTP concerns (request parsing, response formatting)
- Services contain business logic and SQL queries
- Raw SQL with the `pg` library (no ORM)

This is a clean pattern, but the lack of an ORM means:
- All SQL is handwritten (higher bug risk, harder to maintain)
- Schema changes require updating SQL strings across multiple service files
- No compile-time checking of SQL against schema

### Error Handling

Every controller function is wrapped in try/catch blocks. Errors are logged with `console.error()` and return appropriate HTTP status codes. This is functional but has gaps:

- **No structured error logging** - errors go to stdout/stderr, not to a logging service
- **No error categorization** - all caught errors return 500 with a generic message
- **No error monitoring** - no integration with Sentry, Datadog, or similar
- **Stack traces exposed in development** - error details are logged to console, which is visible in Docker logs

### API Consistency

Response formats are inconsistent across endpoints:
- Shopping workflow endpoints return `{ success: true, data: {...} }`
- Older endpoints (job codes, scope library, etc.) return the raw object directly
- Some endpoints return `{ error: "message" }`, others return `{ success: false, error: "message" }`

This inconsistency complicates frontend development and makes it harder to build a reliable API client.

### Testing

| Type | Status |
|------|--------|
| Unit tests | 6 test files exist (`*.test.ts`) but coverage is minimal |
| Integration tests | `test-save-functions.sh` (63 tests, all passing) |
| End-to-end tests | None |
| Load tests | None |
| Security tests | None |
| CI/CD pipeline | None |

The `test-save-functions.sh` bash script is the primary verification tool. It tests all CRUD operations for the shopping workflow (63 test cases). This is a start, but:
- It only covers the shopping workflow, not the other 200+ endpoints
- It runs against a live database (not isolated test data)
- It has no rollback/cleanup (test data accumulates)
- It's a bash script, not a test framework (no assertions library, no parallel execution, no reporting)

---

## 5. Frontend Assessment

### Architecture

- Next.js 14 with App Router
- Client-side rendering (`'use client'` directive on all pages)
- Tailwind CSS with custom design system (dark mode support)
- `fetchApi<T>()` wrapper for all API calls
- No state management library (useState/useEffect patterns)
- **Vertical sidebar navigation** — replaces top banner navigation. Fixed-position left sidebar with icon-only collapsed state (56px) and expanded state (224px). 8 primary categories with nested subcategories. Mobile responsive with hamburger menu overlay. Built with lucide-react icons and CSS transitions. Legacy AuthHeader.tsx and MobileNavBar.tsx components have been deleted.
- **Cars page** — Three-panel layout (TypeTree | Car List | Side Drawer). Server-side pagination. URL query parameter support for deep-linking with pre-applied filters. Suspense boundary for Next.js App Router compatibility. TypeTree hidden on mobile for usability.
- **CCM page** — Tabbed interface with Browse and Create/Edit sub-tabs. Browse tab shows list of existing CCM instructions with expandable detail cards. Create/Edit tab has two-panel layout: left panel with hierarchy tree picker (Customer → Lease → Rider → Amendment), right panel with full CCM editor showing inheritance indicators. Each field displays whether it's inherited or locally defined, with Override/Reset buttons. Sealing and lining sections support per-commodity inheritance.

### Concerns

| Issue | Severity |
|-------|----------|
| No client-side form validation | Medium - server validates, but UX is poor |
| No loading skeletons | Low - pages show nothing during fetch |
| No error boundaries | Medium - unhandled errors crash the page |
| No offline support | Low - expected for internal tool |
| No accessibility audit | Medium - no ARIA labels, keyboard navigation untested |
| API URL hardcoded to localhost | HIGH - `NEXT_PUBLIC_API_URL=http://localhost:3001/api` |

### Page Coverage

24 frontend page modules exist covering:
- Dashboard, Contracts, Cars (rebuilt with 3-panel layout), Shops (rebuilt with grouped cards)
- Bad Orders, Invoices, Assignments
- Shopping Events, Scope Library, CCM (rebuilt with hierarchy tabs)
- Planning, Pipeline, Reports, Analytics
- Admin, Settings, Rules, Projects, Budget

**Cars Page Architecture (New):** The Cars page (`/cars`) has been rebuilt with a three-panel layout:
- **Left panel:** Car type hierarchy tree component with expand/collapse, count badges, and click-to-filter
- **Center panel:** Server-side paginated table (50 rows/page) with sortable columns and inline status/qualification badges
- **Right panel:** Side drawer (480px) that slides in from the right, showing full car details in collapsible sections with sticky header, quick stats, and navigation links

Key frontend patterns used:
- Server-side pagination via query parameters (no client-side filtering of large datasets)
- Debounced search input (300ms) to reduce API calls
- CSS animation for drawer slide-in (`animate-slide-in-right`)
- ESC key and backdrop click to close drawer
- Responsive pagination with page number buttons

**CCM Page Architecture (New):** The CCM page (`/ccm`) has been rebuilt with a tabbed interface:
- **Browse tab:** List of existing CCM instructions as expandable cards. Each card shows scope level badge, scope name, and key CCM fields. Expand to see full details and inheritance chain.
- **Create/Edit tab:** Two-panel layout:
  - **Left panel:** Hierarchy tree picker showing Customer → Master Lease → Rider → Amendment. Nodes with existing CCM show green indicator. Click to select scope for editing.
  - **Right panel:** Full CCM editor with inheritance indicators. Each field shows source badge (inherited from parent level or set locally). Override/Reset buttons to toggle inheritance. Tabbed sections for Contacts, Cleaning, Sealing, Lining, Dispo, Notes.

Key frontend patterns used:
- Hierarchy tree with expand/collapse and search filtering
- Field-level inheritance tracking with source badges
- Per-commodity section editors for sealing/lining
- Inheritance chain visualization as breadcrumb
- Color-coded scope level badges (blue=Customer, purple=Lease, orange=Rider, green=Amendment)

**Shops Page Architecture (New):** The Shops page (`/shops`) has been rebuilt with a grouped card layout:
- **Main content:** Shop cards grouped by geographic area (Midwest, Gulf Coast, etc.) with collapsible sections
- **Shop cards:** Display shop name, code, type badge (Repair/Storage/Scrap/Preferred), location, and capacity
- **Side drawer:** 480px drawer showing full shop details including contact info, capabilities, and recent activity
- **Search/filter:** Search by name/code/city, filter by area and shop type

Key frontend patterns used:
- Grouped card layout with collapsible area sections
- Type badges with color coding (blue=Repair, amber=Storage, gray=Scrap, purple=Preferred)
- Side drawer with ESC key and backdrop click to close
- Capacity utilization indicators with progress bars

---

## 6. DevOps Assessment

### Docker Configuration

The Docker Compose setup is functional for local development. It is NOT suitable for production:

| Issue | Status |
|-------|--------|
| Single-host deployment | No clustering, no failover |
| No health checks on API/frontend | Only PostgreSQL has a health check |
| No resource limits | Containers can consume unlimited CPU/memory |
| No logging driver configuration | Logs go to Docker default (JSON file) |
| No backup strategy | PostgreSQL data is in a Docker volume with no backup |
| No monitoring | No Prometheus, Grafana, or similar |
| `restart: unless-stopped` | Correct for development, needs review for production |

### CI/CD

There is no CI/CD pipeline. No GitHub Actions, no Jenkins, no deployment automation. Deployment is manual: `docker compose up --build`.

### Environment Management

- No staging environment
- No production environment
- No environment-specific configuration beyond docker-compose.yml
- `.env.example` exists but no `.env` file is used by Docker Compose

---

## 7. Verified Functionality (Test Results)

### Shopping Workflow - 63/63 Tests Passing

All tests run on February 3, 2026 against live Docker containers.

| Section | Tests | Status |
|---------|-------|--------|
| Job Codes (CRUD) | 5 | ALL PASS |
| Scope Library (CRUD + items + codes) | 10 | ALL PASS |
| Scope of Work (CRUD + items + finalize + save-as-template) | 12 | ALL PASS |
| Shopping Events (CRUD + filters) | 5 | ALL PASS |
| State Machine (full 15-state lifecycle) | 9 | ALL PASS |
| Approval Gates (DoD #3 Hard Stops) | 1 | PASS |
| Estimates (submit + approve + decisions + approval packet) | 15 | ALL PASS |
| State History (immutable log) | 1 | PASS |
| Batch Shopping (create 3 cars) | 2 | ALL PASS |
| Cancellation (with reason) | 2 | ALL PASS |
| Invalid Transitions (rejection) | 2 | ALL PASS |
| Car Shopping History | 1 | PASS |
| CCM Forms (CRUD + sealing + lining + SOW sections) | 12 | ALL PASS |

### What Was NOT Tested

- ~280 additional API endpoints (contracts, cars, shops, invoices, assignments, planning, etc.)
- Frontend functionality (no Cypress/Playwright tests)
- Concurrent access / race conditions
- Large dataset performance
- File upload endpoints (shopping packets, CCM attachments)
- SSE (Server-Sent Events) real-time notifications
- Email notification service
- SAP integration service
- Session management / token refresh flow

---

## 8. Known Issues and Technical Debt

### Critical (Must Fix Before Production)

1. **JWT secret is hardcoded** - Any source code reader can forge admin tokens
2. **No migration framework** - Cannot apply schema changes to existing databases
3. **Database credentials in source control** - Plaintext in docker-compose.yml
4. **No rate limiting** - Login endpoint vulnerable to brute force
5. **PostgreSQL port exposed** - Database directly accessible from host network
6. **No HTTPS** - All traffic in cleartext including passwords and tokens

### High (Should Fix Before Production)

7. **No CI/CD pipeline** - Manual deployment only
8. **Inconsistent API response format** - Mixed `{data}` and raw responses
9. **No structured logging** - Console.log only, no log aggregation
10. **No database backup strategy** - Data loss risk
11. **No health checks on API/frontend containers** - Docker can't detect failures
12. **Duplicate migration numbers** - 5 pairs of migrations share the same number prefix

### Medium (Should Fix Before Scale)

13. **No input validation middleware** - Inconsistent validation across endpoints
14. **No error monitoring** - No Sentry or equivalent
15. **No load testing** - Unknown capacity limits
16. **Minimal unit test coverage** - 6 test files for 42 services
17. **No accessibility audit** - WCAG compliance unknown
18. **Hard-coded localhost URLs in frontend** - Environment variable exists but defaults to localhost
19. **Audit logging incomplete** - Not all state changes are captured

### Low (Quality of Life)

20. **No API documentation** - No Swagger/OpenAPI spec
21. ~~No database seeding for development~~ **RESOLVED** - `scripts/seed-demo.js` seeds 1,500 cars, 59 customers, 116 leases, 220 shopping events, budget data, demands, projects, and bad orders from the Qual Planner CSV
22. **No frontend error boundaries** - Unhandled errors crash pages

---

## 9. Recommendations for IT Team

### Before Accepting for Internal Testing

1. Set `JWT_SECRET` environment variable to a cryptographically random 256-bit key
2. Move all secrets to environment variables or a secrets manager
3. Remove PostgreSQL port exposure from docker-compose.yml (`5432:5432`)
4. Add rate limiting to auth endpoints (express-rate-limit, minimum)
5. Verify the admin default password has been changed

### Before Accepting for Production

1. Deploy behind a reverse proxy with TLS (nginx + Let's Encrypt, or cloud load balancer)
2. Implement a proper migration framework (e.g., `node-pg-migrate` or `knex`)
3. Set up database backups (pg_dump on schedule, or managed PostgreSQL)
4. Implement CI/CD pipeline with automated testing
5. Add structured logging (Winston or Pino) with log aggregation
6. Add error monitoring (Sentry)
7. Standardize API response format across all endpoints
8. Add health check endpoints and configure Docker health checks
9. Implement rate limiting on all endpoints
10. Conduct a security penetration test

### Architecture Recommendations

- Consider managed PostgreSQL (AWS RDS, Azure Database for PostgreSQL) instead of self-hosted
- Consider container orchestration (Kubernetes or ECS) for high availability
- Implement read replicas if report queries impact operational performance
- Add Redis for session management and caching if needed at scale

---

## 10. Conclusion

RailSync demonstrates solid foundational architecture with consistent coding patterns, proper SQL injection prevention, and a well-designed state machine for the shopping workflow. The 63/63 passing tests for the new shopping workflow show that the core business logic is implemented correctly.

However, the system has critical security gaps (hardcoded JWT secret, exposed database, no rate limiting) and operational gaps (no migration framework, no CI/CD, no monitoring, no backups) that make it unsuitable for production use in its current state.

**Recommendation:** Accept as a working development prototype for demonstration and continued iteration. Do NOT deploy to production or expose to external networks without addressing the Critical and High items listed in Section 8.

---

*This assessment was generated from automated testing (63 endpoint tests) and manual code review of 360+ API endpoints, 43 services, 34 migration files, and 24 frontend modules.*
