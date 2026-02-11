/**
 * SAP Integration Service
 * Handles pushing approved costs, billing triggers, mileage data, and invoices to SAP.
 *
 * DUAL-MODE: Real SAP OData/REST when SAP_API_URL is configured, mock otherwise.
 * SAP S/4HANA REST API — targets BAPI_ACC_DOCUMENT_POST equivalent via OData.
 *
 * Required env vars for live mode:
 *   SAP_API_URL          - e.g. https://sap-host:port/sap/opu/odata/sap/API_JOURNAL_ENTRY_SRV
 *   SAP_CLIENT_ID        - OAuth2 client ID
 *   SAP_CLIENT_SECRET    - OAuth2 client secret
 *   SAP_TOKEN_URL        - OAuth2 token endpoint
 *   SAP_COMPANY_CODE     - Default company code (e.g. '1000')
 *   SAP_CLIENT           - SAP client number (e.g. '100')
 */

import { query, queryOne } from '../config/database';
import * as invoiceService from './invoice.service';
import logger from '../config/logger';
import { fetchWithTimeout, sapCircuitBreaker } from './circuit-breaker';

// ============================================================================
// CONFIG
// ============================================================================

interface SAPConfig {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  companyCode: string;
  sapClient: string;
  isLive: boolean;
}

function getSAPConfig(): SAPConfig {
  const apiUrl = process.env.SAP_API_URL || '';
  return {
    apiUrl,
    clientId: process.env.SAP_CLIENT_ID || '',
    clientSecret: process.env.SAP_CLIENT_SECRET || '',
    tokenUrl: process.env.SAP_TOKEN_URL || '',
    companyCode: process.env.SAP_COMPANY_CODE || '1000',
    sapClient: process.env.SAP_CLIENT || '100',
    isLive: !!apiUrl,
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface SAPPushRequest {
  invoice_id: string;
  invoice_number: string;
  vendor_code: string;
  invoice_date: Date;
  invoice_total: number;
  line_items: {
    car_number: string;
    job_code?: string;
    why_made_code?: string;
    amount: number;
    description?: string;
  }[];
}

export interface SAPPushResponse {
  success: boolean;
  sap_document_id?: string;
  error?: string;
  error_code?: string;
  response_data?: Record<string, unknown>;
}

interface SyncLogEntry {
  id: string;
  system_name: string;
  operation: string;
  direction: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_ref: string | null;
  status: string;
  payload: unknown;
  response: unknown;
  error_message: string | null;
  external_id: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

interface SAPFieldMapping {
  railsync_field: string;
  sap_field: string;
  sap_structure: string | null;
  transform_rule: string;
  transform_config: Record<string, unknown>;
  is_required: boolean;
  default_value: string | null;
}

// SAP OData journal entry structures
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SAPJournalHeader {
  CompanyCode: string;
  DocumentDate: string;
  PostingDate: string;
  DocumentType: string;
  DocumentReferenceID?: string;
  DocumentHeaderText?: string;
  AccountingDocumentType: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SAPJournalItem {
  GLAccount?: string;
  DebitCreditCode: string;
  AmountInTransactionCurrency: string;
  TransactionCurrency: string;
  CostCenter?: string;
  ProfitCenter?: string;
  AssignmentReference?: string;
  DocumentItemText?: string;
  Supplier?: string;
  Customer?: string;
}

// ============================================================================
// OAUTH2 TOKEN MANAGEMENT
// ============================================================================

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getOAuthToken(config: SAPConfig): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expires_at > Date.now() + 60000) {
    return cachedToken.access_token;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetchWithTimeout(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  }, 15_000); // 15s timeout for token requests

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SAP OAuth2 token request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  // Update token refresh time
  await query(
    `UPDATE integration_connection_status
     SET last_token_refresh_at = NOW(), token_expires_at = $1, updated_at = NOW()
     WHERE system_name = 'sap'`,
    [new Date(cachedToken.expires_at)]
  ).catch(() => { /* non-critical */ });

  return cachedToken.access_token;
}

// ============================================================================
// SAP HTTP CLIENT
// ============================================================================

async function sapRequestInternal(
  config: SAPConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const token = await getOAuthToken(config);
  const url = `${config.apiUrl}${path}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'sap-client': config.sapClient,
    'X-CSRF-Token': 'fetch', // Will be obtained separately for writes
  };

  // For POST/PUT, fetch CSRF token first
  if (method !== 'GET') {
    try {
      const csrfRes = await fetchWithTimeout(config.apiUrl, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-CSRF-Token': 'Fetch',
          'sap-client': config.sapClient,
        },
      }, 10_000); // 10s timeout for CSRF fetch
      const csrfToken = csrfRes.headers.get('x-csrf-token');
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    } catch {
      // CSRF fetch failed — proceed anyway, some endpoints don't require it
    }
  }

  const response = await fetchWithTimeout(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }, 30_000); // 30s timeout for SAP data requests

  const responseText = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { raw: responseText };
  }

  return { ok: response.ok, status: response.status, data };
}

/**
 * SAP HTTP client wrapped with circuit breaker.
 * When the circuit is OPEN, requests are rejected immediately to avoid
 * piling up connections to an unresponsive SAP system.
 */
async function sapRequest(
  config: SAPConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return sapCircuitBreaker.execute(() => sapRequestInternal(config, method, path, body));
}

// ============================================================================
// FIELD MAPPING ENGINE
// ============================================================================

async function getFieldMappings(documentType: string): Promise<SAPFieldMapping[]> {
  return query<SAPFieldMapping>(
    `SELECT railsync_field, sap_field, sap_structure, transform_rule,
            transform_config, is_required, default_value
     FROM sap_field_mappings
     WHERE document_type = $1 AND is_active = TRUE
     ORDER BY sort_order`,
    [documentType]
  );
}

function transformValue(value: unknown, rule: string, config: Record<string, unknown>): string {
  if (value === null || value === undefined) return '';

  switch (rule) {
    case 'date_format': {
      // Convert to SAP date format (YYYYMMDD or ISO)
      const d = new Date(value as string);
      if (isNaN(d.getTime())) return String(value);
      const fmt = (config.format as string) || 'ISO';
      if (fmt === 'YYYYMMDD') {
        return d.toISOString().slice(0, 10).replace(/-/g, '');
      }
      return d.toISOString().slice(0, 10); // yyyy-mm-dd for OData
    }
    case 'decimal_scale': {
      const scale = (config.scale as number) || 2;
      return Number(value).toFixed(scale);
    }
    case 'lookup':
      // Placeholder for table lookups — would query a mapping table
      return String(value);
    case 'concat': {
      const sep = (config.separator as string) || '';
      const fields = (config.fields as string[]) || [];
      if (typeof value === 'object' && value !== null) {
        return fields.map(f => (value as Record<string, unknown>)[f] || '').join(sep);
      }
      return String(value);
    }
    default:
      return String(value);
  }
}

function buildSAPPayload(
  mappings: SAPFieldMapping[],
  sourceData: Record<string, unknown>
): { header: Record<string, string>; items: Record<string, string>[] } {
  const header: Record<string, string> = {};
  const itemFields: Record<string, string> = {};

  for (const mapping of mappings) {
    const rawValue = sourceData[mapping.railsync_field] ?? mapping.default_value;
    if (mapping.is_required && (rawValue === null || rawValue === undefined)) {
      throw new Error(`Required SAP field missing: ${mapping.railsync_field} → ${mapping.sap_field}`);
    }

    const transformed = transformValue(rawValue, mapping.transform_rule, mapping.transform_config as Record<string, unknown>);

    if (mapping.sap_structure === 'BKPF' || mapping.sap_structure === null) {
      header[mapping.sap_field] = transformed;
    } else {
      itemFields[mapping.sap_field] = transformed;
    }
  }

  return { header, items: Object.keys(itemFields).length > 0 ? [itemFields] : [] };
}

// ============================================================================
// SAP DOCUMENT TRACKING
// ============================================================================

async function recordSAPDocument(
  documentType: string,
  sapDocNumber: string | null,
  entityType: string,
  entityId: string,
  entityRef: string | null,
  sapResponse: unknown,
  syncLogId: string,
  userId?: string
): Promise<void> {
  const config = getSAPConfig();
  await query(
    `INSERT INTO sap_documents
       (document_type, sap_document_number, sap_company_code, sap_fiscal_year,
        sap_posting_date, railsync_entity_type, railsync_entity_id, railsync_entity_ref,
        status, sap_response, sync_log_id, posted_by)
     VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, $10, $11)`,
    [
      documentType,
      sapDocNumber,
      config.companyCode,
      new Date().getFullYear(),
      entityType,
      entityId,
      entityRef,
      sapDocNumber ? 'posted' : 'error',
      JSON.stringify(sapResponse),
      syncLogId,
      userId || null,
    ]
  );
}

// ============================================================================
// SYNC LOG HELPERS
// ============================================================================

async function createSyncLog(
  operation: string,
  entityType: string,
  entityId: string | null,
  entityRef: string | null,
  payload: unknown,
  userId?: string
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO integration_sync_log
       (system_name, operation, direction, entity_type, entity_id, entity_ref, status, payload, initiated_by, started_at)
     VALUES ('sap', $1, 'push', $2, $3, $4, 'in_progress', $5, $6, NOW())
     RETURNING id`,
    [operation, entityType, entityId, entityRef, JSON.stringify(payload), userId || null]
  );
  return row!.id;
}

async function completeSyncLog(
  logId: string,
  success: boolean,
  externalId: string | null,
  response: unknown,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE integration_sync_log
     SET status = $1, external_id = $2, response = $3, error_message = $4,
         completed_at = NOW(), updated_at = NOW()
     WHERE id = $5`,
    [
      success ? 'success' : 'failed',
      externalId,
      JSON.stringify(response),
      errorMessage || null,
      logId,
    ]
  );
}

function mockSAPDocId(): string {
  return `SAP${Date.now()}`;
}

// ============================================================================
// PARSE SAP ERROR RESPONSE
// ============================================================================

function parseSAPError(data: Record<string, unknown>): { code: string; message: string } {
  // OData error format
  if (data.error && typeof data.error === 'object') {
    const err = data.error as Record<string, unknown>;
    const message = (err.message as Record<string, string>)?.value || String(err.message) || 'Unknown SAP error';
    const code = String(err.code || 'SAP_ERROR');
    return { code, message };
  }
  // BAPI return format
  if (Array.isArray(data.RETURN)) {
    const errors = (data.RETURN as Record<string, string>[]).filter(r => r.TYPE === 'E' || r.TYPE === 'A');
    if (errors.length > 0) {
      return { code: errors[0].NUMBER || 'BAPI_ERROR', message: errors.map(e => e.MESSAGE).join('; ') };
    }
  }
  return { code: 'UNKNOWN', message: JSON.stringify(data).slice(0, 500) };
}

// ============================================================================
// CHECK CONNECTION
// ============================================================================

export async function checkSAPConnection(): Promise<{
  connected: boolean;
  mode: string;
  last_check: Date;
  last_success: Date | null;
  api_url?: string;
  error?: string;
}> {
  const config = getSAPConfig();

  if (!config.isLive) {
    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), is_connected = TRUE, mode = 'mock', updated_at = NOW()
       WHERE system_name = 'sap'`
    );
    return { connected: true, mode: 'mock', last_check: new Date(), last_success: null };
  }

  // Live mode — test connection
  try {
    const token = await getOAuthToken(config);
    const response = await fetchWithTimeout(`${config.apiUrl}/$metadata`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/xml',
        'sap-client': config.sapClient,
      },
    }, 15_000); // 15s timeout for connection check

    const connected = response.ok;
    const now = new Date();

    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), is_connected = $1, mode = 'live',
           last_success_at = CASE WHEN $1 THEN NOW() ELSE last_success_at END,
           last_error = $2, updated_at = NOW()
       WHERE system_name = 'sap'`,
      [connected, connected ? null : `HTTP ${response.status}`]
    );

    return {
      connected,
      mode: 'live',
      last_check: now,
      last_success: connected ? now : null,
      api_url: config.apiUrl.replace(/\/\/.*:.*@/, '//***:***@'), // mask credentials in URL
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Connection failed';
    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), is_connected = FALSE, mode = 'live', last_error = $1, updated_at = NOW()
       WHERE system_name = 'sap'`,
      [errorMsg]
    );
    return { connected: false, mode: 'live', last_check: new Date(), last_success: null, error: errorMsg };
  }
}

// ============================================================================
// PUSH APPROVED COSTS (Allocations → SAP SPV)
// ============================================================================

export async function pushApprovedCosts(
  allocationId: string,
  userId?: string
): Promise<SAPPushResponse> {
  const config = getSAPConfig();

  const allocation = await queryOne<{
    id: string;
    car_number: string;
    shop_code: string | null;
    target_month: string;
    estimated_cost: number;
    actual_cost: number | null;
    status: string;
    plan_id: string | null;
  }>(
    `SELECT id, car_number, shop_code, target_month, estimated_cost, actual_cost, status, plan_id
     FROM allocations WHERE id = $1`,
    [allocationId]
  );

  if (!allocation) {
    return { success: false, error: 'Allocation not found' };
  }

  const costAmount = allocation.actual_cost || allocation.estimated_cost;

  // Build payload with field mappings
  const sourceData: Record<string, unknown> = {
    company_code: config.companyCode,
    fiscal_year: new Date().getFullYear(),
    fiscal_period: allocation.target_month ? parseInt(allocation.target_month.split('-')[1]) : new Date().getMonth() + 1,
    gl_account: '5010000', // Maintenance cost GL
    cost_center: allocation.shop_code || '',
    amount: costAmount,
    assignment_ref: allocation.car_number,
    item_text: `SPV cost allocation: ${allocation.car_number} - ${allocation.target_month}`,
  };

  const logId = await createSyncLog(
    'push_approved_costs', 'allocation', allocationId, allocation.car_number, sourceData, userId
  );

  if (!config.isLive) {
    // Mock mode
    const docId = mockSAPDocId();
    const mockResponse = {
      status: 'CREATED',
      document_id: docId,
      document_type: 'SPV_COST_ALLOCATION',
      timestamp: new Date().toISOString(),
      message: 'Cost allocation posted (mock)',
    };
    logger.info({ car: allocation.car_number, cost: costAmount }, '[SAP MOCK] push_approved_costs');
    await recordSAPDocument('SPV_COST', docId, 'allocation', allocationId, allocation.car_number, mockResponse, logId, userId);
    await completeSyncLog(logId, true, docId, mockResponse);
    return { success: true, sap_document_id: docId, response_data: mockResponse };
  }

  // Live mode — post to SAP OData
  try {
    const mappings = await getFieldMappings('SPV_COST');
    const { header } = buildSAPPayload(mappings, sourceData);

    const journalEntry = {
      CompanyCode: header.BUKRS || config.companyCode,
      DocumentDate: `/Date(${Date.now()})/`,
      PostingDate: `/Date(${Date.now()})/`,
      AccountingDocumentType: 'SA',
      DocumentHeaderText: `SPV Cost: ${allocation.car_number}`,
      to_Item: {
        results: [
          {
            GLAccount: header.HKONT || '5010000',
            AmountInTransactionCurrency: String(costAmount),
            TransactionCurrency: 'USD',
            DebitCreditCode: 'S', // Debit
            CostCenter: header.KOSTL || '',
            DocumentItemText: header.SGTXT || `SPV: ${allocation.car_number}`,
            AssignmentReference: header.ZUONR || allocation.car_number,
          },
          {
            GLAccount: '2100000', // AP clearing
            AmountInTransactionCurrency: String(costAmount),
            TransactionCurrency: 'USD',
            DebitCreditCode: 'H', // Credit
            DocumentItemText: `SPV clearing: ${allocation.car_number}`,
          },
        ],
      },
    };

    const result = await sapRequest(config, 'POST', '/A_JournalEntry', journalEntry);

    if (result.ok) {
      const sapDocId = String(
        (result.data.d as Record<string, unknown>)?.AccountingDocument ||
        (result.data as Record<string, unknown>).AccountingDocument ||
        ''
      );
      await recordSAPDocument('SPV_COST', sapDocId, 'allocation', allocationId, allocation.car_number, result.data, logId, userId);
      await completeSyncLog(logId, true, sapDocId, result.data);
      return { success: true, sap_document_id: sapDocId, response_data: result.data };
    } else {
      const sapErr = parseSAPError(result.data);
      await recordSAPDocument('SPV_COST', null, 'allocation', allocationId, allocation.car_number, result.data, logId, userId);
      await completeSyncLog(logId, false, null, result.data, sapErr.message);
      return { success: false, error: sapErr.message, error_code: sapErr.code, response_data: result.data };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'SAP push failed';
    await completeSyncLog(logId, false, null, { error: errorMsg }, errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// PUSH BILLING TRIGGERS (Outbound invoices → SAP AR)
// ============================================================================

export async function pushBillingTrigger(
  outboundInvoiceId: string,
  userId?: string
): Promise<SAPPushResponse> {
  const config = getSAPConfig();

  const invoice = await queryOne<{
    id: string;
    invoice_number: string;
    customer_id: string;
    invoice_type: string;
    fiscal_year: number;
    fiscal_month: number;
    total_amount: number;
    status: string;
  }>(
    `SELECT id, invoice_number, customer_id, invoice_type, fiscal_year, fiscal_month, total_amount, status
     FROM outbound_invoices WHERE id = $1`,
    [outboundInvoiceId]
  );

  if (!invoice) return { success: false, error: 'Outbound invoice not found' };
  if (invoice.status !== 'approved' && invoice.status !== 'sent') {
    return { success: false, error: 'Invoice must be approved or sent before SAP push' };
  }

  // Get customer SAP code
  const customer = await queryOne<{ customer_code: string; customer_name: string }>(
    `SELECT customer_code, customer_name FROM customers WHERE id = $1`,
    [invoice.customer_id]
  );

  const documentClass = invoice.invoice_type === 'chargeback' ? 'DEBIT_MEMO' : 'INVOICE';

  const sourceData: Record<string, unknown> = {
    company_code: config.companyCode,
    document_date: new Date().toISOString().slice(0, 10),
    posting_date: new Date().toISOString().slice(0, 10),
    document_type: invoice.invoice_type === 'credit_memo' ? 'DG' : 'DR',
    reference: invoice.invoice_number,
    currency: 'USD',
    customer_number: customer?.customer_code || '',
    posting_key: invoice.invoice_type === 'credit_memo' ? '11' : '01',
    amount: invoice.total_amount,
    gl_account: '1100000', // AR account
    item_text: `${documentClass}: ${invoice.invoice_number} - ${customer?.customer_name || ''}`,
  };

  const logId = await createSyncLog(
    'push_billing_trigger', 'outbound_invoice', outboundInvoiceId, invoice.invoice_number, sourceData, userId
  );

  if (!config.isLive) {
    const docId = mockSAPDocId();
    const mockResponse = {
      status: 'CREATED',
      document_id: docId,
      document_type: documentClass,
      timestamp: new Date().toISOString(),
      message: `AR ${documentClass} posted (mock)`,
    };
    logger.info({ invoice: invoice.invoice_number, total: invoice.total_amount }, '[SAP MOCK] push_billing_trigger');
    await recordSAPDocument('AR_INVOICE', docId, 'outbound_invoice', outboundInvoiceId, invoice.invoice_number, mockResponse, logId, userId);
    await completeSyncLog(logId, true, docId, mockResponse);
    return { success: true, sap_document_id: docId, response_data: mockResponse };
  }

  // Live mode
  try {
    const mappings = await getFieldMappings('AR_INVOICE');
    const { header } = buildSAPPayload(mappings, sourceData);

    const journalEntry = {
      CompanyCode: header.BUKRS || config.companyCode,
      DocumentDate: `/Date(${Date.now()})/`,
      PostingDate: `/Date(${Date.now()})/`,
      AccountingDocumentType: header.BLART || 'DR',
      DocumentReferenceID: header.XBLNR || invoice.invoice_number,
      to_Item: {
        results: [
          {
            Customer: header.KUNNR || customer?.customer_code || '',
            DebitCreditCode: invoice.invoice_type === 'credit_memo' ? 'H' : 'S',
            AmountInTransactionCurrency: String(invoice.total_amount),
            TransactionCurrency: 'USD',
            DocumentItemText: header.SGTXT || `AR: ${invoice.invoice_number}`,
          },
          {
            GLAccount: header.HKONT || '4000000', // Revenue
            DebitCreditCode: invoice.invoice_type === 'credit_memo' ? 'S' : 'H',
            AmountInTransactionCurrency: String(invoice.total_amount),
            TransactionCurrency: 'USD',
            DocumentItemText: `Revenue: ${invoice.invoice_number}`,
          },
        ],
      },
    };

    const result = await sapRequest(config, 'POST', '/A_JournalEntry', journalEntry);

    if (result.ok) {
      const sapDocId = String(
        (result.data.d as Record<string, unknown>)?.AccountingDocument || ''
      );
      // Update outbound invoice status
      await query(
        `UPDATE outbound_invoices SET status = 'sent_to_sap', sap_document_id = $1, updated_at = NOW() WHERE id = $2`,
        [sapDocId, outboundInvoiceId]
      );
      await recordSAPDocument('AR_INVOICE', sapDocId, 'outbound_invoice', outboundInvoiceId, invoice.invoice_number, result.data, logId, userId);
      await completeSyncLog(logId, true, sapDocId, result.data);
      return { success: true, sap_document_id: sapDocId, response_data: result.data };
    } else {
      const sapErr = parseSAPError(result.data);
      await recordSAPDocument('AR_INVOICE', null, 'outbound_invoice', outboundInvoiceId, invoice.invoice_number, result.data, logId, userId);
      await completeSyncLog(logId, false, null, result.data, sapErr.message);
      return { success: false, error: sapErr.message, error_code: sapErr.code, response_data: result.data };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'SAP billing push failed';
    await completeSyncLog(logId, false, null, { error: errorMsg }, errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// PUSH MILEAGE (Mileage records → SAP)
// ============================================================================

export async function pushMileage(
  mileageRecordId: string,
  userId?: string
): Promise<SAPPushResponse> {
  const config = getSAPConfig();

  const record = await queryOne<{
    id: string;
    car_number: string;
    customer_id: string;
    reporting_period: string;
    total_miles: number;
    status: string;
  }>(
    `SELECT id, car_number, customer_id, reporting_period, total_miles, status
     FROM mileage_records WHERE id = $1`,
    [mileageRecordId]
  );

  if (!record) return { success: false, error: 'Mileage record not found' };

  const customer = await queryOne<{ customer_code: string }>(
    `SELECT customer_code FROM customers WHERE id = $1`,
    [record.customer_id]
  );

  const payload = {
    car_number: record.car_number,
    customer_code: customer?.customer_code || '',
    period: record.reporting_period,
    total_miles: record.total_miles,
    company_code: config.companyCode,
  };

  const logId = await createSyncLog(
    'push_mileage', 'mileage_record', mileageRecordId, record.car_number, payload, userId
  );

  if (!config.isLive) {
    const docId = mockSAPDocId();
    const mockResponse = {
      status: 'CREATED',
      document_id: docId,
      document_type: 'MILEAGE_POSTING',
      timestamp: new Date().toISOString(),
      message: 'Mileage posted (mock)',
    };
    logger.info({ car: record.car_number, miles: record.total_miles }, '[SAP MOCK] push_mileage');
    await recordSAPDocument('MILEAGE', docId, 'mileage_record', mileageRecordId, record.car_number, mockResponse, logId, userId);
    await completeSyncLog(logId, true, docId, mockResponse);
    return { success: true, sap_document_id: docId, response_data: mockResponse };
  }

  // Live mode — mileage posting via custom SAP service
  try {
    const mileagePayload = {
      CarNumber: record.car_number,
      CustomerNumber: customer?.customer_code || '',
      ReportingPeriod: record.reporting_period,
      TotalMiles: record.total_miles,
      CompanyCode: config.companyCode,
    };

    const result = await sapRequest(config, 'POST', '/ZZ_MILEAGE_SRV/MileagePostingSet', mileagePayload);

    if (result.ok) {
      const sapDocId = String(
        (result.data.d as Record<string, unknown>)?.DocumentNumber || ''
      );
      await query(
        `UPDATE mileage_records SET status = 'billed', updated_at = NOW() WHERE id = $1`,
        [mileageRecordId]
      );
      await recordSAPDocument('MILEAGE', sapDocId, 'mileage_record', mileageRecordId, record.car_number, result.data, logId, userId);
      await completeSyncLog(logId, true, sapDocId, result.data);
      return { success: true, sap_document_id: sapDocId, response_data: result.data };
    } else {
      const sapErr = parseSAPError(result.data);
      await completeSyncLog(logId, false, null, result.data, sapErr.message);
      return { success: false, error: sapErr.message, error_code: sapErr.code };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'SAP mileage push failed';
    await completeSyncLog(logId, false, null, { error: errorMsg }, errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// PUSH INVOICE TO SAP (inbound vendor invoices → SAP FI-AP)
// ============================================================================

export async function pushInvoiceToSAP(invoiceId: string, userId?: string): Promise<SAPPushResponse> {
  const config = getSAPConfig();
  const invoice = await invoiceService.getInvoice(invoiceId);
  if (!invoice) return { success: false, error: 'Invoice not found' };

  if (invoice.status !== 'approved' && invoice.status !== 'auto_approved') {
    return { success: false, error: 'Invoice must be approved before pushing to SAP' };
  }

  const lineItems = await invoiceService.getInvoiceLineItems(invoiceId);

  const sapPayload: SAPPushRequest = {
    invoice_id: invoiceId,
    invoice_number: invoice.invoice_number,
    vendor_code: invoice.vendor_code || '',
    invoice_date: invoice.invoice_date,
    invoice_total: invoice.invoice_total,
    line_items: lineItems.map(li => ({
      car_number: li.car_number || '',
      job_code: li.job_code,
      why_made_code: li.why_made_code,
      amount: li.total_amount,
      description: li.description,
    })),
  };

  const logId = await createSyncLog(
    'push_invoice', 'invoice', invoiceId, invoice.invoice_number, sapPayload, userId
  );

  if (!config.isLive) {
    const docId = mockSAPDocId();
    const mockResponse = {
      status: 'CREATED',
      document_id: docId,
      timestamp: new Date().toISOString(),
      message: 'Invoice document created (mock)',
    };
    logger.info({ invoice_number: sapPayload.invoice_number, total: sapPayload.invoice_total }, '[SAP MOCK] push_invoice');
    await invoiceService.markInvoiceSentToSap(invoiceId, docId, mockResponse);
    await recordSAPDocument('AP_INVOICE', docId, 'invoice', invoiceId, invoice.invoice_number, mockResponse, logId, userId);
    await completeSyncLog(logId, true, docId, mockResponse);
    return { success: true, sap_document_id: docId, response_data: mockResponse };
  }

  // Live mode — post AP invoice to SAP
  try {
    const mappings = await getFieldMappings('AP_INVOICE');
    const sourceData: Record<string, unknown> = {
      company_code: config.companyCode,
      document_date: invoice.invoice_date,
      posting_date: new Date().toISOString().slice(0, 10),
      document_type: 'RE', // Vendor invoice
      reference: invoice.invoice_number,
      header_text: `AP: ${invoice.invoice_number}`,
      currency: 'USD',
      vendor_code: invoice.vendor_code || '',
      posting_key: '31', // Vendor credit
      amount: invoice.invoice_total,
    };

    const { header } = buildSAPPayload(mappings, sourceData);

    // Build line items for each car/job
    const sapLineItems = sapPayload.line_items.map((li, idx) => ({
      GLAccount: '5010000', // Maintenance expense
      DebitCreditCode: 'S', // Debit
      AmountInTransactionCurrency: String(li.amount),
      TransactionCurrency: 'USD',
      AssignmentReference: li.car_number,
      DocumentItemText: li.description || `${li.car_number} - ${li.job_code || 'MAINT'}`,
      OrderID: li.why_made_code || '',
      ItemNumber: String((idx + 2) * 10).padStart(3, '0'),
    }));

    const journalEntry = {
      CompanyCode: header.BUKRS || config.companyCode,
      DocumentDate: `/Date(${new Date(invoice.invoice_date).getTime()})/`,
      PostingDate: `/Date(${Date.now()})/`,
      AccountingDocumentType: header.BLART || 'RE',
      DocumentReferenceID: header.XBLNR || invoice.invoice_number,
      DocumentHeaderText: header.BKTXT || `AP: ${invoice.invoice_number}`,
      to_Item: {
        results: [
          {
            Supplier: header.LIFNR || invoice.vendor_code || '',
            DebitCreditCode: 'H', // Credit vendor
            AmountInTransactionCurrency: String(invoice.invoice_total),
            TransactionCurrency: 'USD',
            DocumentItemText: `Vendor: ${invoice.invoice_number}`,
            ItemNumber: '010',
          },
          ...sapLineItems,
        ],
      },
    };

    const result = await sapRequest(config, 'POST', '/A_JournalEntry', journalEntry);

    if (result.ok) {
      const sapDocId = String(
        (result.data.d as Record<string, unknown>)?.AccountingDocument || ''
      );
      await invoiceService.markInvoiceSentToSap(invoiceId, sapDocId, result.data);
      await recordSAPDocument('AP_INVOICE', sapDocId, 'invoice', invoiceId, invoice.invoice_number, result.data, logId, userId);
      await completeSyncLog(logId, true, sapDocId, result.data);
      return { success: true, sap_document_id: sapDocId, response_data: result.data };
    } else {
      const sapErr = parseSAPError(result.data);
      await recordSAPDocument('AP_INVOICE', null, 'invoice', invoiceId, invoice.invoice_number, result.data, logId, userId);
      await completeSyncLog(logId, false, null, result.data, sapErr.message);
      return { success: false, error: sapErr.message, error_code: sapErr.code, response_data: result.data };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'SAP invoice push failed';
    await completeSyncLog(logId, false, null, { error: errorMsg }, errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

export async function batchPushToSAP(limit: number = 100): Promise<{
  processed: number;
  successful: number;
  failed: number;
  errors: { invoice_id: string; error: string }[];
}> {
  const pendingInvoices = await query<{ id: string }>(
    `SELECT id FROM invoices
     WHERE status IN ('approved', 'auto_approved')
       AND sap_document_id IS NULL
     ORDER BY approved_at ASC
     LIMIT $1`,
    [limit]
  );

  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [] as { invoice_id: string; error: string }[],
  };

  // Process in chunks of 10 for controlled concurrency
  const chunkSize = 10;
  for (let i = 0; i < pendingInvoices.length; i += chunkSize) {
    const chunk = pendingInvoices.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(
      chunk.map(inv => pushInvoiceToSAP(inv.id))
    );

    for (let j = 0; j < chunkResults.length; j++) {
      results.processed++;
      const r = chunkResults[j];
      if (r.status === 'fulfilled' && r.value.success) {
        results.successful++;
      } else {
        results.failed++;
        const error = r.status === 'fulfilled' ? r.value.error || 'Unknown error' : r.reason?.message || 'Unknown error';
        results.errors.push({ invoice_id: chunk[j].id, error });
      }
    }
  }

  return results;
}

// ============================================================================
// SYNC LOG QUERIES
// ============================================================================

export async function getSyncLog(filters?: {
  system?: string;
  status?: string;
  entity_type?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: SyncLogEntry[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters?.system) {
    conditions.push(`system_name = $${idx++}`);
    params.push(filters.system);
  }
  if (filters?.status) {
    conditions.push(`status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters?.entity_type) {
    conditions.push(`entity_type = $${idx++}`);
    params.push(filters.entity_type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const [entries, countResult] = await Promise.all([
    query<SyncLogEntry>(
      `SELECT * FROM integration_sync_log ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM integration_sync_log ${where}`,
      params
    ),
  ]);

  return { entries, total: parseInt(countResult?.count || '0', 10) };
}

export async function getSyncStats(): Promise<{
  total: number;
  pending: number;
  success: number;
  failed: number;
  by_system: { system_name: string; total: number; success: number; failed: number }[];
}> {
  const totals = await queryOne<{
    total: string;
    pending: string;
    success: string;
    failed: string;
  }>(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress', 'retrying')) as pending,
       COUNT(*) FILTER (WHERE status = 'success') as success,
       COUNT(*) FILTER (WHERE status = 'failed') as failed
     FROM integration_sync_log`
  );

  const bySystem = await query<{
    system_name: string;
    total: string;
    success: string;
    failed: string;
  }>(
    `SELECT
       system_name,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'success') as success,
       COUNT(*) FILTER (WHERE status = 'failed') as failed
     FROM integration_sync_log
     GROUP BY system_name`
  );

  return {
    total: parseInt(totals?.total || '0', 10),
    pending: parseInt(totals?.pending || '0', 10),
    success: parseInt(totals?.success || '0', 10),
    failed: parseInt(totals?.failed || '0', 10),
    by_system: bySystem.map(s => ({
      system_name: s.system_name,
      total: parseInt(s.total, 10),
      success: parseInt(s.success, 10),
      failed: parseInt(s.failed, 10),
    })),
  };
}

export async function retrySyncEntry(entryId: string): Promise<SAPPushResponse> {
  const entry = await queryOne<SyncLogEntry>(
    `SELECT * FROM integration_sync_log WHERE id = $1`,
    [entryId]
  );
  if (!entry) return { success: false, error: 'Sync log entry not found' };
  if (entry.status !== 'failed') return { success: false, error: 'Only failed entries can be retried' };

  // Check retry limit
  if (entry.retry_count >= 3) {
    return { success: false, error: 'Maximum retry count exceeded (3)' };
  }

  // Update retry count
  await query(
    `UPDATE integration_sync_log SET status = 'retrying', retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1`,
    [entryId]
  );

  // Re-dispatch based on operation type
  let result: SAPPushResponse;
  switch (entry.operation) {
    case 'push_approved_costs':
      result = await pushApprovedCosts(entry.entity_id!);
      break;
    case 'push_billing_trigger':
      result = await pushBillingTrigger(entry.entity_id!);
      break;
    case 'push_mileage':
      result = await pushMileage(entry.entity_id!);
      break;
    case 'push_invoice':
      result = await pushInvoiceToSAP(entry.entity_id!);
      break;
    default:
      result = { success: false, error: `Unknown operation: ${entry.operation}` };
  }

  // Update original entry status
  await query(
    `UPDATE integration_sync_log SET status = $1, updated_at = NOW() WHERE id = $2`,
    [result.success ? 'success' : 'failed', entryId]
  );

  return result;
}

export async function getConnectionStatuses(): Promise<{
  system_name: string;
  is_connected: boolean;
  mode: string;
  last_check_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}[]> {
  return query(
    `SELECT system_name, is_connected, mode, last_check_at, last_success_at, last_error
     FROM integration_connection_status
     ORDER BY system_name`
  );
}

// ============================================================================
// SAP PUSH HISTORY (legacy — for inbound invoices)
// ============================================================================

export async function getSAPPushHistory(invoiceId: string): Promise<{
  invoice_id: string;
  sap_document_id: string | null;
  sent_at: Date | null;
  response: Record<string, unknown> | null;
}[]> {
  const result = await query<{
    id: string;
    sap_document_id: string | null;
    sent_to_sap_at: Date | null;
    sap_response: Record<string, unknown> | null;
  }>(
    `SELECT id, sap_document_id, sent_to_sap_at, sap_response
     FROM invoices WHERE id = $1`,
    [invoiceId]
  );

  return result.map(r => ({
    invoice_id: r.id,
    sap_document_id: r.sap_document_id,
    sent_at: r.sent_to_sap_at,
    response: r.sap_response,
  }));
}

// ============================================================================
// FIELD MAPPING ADMIN
// ============================================================================

export async function getFieldMappingsByType(documentType: string): Promise<SAPFieldMapping[]> {
  return getFieldMappings(documentType);
}

export async function validateSAPPayload(
  documentType: string,
  sourceData: Record<string, unknown>
): Promise<{ valid: boolean; errors: string[]; preview: Record<string, unknown> }> {
  const mappings = await getFieldMappings(documentType);
  const errors: string[] = [];

  for (const mapping of mappings) {
    if (mapping.is_required && !(mapping.railsync_field in sourceData) && !mapping.default_value) {
      errors.push(`Missing required field: ${mapping.railsync_field} (SAP: ${mapping.sap_field})`);
    }
  }

  let preview: Record<string, unknown> = {};
  if (errors.length === 0) {
    try {
      const result = buildSAPPayload(mappings, sourceData);
      preview = result;
    } catch (err: unknown) {
      errors.push(err instanceof Error ? err.message : 'Payload build failed');
    }
  }

  return { valid: errors.length === 0, errors, preview };
}
