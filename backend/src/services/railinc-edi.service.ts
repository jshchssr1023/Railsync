/**
 * Railinc EDI Service
 * Parses EDI transaction sets for mileage data (404/417).
 *
 * EDI Structure: ISA → GS → ST → [segments] → SE → GE → IEA
 * Currently provides parsing framework with mock adapter for testing.
 */

import { query, queryOne } from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

export interface EDISegment {
  id: string;
  elements: string[];
}

export interface EDIParsedFile {
  isa: { sender_id: string; receiver_id: string; date: string; control_number: string } | null;
  transaction_sets: EDITransactionSet[];
  errors: string[];
  total_segments: number;
}

export interface EDITransactionSet {
  set_id: string;
  set_type: string;  // '404' or '417'
  records: EDIMileageRecord[];
}

export interface EDIMileageRecord {
  car_number: string;
  origin_railroad: string;
  destination_railroad: string;
  miles: number;
  reporting_period: string;
  waybill_number?: string;
}

export interface EDIImportResult {
  file_id: string;
  transaction_sets_found: number;
  records_parsed: number;
  records_imported: number;
  records_skipped: number;
  errors: string[];
}

// ============================================================================
// PARSE EDI FILE
// ============================================================================

export function parseEDIContent(content: string): EDIParsedFile {
  const result: EDIParsedFile = {
    isa: null,
    transaction_sets: [],
    errors: [],
    total_segments: 0,
  };

  // Determine segment separator (typically ~ or newline)
  const separator = content.includes('~') ? '~' : '\n';
  const segments = content.split(separator).map(s => s.trim()).filter(Boolean);
  result.total_segments = segments.length;

  // Determine element separator (typically *)
  const elementSep = '*';

  let currentSet: EDITransactionSet | null = null;

  for (const seg of segments) {
    const elements = seg.split(elementSep);
    const segId = elements[0];

    switch (segId) {
      case 'ISA':
        result.isa = {
          sender_id: (elements[6] || '').trim(),
          receiver_id: (elements[8] || '').trim(),
          date: (elements[9] || '').trim(),
          control_number: (elements[13] || '').trim(),
        };
        break;

      case 'ST':
        currentSet = {
          set_id: elements[2] || '',
          set_type: elements[1] || '',
          records: [],
        };
        break;

      case 'SE':
        if (currentSet) {
          result.transaction_sets.push(currentSet);
          currentSet = null;
        }
        break;

      // Transaction 404 (Rail Carrier Shipment Information)
      // Transaction 417 (Rail Carrier Waybill Interchange)
      case 'N7':
        // N7 = Equipment Details — car number is in element 1
        if (currentSet) {
          const carNumber = (elements[1] || '').trim();
          if (carNumber) {
            currentSet.records.push({
              car_number: carNumber,
              origin_railroad: '',
              destination_railroad: '',
              miles: 0,
              reporting_period: '',
            });
          }
        }
        break;

      case 'V1':
        // V1 = Vessel Information (used in rail for carrier info)
        if (currentSet && currentSet.records.length > 0) {
          const lastRecord = currentSet.records[currentSet.records.length - 1];
          lastRecord.origin_railroad = (elements[1] || '').trim();
        }
        break;

      case 'R3':
        // R3 = Route Information
        if (currentSet && currentSet.records.length > 0) {
          const lastRecord = currentSet.records[currentSet.records.length - 1];
          lastRecord.destination_railroad = (elements[1] || '').trim();
          lastRecord.miles = parseInt(elements[3] || '0', 10);
        }
        break;

      case 'DTM':
        // DTM = Date/Time segment
        if (currentSet && currentSet.records.length > 0) {
          const lastRecord = currentSet.records[currentSet.records.length - 1];
          const dateStr = (elements[2] || '').trim();
          if (dateStr.length === 8) {
            lastRecord.reporting_period = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}`;
          }
        }
        break;

      default:
        // Skip unknown segments
        break;
    }
  }

  return result;
}

// ============================================================================
// IMPORT EDI FILE INTO MILEAGE RECORDS
// ============================================================================

export async function importEDIFile(
  fileContent: string,
  userId?: string
): Promise<EDIImportResult> {
  const logId = await queryOne<{ id: string }>(
    `INSERT INTO integration_sync_log
       (system_name, operation, direction, entity_type, status, initiated_by, started_at)
     VALUES ('railinc', 'import_edi_file', 'pull', 'mileage_record', 'in_progress', $1, NOW())
     RETURNING id`,
    [userId || null]
  );
  const syncLogId = logId!.id;

  const parsed = parseEDIContent(fileContent);

  const result: EDIImportResult = {
    file_id: syncLogId,
    transaction_sets_found: parsed.transaction_sets.length,
    records_parsed: 0,
    records_imported: 0,
    records_skipped: 0,
    errors: [...parsed.errors],
  };

  for (const txnSet of parsed.transaction_sets) {
    for (const record of txnSet.records) {
      result.records_parsed++;

      if (!record.car_number || record.miles <= 0) {
        result.records_skipped++;
        continue;
      }

      try {
        // Check if car exists
        const car = await queryOne<{ car_number: string }>(
          `SELECT car_number FROM cars WHERE car_number = $1`,
          [record.car_number]
        );

        if (!car) {
          result.records_skipped++;
          result.errors.push(`Car ${record.car_number} not found in system`);
          continue;
        }

        // Insert mileage record
        await query(
          `INSERT INTO mileage_records (car_number, reporting_period, total_miles, origin_railroad, destination_railroad, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           ON CONFLICT DO NOTHING`,
          [
            record.car_number,
            record.reporting_period || new Date().toISOString().slice(0, 7),
            record.miles,
            record.origin_railroad,
            record.destination_railroad,
          ]
        );

        result.records_imported++;
      } catch (err) {
        result.errors.push(`Failed to import ${record.car_number}: ${(err as Error).message}`);
      }
    }
  }

  // Update sync log
  await query(
    `UPDATE integration_sync_log
     SET status = 'success', response = $1, completed_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(result), syncLogId]
  );

  // Update connection status
  await query(
    `UPDATE integration_connection_status
     SET last_check_at = NOW(), last_success_at = NOW(), is_connected = TRUE, updated_at = NOW()
     WHERE system_name = 'railinc'`
  );

  return result;
}

// ============================================================================
// CONNECTION CHECK
// ============================================================================

export async function checkRailincConnection(): Promise<{
  connected: boolean;
  mode: string;
  last_check: Date;
}> {
  await query(
    `UPDATE integration_connection_status
     SET last_check_at = NOW(), is_connected = TRUE, updated_at = NOW()
     WHERE system_name = 'railinc'`
  );
  return { connected: true, mode: 'mock', last_check: new Date() };
}
