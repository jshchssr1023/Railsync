/**
 * Salesforce Sync Service
 * Pulls customer master, contacts, and deal stages from Salesforce.
 * Pushes billing status updates back to Salesforce.
 *
 * DUAL-MODE: Real Salesforce REST API when SALESFORCE_INSTANCE_URL is configured, mock otherwise.
 * Conflict resolution: RailSync wins for billing fields, Salesforce wins for contact info.
 *
 * Required env vars for live mode:
 *   SALESFORCE_INSTANCE_URL    - e.g. https://yourorg.my.salesforce.com
 *   SALESFORCE_CLIENT_ID       - Connected App consumer key
 *   SALESFORCE_CLIENT_SECRET   - Connected App consumer secret
 *   SALESFORCE_USERNAME        - Integration user username
 *   SALESFORCE_PASSWORD         - Integration user password + security token
 *   SALESFORCE_API_VERSION     - e.g. 'v59.0' (optional, defaults to v59.0)
 */

import { query, queryOne } from '../config/database';
import logger from '../config/logger';
import { fetchWithTimeout, salesforceCircuitBreaker } from './circuit-breaker';

// ============================================================================
// CONFIG
// ============================================================================

interface SFConfig {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  apiVersion: string;
  isLive: boolean;
}

function getSFConfig(): SFConfig {
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL || '';
  return {
    instanceUrl,
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
    username: process.env.SALESFORCE_USERNAME || '',
    password: process.env.SALESFORCE_PASSWORD || '',
    apiVersion: process.env.SALESFORCE_API_VERSION || 'v59.0',
    isLive: !!instanceUrl,
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface SFSyncResult {
  operation: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  conflicts: { railsync_id: string; field: string; railsync_value: string; sf_value: string; winner: string }[];
  errors: { sf_id: string; error: string }[];
}

interface SFFieldMapping {
  sf_field: string;
  railsync_table: string;
  railsync_field: string;
  sync_direction: string;
  conflict_winner: string;
  is_key_field: boolean;
  transform_rule: string;
  transform_config: Record<string, unknown>;
}

interface SFRecord {
  Id: string;
  attributes?: { type: string; url: string };
  [key: string]: unknown;
}

interface SFQueryResponse {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: SFRecord[];
}

// ============================================================================
// OAUTH2 TOKEN MANAGEMENT
// ============================================================================

let sfCachedToken: { access_token: string; instance_url: string; expires_at: number } | null = null;

async function getSFAccessToken(config: SFConfig): Promise<{ access_token: string; instance_url: string }> {
  // Return cached token if still valid (1 hour buffer — SF tokens last ~2 hours)
  if (sfCachedToken && sfCachedToken.expires_at > Date.now() + 300000) {
    return { access_token: sfCachedToken.access_token, instance_url: sfCachedToken.instance_url };
  }

  // OAuth2 username-password flow
  const tokenUrl = `${config.instanceUrl}/services/oauth2/token`;
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    username: config.username,
    password: config.password,
  });

  const response = await fetchWithTimeout(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  }, 15_000); // 15s timeout for token requests

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail: string;
    try {
      const errJson = JSON.parse(errorText);
      errorDetail = errJson.error_description || errJson.error || errorText;
    } catch {
      errorDetail = errorText;
    }
    throw new Error(`Salesforce OAuth2 failed (${response.status}): ${errorDetail}`);
  }

  const data = await response.json() as {
    access_token: string;
    instance_url: string;
    issued_at: string;
  };

  sfCachedToken = {
    access_token: data.access_token,
    instance_url: data.instance_url,
    expires_at: Date.now() + 7200000, // 2 hour validity
  };

  // Update connection status
  await query(
    `UPDATE integration_connection_status
     SET last_token_refresh_at = NOW(), token_expires_at = $1,
         auth_method = 'oauth2', api_version = $2, updated_at = NOW()
     WHERE system_name = 'salesforce'`,
    [new Date(sfCachedToken.expires_at), config.apiVersion]
  ).catch(() => { /* non-critical */ });

  return { access_token: data.access_token, instance_url: data.instance_url };
}

// ============================================================================
// SALESFORCE REST CLIENT
// ============================================================================

async function sfRequestInternal(
  config: SFConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const { access_token, instance_url } = await getSFAccessToken(config);
  const url = `${instance_url}/services/data/${config.apiVersion}${path}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const response = await fetchWithTimeout(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }, 30_000); // 30s timeout for Salesforce data requests

  const responseText = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { raw: responseText };
  }

  // Handle token expiry — retry once
  if (response.status === 401) {
    sfCachedToken = null; // Force re-auth
    const { access_token: newToken, instance_url: newUrl } = await getSFAccessToken(config);
    const retryUrl = `${newUrl}/services/data/${config.apiVersion}${path}`;
    const retryRes = await fetchWithTimeout(retryUrl, {
      method,
      headers: { ...headers, 'Authorization': `Bearer ${newToken}` },
      body: body ? JSON.stringify(body) : undefined,
    }, 30_000); // 30s timeout for retry
    const retryText = await retryRes.text();
    try {
      data = JSON.parse(retryText);
    } catch {
      data = { raw: retryText };
    }
    return { ok: retryRes.ok, status: retryRes.status, data };
  }

  return { ok: response.ok, status: response.status, data };
}

/**
 * Salesforce REST client wrapped with circuit breaker.
 * When the circuit is OPEN, requests are rejected immediately to avoid
 * piling up connections to an unresponsive Salesforce instance.
 */
async function sfRequest(
  config: SFConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  return salesforceCircuitBreaker.execute(() => sfRequestInternal(config, method, path, body));
}

async function sfQuery(config: SFConfig, soql: string): Promise<SFRecord[]> {
  const allRecords: SFRecord[] = [];
  let path = `/query?q=${encodeURIComponent(soql)}`;

  // Handle pagination
  while (path) {
    const result = await sfRequest(config, 'GET', path);
    if (!result.ok) {
      throw new Error(`SOQL query failed (${result.status}): ${JSON.stringify(result.data).slice(0, 500)}`);
    }
    const qr = result.data as SFQueryResponse;
    allRecords.push(...qr.records);

    if (qr.done || !qr.nextRecordsUrl) {
      break;
    }
    // nextRecordsUrl is a full path starting with /services/data/...
    path = qr.nextRecordsUrl.replace(`/services/data/${config.apiVersion}`, '');
  }

  return allRecords;
}

// ============================================================================
// FIELD MAPPING ENGINE
// ============================================================================

async function getFieldMappings(sfObject: string): Promise<SFFieldMapping[]> {
  return query<SFFieldMapping>(
    `SELECT sf_field, railsync_table, railsync_field, sync_direction,
            conflict_winner, is_key_field, transform_rule, transform_config
     FROM salesforce_field_mappings
     WHERE sf_object = $1 AND is_active = TRUE
     ORDER BY sort_order`,
    [sfObject]
  );
}

function buildSOQLFields(mappings: SFFieldMapping[]): string {
  const fields = new Set(['Id']);
  for (const m of mappings) {
    fields.add(m.sf_field);
  }
  return Array.from(fields).join(', ');
}

function mapSFRecordToRailSync(
  record: SFRecord,
  mappings: SFFieldMapping[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const m of mappings) {
    const sfValue = record[m.sf_field];
    if (sfValue !== undefined && sfValue !== null) {
      result[m.railsync_field] = transformSFValue(sfValue, m.transform_rule, m.transform_config);
    }
  }
  return result;
}

function transformSFValue(value: unknown, rule: string, config: Record<string, unknown>): unknown {
  if (value === null || value === undefined) return null;

  switch (rule) {
    case 'date_format': {
      // SF dates come as ISO strings
      return value;
    }
    case 'lookup': {
      const map = config.values as Record<string, string> | undefined;
      return map ? (map[String(value)] || value) : value;
    }
    default:
      return value;
  }
}

// ============================================================================
// SYNC LOG HELPER
// ============================================================================

async function createSyncLog(
  operation: string,
  entityType: string,
  payload: unknown,
  userId?: string
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO integration_sync_log
       (system_name, operation, direction, entity_type, status, payload, initiated_by, started_at)
     VALUES ('salesforce', $1, 'pull', $2, 'in_progress', $3, $4, NOW())
     RETURNING id`,
    [operation, entityType, JSON.stringify(payload), userId || null]
  );
  return row!.id;
}

async function completeSyncLog(
  logId: string,
  success: boolean,
  response: unknown,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE integration_sync_log
     SET status = $1, response = $2, error_message = $3, completed_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [success ? 'success' : 'failed', JSON.stringify(response), errorMessage || null, logId]
  );
}

// ============================================================================
// SYNC MAP HELPERS
// ============================================================================

async function upsertSyncMap(
  entityType: string,
  railsyncId: string,
  salesforceId: string,
  sfObjectType: string,
  direction: string
): Promise<void> {
  await query(
    `INSERT INTO salesforce_sync_map
       (entity_type, railsync_id, salesforce_id, sf_object_type, sync_direction, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (entity_type, railsync_id)
     DO UPDATE SET salesforce_id = $3, sync_direction = $5, last_synced_at = NOW(), updated_at = NOW()`,
    [entityType, railsyncId, salesforceId, sfObjectType, direction]
  );
}

async function getSyncMapBySFId(entityType: string, salesforceId: string): Promise<{ railsync_id: string } | null> {
  return queryOne<{ railsync_id: string }>(
    `SELECT railsync_id FROM salesforce_sync_map WHERE entity_type = $1 AND salesforce_id = $2`,
    [entityType, salesforceId]
  );
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

function resolveConflict(
  railsyncValue: unknown,
  sfValue: unknown,
  mapping: SFFieldMapping
): { value: unknown; winner: string } {
  // If values are equal, no conflict
  if (String(railsyncValue) === String(sfValue)) {
    return { value: railsyncValue, winner: 'none' };
  }

  // Apply conflict resolution rule from mapping
  if (mapping.conflict_winner === 'railsync') {
    return { value: railsyncValue, winner: 'railsync' };
  }
  return { value: sfValue, winner: 'salesforce' };
}

// ============================================================================
// PULL CUSTOMERS (Account → customers)
// ============================================================================

export async function pullCustomers(userId?: string): Promise<SFSyncResult> {
  const config = getSFConfig();
  const logId = await createSyncLog('pull_customers', 'customer', { mode: config.isLive ? 'live' : 'mock' }, userId);

  const result: SFSyncResult = {
    operation: 'pull_customers',
    records_processed: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    conflicts: [],
    errors: [],
  };

  if (!config.isLive) {
    // Mock mode — simulate processing existing customers
    logger.info('[SF MOCK] pull_customers: Would fetch Account records from Salesforce');
    const customers = await query<{ id: string; customer_code: string; customer_name: string }>(
      `SELECT id, customer_code, customer_name FROM customers LIMIT 10`
    );
    result.records_processed = customers.length;
    result.records_skipped = customers.length;

    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), last_success_at = NOW(), is_connected = TRUE, mode = 'mock', updated_at = NOW()
       WHERE system_name = 'salesforce'`
    );
    await completeSyncLog(logId, true, result);
    return result;
  }

  // Live mode — fetch Account records from Salesforce
  try {
    const mappings = await getFieldMappings('Account');
    const fields = buildSOQLFields(mappings);
    const keyMapping = mappings.find(m => m.is_key_field);
    const keyField = keyMapping?.sf_field || 'Account_Code__c';

    // Query active accounts with our custom key field
    const soql = `SELECT ${fields} FROM Account WHERE IsDeleted = false AND ${keyField} != null ORDER BY LastModifiedDate DESC`;
    const sfRecords = await sfQuery(config, soql);

    result.records_processed = sfRecords.length;

    for (const sfRecord of sfRecords) {
      try {
        const mapped = mapSFRecordToRailSync(sfRecord, mappings);
        const keyValue = sfRecord[keyField] as string;

        if (!keyValue) {
          result.records_skipped++;
          continue;
        }

        // Check if customer exists in RailSync
        const existing = await queryOne<{ id: string; [key: string]: unknown }>(
          `SELECT * FROM customers WHERE customer_code = $1`,
          [keyValue]
        );

        if (existing) {
          // Update — apply conflict resolution
          const updates: string[] = [];
          const params: unknown[] = [];
          let paramIdx = 1;

          for (const mapping of mappings) {
            if (mapping.is_key_field) continue;
            if (mapping.sync_direction === 'push') continue; // Don't pull push-only fields

            const sfVal = mapped[mapping.railsync_field];
            const rsVal = existing[mapping.railsync_field];

            if (sfVal === undefined || sfVal === null) continue;

            if (String(sfVal) !== String(rsVal || '')) {
              const resolution = resolveConflict(rsVal, sfVal, mapping);
              if (String(resolution.value) !== String(rsVal || '')) {
                updates.push(`${mapping.railsync_field} = $${paramIdx++}`);
                params.push(resolution.value);
              }
              if (resolution.winner !== 'none') {
                result.conflicts.push({
                  railsync_id: existing.id,
                  field: mapping.railsync_field,
                  railsync_value: String(rsVal || ''),
                  sf_value: String(sfVal),
                  winner: resolution.winner,
                });
              }
            }
          }

          if (updates.length > 0) {
            updates.push(`updated_at = NOW()`);
            await query(
              `UPDATE customers SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
              [...params, existing.id]
            );
            result.records_updated++;
          } else {
            result.records_skipped++;
          }

          await upsertSyncMap('customer', existing.id, sfRecord.Id, 'Account', 'pull');
        } else {
          // Create new customer
          const insertFields: string[] = ['customer_code'];
          const insertValues: unknown[] = [keyValue];
          let insertIdx = 2;

          for (const mapping of mappings) {
            if (mapping.is_key_field) continue;
            const val = mapped[mapping.railsync_field];
            if (val !== undefined && val !== null) {
              insertFields.push(mapping.railsync_field);
              insertValues.push(val);
              insertIdx++;
            }
          }

          const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
          const newCustomer = await queryOne<{ id: string }>(
            `INSERT INTO customers (${insertFields.join(', ')})
             VALUES (${placeholders})
             ON CONFLICT (customer_code) DO NOTHING
             RETURNING id`,
            insertValues
          );

          if (newCustomer) {
            await upsertSyncMap('customer', newCustomer.id, sfRecord.Id, 'Account', 'pull');
            result.records_created++;
          } else {
            result.records_skipped++;
          }
        }
      } catch (err: unknown) {
        result.errors.push({
          sf_id: sfRecord.Id,
          error: err instanceof Error ? err.message : 'Processing failed',
        });
      }
    }

    // Update connection status
    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), last_success_at = NOW(), is_connected = TRUE, mode = 'live', updated_at = NOW()
       WHERE system_name = 'salesforce'`
    );

    await completeSyncLog(logId, true, result);
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Salesforce pull failed';
    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), is_connected = FALSE, mode = 'live', last_error = $1, updated_at = NOW()
       WHERE system_name = 'salesforce'`,
      [errorMsg]
    );
    await completeSyncLog(logId, false, result, errorMsg);
    result.errors.push({ sf_id: '', error: errorMsg });
    return result;
  }
}

// ============================================================================
// PULL CONTACTS (Contact → customer_contacts)
// ============================================================================

export async function pullContacts(userId?: string): Promise<SFSyncResult> {
  const config = getSFConfig();
  const logId = await createSyncLog('pull_contacts', 'contact', { mode: config.isLive ? 'live' : 'mock' }, userId);

  const result: SFSyncResult = {
    operation: 'pull_contacts',
    records_processed: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    conflicts: [],
    errors: [],
  };

  if (!config.isLive) {
    logger.info('[SF MOCK] pull_contacts: Would fetch Contact records from Salesforce');
    await completeSyncLog(logId, true, result);
    return result;
  }

  // Live mode
  try {
    const mappings = await getFieldMappings('Contact');
    const fields = buildSOQLFields(mappings);

    // Include Account reference to link contacts to customers
    const soql = `SELECT ${fields}, Account.Account_Code__c FROM Contact WHERE IsDeleted = false AND Email != null ORDER BY LastModifiedDate DESC`;
    const sfRecords = await sfQuery(config, soql);

    result.records_processed = sfRecords.length;

    for (const sfRecord of sfRecords) {
      try {
        const mapped = mapSFRecordToRailSync(sfRecord, mappings);
        const email = sfRecord.Email as string;
        const accountCode = (sfRecord.Account as Record<string, unknown>)?.Account_Code__c as string;

        if (!email) {
          result.records_skipped++;
          continue;
        }

        // Find parent customer
        let customerId: string | null = null;
        if (accountCode) {
          const customer = await queryOne<{ id: string }>(
            `SELECT id FROM customers WHERE customer_code = $1`,
            [accountCode]
          );
          customerId = customer?.id || null;
        }

        if (!customerId) {
          // Try via sync map
          const accountId = sfRecord.AccountId as string;
          if (accountId) {
            const syncEntry = await getSyncMapBySFId('customer', accountId);
            customerId = syncEntry?.railsync_id || null;
          }
        }

        if (!customerId) {
          result.records_skipped++;
          continue;
        }

        // Upsert contact
        const existing = await queryOne<{ id: string }>(
          `SELECT id FROM customer_contacts WHERE customer_id = $1 AND email = $2`,
          [customerId, email]
        );

        if (existing) {
          const updates: string[] = [];
          const params: unknown[] = [];
          let paramIdx = 1;

          for (const mapping of mappings) {
            if (mapping.is_key_field) continue;
            const sfVal = mapped[mapping.railsync_field];
            if (sfVal !== undefined && sfVal !== null) {
              updates.push(`${mapping.railsync_field} = $${paramIdx++}`);
              params.push(sfVal);
            }
          }

          if (updates.length > 0) {
            updates.push(`salesforce_id = $${paramIdx++}`);
            params.push(sfRecord.Id);
            updates.push(`updated_at = NOW()`);
            await query(
              `UPDATE customer_contacts SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
              [...params, existing.id]
            );
            result.records_updated++;
          } else {
            result.records_skipped++;
          }

          await upsertSyncMap('contact', existing.id, sfRecord.Id, 'Contact', 'pull');
        } else {
          // Insert new contact
          const newContact = await queryOne<{ id: string }>(
            `INSERT INTO customer_contacts
               (customer_id, email, first_name, last_name, title, phone, department, salesforce_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (customer_id, email) DO NOTHING
             RETURNING id`,
            [
              customerId,
              email,
              mapped.first_name || null,
              mapped.last_name || null,
              mapped.title || null,
              mapped.phone || null,
              mapped.department || null,
              sfRecord.Id,
            ]
          );

          if (newContact) {
            await upsertSyncMap('contact', newContact.id, sfRecord.Id, 'Contact', 'pull');
            result.records_created++;
          } else {
            result.records_skipped++;
          }
        }
      } catch (err: unknown) {
        result.errors.push({
          sf_id: sfRecord.Id,
          error: err instanceof Error ? err.message : 'Contact processing failed',
        });
      }
    }

    await completeSyncLog(logId, true, result);
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Contact pull failed';
    await completeSyncLog(logId, false, result, errorMsg);
    result.errors.push({ sf_id: '', error: errorMsg });
    return result;
  }
}

// ============================================================================
// PULL DEAL STAGES (Opportunity → pipeline_deals)
// ============================================================================

export async function pullDealStages(userId?: string): Promise<SFSyncResult> {
  const config = getSFConfig();
  const logId = await createSyncLog('pull_deal_stages', 'opportunity', { mode: config.isLive ? 'live' : 'mock' }, userId);

  const result: SFSyncResult = {
    operation: 'pull_deal_stages',
    records_processed: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    conflicts: [],
    errors: [],
  };

  if (!config.isLive) {
    logger.info('[SF MOCK] pull_deal_stages: Would fetch Opportunity records from Salesforce');
    await completeSyncLog(logId, true, result);
    return result;
  }

  // Live mode
  try {
    const mappings = await getFieldMappings('Opportunity');
    const fields = buildSOQLFields(mappings);
    const keyMapping = mappings.find(m => m.is_key_field);
    const keyField = keyMapping?.sf_field || 'Deal_Code__c';

    const soql = `SELECT ${fields}, Account.Account_Code__c FROM Opportunity WHERE IsClosed = false ORDER BY LastModifiedDate DESC LIMIT 500`;
    const sfRecords = await sfQuery(config, soql);

    result.records_processed = sfRecords.length;

    for (const sfRecord of sfRecords) {
      try {
        const mapped = mapSFRecordToRailSync(sfRecord, mappings);
        const dealCode = sfRecord[keyField] as string;

        // Find linked customer
        let customerId: string | null = null;
        const accountCode = (sfRecord.Account as Record<string, unknown>)?.Account_Code__c as string;
        if (accountCode) {
          const customer = await queryOne<{ id: string }>(
            `SELECT id FROM customers WHERE customer_code = $1`,
            [accountCode]
          );
          customerId = customer?.id || null;
        }

        if (dealCode) {
          // Upsert by deal_code
          const existing = await queryOne<{ id: string }>(
            `SELECT id FROM pipeline_deals WHERE deal_code = $1`,
            [dealCode]
          );

          if (existing) {
            await query(
              `UPDATE pipeline_deals SET
                 deal_name = COALESCE($1, deal_name),
                 stage = COALESCE($2, stage),
                 amount = COALESCE($3, amount),
                 expected_close = COALESCE($4, expected_close),
                 probability = COALESCE($5, probability),
                 customer_id = COALESCE($6, customer_id),
                 salesforce_id = $7,
                 updated_at = NOW()
               WHERE id = $8`,
              [
                mapped.deal_name || null,
                mapped.stage || null,
                mapped.amount || null,
                mapped.expected_close || null,
                mapped.probability || null,
                customerId,
                sfRecord.Id,
                existing.id,
              ]
            );
            await upsertSyncMap('opportunity', existing.id, sfRecord.Id, 'Opportunity', 'pull');
            result.records_updated++;
          } else {
            const newDeal = await queryOne<{ id: string }>(
              `INSERT INTO pipeline_deals
                 (deal_code, deal_name, stage, amount, expected_close, probability, customer_id, salesforce_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (deal_code) DO NOTHING
               RETURNING id`,
              [
                dealCode,
                mapped.deal_name || sfRecord.Name || 'Unknown Deal',
                mapped.stage || 'Prospecting',
                mapped.amount || null,
                mapped.expected_close || null,
                mapped.probability || 0,
                customerId,
                sfRecord.Id,
              ]
            );
            if (newDeal) {
              await upsertSyncMap('opportunity', newDeal.id, sfRecord.Id, 'Opportunity', 'pull');
              result.records_created++;
            } else {
              result.records_skipped++;
            }
          }
        } else {
          // No key field — try to match by SF ID
          const syncEntry = await getSyncMapBySFId('opportunity', sfRecord.Id);
          if (syncEntry) {
            await query(
              `UPDATE pipeline_deals SET
                 deal_name = COALESCE($1, deal_name),
                 stage = COALESCE($2, stage),
                 amount = COALESCE($3, amount),
                 probability = COALESCE($4, probability),
                 updated_at = NOW()
               WHERE id = $5`,
              [
                mapped.deal_name || null,
                mapped.stage || null,
                mapped.amount || null,
                mapped.probability || null,
                syncEntry.railsync_id,
              ]
            );
            result.records_updated++;
          } else {
            result.records_skipped++;
          }
        }
      } catch (err: unknown) {
        result.errors.push({
          sf_id: sfRecord.Id,
          error: err instanceof Error ? err.message : 'Deal processing failed',
        });
      }
    }

    await completeSyncLog(logId, true, result);
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Deal stages pull failed';
    await completeSyncLog(logId, false, result, errorMsg);
    result.errors.push({ sf_id: '', error: errorMsg });
    return result;
  }
}

// ============================================================================
// PUSH CUSTOMER BILLING STATUS TO SALESFORCE
// ============================================================================

export async function pushCustomerBillingStatus(
  customerId: string,
  billingData: {
    total_billed: number;
    outstanding_balance: number;
    last_invoice_date: string;
    active_car_count: number;
  },
  userId?: string
): Promise<SFSyncResult> {
  const config = getSFConfig();
  const logId = await createSyncLog('push_billing_status', 'customer', { customerId, ...billingData }, userId);

  const result: SFSyncResult = {
    operation: 'push_billing_status',
    records_processed: 1,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    conflicts: [],
    errors: [],
  };

  if (!config.isLive) {
    logger.info({ customerId, ...billingData }, '[SF MOCK] push_billing_status');
    result.records_skipped = 1;
    await completeSyncLog(logId, true, result);
    return result;
  }

  try {
    // Get SF Account ID from sync map
    const syncEntry = await queryOne<{ salesforce_id: string }>(
      `SELECT salesforce_id FROM salesforce_sync_map WHERE entity_type = 'customer' AND railsync_id = $1`,
      [customerId]
    );

    if (!syncEntry) {
      result.records_skipped = 1;
      result.errors.push({ sf_id: '', error: 'Customer not linked to Salesforce' });
      await completeSyncLog(logId, true, result);
      return result;
    }

    // Update Account with billing data
    const updateResult = await sfRequest(config, 'PATCH', `/sobjects/Account/${syncEntry.salesforce_id}`, {
      Total_Billed__c: billingData.total_billed,
      Outstanding_Balance__c: billingData.outstanding_balance,
      Last_Invoice_Date__c: billingData.last_invoice_date,
      Active_Car_Count__c: billingData.active_car_count,
    });

    if (updateResult.ok || updateResult.status === 204) {
      result.records_updated = 1;
      await completeSyncLog(logId, true, result);
    } else {
      result.errors.push({
        sf_id: syncEntry.salesforce_id,
        error: JSON.stringify(updateResult.data).slice(0, 500),
      });
      await completeSyncLog(logId, false, result, 'SF Account update failed');
    }

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Push billing status failed';
    result.errors.push({ sf_id: '', error: errorMsg });
    await completeSyncLog(logId, false, result, errorMsg);
    return result;
  }
}

// ============================================================================
// FULL SYNC (run all pulls)
// ============================================================================

export async function runFullSync(userId?: string): Promise<{
  customers: SFSyncResult;
  contacts: SFSyncResult;
  deal_stages: SFSyncResult;
}> {
  const [customers, contacts, deal_stages] = await Promise.all([
    pullCustomers(userId),
    pullContacts(userId),
    pullDealStages(userId),
  ]);
  return { customers, contacts, deal_stages };
}

// ============================================================================
// CONNECTION CHECK
// ============================================================================

export async function checkSalesforceConnection(): Promise<{
  connected: boolean;
  mode: string;
  last_check: Date;
  api_version?: string;
  org_id?: string;
  error?: string;
}> {
  const config = getSFConfig();

  if (!config.isLive) {
    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), is_connected = TRUE, mode = 'mock', updated_at = NOW()
       WHERE system_name = 'salesforce'`
    );
    return { connected: true, mode: 'mock', last_check: new Date() };
  }

  // Live mode — test OAuth and query
  try {
    const { access_token, instance_url } = await getSFAccessToken(config);

    // Query org info to verify connection
    const result = await sfRequest(config, 'GET', '/sobjects');
    const connected = result.ok;
    const now = new Date();

    // Get org identity
    let orgId: string | undefined;
    try {
      const idRes = await fetchWithTimeout(`${instance_url}/services/oauth2/userinfo`, {
        headers: { 'Authorization': `Bearer ${access_token}` },
      }, 10_000); // 10s timeout for identity check
      if (idRes.ok) {
        const idData = await idRes.json() as { organization_id: string };
        orgId = idData.organization_id;
      }
    } catch {
      // Non-critical
    }

    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), is_connected = $1, mode = 'live',
           last_success_at = CASE WHEN $1 THEN NOW() ELSE last_success_at END,
           last_error = $2, api_version = $3, updated_at = NOW()
       WHERE system_name = 'salesforce'`,
      [connected, connected ? null : `HTTP ${result.status}`, config.apiVersion]
    );

    return {
      connected,
      mode: 'live',
      last_check: now,
      api_version: config.apiVersion,
      org_id: orgId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Connection check failed';
    await query(
      `UPDATE integration_connection_status
       SET last_check_at = NOW(), is_connected = FALSE, mode = 'live', last_error = $1, updated_at = NOW()
       WHERE system_name = 'salesforce'`,
      [errorMsg]
    );
    return { connected: false, mode: 'live', last_check: new Date(), error: errorMsg };
  }
}

// ============================================================================
// SYNC MAP ADMIN
// ============================================================================

export async function getSyncMapEntries(entityType?: string, limit: number = 50): Promise<{
  entries: {
    id: string;
    entity_type: string;
    railsync_id: string;
    salesforce_id: string;
    sf_object_type: string;
    last_synced_at: string;
    sync_direction: string;
  }[];
  total: number;
}> {
  const conditions = entityType ? 'WHERE entity_type = $1' : '';
  const params = entityType ? [entityType, limit] : [limit];
  const limitParam = entityType ? '$2' : '$1';

  const [entries, countResult] = await Promise.all([
    query(
      `SELECT id, entity_type, railsync_id, salesforce_id, sf_object_type, last_synced_at, sync_direction
       FROM salesforce_sync_map ${conditions}
       ORDER BY last_synced_at DESC NULLS LAST
       LIMIT ${limitParam}`,
      params
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM salesforce_sync_map ${conditions}`,
      entityType ? [entityType] : []
    ),
  ]);

  return {
    entries: entries as {
      id: string;
      entity_type: string;
      railsync_id: string;
      salesforce_id: string;
      sf_object_type: string;
      last_synced_at: string;
      sync_direction: string;
    }[],
    total: parseInt(countResult?.count || '0', 10),
  };
}
