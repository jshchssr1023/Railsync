import { query, queryOne } from '../config/database';
import { Car, CarWithCommodity, Commodity, ServiceEvent } from '../types';

export async function findByCarNumber(carNumber: string): Promise<CarWithCommodity | null> {
  const sql = `
    SELECT
      c.*,
      com.cin_code as "commodity.cin_code",
      com.description as "commodity.description",
      com.cleaning_class as "commodity.cleaning_class",
      com.recommended_price as "commodity.recommended_price",
      com.hazmat_class as "commodity.hazmat_class",
      com.requires_kosher as "commodity.requires_kosher",
      com.requires_nitrogen as "commodity.requires_nitrogen",
      com.nitrogen_stage as "commodity.nitrogen_stage"
    FROM cars c
    LEFT JOIN commodities com ON c.commodity_cin = com.cin_code
    WHERE c.car_number = $1
  `;

  const row = await queryOne<any>(sql, [carNumber]);

  if (!row) return null;

  // Transform flat result to nested object
  const car: CarWithCommodity = {
    car_number: row.car_number,
    product_code: row.product_code,
    material_type: row.material_type,
    stencil_class: row.stencil_class,
    lining_type: row.lining_type,
    commodity_cin: row.commodity_cin,
    has_asbestos: row.has_asbestos,
    asbestos_abatement_required: row.asbestos_abatement_required,
    nitrogen_pad_stage: row.nitrogen_pad_stage,
    last_repair_date: row.last_repair_date,
    last_repair_shop: row.last_repair_shop,
    owner_code: row.owner_code,
    lessee_code: row.lessee_code,
  };

  if (row['commodity.cin_code']) {
    car.commodity = {
      cin_code: row['commodity.cin_code'],
      description: row['commodity.description'],
      cleaning_class: row['commodity.cleaning_class'],
      recommended_price: row['commodity.recommended_price'],
      hazmat_class: row['commodity.hazmat_class'],
      requires_kosher: row['commodity.requires_kosher'],
      requires_nitrogen: row['commodity.requires_nitrogen'],
      nitrogen_stage: row['commodity.nitrogen_stage'],
    };
  }

  return car;
}

export async function getActiveServiceEvent(carNumber: string): Promise<ServiceEvent | null> {
  const sql = `
    SELECT *
    FROM service_events
    WHERE car_number = $1
      AND status IN ('pending', 'in_progress')
    ORDER BY requested_date DESC
    LIMIT 1
  `;

  return queryOne<ServiceEvent>(sql, [carNumber]);
}

export async function createServiceEvent(
  carNumber: string,
  eventType: string,
  overrides: {
    exterior_paint?: boolean;
    new_lining?: boolean;
    interior_blast?: boolean;
    kosher_cleaning?: boolean;
    primary_network?: boolean;
  }
): Promise<ServiceEvent> {
  const sql = `
    INSERT INTO service_events (
      car_number, event_type, status, requested_date,
      override_exterior_paint, override_new_lining,
      override_interior_blast, override_kosher_cleaning,
      override_primary_network
    ) VALUES ($1, $2, 'pending', CURRENT_DATE, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const rows = await query<ServiceEvent>(sql, [
    carNumber,
    eventType,
    overrides.exterior_paint || false,
    overrides.new_lining || false,
    overrides.interior_blast || false,
    overrides.kosher_cleaning || false,
    overrides.primary_network || false,
  ]);

  return rows[0];
}

export default {
  findByCarNumber,
  getActiveServiceEvent,
  createServiceEvent,
};
