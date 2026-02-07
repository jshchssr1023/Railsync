# Railsync

An enterprise web application for railcar fleet management, shop loading, repair planning, and operational coordination. Built for railroad operators who manage fleet maintenance across a national network of repair shops.

## What It Does

Railsync centralizes the lifecycle of railcar repair operations:

- **Shop Loading** -- Evaluate ~100 shops against 40+ eligibility criteria and assign cars to the best-fit facility based on cost, capacity, and capability
- **Fleet Visibility** -- Browse, search, and track railcar status, location, service history, and UMLER engineering specs
- **Demand & Capacity Planning** -- Forecast repair demand, manage shop capacity, build allocation scenarios, and run budget simulations
- **Shopping Workflow** -- Manage the full shopping request lifecycle from car identification through facility assignment, with packet/event tracking
- **Invoice Processing** -- Upload, parse, validate, and approve repair invoices with line-level review and case management for disputes
- **Contract Management** -- Browse contracts, customer hierarchies, lease structures, riders, and amendments
- **Commodity Cleaning Matrix (CCM)** -- Hierarchical cleaning instruction management with field-level inheritance
- **Estimates & Scope of Work** -- Build repair estimates from job code libraries, submit for approval, track scope templates
- **Qualifications & Compliance** -- Track shop certifications, qualification reports, and compliance status
- **Billing & Cost Analytics** -- Billable item management, cost allocation, and analytical dashboards
- **Integration** -- SAP sync, Salesforce sync, Railinc EDI messaging, data migration pipeline, parallel run testing

## Architecture

```
                         NGINX (reverse proxy, SSL)
                                  |
                   +--------------+--------------+
                   |                             |
            Frontend (3000)               Backend API (3001)
            Next.js 14 + React 18         Node.js + Express
            Tailwind CSS                  TypeScript
            SWR, Recharts                 JWT Auth, RBAC
            Framer Motion                 Rules Engine
                                          Scheduler
                   |                             |
                   +-------------+---------------+
                                 |
                          PostgreSQL 14+
                        56+ migration files
                        JSONB rule definitions
                        Audit trail, versioning
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript 5.3, Tailwind CSS 3.4 |
| UI | Lucide React icons, Framer Motion, Recharts, React Window |
| Data Fetching | SWR 2.4 |
| Backend | Node.js 18+, Express 4.18, TypeScript 5.9 |
| Database | PostgreSQL 14+ (raw SQL, parameterized queries) |
| Auth | JWT (jsonwebtoken), bcrypt, role-based access control |
| Validation | express-validator, Zod |
| Security | Helmet, CORS, express-rate-limit |
| File Handling | Multer (uploads), pdf-parse, csv-parse |
| Scheduling | node-cron |
| Testing | Jest 30, React Testing Library, ts-jest |
| DevOps | Docker, Docker Compose, Nginx |

## Project Structure

```
Railsync/
├── frontend/                    # Next.js application
│   ├── src/
│   │   ├── app/                 # 61 page routes (App Router)
│   │   ├── components/          # 70 reusable components
│   │   ├── context/             # Auth + Sidebar providers
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/
│   │   │   └── api.ts           # API client (308+ functions)
│   │   └── types/               # TypeScript interfaces
│   └── __tests__/               # 47 frontend test suites
│
├── backend/                     # Express API server
│   ├── src/
│   │   ├── controllers/         # 39 route controllers
│   │   ├── services/            # 75+ business logic services
│   │   ├── models/              # Car, Shop, Rule, User models
│   │   ├── routes/              # Centralized route definitions
│   │   ├── rules-engine/        # JSON-based eligibility engine
│   │   ├── middleware/          # Auth, validation, error handling
│   │   ├── config/              # Database configuration
│   │   └── types/               # TypeScript interfaces
│   └── tests/                   # 26 backend test suites
│
├── database/
│   ├── schema.sql               # Core schema (shops, cars, rules, events)
│   ├── seed.sql                 # Sample data
│   └── migrations-tracked/      # 56+ sequential migrations
│
├── nginx/                       # Reverse proxy config + SSL certs
├── docs/
│   ├── design/                  # PRD, roadmap, UI specs
│   ├── data-mapping/            # API data requirements, CSV templates
│   └── internal/                # Task tracking, system status, test log
│
├── docker-compose.yml           # Full stack orchestration
└── .env.example                 # Environment variable template
```

## Frontend Pages (61 Routes)

**Core**
- Dashboard (configurable widget grid)
- Settings, Notifications, Feedback

**Fleet & Cars**
- Car browser with search and filtering
- Commodities master data
- Fleet location map
- Bad order tracking

**Shop Operations**
- Shop loading tool (evaluate, compare, assign)
- Shop performance dashboards
- Service event tracking
- Rules management
- Qualifications and compliance

**Planning & Budgeting**
- Demand and capacity planning
- Budget planning with scenario modeling
- Cost analytics
- Allocation management
- Pipeline summary
- Master plans and service plans

**Shopping Workflow**
- Shopping request creation and lifecycle
- Shopping event and packet tracking
- Shopping type and reason configuration

**Financial**
- Estimates with approval workflow
- Invoice upload, validation, and approval
- Invoice case management for disputes
- Billing dashboard
- Billable item management
- Contracts browser with amendments and riders

**Data Management**
- Scope of work library
- Commodity Cleaning Matrix (CCM) editor
- Freight calculator
- Customer hierarchy
- Component registry

**Admin**
- User management (roles: admin, operator, viewer)
- System monitoring and alerts
- Data validation and reconciliation
- Storage commodities, commodity cleaning, work hours
- Service plans, shopping types/reasons, shop designations

**Deployment & Migration**
- Integration status (SAP, Salesforce)
- SAP validation
- Data migration tools
- Parallel run testing
- Go-live checklist
- Reports, analytics, training center, audit trail

## API Endpoints (200+)

Key endpoint groups:

| Group | Base Path | Operations |
|-------|-----------|------------|
| Auth | `/api/auth` | Login, register, refresh, logout, current user |
| Cars | `/api/cars` | Lookup, history, UMLER specs, import, browse |
| Shops | `/api/shops` | List, evaluate, backlog, capacity, filter, nearby, import |
| Rules | `/api/rules` | CRUD for eligibility rules |
| Service Events | `/api/service-events` | Create, list, status transitions |
| Budget | `/api/budget` | Running repairs, service event budgets, summary |
| Demand | `/api/demands` | CRUD, status updates, revert |
| Capacity | `/api/capacity` | Query, update, import monthly/work capacity |
| Scenarios | `/api/scenarios` | Create, compare allocation scenarios |
| Allocations | `/api/allocations` | Generate, assign, status management |
| Invoices | `/api/invoices` | Upload, validate, approve/reject lines, submit |
| Invoice Cases | `/api/invoice-cases` | Create, update, resolve disputes |
| Shopping | `/api/shopping-requests` | Full lifecycle with attachments |
| Shopping Events | `/api/shopping-events` | Event tracking |
| Shopping Packets | `/api/shopping-packets` | Packet management |
| Estimates | `/api/estimates` | Create, submit, approve |
| Job Codes | `/api/job-codes` | Job code library |
| Scope Library | `/api/scope-library` | Work scope templates |
| CCM | `/api/ccm` | Cleaning matrix, hierarchy, instructions |
| Contracts | `/api/contracts-browse` | Filter, type hierarchy, car lookup |
| Qualifications | `/api/qualifications` | CRUD for shop qualifications |
| Freight | `/api/freight` | Cost calculation |
| Analytics | `/api/analytics` | Dashboard metrics, shop analytics |
| Reports | `/api/reports` | Generate and list reports |
| Alerts | `/api/alerts` | Alert configuration |
| Audit | `/api/audit-logs` | Audit trail queries |
| Users | `/api/admin/users` | User management (admin) |
| Monitoring | `/api/admin/monitoring` | System health |
| Data Validation | `/api/data-validation` | Validation runs and status |
| Data Reconciliation | `/api/data-reconciliation` | Discrepancy detection and resolution |
| Integrations | `/api/integrations` | Status, SAP sync, Salesforce sync |
| Migration | `/api/migration` | Status, execute migration pipeline |
| Training | `/api/training` | Modules and progress tracking |
| Performance | `/api/performance` | Performance summary metrics |

## Authentication & Security

- **JWT tokens** with 15-minute access / 7-day refresh
- **Role-based access control** -- admin, operator, viewer
- **Rate limiting** -- 10 auth attempts per 15 min, 100 API requests per min
- **Helmet.js** -- security headers (XSS, HSTS, content-type sniffing)
- **CORS** -- configurable origin whitelist
- **Request IDs** -- traceable through the stack
- **Audit logging** -- every meaningful change recorded with who/when/what

## Database

Core schema with 56+ migrations tracking the full evolution:

**Core tables:** shops, shop_capabilities, cars, service_events, commodities, commodity_restrictions, eligibility_rules, freight_rates, labor_rates, material_costs, audit_log

**Planning tables:** demands, capacity, allocations, scenarios, budget entries, master plans

**Financial tables:** invoices, invoice_lines, invoice_cases, estimates, estimate_lines, billable_items, billing_records

**Shopping tables:** shopping_requests, shopping_events, shopping_packets, shopping_types, shopping_reasons

**Reference tables:** job_codes, scope_templates, ccm_instructions, qualifications, contracts, riders, amendments

**Views:** v_shop_summary, v_shop_capabilities_summary, v_active_service_events

**Auto-maintained timestamps** via database triggers on all major tables.

## Testing

**73 test suites total** (47 frontend + 26 backend)

Frontend tests cover all 61 pages plus shared components (ErrorBoundary, ConfirmDialog, PageSkeleton). Backend tests cover core business logic: allocation, billing, budgeting, contracts, dashboard, data reconciliation, demand, evaluation, go-live incidents, invoice processing, master planning, migration, parallel run, qualifications, reports, SAP integration, scope of work, shopping events, system mode, training, and transition logging.

Run tests:

```bash
# Frontend
cd frontend && npm test

# Backend
cd backend && npm test
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Docker (optional)

### Installation

```bash
# Clone
git clone <repo-url>
cd Railsync

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
```

### Environment Setup

```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://localhost:5432/railsync` |
| `PORT` | Backend API port | `3001` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `JWT_SECRET` | 64-byte hex secret for token signing | -- |
| `JWT_EXPIRES_IN` | Access token TTL | `15m` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Refresh token TTL | `7` |
| `SAP_API_URL` | SAP integration endpoint | optional |
| `SALESFORCE_INSTANCE_URL` | Salesforce instance | optional |

### Database Setup

```bash
psql -U postgres -c "CREATE DATABASE railsync;"
psql -U postgres -d railsync -f database/schema.sql
psql -U postgres -d railsync -f database/seed.sql

# Run migrations
cd backend && npx node-pg-migrate up
```

### Start Development

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Using Docker

```bash
docker-compose up -d
```

This starts PostgreSQL, backend, frontend, and Nginx. Migrations run automatically.

## Build Stats

| Metric | Count |
|--------|-------|
| Frontend pages | 61 |
| Reusable components | 70 |
| Backend controllers | 39 |
| Backend services | 75+ |
| API endpoints | 200+ |
| Database migrations | 56+ |
| Test suites | 73 |
| API client functions | 308+ |
| Custom hooks | 4 |
| Lines of TypeScript | ~137,000 |

## License

MIT
