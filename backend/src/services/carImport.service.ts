import { query, queryOne } from '../config/database';
import { CarMaster } from '../types';

interface CSVRow {
  [key: string]: string;
}

interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  errors: string[];
}

/**
 * Parse a CSV file into an array of row objects
 */
function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: CSVRow = {};

    for (let j = 0; j < headers.length && j < values.length; j++) {
      row[headers[j].trim()] = values[j];
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse date from various formats
 */
function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null;

  // Try MM/DD/YYYY format
  const usFormat = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = value.match(usFormat);
  if (match) {
    const [, month, day, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try YYYY-MM-DD format
  const isoFormat = /^(\d{4})-(\d{2})-(\d{2})$/;
  const isoMatch = value.match(isoFormat);
  if (isoMatch) {
    return new Date(value);
  }

  return null;
}

/**
 * Map CSV row to CarMaster object
 */
function mapCSVToCarMaster(row: CSVRow): Partial<CarMaster> {
  const carMark = row['Car Mark'] || '';
  const mark = row['Mark'] || carMark.substring(0, 4);
  const number = row['Number'] || carMark.substring(4);

  return {
    car_id: carMark,
    car_mark: mark,
    car_number: number || carMark,
    car_type: row['Car Type Level 2'] || undefined,
    lessee_name: row['Lessee Name'] || undefined,
    lessee_code: row['FMS Lessee Number'] || undefined,
    contract_number: row['Contract'] || undefined,
    contract_expiration: parseDate(row['Contract Expiration']) || undefined,
    portfolio_status: row['Portfolio'] || undefined,
    commodity: row['Primary Commodity'] || undefined,
    is_jacketed: row['Jacketed'] === 'Jacketed',
    is_lined: row['Lined'] !== 'Unlined' && row['Lined'] !== '',
    lining_type: row['Lining Type'] || undefined,
    car_age: parseInt(row['Car Age']) || undefined,
    // Compliance dates
    min_no_lining_year: parseInt(row['Min (no lining)']) || undefined,
    min_lining_year: parseInt(row['Min w lining']) || undefined,
    interior_lining_year: parseInt(row['Interior Lining']) || undefined,
    rule_88b_year: parseInt(row['Rule 88B']) || undefined,
    safety_relief_year: parseInt(row['Safety Relief']) || undefined,
    service_equipment_year: parseInt(row['Service Equipment']) || undefined,
    stub_sill_year: parseInt(row['Stub Sill']) || undefined,
    tank_thickness_year: parseInt(row['Tank Thickness']) || undefined,
    tank_qual_year: parseInt(row['Tank Qualification']) || undefined,
    // Planning status
    current_status: row['Current Status'] || undefined,
  };
}

/**
 * Import cars from CSV content
 */
export async function importCarsFromCSV(content: string): Promise<ImportResult> {
  const rows = parseCSV(content);
  const result: ImportResult = {
    total: rows.length,
    imported: 0,
    updated: 0,
    errors: [],
  };

  for (const row of rows) {
    try {
      const car = mapCSVToCarMaster(row);

      if (!car.car_number) {
        result.errors.push(`Missing car number for row`);
        continue;
      }

      // Check if car exists
      const existing = await queryOne<{ car_number: string }>(
        'SELECT car_number FROM cars WHERE car_number = $1',
        [car.car_number]
      );

      if (existing) {
        // Update existing car
        await query(
          `UPDATE cars SET
            car_id = COALESCE($2, car_id),
            car_mark = COALESCE($3, car_mark),
            car_type = COALESCE($4, car_type),
            lessee_name = COALESCE($5, lessee_name),
            lessee_code = COALESCE($6, lessee_code),
            contract_number = COALESCE($7, contract_number),
            contract_expiration = COALESCE($8, contract_expiration),
            portfolio_status = COALESCE($9, portfolio_status),
            commodity = COALESCE($10, commodity),
            is_jacketed = COALESCE($11, is_jacketed),
            is_lined = COALESCE($12, is_lined),
            lining_type = COALESCE($13, lining_type),
            car_age = COALESCE($14, car_age),
            min_no_lining_year = COALESCE($15, min_no_lining_year),
            min_lining_year = COALESCE($16, min_lining_year),
            interior_lining_year = COALESCE($17, interior_lining_year),
            rule_88b_year = COALESCE($18, rule_88b_year),
            safety_relief_year = COALESCE($19, safety_relief_year),
            service_equipment_year = COALESCE($20, service_equipment_year),
            stub_sill_year = COALESCE($21, stub_sill_year),
            tank_thickness_year = COALESCE($22, tank_thickness_year),
            tank_qual_year = COALESCE($23, tank_qual_year),
            current_status = COALESCE($24, current_status),
            updated_at = NOW()
          WHERE car_number = $1`,
          [
            car.car_number,
            car.car_id,
            car.car_mark,
            car.car_type,
            car.lessee_name,
            car.lessee_code,
            car.contract_number,
            car.contract_expiration,
            car.portfolio_status,
            car.commodity,
            car.is_jacketed,
            car.is_lined,
            car.lining_type,
            car.car_age,
            car.min_no_lining_year,
            car.min_lining_year,
            car.interior_lining_year,
            car.rule_88b_year,
            car.safety_relief_year,
            car.service_equipment_year,
            car.stub_sill_year,
            car.tank_thickness_year,
            car.tank_qual_year,
            car.current_status,
          ]
        );
        result.updated++;
      } else {
        // Insert new car
        await query(
          `INSERT INTO cars (
            car_number, car_id, car_mark, car_type,
            lessee_name, lessee_code, contract_number, contract_expiration,
            portfolio_status, commodity, is_jacketed, is_lined, lining_type, car_age,
            min_no_lining_year, min_lining_year, interior_lining_year, rule_88b_year,
            safety_relief_year, service_equipment_year, stub_sill_year,
            tank_thickness_year, tank_qual_year,
            current_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
          [
            car.car_number,
            car.car_id,
            car.car_mark,
            car.car_type,
            car.lessee_name,
            car.lessee_code,
            car.contract_number,
            car.contract_expiration,
            car.portfolio_status,
            car.commodity,
            car.is_jacketed,
            car.is_lined,
            car.lining_type,
            car.car_age,
            car.min_no_lining_year,
            car.min_lining_year,
            car.interior_lining_year,
            car.rule_88b_year,
            car.safety_relief_year,
            car.service_equipment_year,
            car.stub_sill_year,
            car.tank_thickness_year,
            car.tank_qual_year,
            car.current_status,
          ]
        );
        result.imported++;
      }
    } catch (error: any) {
      result.errors.push(`Error processing car ${row['Car Mark'] || 'unknown'}: ${error.message}`);
    }
  }

  return result;
}

/**
 * Get active car count (cars on lease) for a given month
 */
export async function getActiveCarCount(_month?: string): Promise<number> {
  const sql = `
    SELECT COUNT(*) as count
    FROM cars
    WHERE portfolio_status = 'On Lease'
  `;

  const result = await queryOne<{ count: string }>(sql);
  return parseInt(result?.count || '0', 10);
}

/**
 * List cars with filters
 */
export async function listCars(filters: {
  portfolio_status?: string;
  current_status?: string;
  lessee_code?: string;
  car_type?: string;
  tank_qual_year?: number;
  limit?: number;
  offset?: number;
}): Promise<{ cars: CarMaster[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.portfolio_status) {
    conditions.push(`portfolio_status = $${paramIndex++}`);
    params.push(filters.portfolio_status);
  }

  if (filters.current_status) {
    conditions.push(`current_status = $${paramIndex++}`);
    params.push(filters.current_status);
  }

  if (filters.lessee_code) {
    conditions.push(`lessee_code = $${paramIndex++}`);
    params.push(filters.lessee_code);
  }

  if (filters.car_type) {
    conditions.push(`car_type = $${paramIndex++}`);
    params.push(filters.car_type);
  }

  if (filters.tank_qual_year) {
    conditions.push(`tank_qual_year = $${paramIndex++}`);
    params.push(filters.tank_qual_year);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM cars ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  // Get paginated results
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const cars = await query<CarMaster>(
    `SELECT * FROM cars ${whereClause}
     ORDER BY car_number
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return { cars, total };
}

/**
 * Get car by ID or number
 */
export async function getCarById(carId: string): Promise<CarMaster | null> {
  const car = await queryOne<CarMaster>(
    `SELECT * FROM cars WHERE car_id = $1 OR car_number = $1`,
    [carId]
  );
  return car;
}

export default {
  importCarsFromCSV,
  getActiveCarCount,
  listCars,
  getCarById,
};
