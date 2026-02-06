import { query, queryOne, transaction } from '../config/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShoppingRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface ShoppingRequest {
  id: string;
  request_number: string;
  status: ShoppingRequestStatus;
  customer_company: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  car_number: string;
  current_railroad: string | null;
  current_location_city: string | null;
  current_location_state: string | null;
  next_railroad: string | null;
  next_location_city: string | null;
  next_location_state: string | null;
  stcc_or_un_number: string | null;
  residue_clean: string;
  gasket: string;
  o_rings: string;
  last_known_commodity: string | null;
  lining_current: string | null;
  lining_alternative: string | null;
  preferred_shop_code: string | null;
  mobile_repair_unit: boolean;
  shopping_type_code: string | null;
  shopping_reason_code: string | null;
  clean_grade: string | null;
  is_kosher: boolean;
  is_food_grade: boolean;
  dry_grade: string | null;
  disposition_city: string | null;
  disposition_state: string | null;
  disposition_route: string | null;
  disposition_payer_of_freight: string | null;
  disposition_comment: string | null;
  one_time_movement_approval: boolean;
  comments: string | null;
  shopping_event_id: string | null;
  bad_order_report_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  review_notes: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  version: number;
  // View fields
  preferred_shop_name?: string;
  created_by_name?: string;
  created_by_email?: string;
  reviewed_by_name?: string;
  attachment_count?: number;
}

export interface CreateShoppingRequestInput {
  customer_company?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_email?: string;
  customer_phone?: string;
  car_number: string;
  current_railroad?: string;
  current_location_city?: string;
  current_location_state?: string;
  next_railroad?: string;
  next_location_city?: string;
  next_location_state?: string;
  stcc_or_un_number?: string;
  residue_clean?: string;
  gasket?: string;
  o_rings?: string;
  last_known_commodity?: string;
  lining_current?: string;
  lining_alternative?: string;
  preferred_shop_code?: string;
  mobile_repair_unit?: boolean;
  shopping_type_code?: string;
  shopping_reason_code?: string;
  clean_grade?: string;
  is_kosher?: boolean;
  is_food_grade?: boolean;
  dry_grade?: string;
  disposition_city?: string;
  disposition_state?: string;
  disposition_route?: string;
  disposition_payer_of_freight?: string;
  disposition_comment?: string;
  one_time_movement_approval?: boolean;
  comments?: string;
  bad_order_report_id?: string;
}

export interface ShoppingRequestFilters {
  status?: string;
  car_number?: string;
  customer_email?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createShoppingRequest(
  input: CreateShoppingRequestInput,
  userId: string
): Promise<ShoppingRequest> {
  const numResult = await queryOne<{ generate_request_number: string }>(
    `SELECT generate_request_number()`,
    []
  );

  const result = await queryOne<ShoppingRequest>(
    `INSERT INTO shopping_requests (
      request_number, status,
      customer_company, customer_first_name, customer_last_name, customer_email, customer_phone,
      car_number, current_railroad, current_location_city, current_location_state,
      next_railroad, next_location_city, next_location_state, stcc_or_un_number,
      residue_clean, gasket, o_rings, last_known_commodity,
      lining_current, lining_alternative, preferred_shop_code,
      mobile_repair_unit,
      shopping_type_code, shopping_reason_code, clean_grade, is_kosher, is_food_grade, dry_grade,
      disposition_city, disposition_state, disposition_route, disposition_payer_of_freight, disposition_comment,
      one_time_movement_approval, comments,
      bad_order_report_id,
      submitted_at, created_by_id
    ) VALUES (
      $1, 'submitted',
      $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14,
      $15, $16, $17, $18,
      $19, $20, $21,
      $22,
      $23, $24, $25, $26, $27, $28,
      $29, $30, $31, $32, $33,
      $34, $35,
      $36,
      NOW(), $37
    )
    RETURNING *`,
    [
      numResult!.generate_request_number,
      input.customer_company || 'all_customers',
      input.customer_first_name || null,
      input.customer_last_name || null,
      input.customer_email || null,
      input.customer_phone || null,
      input.car_number,
      input.current_railroad || null,
      input.current_location_city || null,
      input.current_location_state || null,
      input.next_railroad || null,
      input.next_location_city || null,
      input.next_location_state || null,
      input.stcc_or_un_number || null,
      input.residue_clean || 'unknown',
      input.gasket || 'unknown',
      input.o_rings || 'unknown',
      input.last_known_commodity || null,
      input.lining_current || null,
      input.lining_alternative || null,
      input.preferred_shop_code || null,
      input.mobile_repair_unit ?? false,
      input.shopping_type_code || null,
      input.shopping_reason_code || null,
      input.clean_grade || null,
      input.is_kosher ?? false,
      input.is_food_grade ?? false,
      input.dry_grade || null,
      input.disposition_city || null,
      input.disposition_state || null,
      input.disposition_route || null,
      input.disposition_payer_of_freight || null,
      input.disposition_comment || null,
      input.one_time_movement_approval ?? false,
      input.comments || null,
      input.bad_order_report_id || null,
      userId,
    ]
  );

  return result!;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getShoppingRequest(id: string): Promise<ShoppingRequest | null> {
  return queryOne<ShoppingRequest>(
    `SELECT * FROM v_shopping_requests WHERE id = $1`,
    [id]
  );
}

export async function listShoppingRequests(
  filters: ShoppingRequestFilters = {}
): Promise<{ requests: ShoppingRequest[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.car_number) {
    conditions.push(`car_number ILIKE $${paramIndex++}`);
    params.push(`%${filters.car_number}%`);
  }
  if (filters.customer_email) {
    conditions.push(`customer_email ILIKE $${paramIndex++}`);
    params.push(`%${filters.customer_email}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 25;
  const offset = filters.offset || 0;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM shopping_requests ${where}`,
    params
  );

  const requests = await query<ShoppingRequest>(
    `SELECT * FROM v_shopping_requests ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    requests,
    total: parseInt(countResult?.count || '0', 10),
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateShoppingRequest(
  id: string,
  input: Partial<CreateShoppingRequestInput>,
  userId: string
): Promise<ShoppingRequest> {
  const existing = await getShoppingRequest(id);
  if (!existing) {
    throw new Error('Shopping request not found');
  }
  if (existing.status !== 'draft' && existing.status !== 'submitted') {
    throw new Error(`Cannot update a request in '${existing.status}' status`);
  }

  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  const setField = (col: string, val: any) => {
    fields.push(`${col} = $${paramIndex++}`);
    params.push(val);
  };

  if (input.customer_company !== undefined) setField('customer_company', input.customer_company);
  if (input.customer_first_name !== undefined) setField('customer_first_name', input.customer_first_name || null);
  if (input.customer_last_name !== undefined) setField('customer_last_name', input.customer_last_name || null);
  if (input.customer_email !== undefined) setField('customer_email', input.customer_email || null);
  if (input.customer_phone !== undefined) setField('customer_phone', input.customer_phone || null);
  if (input.car_number !== undefined) setField('car_number', input.car_number);
  if (input.current_railroad !== undefined) setField('current_railroad', input.current_railroad || null);
  if (input.current_location_city !== undefined) setField('current_location_city', input.current_location_city || null);
  if (input.current_location_state !== undefined) setField('current_location_state', input.current_location_state || null);
  if (input.next_railroad !== undefined) setField('next_railroad', input.next_railroad || null);
  if (input.next_location_city !== undefined) setField('next_location_city', input.next_location_city || null);
  if (input.next_location_state !== undefined) setField('next_location_state', input.next_location_state || null);
  if (input.stcc_or_un_number !== undefined) setField('stcc_or_un_number', input.stcc_or_un_number || null);
  if (input.residue_clean !== undefined) setField('residue_clean', input.residue_clean);
  if (input.gasket !== undefined) setField('gasket', input.gasket);
  if (input.o_rings !== undefined) setField('o_rings', input.o_rings);
  if (input.last_known_commodity !== undefined) setField('last_known_commodity', input.last_known_commodity || null);
  if (input.lining_current !== undefined) setField('lining_current', input.lining_current || null);
  if (input.lining_alternative !== undefined) setField('lining_alternative', input.lining_alternative || null);
  if (input.preferred_shop_code !== undefined) setField('preferred_shop_code', input.preferred_shop_code || null);
  if (input.mobile_repair_unit !== undefined) setField('mobile_repair_unit', input.mobile_repair_unit);
  if (input.shopping_type_code !== undefined) setField('shopping_type_code', input.shopping_type_code || null);
  if (input.shopping_reason_code !== undefined) setField('shopping_reason_code', input.shopping_reason_code || null);
  if (input.clean_grade !== undefined) setField('clean_grade', input.clean_grade || null);
  if (input.is_kosher !== undefined) setField('is_kosher', input.is_kosher);
  if (input.is_food_grade !== undefined) setField('is_food_grade', input.is_food_grade);
  if (input.dry_grade !== undefined) setField('dry_grade', input.dry_grade || null);
  if (input.disposition_city !== undefined) setField('disposition_city', input.disposition_city || null);
  if (input.disposition_state !== undefined) setField('disposition_state', input.disposition_state || null);
  if (input.disposition_route !== undefined) setField('disposition_route', input.disposition_route || null);
  if (input.disposition_payer_of_freight !== undefined) setField('disposition_payer_of_freight', input.disposition_payer_of_freight || null);
  if (input.disposition_comment !== undefined) setField('disposition_comment', input.disposition_comment || null);
  if (input.one_time_movement_approval !== undefined) setField('one_time_movement_approval', input.one_time_movement_approval);
  if (input.comments !== undefined) setField('comments', input.comments || null);

  if (fields.length === 0) {
    return existing;
  }

  setField('updated_by_id', userId);
  fields.push(`version = version + 1`);

  const result = await queryOne<ShoppingRequest>(
    `UPDATE shopping_requests SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    [...params, id]
  );

  return result!;
}

// ---------------------------------------------------------------------------
// Approve — creates a shopping event in REQUESTED state
// ---------------------------------------------------------------------------

export async function approveShoppingRequest(
  id: string,
  userId: string,
  shopCode: string,
  notes?: string
): Promise<ShoppingRequest> {
  return transaction(async (client) => {
    // Lock the row
    const lockResult = await client.query(
      `SELECT * FROM shopping_requests WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (lockResult.rows.length === 0) {
      throw new Error('Shopping request not found');
    }
    const req = lockResult.rows[0];
    if (req.status !== 'submitted' && req.status !== 'under_review') {
      throw new Error(`Cannot approve a request in '${req.status}' status`);
    }

    // Generate event number and create shopping event
    const eventNumResult = await client.query(`SELECT generate_event_number()`, []);
    const eventNumber = eventNumResult.rows[0].generate_event_number;

    const eventResult = await client.query(
      `INSERT INTO shopping_events (
        event_number, car_number, shop_code, state,
        shopping_type_code, shopping_reason_code, created_by_id
      ) VALUES ($1, $2, $3, 'REQUESTED', $4, $5, $6)
      RETURNING id`,
      [
        eventNumber,
        req.car_number,
        shopCode,
        req.shopping_type_code || null,
        req.shopping_reason_code || null,
        userId,
      ]
    );
    const eventId = eventResult.rows[0].id;

    // Update the shopping request
    const updateResult = await client.query(
      `UPDATE shopping_requests
       SET status = 'approved',
           preferred_shop_code = $1,
           shopping_event_id = $2,
           reviewed_at = NOW(),
           reviewed_by_id = $3,
           review_notes = $4,
           updated_by_id = $3,
           version = version + 1
       WHERE id = $5
       RETURNING *`,
      [shopCode, eventId, userId, notes || null, id]
    );

    // If linked to a bad order, update its status
    if (req.bad_order_report_id) {
      await client.query(
        `UPDATE bad_order_reports
         SET status = 'assigned', resolution_action = 'repair_only'
         WHERE id = $1 AND status IN ('open', 'pending_decision')`,
        [req.bad_order_report_id]
      );
    }

    return updateResult.rows[0];
  });
}

// ---------------------------------------------------------------------------
// Reject
// ---------------------------------------------------------------------------

export async function rejectShoppingRequest(
  id: string,
  userId: string,
  notes: string
): Promise<ShoppingRequest> {
  const existing = await getShoppingRequest(id);
  if (!existing) throw new Error('Shopping request not found');
  if (existing.status !== 'submitted' && existing.status !== 'under_review') {
    throw new Error(`Cannot reject a request in '${existing.status}' status`);
  }

  const result = await queryOne<ShoppingRequest>(
    `UPDATE shopping_requests
     SET status = 'rejected',
         reviewed_at = NOW(),
         reviewed_by_id = $1,
         review_notes = $2,
         updated_by_id = $1,
         version = version + 1
     WHERE id = $3
     RETURNING *`,
    [userId, notes, id]
  );

  return result!;
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelShoppingRequest(
  id: string,
  userId: string
): Promise<ShoppingRequest> {
  const existing = await getShoppingRequest(id);
  if (!existing) throw new Error('Shopping request not found');
  if (existing.status === 'approved' || existing.status === 'cancelled') {
    throw new Error(`Cannot cancel a request in '${existing.status}' status`);
  }

  const result = await queryOne<ShoppingRequest>(
    `UPDATE shopping_requests
     SET status = 'cancelled',
         updated_by_id = $1,
         version = version + 1
     WHERE id = $2
     RETURNING *`,
    [userId, id]
  );

  return result!;
}
