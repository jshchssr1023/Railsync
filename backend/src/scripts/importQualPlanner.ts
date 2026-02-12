/**
 * Import Qual Planner Master CSV into Railsync cars table
 *
 * Usage: npx ts-node src/scripts/importQualPlanner.ts <path-to-csv>
 */

import * as fs from 'fs';
import logger from '../config/logger';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://railsync:railsync_password@localhost:5432/railsync',
});

interface QualPlannerRow {
  'Lessee Name': string;
  'Car Mark': string;
  'FMS Lessee Number': string;
  'Contract': string;
  'Contract Expiration': string;
  'Primary Commodity': string;
  'CSR': string;
  'CSL': string;
  'Commericial': string;
  'Past Region': string;
  '2026 Region': string;
  'Jacketed': string;
  'Lined': string;
  'Lining Type': string;
  'Car Age': string;
  'Mark': string;
  'Number': string;
  'Car Type Level 2': string;
  'Min (no lining)': string;
  'Min w lining': string;
  'Interior Lining': string;
  'Rule 88B ': string;
  'Safety Relief': string;
  'Service Equipment ': string;
  'Stub Sill': string;
  'Tank Thickness': string;
  'Tank Qualification': string;
  'Portfolio': string;
  'Car': string;
  'Year': string;
  'Full/Partial Qual': string;
  'Reason Shopped': string;
  'Perform Tank Qual': string;
  'Scheduled': string;
  'Current Status': string;
  'Adjusted Status': string;
  'Plan Status': string;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;

  // Handle MM/DD/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function parseYear(yearStr: string): number | null {
  if (!yearStr || yearStr.trim() === '') return null;
  const year = parseInt(yearStr, 10);
  return isNaN(year) ? null : year;
}

function parseBoolean(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  return lower === 'yes' || lower === 'true' || lower === 'jacketed' || lower === 'lined';
}

function parseAge(ageStr: string): number | null {
  if (!ageStr || ageStr.trim() === '') return null;
  const age = parseInt(ageStr, 10);
  return isNaN(age) ? null : age;
}

async function importQualPlanner(csvPath: string) {
  logger.info(`Reading CSV from: ${csvPath}`);

  const fileContent = fs.readFileSync(csvPath, 'utf-8');

  const records: QualPlannerRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  logger.info(`Found ${records.length} records to import`);

  let imported = 0;
  let updated = 0;
  let errors = 0;

  for (const row of records) {
    try {
      // Build car number from Mark + Number or use Car Mark column
      const carNumber = row['Car Mark'] || `${row['Mark']}${row['Number']}`;

      if (!carNumber || carNumber.trim() === '') {
        logger.warn('Skipping row with no car number');
        continue;
      }

      const carData = {
        car_number: carNumber.trim(),
        car_mark: row['Mark']?.trim() || null,
        car_id: row['Car']?.trim() || carNumber.trim(),
        car_type: row['Car Type Level 2']?.trim() || null,
        lessee_name: row['Lessee Name']?.trim() || null,
        lessee_code: row['FMS Lessee Number']?.trim() || null,
        fms_lessee_number: row['FMS Lessee Number']?.trim() || null,
        contract_number: row['Contract']?.trim() || null,
        contract_expiration: parseDate(row['Contract Expiration']),
        commodity: row['Primary Commodity']?.trim() || null,
        csr_name: row['CSR']?.trim() || null,
        csl_name: row['CSL']?.trim() || null,
        commercial_contact: row['Commericial']?.trim() || null,
        past_region: row['Past Region']?.trim() || null,
        current_region: row['2026 Region']?.trim() || null,
        is_jacketed: parseBoolean(row['Jacketed']),
        is_lined: parseBoolean(row['Lined']),
        lining_type: row['Lining Type']?.trim() || null,
        car_age: parseAge(row['Car Age']),
        min_no_lining_year: parseYear(row['Min (no lining)']),
        min_lining_year: parseYear(row['Min w lining']),
        interior_lining_year: parseYear(row['Interior Lining']),
        rule_88b_year: parseYear(row['Rule 88B ']),
        safety_relief_year: parseYear(row['Safety Relief']),
        service_equipment_year: parseYear(row['Service Equipment ']),
        stub_sill_year: parseYear(row['Stub Sill']),
        tank_thickness_year: parseYear(row['Tank Thickness']),
        tank_qual_year: parseYear(row['Tank Qualification']),
        portfolio_status: row['Portfolio']?.trim() || null,
        full_partial_qual: row['Full/Partial Qual']?.trim() || null,
        reason_shopped: row['Reason Shopped']?.trim() || null,
        perform_tank_qual: parseBoolean(row['Perform Tank Qual']),
        current_status: row['Current Status']?.trim() || null,
      };

      // Upsert: insert or update on conflict
      const result = await pool.query(`
        INSERT INTO cars (
          car_number, car_mark, car_id, car_type, lessee_name, lessee_code,
          fms_lessee_number, contract_number, contract_expiration, commodity,
          csr_name, csl_name, commercial_contact, past_region, current_region,
          is_jacketed, is_lined, lining_type, car_age,
          min_no_lining_year, min_lining_year, interior_lining_year,
          rule_88b_year, safety_relief_year, service_equipment_year,
          stub_sill_year, tank_thickness_year, tank_qual_year,
          portfolio_status, full_partial_qual, reason_shopped,
          perform_tank_qual, current_status, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, CURRENT_TIMESTAMP
        )
        ON CONFLICT (car_number) DO UPDATE SET
          car_mark = EXCLUDED.car_mark,
          car_id = EXCLUDED.car_id,
          car_type = EXCLUDED.car_type,
          lessee_name = EXCLUDED.lessee_name,
          lessee_code = EXCLUDED.lessee_code,
          fms_lessee_number = EXCLUDED.fms_lessee_number,
          contract_number = EXCLUDED.contract_number,
          contract_expiration = EXCLUDED.contract_expiration,
          commodity = EXCLUDED.commodity,
          csr_name = EXCLUDED.csr_name,
          csl_name = EXCLUDED.csl_name,
          commercial_contact = EXCLUDED.commercial_contact,
          past_region = EXCLUDED.past_region,
          current_region = EXCLUDED.current_region,
          is_jacketed = EXCLUDED.is_jacketed,
          is_lined = EXCLUDED.is_lined,
          lining_type = EXCLUDED.lining_type,
          car_age = EXCLUDED.car_age,
          min_no_lining_year = EXCLUDED.min_no_lining_year,
          min_lining_year = EXCLUDED.min_lining_year,
          interior_lining_year = EXCLUDED.interior_lining_year,
          rule_88b_year = EXCLUDED.rule_88b_year,
          safety_relief_year = EXCLUDED.safety_relief_year,
          service_equipment_year = EXCLUDED.service_equipment_year,
          stub_sill_year = EXCLUDED.stub_sill_year,
          tank_thickness_year = EXCLUDED.tank_thickness_year,
          tank_qual_year = EXCLUDED.tank_qual_year,
          portfolio_status = EXCLUDED.portfolio_status,
          full_partial_qual = EXCLUDED.full_partial_qual,
          reason_shopped = EXCLUDED.reason_shopped,
          perform_tank_qual = EXCLUDED.perform_tank_qual,
          current_status = EXCLUDED.current_status,
          updated_at = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS inserted
      `, [
        carData.car_number,
        carData.car_mark,
        carData.car_id,
        carData.car_type,
        carData.lessee_name,
        carData.lessee_code,
        carData.fms_lessee_number,
        carData.contract_number,
        carData.contract_expiration,
        carData.commodity,
        carData.csr_name,
        carData.csl_name,
        carData.commercial_contact,
        carData.past_region,
        carData.current_region,
        carData.is_jacketed,
        carData.is_lined,
        carData.lining_type,
        carData.car_age,
        carData.min_no_lining_year,
        carData.min_lining_year,
        carData.interior_lining_year,
        carData.rule_88b_year,
        carData.safety_relief_year,
        carData.service_equipment_year,
        carData.stub_sill_year,
        carData.tank_thickness_year,
        carData.tank_qual_year,
        carData.portfolio_status,
        carData.full_partial_qual,
        carData.reason_shopped,
        carData.perform_tank_qual,
        carData.current_status,
      ]);

      if (result.rows[0]?.inserted) {
        imported++;
      } else {
        updated++;
      }

      if ((imported + updated) % 100 === 0) {
        logger.info(`Progress: ${imported} imported, ${updated} updated`);
      }
    } catch (err) {
      errors++;
      logger.error({ err: err }, `Error importing row`);
    }
  }

  logger.info('\n=== Import Complete ===');
  logger.info(`Imported: ${imported}`);
  logger.info(`Updated: ${updated}`);
  logger.info(`Errors: ${errors}`);
  logger.info(`Total: ${imported + updated + errors}`);

  await pool.end();
}

// Run if called directly
const csvPath = process.argv[2];
if (!csvPath) {
  logger.error('Usage: npx ts-node src/scripts/importQualPlanner.ts <path-to-csv>');
  process.exit(1);
}

const resolvedPath = path.resolve(csvPath);
if (!fs.existsSync(resolvedPath)) {
  logger.error(`File not found: ${resolvedPath}`);
  process.exit(1);
}

importQualPlanner(resolvedPath).catch((err) => {
  logger.error({ err: err }, 'Import failed');
  process.exit(1);
});
