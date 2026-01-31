# Railsync - Shop Loading Tool

A web-based Shop Loading Tool for railcar repair shop assignment. This system evaluates railroad shops against eligibility criteria and calculates optimal repair assignments based on cost, capacity, and capabilities.

## Architecture

This application uses a **three-tier architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                   (Next.js + React)                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Car Input   │ │ Override    │ │ Results     │               │
│  │ Form        │ │ Dropdowns   │ │ Grid        │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────▼────────────────────────────────────────┐
│                      BACKEND API                                 │
│                   (Node.js + Express)                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Car Lookup  │ │ Shop        │ │ Rules       │               │
│  │ Controller  │ │ Evaluation  │ │ Management  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────┐                │
│  │           RULES ENGINE                       │                │
│  │    (JSON-based configurable rules)          │                │
│  └─────────────────────────────────────────────┘                │
└────────────────────────┬────────────────────────────────────────┘
                         │ SQL
┌────────────────────────▼────────────────────────────────────────┐
│                       DATABASE                                   │
│                     (PostgreSQL)                                │
│  ┌─────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ shops   │ │ capabilities │ │ commodities │ │ rules       │  │
│  └─────────┘ └──────────────┘ └─────────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Car Lookup**: Retrieve car attributes by car number (product code, material type, stencil class, lining type, commodity CIN, asbestos flags, nitrogen pad stage)
- **User Overrides**: Override settings for exterior paint, new lining, interior blast, kosher cleaning, and primary network requirement
- **Shop Evaluation**: Evaluate ~100 shops against 40+ eligibility criteria including:
  - Car type capability
  - Material handling (aluminum/stainless)
  - Lining types (high bake, plasite, rubber, vinyl ester)
  - Compliance certifications (HM201)
  - Nitrogen pad stages (1-9)
  - Kosher certification
  - Commodity restrictions
- **Cost Calculation**: Calculate total cost per shop including labor, materials, abatement, and freight
- **Results Display**: Ranked results with cost breakdown, backlog metrics, en-route cars, and capacity by work type
- **Configurable Rules**: JSON-based rule definitions for maintainability

## Project Structure

```
Railsync/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── services/       # Business logic
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── rules-engine/   # Eligibility rules engine
│   │   ├── middleware/     # Express middleware
│   │   └── types/          # TypeScript types
│   └── package.json
├── frontend/               # Next.js React application
│   ├── src/
│   │   ├── app/           # Next.js app router pages
│   │   ├── components/    # React components
│   │   ├── lib/           # Utilities and API client
│   │   └── types/         # TypeScript types
│   └── package.json
├── database/              # PostgreSQL schema and migrations
│   ├── schema.sql         # Main database schema
│   ├── seed.sql           # Sample data
│   └── migrations/        # Database migrations
├── docker-compose.yml     # Docker orchestration
└── .env.example          # Environment variables template
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cars/:carNumber` | Retrieve car attributes and active service event |
| POST | `/api/shops/evaluate` | Submit car data + overrides, returns eligible shops with costs |
| GET | `/api/shops/:shopCode/backlog` | Get current backlog and capacity metrics |
| GET | `/api/rules` | List all eligibility rules with status |
| PUT | `/api/rules/:ruleId` | Update rule configuration |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Docker (optional)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/railsync.git
cd railsync
```

2. Install dependencies:
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Set up the database:
```bash
# Create database and run schema
psql -U postgres -c "CREATE DATABASE railsync;"
psql -U postgres -d railsync -f database/schema.sql
psql -U postgres -d railsync -f database/seed.sql
```

5. Start the development servers:
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

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://localhost:5432/railsync` |
| `PORT` | Backend API port | `3001` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `NODE_ENV` | Environment mode | `development` |

### Rules Configuration

Eligibility rules are stored in the database and can be modified via the API or directly in the `eligibility_rules` table. Rules use JSON-based condition definitions for flexibility.

## License

MIT
