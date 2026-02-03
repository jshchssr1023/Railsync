/**
 * Invoice Service
 * CRUD operations for invoice management
 */

import { query, queryOne } from '../config/database';

// Constants
export const VARIANCE_THRESHOLD = 0.03; // 3%

// Types
export type InvoiceStatus = 'pending' | 'auto_approved' | 'manual_review' | 'approved' | 'rejected' | 'sent_to_sap';
export type MatchStatus = 'pending' | 'exact_match' | 'close_match' | 'no_match' | 'manually_matched';
export type MatchType = 'exact' | 'close' | 'manual';
export type FileFormat = 'pdf' | 'edi500';

export interface Invoice {
  id: string;
  invoice_number: string;
  vendor_code?: string;
  shop_code?: string;
  invoice_date: Date;
  received_date: Date;
  invoice_total: number;
  brc_total?: number;
  variance_amount?: number;
  variance_pct?: number;
  status: InvoiceStatus;
  match_count: number;
  exact_match_count: number;
  close_match_count: number;
  unmatched_count: number;
  reviewed_by?: string;
  reviewed_at?: Date;
  approval_notes?: string;
  sap_document_id?: string;
  sent_to_sap_at?: Date;
  sap_response?: Record<string, unknown>;
  original_filename?: string;
  file_format?: FileFormat;
  file_path?: string;
  file_size_bytes?: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  line_number: number;
  car_number?: string;
  brc_number?: string;
  job_code?: string;
  why_made_code?: string;
  labor_amount: number;
  material_amount: number;
  total_amount: number;
  description?: string;
  match_status: MatchStatus;
  matched_allocation_id?: string;
  match_confidence?: number;
  match_notes?: string;
  manually_verified: boolean;
  verified_by?: string;
  verified_at?: Date;
}

export interface InvoiceBrcMatch {
  id: string;
  invoice_id: string;
  allocation_id: string;
  brc_number?: string;
  brc_total?: number;
  invoice_amount?: number;
  match_type: MatchType;
  created_at: Date;
}

export interface CreateInvoiceInput {
  invoice_number: string;
  vendor_code?: string;
  shop_code?: string;
  invoice_date: Date | string;
  invoice_total: number;
  original_filename?: string;
  file_format?: FileFormat;
  file_path?: string;
  file_size_bytes?: number;
  created_by?: string;
}

export interface CreateLineItemInput {
  invoice_id: string;
  line_number: number;
  car_number?: string;
  brc_number?: string;
  job_code?: string;
  why_made_code?: string;
  labor_amount?: number;
  material_amount?: number;
  total_amount: number;
  description?: string;
}

// ============================================================================
// INVOICE CRUD
// ============================================================================

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const result = await query<Invoice>(
    `INSERT INTO invoices (
      invoice_number, vendor_code, shop_code, invoice_date, invoice_total,
      original_filename, file_format, file_path, file_size_bytes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      input.invoice_number,
      input.vendor_code || null,
      input.shop_code || null,
      input.invoice_date,
      input.invoice_total,
      input.original_filename || null,
      input.file_format || null,
      input.file_path || null,
      input.file_size_bytes || null,
      input.created_by || null,
    ]
  );
  return result[0];
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  return queryOne<Invoice>('SELECT * FROM v_invoice_summary WHERE id = $1', [id]);
}

export async function listInvoices(filters: {
  status?: InvoiceStatus | InvoiceStatus[];
  shop_code?: string;
  start_date?: Date | string;
  end_date?: Date | string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ invoices: Invoice[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number | Date)[] = [];
  let paramIndex = 1;

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(`status = ANY($${paramIndex++})`);
      params.push(filters.status as unknown as string);
    } else {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
  }

  if (filters.shop_code) {
    conditions.push(`shop_code = $${paramIndex++}`);
    params.push(filters.shop_code);
  }

  if (filters.start_date) {
    conditions.push(`invoice_date >= $${paramIndex++}`);
    params.push(filters.start_date);
  }

  if (filters.end_date) {
    conditions.push(`invoice_date <= $${paramIndex++}`);
    params.push(filters.end_date);
  }

  // Search across invoice_number, vendor_code, shop_code, shop_name
  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    conditions.push(`(
      invoice_number ILIKE $${paramIndex++}
      OR vendor_code ILIKE $${paramIndex++}
      OR shop_code ILIKE $${paramIndex++}
      OR shop_name ILIKE $${paramIndex++}
    )`);
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM v_invoice_summary ${whereClause}`,
    params
  );
  const total = parseInt(countResult[0]?.count || '0');

  // Data
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  const invoices = await query<Invoice>(
    `SELECT * FROM v_invoice_summary ${whereClause}
     ORDER BY received_date DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return { invoices, total };
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  reviewedBy?: string,
  notes?: string
): Promise<Invoice | null> {
  const result = await query<Invoice>(
    `UPDATE invoices SET
      status = $2,
      reviewed_by = COALESCE($3, reviewed_by),
      reviewed_at = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE reviewed_at END,
      approval_notes = COALESCE($4, approval_notes)
    WHERE id = $1
    RETURNING *`,
    [id, status, reviewedBy || null, notes || null]
  );
  return result[0] || null;
}

export async function updateInvoiceMatchStats(
  id: string,
  stats: {
    brc_total: number;
    variance_amount: number;
    variance_pct: number;
    match_count: number;
    exact_match_count: number;
    close_match_count: number;
    unmatched_count: number;
  }
): Promise<Invoice | null> {
  const result = await query<Invoice>(
    `UPDATE invoices SET
      brc_total = $2,
      variance_amount = $3,
      variance_pct = $4,
      match_count = $5,
      exact_match_count = $6,
      close_match_count = $7,
      unmatched_count = $8
    WHERE id = $1
    RETURNING *`,
    [
      id,
      stats.brc_total,
      stats.variance_amount,
      stats.variance_pct,
      stats.match_count,
      stats.exact_match_count,
      stats.close_match_count,
      stats.unmatched_count,
    ]
  );
  return result[0] || null;
}

export async function markInvoiceSentToSap(
  id: string,
  sapDocumentId: string,
  response?: Record<string, unknown>
): Promise<Invoice | null> {
  const result = await query<Invoice>(
    `UPDATE invoices SET
      status = 'sent_to_sap',
      sap_document_id = $2,
      sent_to_sap_at = NOW(),
      sap_response = $3
    WHERE id = $1
    RETURNING *`,
    [id, sapDocumentId, response ? JSON.stringify(response) : null]
  );
  return result[0] || null;
}

// ============================================================================
// LINE ITEMS
// ============================================================================

export async function createLineItem(input: CreateLineItemInput): Promise<InvoiceLineItem> {
  const result = await query<InvoiceLineItem>(
    `INSERT INTO invoice_line_items (
      invoice_id, line_number, car_number, brc_number, job_code, why_made_code,
      labor_amount, material_amount, total_amount, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      input.invoice_id,
      input.line_number,
      input.car_number || null,
      input.brc_number || null,
      input.job_code || null,
      input.why_made_code || null,
      input.labor_amount || 0,
      input.material_amount || 0,
      input.total_amount,
      input.description || null,
    ]
  );
  return result[0];
}

export async function createLineItemsBatch(items: CreateLineItemInput[]): Promise<number> {
  if (items.length === 0) return 0;

  const values: string[] = [];
  const params: (string | number | null)[] = [];
  let paramIndex = 1;

  for (const item of items) {
    values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
    params.push(
      item.invoice_id,
      item.line_number,
      item.car_number || null,
      item.brc_number || null,
      item.job_code || null,
      item.why_made_code || null,
      item.labor_amount || 0,
      item.material_amount || 0,
      item.total_amount,
      item.description || null
    );
  }

  await query(
    `INSERT INTO invoice_line_items (
      invoice_id, line_number, car_number, brc_number, job_code, why_made_code,
      labor_amount, material_amount, total_amount, description
    ) VALUES ${values.join(', ')}`,
    params
  );

  return items.length;
}

export async function getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
  return query<InvoiceLineItem>(
    `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY line_number`,
    [invoiceId]
  );
}

export async function updateLineItemMatch(
  lineId: string,
  matchStatus: MatchStatus,
  allocationId?: string,
  confidence?: number,
  notes?: string
): Promise<InvoiceLineItem | null> {
  const result = await query<InvoiceLineItem>(
    `UPDATE invoice_line_items SET
      match_status = $2,
      matched_allocation_id = $3,
      match_confidence = $4,
      match_notes = $5
    WHERE id = $1
    RETURNING *`,
    [lineId, matchStatus, allocationId || null, confidence || null, notes || null]
  );
  return result[0] || null;
}

export async function verifyLineItem(
  lineId: string,
  verifiedBy: string
): Promise<InvoiceLineItem | null> {
  const result = await query<InvoiceLineItem>(
    `UPDATE invoice_line_items SET
      manually_verified = TRUE,
      verified_by = $2,
      verified_at = NOW()
    WHERE id = $1
    RETURNING *`,
    [lineId, verifiedBy]
  );
  return result[0] || null;
}

// ============================================================================
// BRC MATCHES
// ============================================================================

export async function createBrcMatch(
  invoiceId: string,
  allocationId: string,
  matchType: MatchType,
  brcNumber?: string,
  brcTotal?: number,
  invoiceAmount?: number
): Promise<InvoiceBrcMatch> {
  const result = await query<InvoiceBrcMatch>(
    `INSERT INTO invoice_brc_matches (
      invoice_id, allocation_id, brc_number, brc_total, invoice_amount, match_type
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [invoiceId, allocationId, brcNumber || null, brcTotal || null, invoiceAmount || null, matchType]
  );
  return result[0];
}

export async function getInvoiceBrcMatches(invoiceId: string): Promise<InvoiceBrcMatch[]> {
  return query<InvoiceBrcMatch>(
    `SELECT * FROM invoice_brc_matches WHERE invoice_id = $1`,
    [invoiceId]
  );
}

// ============================================================================
// COMPARISON
// ============================================================================

export interface InvoiceComparison {
  invoice: Invoice;
  line_items: InvoiceLineItem[];
  brc_matches: (InvoiceBrcMatch & {
    allocation_car_number?: string;
    allocation_shop_code?: string;
    allocation_actual_cost?: number;
    allocation_job_codes?: { code: string; amount: number }[];
  })[];
  summary: {
    invoice_total: number;
    brc_total: number;
    variance_amount: number;
    variance_pct: number;
    within_tolerance: boolean;
    exact_matches: number;
    close_matches: number;
    unmatched: number;
  };
}

export async function getInvoiceComparison(invoiceId: string): Promise<InvoiceComparison | null> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return null;

  const lineItems = await getInvoiceLineItems(invoiceId);

  const brcMatches = await query<InvoiceBrcMatch & {
    allocation_car_number?: string;
    allocation_shop_code?: string;
    allocation_actual_cost?: number;
    allocation_job_codes?: { code: string; amount: number }[];
  }>(
    `SELECT ibm.*,
      a.car_number as allocation_car_number,
      a.shop_code as allocation_shop_code,
      a.actual_cost as allocation_actual_cost,
      a.actual_cost_breakdown->'job_codes' as allocation_job_codes
    FROM invoice_brc_matches ibm
    JOIN allocations a ON ibm.allocation_id = a.id
    WHERE ibm.invoice_id = $1`,
    [invoiceId]
  );

  const brcTotal = brcMatches.reduce((sum, m) => sum + (m.brc_total || 0), 0);
  const varianceAmount = invoice.invoice_total - brcTotal;
  const variancePct = brcTotal > 0 ? (varianceAmount / brcTotal) * 100 : 0;

  return {
    invoice,
    line_items: lineItems,
    brc_matches: brcMatches,
    summary: {
      invoice_total: invoice.invoice_total,
      brc_total: brcTotal,
      variance_amount: varianceAmount,
      variance_pct: variancePct,
      within_tolerance: Math.abs(variancePct) <= VARIANCE_THRESHOLD * 100,
      exact_matches: lineItems.filter(l => l.match_status === 'exact_match').length,
      close_matches: lineItems.filter(l => l.match_status === 'close_match').length,
      unmatched: lineItems.filter(l => l.match_status === 'no_match' || l.match_status === 'pending').length,
    },
  };
}

// ============================================================================
// APPROVAL QUEUE
// ============================================================================

export async function getApprovalQueueStats(): Promise<{
  status: string;
  count: number;
  total_amount: number;
  avg_variance_pct: number;
}[]> {
  return query<{
    status: string;
    count: number;
    total_amount: number;
    avg_variance_pct: number;
  }>('SELECT * FROM v_invoice_approval_queue');
}

export async function getPendingReviewInvoices(): Promise<Invoice[]> {
  return query<Invoice>('SELECT * FROM v_invoices_pending_review');
}

export default {
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoiceStatus,
  updateInvoiceMatchStats,
  markInvoiceSentToSap,
  createLineItem,
  createLineItemsBatch,
  getInvoiceLineItems,
  updateLineItemMatch,
  verifyLineItem,
  createBrcMatch,
  getInvoiceBrcMatches,
  getInvoiceComparison,
  getApprovalQueueStats,
  getPendingReviewInvoices,
  VARIANCE_THRESHOLD,
};
