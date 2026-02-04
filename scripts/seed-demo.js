/**
 * Comprehensive Demo Seed Script for Railsync
 *
 * Seeds all tables with realistic demo data from the Qual Planner CSV.
 * Idempotent: clears transactional data before re-seeding.
 *
 * Usage: node scripts/seed-demo.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

// ============================================================================
// CONFIG — adjust these for your demo
// ============================================================================
const CONFIG = {
  CAR_COUNT: 1500,
  BUDGET_PER_CAR_MONTH: 200,
  QUAL_COST: 30000,
  ASSIGNMENT_COST: 7000,
  BAD_ORDER_COST: 15000,
  SHOPPING_EVENTS_REALISTIC: 200,
  SHOPPING_EVENTS_CURATED: 20,
  FISCAL_YEAR: 2026,
};

const CSV_PATH = path.resolve(__dirname, '..', 'docs', 'Qual Planner Master.csv');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://railsync:railsync_password@localhost:5432/railsync',
});

const SHOPS = [
  'BNSF001','BNSF002','UP001','UP002','NS001','NS002','CSX001','CSX002',
  'CN001','CN002','KCS001','CPKC001','IND001','IND002','IND003',
];

const SHOPPING_TYPES = [
  'QUAL_REG','BAD_ORDER','LEASE_ASSIGN','LEASE_RETURN','LESSEE_REQ',
  'COMMODITY_CONV','RUNNING_REPAIR','PREVENTIVE',
];

const AAR_CODES = [
  'T01','T02','T03','T04','T05','T06','T07','T08','T09','T10',
  'T11','T12','T13','T14','T15','T16','T17','T18','T19','T20',
];

const REPAIR_DESCRIPTIONS = [
  'Tank Cleaning - Interior','Tank Cleaning - Exterior','Hydrostatic Test',
  'Lining Application - Epoxy','Lining Application - High Bake','Safety Relief Valve Replacement',
  'Stub Sill Repair','Bottom Outlet Valve Service','Manway Gasket Replacement',
  'Tank Thickness Measurement','Jacket Repair','Service Equipment Inspection',
  'Tank Qualification Inspection','Air Brake Service','Coupler Replacement',
  'Wheel Set Replacement','Body Bolster Repair','Draft Gear Service',
  'Placard/Stencil Update','Paint/Protective Coating',
];

const ISSUE_TYPES = [
  'tank_leak','valve_failure','safety_relief','structural_damage','wheel_flat',
  'coupler_defect','brake_failure','lining_failure','jacket_damage','corrosion',
];

// ============================================================================
// HELPERS
// ============================================================================
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDecimal(min, max) { return +(Math.random() * (max - min) + min).toFixed(2); }
function slug(name) { return name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20).toUpperCase(); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
function monthStr(year, month) { return `${year}-${String(month).padStart(2, '0')}`; }

function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function parseYear(s) {
  if (!s || !s.trim()) return null;
  const y = parseInt(s, 10);
  return isNaN(y) ? null : y;
}

function parseBool(s) {
  if (!s) return false;
  const l = s.toLowerCase().trim();
  return l === 'yes' || l === 'true' || l === 'jacketed' || l === 'lined';
}

function parseAge(s) {
  if (!s || !s.trim()) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('=== Railsync Demo Seed ===\n');

  // Read CSV
  console.log('Reading CSV...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const allRows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
  const rows = allRows.slice(0, CONFIG.CAR_COUNT);
  console.log(`  ${allRows.length} total rows, using first ${rows.length}`);

  // Get admin user ID
  const adminResult = await pool.query("SELECT id FROM users WHERE email = 'admin@railsync.com'");
  const adminId = adminResult.rows[0]?.id;
  if (!adminId) throw new Error('Admin user not found — run migrations first');
  console.log(`  Admin user: ${adminId}\n`);

  // ------------------------------------------------------------------
  // CLEAN transactional data (preserve reference data)
  // ------------------------------------------------------------------
  console.log('Cleaning transactional data...');
  await pool.query(`
    DELETE FROM estimate_line_decisions;
    DELETE FROM estimate_lines;
    DELETE FROM approval_packets;
    DELETE FROM estimate_submissions;
    DELETE FROM shopping_event_state_history;
    DELETE FROM shopping_events;
    DELETE FROM shopping_batches;
    DELETE FROM project_cars;
    DELETE FROM projects;
    DELETE FROM bad_order_reports;
    DELETE FROM assignment_service_options;
    DELETE FROM car_assignments;
    DELETE FROM lease_car_assignments;
    DELETE FROM rider_cars;
    DELETE FROM lease_amendments;
    DELETE FROM lease_riders;
    DELETE FROM master_leases;
    UPDATE users SET customer_id = NULL WHERE customer_id IS NOT NULL;
    DELETE FROM customers;
    DELETE FROM demands;
    DELETE FROM running_repairs_budget;
    DELETE FROM service_event_budget;
  `);
  console.log('  Done\n');

  // ==================================================================
  // PHASE 1: CARS
  // ==================================================================
  console.log('Phase 1: Importing cars...');
  let carCount = 0;
  for (const row of rows) {
    const carNumber = row['Car Mark'] || `${row['Mark']}${row['Number']}`;
    if (!carNumber || !carNumber.trim()) continue;

    await pool.query(`
      INSERT INTO cars (
        car_number, car_mark, car_id, car_type, lessee_name, lessee_code,
        fms_lessee_number, contract_number, contract_expiration, commodity,
        csr_name, csl_name, commercial_contact, past_region, current_region,
        is_jacketed, is_lined, lining_type, car_age,
        min_no_lining_year, min_lining_year, interior_lining_year,
        rule_88b_year, safety_relief_year, service_equipment_year,
        stub_sill_year, tank_thickness_year, tank_qual_year,
        portfolio_status, full_partial_qual, reason_shopped,
        perform_tank_qual, scheduled_status, current_status,
        adjusted_status, plan_status, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,NOW()
      ) ON CONFLICT (car_number) DO UPDATE SET
        car_type=EXCLUDED.car_type, lessee_name=EXCLUDED.lessee_name,
        lessee_code=EXCLUDED.lessee_code, contract_number=EXCLUDED.contract_number,
        contract_expiration=EXCLUDED.contract_expiration, commodity=EXCLUDED.commodity,
        current_status=EXCLUDED.current_status, plan_status=EXCLUDED.plan_status,
        updated_at=NOW()
    `, [
      carNumber.trim(), row['Mark']?.trim()||null, row['Car']?.trim()||carNumber.trim(),
      row['Car Type Level 2']?.trim()||null, row['Lessee Name']?.trim()||null,
      row['FMS Lessee Number']?.trim()||null, row['FMS Lessee Number']?.trim()||null,
      row['Contract']?.trim()||null, parseDate(row['Contract Expiration']),
      row['Primary Commodity']?.trim()||null, row['CSR']?.trim()||null,
      row['CSL']?.trim()||null, row['Commericial']?.trim()||null,
      row['Past Region']?.trim()||null, row['2026 Region']?.trim()||null,
      parseBool(row['Jacketed']), parseBool(row['Lined']),
      (row['Lining Type']?.trim()||'').substring(0, 50)||null, parseAge(row['Car Age']),
      parseYear(row['Min (no lining)']), parseYear(row['Min w lining']),
      parseYear(row['Interior Lining']), parseYear(row['Rule 88B ']),
      parseYear(row['Safety Relief']), parseYear(row['Service Equipment ']),
      parseYear(row['Stub Sill']), parseYear(row['Tank Thickness']),
      parseYear(row['Tank Qualification']), row['Portfolio']?.trim()||null,
      row['Full/Partial Qual']?.trim()||null, row['Reason Shopped']?.trim()||null,
      parseBool(row['Perform Tank Qual']), row['Scheduled']?.trim()||null,
      row['Current Status']?.trim()||null, row['Adjusted Status']?.trim()||null,
      row['Plan Status']?.trim()||null,
    ]);
    carCount++;
    if (carCount % 250 === 0) console.log(`  ${carCount} cars...`);
  }
  console.log(`  ${carCount} cars imported\n`);

  // Collect car numbers for later use
  const carNumbers = rows
    .map(r => (r['Car Mark'] || `${r['Mark']}${r['Number']}`).trim())
    .filter(Boolean);

  // ==================================================================
  // PHASE 2: CUSTOMERS
  // ==================================================================
  console.log('Phase 2: Creating customers...');
  const lesseeMap = new Map(); // lesseeName -> { code, csr, cars[] }
  for (const row of rows) {
    const name = row['Lessee Name']?.trim();
    if (!name) continue;
    if (!lesseeMap.has(name)) {
      lesseeMap.set(name, {
        code: row['FMS Lessee Number']?.trim() || slug(name),
        csr: row['CSR']?.trim() || null,
        csl: row['CSL']?.trim() || null,
      });
    }
  }

  const customerIds = new Map(); // lesseeName -> UUID
  for (const [name, info] of lesseeMap) {
    const r = await pool.query(`
      INSERT INTO customers (customer_code, customer_name, contact_name, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (customer_code) DO UPDATE SET customer_name=EXCLUDED.customer_name
      RETURNING id
    `, [info.code, name, info.csr]);
    customerIds.set(name, r.rows[0].id);
  }
  console.log(`  ${customerIds.size} customers created\n`);

  // ==================================================================
  // PHASE 3: MASTER LEASES
  // ==================================================================
  console.log('Phase 3: Creating master leases...');
  const contractMap = new Map(); // contract -> { customerId, expDate, cars[] }
  for (const row of rows) {
    const contract = row['Contract']?.trim();
    const lessee = row['Lessee Name']?.trim();
    if (!contract || !lessee) continue;
    if (!contractMap.has(contract)) {
      contractMap.set(contract, {
        customerId: customerIds.get(lessee),
        expDate: parseDate(row['Contract Expiration']),
        carCount: 0,
      });
    }
    contractMap.get(contract).carCount++;
  }

  const leaseIds = new Map(); // contract -> UUID
  for (const [contract, info] of contractMap) {
    if (!info.customerId) continue;
    const endDate = info.expDate || '2028-12-31';
    const endD = new Date(endDate);
    endD.setFullYear(endD.getFullYear() - 5);
    const startDate = endD.toISOString().slice(0, 10);
    const rate = randDecimal(200, 400);

    const r = await pool.query(`
      INSERT INTO master_leases (lease_id, customer_id, lease_name, start_date, end_date, status, base_rate_per_car)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (lease_id) DO UPDATE SET customer_id=EXCLUDED.customer_id
      RETURNING id
    `, [
      contract, info.customerId, `Lease ${contract}`,
      startDate, endDate,
      endDate < '2026-07-01' ? 'Expiring' : 'Active',
      rate,
    ]);
    leaseIds.set(contract, r.rows[0].id);
  }
  console.log(`  ${leaseIds.size} leases created\n`);

  // ==================================================================
  // PHASE 4: LEASE RIDERS
  // ==================================================================
  console.log('Phase 4: Creating lease riders...');
  const riderIds = new Map(); // contract -> rider UUID
  for (const [contract, info] of contractMap) {
    const leaseId = leaseIds.get(contract);
    if (!leaseId) continue;
    const riderId = `${contract}-R01`.replace(/\s+/g, '');
    const r = await pool.query(`
      INSERT INTO lease_riders (rider_id, master_lease_id, rider_name, effective_date, car_count, status)
      VALUES ($1, $2, $3, '2021-01-01', $4, 'Active')
      ON CONFLICT (rider_id) DO UPDATE SET car_count=EXCLUDED.car_count
      RETURNING id
    `, [riderId, leaseId, `Rider ${riderId}`, info.carCount]);
    riderIds.set(contract, r.rows[0].id);
  }
  console.log(`  ${riderIds.size} riders created\n`);

  // ==================================================================
  // PHASE 5: RIDER CARS
  // ==================================================================
  console.log('Phase 5: Linking cars to riders...');
  let riderCarCount = 0;
  for (const row of rows) {
    const carNumber = (row['Car Mark'] || `${row['Mark']}${row['Number']}`).trim();
    const contract = row['Contract']?.trim();
    if (!carNumber || !contract) continue;
    const riderId = riderIds.get(contract);
    if (!riderId) continue;

    await pool.query(`
      INSERT INTO rider_cars (rider_id, car_number, added_date, is_active)
      VALUES ($1, $2, '2021-01-01', true)
      ON CONFLICT (rider_id, car_number, added_date) DO NOTHING
    `, [riderId, carNumber]);
    riderCarCount++;
  }
  console.log(`  ${riderCarCount} car-rider links created\n`);

  // ==================================================================
  // PHASE 6: BUDGET
  // ==================================================================
  console.log('Phase 6: Creating budget data...');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  for (let m = 1; m <= 12; m++) {
    const monthBudget = CONFIG.CAR_COUNT * CONFIG.BUDGET_PER_CAR_MONTH;
    const isPast = m < currentMonth || (m === currentMonth && now.getDate() > 15);
    const actualSpend = isPast ? randDecimal(monthBudget * 0.85, monthBudget * 1.10) : 0;
    const actualCars = isPast ? randBetween(Math.floor(CONFIG.CAR_COUNT * 0.02), Math.floor(CONFIG.CAR_COUNT * 0.04)) : 0;

    await pool.query(`
      INSERT INTO running_repairs_budget (fiscal_year, month, cars_on_lease, allocation_per_car, monthly_budget, actual_spend, actual_car_count, remaining_budget)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (fiscal_year, month) DO UPDATE SET actual_spend=EXCLUDED.actual_spend, actual_car_count=EXCLUDED.actual_car_count
    `, [
      CONFIG.FISCAL_YEAR, monthStr(CONFIG.FISCAL_YEAR, m),
      CONFIG.CAR_COUNT, CONFIG.BUDGET_PER_CAR_MONTH, monthBudget,
      actualSpend, actualCars, monthBudget - actualSpend,
    ]);
  }

  // Service event budgets
  const eventBudgets = [
    { type: 'Tank Qualification', cars: 200, cost: CONFIG.QUAL_COST, segment: 'QUAL_REG' },
    { type: 'Lease Assignment', cars: 300, cost: CONFIG.ASSIGNMENT_COST, segment: 'LEASE_ASSIGN' },
    { type: 'Bad Order Repair', cars: 50, cost: CONFIG.BAD_ORDER_COST, segment: 'BAD_ORDER' },
    { type: 'Commodity Conversion', cars: 30, cost: 20000, segment: 'COMMODITY_CONV' },
    { type: 'Running Repair', cars: 100, cost: 5000, segment: 'RUNNING_REPAIR' },
  ];
  for (const eb of eventBudgets) {
    await pool.query(`
      INSERT INTO service_event_budget (fiscal_year, event_type, budgeted_car_count, avg_cost_per_car, total_budget, fleet_segment)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [CONFIG.FISCAL_YEAR, eb.type, eb.cars, eb.cost, eb.cars * eb.cost, eb.segment]);
  }
  console.log('  12 monthly budgets + 5 event budgets created\n');

  // ==================================================================
  // PHASE 7: DEMANDS
  // ==================================================================
  console.log('Phase 7: Creating demands...');
  for (let m = 1; m <= 12; m++) {
    const carCount = randBetween(12, 22);
    await pool.query(`
      INSERT INTO demands (name, description, fiscal_year, target_month, car_count, event_type, car_type, priority, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      `Tank Quals - ${monthStr(CONFIG.FISCAL_YEAR, m)}`,
      `Monthly tank qualification campaign for ${monthStr(CONFIG.FISCAL_YEAR, m)}`,
      CONFIG.FISCAL_YEAR, monthStr(CONFIG.FISCAL_YEAR, m),
      carCount, 'Tank Qualification', 'General Service Tank',
      'High', m <= currentMonth ? 'Committed' : 'Forecast', adminId,
    ]);
  }
  // Quarterly lease assignments
  for (let q = 1; q <= 4; q++) {
    const m = q * 3;
    await pool.query(`
      INSERT INTO demands (name, description, fiscal_year, target_month, car_count, event_type, priority, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      `Q${q} Lease Assignments`, `Quarterly lease assignment batch Q${q} ${CONFIG.FISCAL_YEAR}`,
      CONFIG.FISCAL_YEAR, monthStr(CONFIG.FISCAL_YEAR, m),
      75, 'Lease Assignment', 'Medium', q === 1 ? 'Committed' : 'Forecast', adminId,
    ]);
  }
  // Commodity conversion demands
  await pool.query(`
    INSERT INTO demands (name, description, fiscal_year, target_month, car_count, event_type, priority, status, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, ['ADM Corn Oil Conversion', 'Convert 15 cars from soybean to corn oil service',
    CONFIG.FISCAL_YEAR, monthStr(CONFIG.FISCAL_YEAR, 3), 15, 'Commodity Conversion', 'High', 'Committed', adminId]);
  await pool.query(`
    INSERT INTO demands (name, description, fiscal_year, target_month, car_count, event_type, priority, status, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, ['BASF Chemical Conversion', 'Convert 10 cars for new chemical commodity',
    CONFIG.FISCAL_YEAR, monthStr(CONFIG.FISCAL_YEAR, 6), 10, 'Commodity Conversion', 'Medium', 'Forecast', adminId]);
  console.log('  18 demands created\n');

  // ==================================================================
  // PHASE 8: CAR ASSIGNMENTS
  // ==================================================================
  console.log('Phase 8: Creating car assignments...');
  const assignmentStatuses = [
    ...Array(30).fill('Planned'),
    ...Array(25).fill('Scheduled'),
    ...Array(20).fill('Enroute'),
    ...Array(25).fill('Arrived'),
    ...Array(20).fill('InShop'),
    ...Array(30).fill('Complete'),
  ];
  // Use cars starting from index 300 to avoid overlap with shopping events
  const assignmentCars = carNumbers.slice(300, 300 + assignmentStatuses.length);
  for (let i = 0; i < assignmentCars.length; i++) {
    const status = assignmentStatuses[i];
    const shop = SHOPS[i % SHOPS.length];
    const targetMonth = monthStr(CONFIG.FISCAL_YEAR, randBetween(1, 12));
    const baseDays = randBetween(5, 90);
    const timestamps = {};
    if (['Scheduled','Enroute','Arrived','InShop','Complete'].includes(status))
      timestamps.scheduled_at = daysAgo(baseDays);
    if (['Enroute','Arrived','InShop','Complete'].includes(status))
      timestamps.enroute_at = daysAgo(baseDays - 2);
    if (['Arrived','InShop','Complete'].includes(status))
      timestamps.arrived_at = daysAgo(baseDays - 5);
    if (['InShop','Complete'].includes(status))
      timestamps.in_shop_at = daysAgo(baseDays - 7);
    if (status === 'Complete')
      timestamps.completed_at = daysAgo(baseDays - 14);

    await pool.query(`
      INSERT INTO car_assignments (
        car_id, car_number, shop_code, target_month, status,
        scheduled_at, enroute_at, arrived_at, in_shop_at, completed_at,
        priority, estimated_cost, source, created_by_id
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13
      )
    `, [
      assignmentCars[i], shop, targetMonth, status,
      timestamps.scheduled_at || null, timestamps.enroute_at || null,
      timestamps.arrived_at || null, timestamps.in_shop_at || null,
      timestamps.completed_at || null,
      randBetween(1, 4), randDecimal(5000, 35000),
      i % 3 === 0 ? 'quick_shop' : 'demand_plan', adminId,
    ]);
  }
  console.log(`  ${assignmentCars.length} car assignments created\n`);

  // ==================================================================
  // PHASE 9: PROJECTS
  // ==================================================================
  console.log('Phase 9: Creating projects...');
  const projects = [
    {
      number: 'P-2026-001', name: 'Q1 Tank Qualification Campaign',
      type: 'qualification', scope: 'Full tank qualification including hydro test, thickness measurement, safety relief, and service equipment inspection.',
      status: 'active', carStart: 500, carEnd: 540, reason_code: 'QUAL_REG',
    },
    {
      number: 'P-2026-002', name: 'ADM Corn Oil Conversion',
      type: 'lining', scope: 'Strip existing soybean oil lining, clean, apply new corn oil compatible epoxy lining. Interior inspection required.',
      status: 'in_progress', carStart: 540, carEnd: 555, reason_code: 'COMMODITY_CONV',
    },
    {
      number: 'P-2026-003', name: 'Emergency Repairs - Feb 2026',
      type: 'other', scope: 'Emergency mechanical and structural repairs for cars pulled from service due to safety concerns.',
      status: 'active', carStart: 555, carEnd: 563, reason_code: 'BAD_ORDER',
    },
  ];
  for (const proj of projects) {
    const r = await pool.query(`
      INSERT INTO projects (project_number, project_name, project_type, scope_of_work, status, shopping_reason_code, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `, [proj.number, proj.name, proj.type, proj.scope, proj.status, proj.reason_code, adminId]);
    const projId = r.rows[0].id;

    const projCars = carNumbers.slice(proj.carStart, proj.carEnd);
    for (const cn of projCars) {
      const pcStatus = proj.status === 'in_progress' ? pick(['pending','in_progress','completed']) : 'pending';
      await pool.query(`
        INSERT INTO project_cars (project_id, car_number, status, added_by)
        VALUES ($1, $2, $3, $4)
      `, [projId, cn, pcStatus, adminId]);
    }
  }
  console.log('  3 projects created\n');

  // ==================================================================
  // PHASE 10: BAD ORDER REPORTS
  // ==================================================================
  console.log('Phase 10: Creating bad order reports...');
  const borCars = carNumbers.slice(555, 565);
  const severities = ['critical','critical','high','high','high','medium','medium','medium','low','low'];
  const borStatuses = ['open','open','pending_decision','pending_decision','pending_decision','assigned','assigned','resolved','resolved','resolved'];
  for (let i = 0; i < 10; i++) {
    await pool.query(`
      INSERT INTO bad_order_reports (
        car_id, car_number, reported_date, issue_type, issue_description,
        severity, location, reported_by, status, created_by_id
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      borCars[i], new Date(Date.now() - randBetween(1, 30) * 86400000).toISOString().slice(0, 10),
      ISSUE_TYPES[i], `${ISSUE_TYPES[i].replace(/_/g, ' ')} detected during ${pick(['routine inspection','in-transit check','customer report','shop receiving'])}`,
      severities[i], pick(['Chicago IL','Houston TX','Kansas City MO','Atlanta GA','Memphis TN']),
      pick(['Field Inspector','Customer','Railroad','Shop Foreman']),
      borStatuses[i], adminId,
    ]);
  }
  console.log('  10 bad order reports created\n');

  // ==================================================================
  // PHASE 11: SHOPPING EVENTS
  // ==================================================================
  console.log('Phase 11: Creating shopping events...');

  const STATES_ORDERED = [
    'REQUESTED','ASSIGNED_TO_SHOP','INBOUND','INSPECTION',
    'ESTIMATE_SUBMITTED','ESTIMATE_UNDER_REVIEW','ESTIMATE_APPROVED',
    'WORK_AUTHORIZED','IN_REPAIR','QA_COMPLETE',
    'FINAL_ESTIMATE_SUBMITTED','FINAL_ESTIMATE_APPROVED',
    'READY_FOR_RELEASE','RELEASED',
  ];

  // Build the 200 realistic events with target states
  const realisticDistribution = [
    ...Array(30).fill('REQUESTED'),
    ...Array(25).fill('ASSIGNED_TO_SHOP'),
    ...Array(20).fill('INBOUND'),
    ...Array(15).fill('INSPECTION'),
    ...Array(15).fill('ESTIMATE_SUBMITTED'),
    ...Array(10).fill('ESTIMATE_UNDER_REVIEW'),
    ...Array(10).fill('ESTIMATE_APPROVED'),
    ...Array(15).fill('WORK_AUTHORIZED'),
    ...Array(20).fill('IN_REPAIR'),
    ...Array(10).fill('QA_COMPLETE'),
    ...Array(5).fill('FINAL_ESTIMATE_SUBMITTED'),
    ...Array(5).fill('FINAL_ESTIMATE_APPROVED'),
    ...Array(5).fill('READY_FOR_RELEASE'),
    ...Array(15).fill('RELEASED'),
  ];

  // Use cars from index 0-219 for shopping events (no overlap with assignments at 300+)
  const shoppingCarPool = carNumbers.slice(0, CONFIG.SHOPPING_EVENTS_REALISTIC + CONFIG.SHOPPING_EVENTS_CURATED);

  // Helper: create shopping event and advance state with history
  async function createShoppingEvent(carNumber, targetState, shopCode, typeCode, options = {}) {
    // Generate event number
    const evNumResult = await pool.query('SELECT generate_event_number()');
    const eventNumber = evNumResult.rows[0].generate_event_number;

    // Insert in REQUESTED state
    const evResult = await pool.query(`
      INSERT INTO shopping_events (
        event_number, car_number, shop_code, state,
        shopping_type_code, shopping_reason_code, created_by_id
      ) VALUES ($1, $2, $3, 'REQUESTED', $4, $5, $6)
      RETURNING id
    `, [eventNumber, carNumber, shopCode, typeCode, options.reasonCode || null, adminId]);
    const eventId = evResult.rows[0].id;

    // Record initial state history
    await pool.query(`
      INSERT INTO shopping_event_state_history (shopping_event_id, from_state, to_state, changed_by_id, changed_at)
      VALUES ($1, NULL, 'REQUESTED', $2, $3)
    `, [eventId, adminId, daysAgo(randBetween(20, 60))]);

    // Advance through states up to target
    const targetIdx = STATES_ORDERED.indexOf(targetState);
    if (targetIdx > 0) {
      for (let s = 1; s <= targetIdx; s++) {
        const fromState = STATES_ORDERED[s - 1];
        const toState = STATES_ORDERED[s];
        const daysOffset = randBetween(1, 3);

        // Update state directly (bypassing trigger validation since we're seeding)
        await pool.query(`UPDATE shopping_events SET state = $2, updated_at = NOW() WHERE id = $1`, [eventId, toState]);
        await pool.query(`
          INSERT INTO shopping_event_state_history (shopping_event_id, from_state, to_state, changed_by_id, changed_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [eventId, fromState, toState, adminId, daysAgo(Math.max(1, (targetIdx - s) * daysOffset))]);
      }
    }

    return eventId;
  }

  // Create realistic events
  let eventCount = 0;
  for (let i = 0; i < CONFIG.SHOPPING_EVENTS_REALISTIC; i++) {
    const targetState = realisticDistribution[i];
    const carNumber = shoppingCarPool[i];
    if (!carNumber) break;
    const shop = SHOPS[i % SHOPS.length];
    const typeCode = pick(SHOPPING_TYPES);

    await createShoppingEvent(carNumber, targetState, shop, typeCode);
    eventCount++;
    if (eventCount % 50 === 0) console.log(`  ${eventCount} realistic events...`);
  }
  console.log(`  ${eventCount} realistic events created`);

  // ==================================================================
  // PHASE 11b: CURATED EVENTS
  // ==================================================================
  console.log('  Creating curated events...');
  const curatedStart = CONFIG.SHOPPING_EVENTS_REALISTIC;

  // --- 5 bad order events ---
  for (let i = 0; i < 5; i++) {
    const cn = shoppingCarPool[curatedStart + i];
    if (!cn) break;
    const targetState = pick(['INSPECTION', 'ESTIMATE_SUBMITTED', 'IN_REPAIR']);
    await createShoppingEvent(cn, targetState, SHOPS[i], 'BAD_ORDER', { reasonCode: 'BO_MECHANICAL' });
  }

  // --- 5 commodity conversion events ---
  for (let i = 0; i < 5; i++) {
    const cn = shoppingCarPool[curatedStart + 5 + i];
    if (!cn) break;
    const targetState = pick(['WORK_AUTHORIZED', 'IN_REPAIR', 'QA_COMPLETE']);
    await createShoppingEvent(cn, targetState, SHOPS[i + 3], 'COMMODITY_CONV');
  }

  // --- 5 multi-version estimate events ---
  const multiVersionEventIds = [];
  for (let i = 0; i < 5; i++) {
    const cn = shoppingCarPool[curatedStart + 10 + i];
    if (!cn) break;
    const eid = await createShoppingEvent(cn, 'WORK_AUTHORIZED', SHOPS[i + 6], 'QUAL_REG');
    multiVersionEventIds.push(eid);
  }

  // --- 5 released events with full trail ---
  const releasedEventIds = [];
  for (let i = 0; i < 5; i++) {
    const cn = shoppingCarPool[curatedStart + 15 + i];
    if (!cn) break;
    const eid = await createShoppingEvent(cn, 'RELEASED', SHOPS[i + 10], 'QUAL_REG');
    releasedEventIds.push(eid);
  }
  console.log('  20 curated events created\n');

  // ==================================================================
  // PHASE 12: ESTIMATES & DECISIONS (for curated events)
  // ==================================================================
  console.log('Phase 12: Creating estimates and decisions...');

  async function createEstimateWithLines(eventId, lineCount, version) {
    const lines = [];
    let totalLabor = 0, totalMaterial = 0, totalCost = 0;
    for (let l = 0; l < lineCount; l++) {
      const labor = randDecimal(2, 16);
      const material = randDecimal(100, 2000);
      const total = randDecimal(labor * 80 + material, labor * 120 + material + 500);
      totalLabor += labor;
      totalMaterial += material;
      totalCost += total;
      lines.push({
        aar_code: AAR_CODES[l % AAR_CODES.length],
        description: REPAIR_DESCRIPTIONS[l % REPAIR_DESCRIPTIONS.length],
        labor_hours: labor, material_cost: material, total_cost: total,
      });
    }

    const estResult = await pool.query(`
      INSERT INTO estimate_submissions (
        shopping_event_id, version_number, submitted_by, submitted_at,
        status, total_labor_hours, total_material_cost, total_cost
      ) VALUES ($1, $2, $3, NOW(), 'submitted', $4, $5, $6)
      RETURNING id
    `, [eventId, version, adminId, totalLabor, totalMaterial, totalCost]);
    const estId = estResult.rows[0].id;

    const lineIds = [];
    for (let l = 0; l < lines.length; l++) {
      const lr = await pool.query(`
        INSERT INTO estimate_lines (
          estimate_submission_id, line_number, aar_code, description,
          labor_hours, material_cost, total_cost
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [estId, l + 1, lines[l].aar_code, lines[l].description,
        lines[l].labor_hours, lines[l].material_cost, lines[l].total_cost]);
      lineIds.push(lr.rows[0].id);
    }

    return { estId, lineIds, totalCost };
  }

  // Multi-version estimate events: v1 changes_required, v2 approved
  for (const eid of multiVersionEventIds) {
    // v1 — changes_required
    const v1 = await createEstimateWithLines(eid, 3, 1);
    await pool.query(`UPDATE estimate_submissions SET status = 'changes_required' WHERE id = $1`, [v1.estId]);
    // Approval packet for v1
    await pool.query(`
      INSERT INTO approval_packets (estimate_submission_id, overall_decision, notes)
      VALUES ($1, 'changes_required', 'Labor hours underestimated. Please revise cleaning and hydro test lines.')
    `, [v1.estId]);

    // v2 — approved
    const v2 = await createEstimateWithLines(eid, 3, 2);
    await pool.query(`UPDATE estimate_submissions SET status = 'approved' WHERE id = $1`, [v2.estId]);
    // AI + human decisions on v2 lines
    for (let l = 0; l < v2.lineIds.length; l++) {
      const resp = l === 0 ? 'customer' : 'lessor';
      // AI decision
      await pool.query(`
        INSERT INTO estimate_line_decisions (
          estimate_line_id, decision_source, decision, confidence_score,
          responsibility, basis_type, basis_reference, decided_by_id, decided_at
        ) VALUES ($1, 'ai', 'approve', $2, $3, 'cri_table', 'CRI-2024-A', $4, NOW() - interval '2 hours')
      `, [v2.lineIds[l], randDecimal(0.78, 0.97), resp, adminId]);

      // Human decision (override on first line)
      if (l === 0) {
        await pool.query(`
          INSERT INTO estimate_line_decisions (
            estimate_line_id, decision_source, decision, responsibility,
            basis_type, basis_reference, decision_notes, decided_by_id, decided_at
          ) VALUES ($1, 'human', 'approve', 'lessor', 'lease_clause', 'Master Lease Sec 4.2',
            '[OVERRIDE] Human overrode AI responsibility from customer to lessor. Lease terms cover this repair category.', $2, NOW() - interval '1 hour')
        `, [v2.lineIds[0], adminId]);
      } else {
        await pool.query(`
          INSERT INTO estimate_line_decisions (
            estimate_line_id, decision_source, decision, responsibility,
            basis_type, decided_by_id, decided_at
          ) VALUES ($1, 'human', 'approve', $2, 'cri_table', $3, NOW() - interval '1 hour')
        `, [v2.lineIds[l], resp, adminId]);
      }
    }
    // Approval packet for v2
    await pool.query(`
      INSERT INTO approval_packets (estimate_submission_id, overall_decision, approved_line_ids, notes)
      VALUES ($1, 'approved', $2, 'Revised estimate approved. Responsibility adjusted per lease terms.')
    `, [v2.estId, `{${v2.lineIds.join(',')}}`]);
  }

  // Released events: single approved estimate with decisions
  for (const eid of releasedEventIds) {
    const est = await createEstimateWithLines(eid, 4, 1);
    await pool.query(`UPDATE estimate_submissions SET status = 'approved' WHERE id = $1`, [est.estId]);
    for (const lid of est.lineIds) {
      const resp = pick(['lessor', 'customer']);
      await pool.query(`
        INSERT INTO estimate_line_decisions (
          estimate_line_id, decision_source, decision, confidence_score,
          responsibility, basis_type, decided_by_id, decided_at
        ) VALUES ($1, 'human', 'approve', NULL, $2, 'cri_table', $3, NOW() - interval '3 days')
      `, [lid, resp, adminId]);
    }
    await pool.query(`
      INSERT INTO approval_packets (estimate_submission_id, overall_decision, approved_line_ids)
      VALUES ($1, 'approved', $2)
    `, [est.estId, `{${est.lineIds.join(',')}}`]);
    // Also create final estimate (v2)
    const fest = await createEstimateWithLines(eid, 4, 2);
    await pool.query(`UPDATE estimate_submissions SET status = 'approved' WHERE id = $1`, [fest.estId]);
    for (const lid of fest.lineIds) {
      await pool.query(`
        INSERT INTO estimate_line_decisions (
          estimate_line_id, decision_source, decision, responsibility,
          basis_type, decided_by_id, decided_at
        ) VALUES ($1, 'human', 'approve', $2, 'cri_table', $3, NOW() - interval '1 day')
      `, [lid, pick(['lessor', 'customer']), adminId]);
    }
    await pool.query(`
      INSERT INTO approval_packets (estimate_submission_id, overall_decision, approved_line_ids)
      VALUES ($1, 'approved', $2)
    `, [fest.estId, `{${fest.lineIds.join(',')}}`]);
  }
  console.log('  Estimates and decisions created\n');

  // ==================================================================
  // SUMMARY
  // ==================================================================
  console.log('=== Verifying counts ===');
  const counts = await pool.query(`
    SELECT 'cars' AS t, COUNT(*)::int AS c FROM cars
    UNION ALL SELECT 'customers', COUNT(*)::int FROM customers
    UNION ALL SELECT 'master_leases', COUNT(*)::int FROM master_leases
    UNION ALL SELECT 'lease_riders', COUNT(*)::int FROM lease_riders
    UNION ALL SELECT 'rider_cars', COUNT(*)::int FROM rider_cars
    UNION ALL SELECT 'running_repairs_budget', COUNT(*)::int FROM running_repairs_budget
    UNION ALL SELECT 'service_event_budget', COUNT(*)::int FROM service_event_budget
    UNION ALL SELECT 'demands', COUNT(*)::int FROM demands
    UNION ALL SELECT 'car_assignments', COUNT(*)::int FROM car_assignments
    UNION ALL SELECT 'projects', COUNT(*)::int FROM projects
    UNION ALL SELECT 'project_cars', COUNT(*)::int FROM project_cars
    UNION ALL SELECT 'bad_order_reports', COUNT(*)::int FROM bad_order_reports
    UNION ALL SELECT 'shopping_events', COUNT(*)::int FROM shopping_events
    UNION ALL SELECT 'estimate_submissions', COUNT(*)::int FROM estimate_submissions
    UNION ALL SELECT 'estimate_lines', COUNT(*)::int FROM estimate_lines
    UNION ALL SELECT 'estimate_line_decisions', COUNT(*)::int FROM estimate_line_decisions
    UNION ALL SELECT 'approval_packets', COUNT(*)::int FROM approval_packets
    UNION ALL SELECT 'shopping_event_state_history', COUNT(*)::int FROM shopping_event_state_history
    ORDER BY t
  `);
  console.log('');
  for (const row of counts.rows) {
    console.log(`  ${row.t.padEnd(30)} ${row.c}`);
  }

  console.log('\n=== SEED COMPLETE ===');
  await pool.end();
}

main().catch(err => {
  console.error('SEED FAILED:', err);
  process.exit(1);
});
