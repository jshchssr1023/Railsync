/**
 * Shopping Packet Service
 * Manages document packages sent to shops for shopping events
 */

import { query, queryOne, transaction } from '../config/database';

// Types
export interface ShoppingPacketDetail {
  id: string;
  allocation_id?: string;
  shopping_event_id?: string;
  batch_id?: string;
  packet_number: string;
  version: number;
  status: string;
  car_number: string;
  shop_code: string;
  shop_name?: string;
  lessee_code?: string;
  lessee_name?: string;
  shopping_types?: Record<string, unknown>;
  shopping_reasons?: Record<string, unknown>;
  scope_of_work?: string;
  scope_of_work_id?: string;
  special_instructions?: string;
  ccm_document_id?: string;
  ccm_document_name?: string;
  billable_items?: Record<string, unknown>;
  issued_at?: string;
  issued_by?: string;
  issued_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  documents?: PacketDocument[];
}

export interface PacketDocument {
  id: string;
  packet_id: string;
  document_type: string;
  document_name: string;
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
  mfiles_id?: string;
  mfiles_url?: string;
  uploaded_by_id?: string;
  created_at: string;
}

export interface CreatePacketInput {
  shopping_event_id?: string;
  batch_id?: string;
  allocation_id?: string;
  car_number: string;
  shop_code: string;
  scope_of_work_id?: string;
  special_instructions?: string;
}

export interface AddDocumentInput {
  document_type: string;
  document_name: string;
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
}

export interface LinkMFilesInput {
  document_type: string;
  document_name: string;
  mfiles_id: string;
  mfiles_url?: string;
}

// ============================================================================
// PACKET OPERATIONS
// ============================================================================

export async function createPacket(input: CreatePacketInput, userId?: string): Promise<ShoppingPacketDetail> {
  const packetNumber = await queryOne<{ generate_packet_number: string }>(
    `SELECT generate_packet_number()`
  );

  const shopName = await queryOne<{ shop_name: string }>(
    `SELECT shop_name FROM shops WHERE shop_code = $1`, [input.shop_code]
  );

  const result = await queryOne<ShoppingPacketDetail>(
    `INSERT INTO shopping_packets (
      allocation_id, shopping_event_id, batch_id,
      packet_number, car_number, shop_code, shop_name,
      scope_of_work_id, special_instructions, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      input.allocation_id || null,
      input.shopping_event_id || null,
      input.batch_id || null,
      packetNumber?.generate_packet_number || `PKT-${Date.now()}`,
      input.car_number,
      input.shop_code,
      shopName?.shop_name || null,
      input.scope_of_work_id || null,
      input.special_instructions || null,
      userId || null,
    ]
  );

  return result!;
}

export async function getPacket(id: string): Promise<ShoppingPacketDetail | null> {
  const packet = await queryOne<ShoppingPacketDetail>(
    `SELECT sp.*,
       u.email AS issued_by_email,
       uc.email AS created_by_email
     FROM shopping_packets sp
     LEFT JOIN users u ON u.id = sp.issued_by
     LEFT JOIN users uc ON uc.id = sp.created_by
     WHERE sp.id = $1`,
    [id]
  );

  if (!packet) return null;

  const documents = await query<PacketDocument>(
    `SELECT * FROM packet_documents WHERE packet_id = $1 ORDER BY created_at`,
    [id]
  );

  return { ...packet, documents };
}

export async function listPackets(filters: {
  shopping_event_id?: string;
  batch_id?: string;
  car_number?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ packets: ShoppingPacketDetail[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.shopping_event_id) {
    conditions.push(`sp.shopping_event_id = $${paramIdx++}`);
    params.push(filters.shopping_event_id);
  }
  if (filters.batch_id) {
    conditions.push(`sp.batch_id = $${paramIdx++}`);
    params.push(filters.batch_id);
  }
  if (filters.car_number) {
    conditions.push(`sp.car_number = $${paramIdx++}`);
    params.push(filters.car_number);
  }
  if (filters.status) {
    conditions.push(`sp.status = $${paramIdx++}`);
    params.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM shopping_packets sp ${whereClause}`, params
  );

  const packets = await query<ShoppingPacketDetail>(
    `SELECT sp.*, u.email AS created_by_email
     FROM shopping_packets sp
     LEFT JOIN users u ON u.id = sp.created_by
     ${whereClause}
     ORDER BY sp.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { packets, total: parseInt(countResult?.count || '0', 10) };
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

export async function addDocument(
  packetId: string,
  input: AddDocumentInput,
  userId?: string
): Promise<PacketDocument> {
  const result = await queryOne<PacketDocument>(
    `INSERT INTO packet_documents (
      packet_id, document_type, document_name, file_path,
      file_size_bytes, mime_type, uploaded_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      packetId,
      input.document_type,
      input.document_name,
      input.file_path || null,
      input.file_size_bytes || null,
      input.mime_type || null,
      userId || null,
    ]
  );
  return result!;
}

export async function linkMFilesDocument(
  packetId: string,
  input: LinkMFilesInput,
  userId?: string
): Promise<PacketDocument> {
  const result = await queryOne<PacketDocument>(
    `INSERT INTO packet_documents (
      packet_id, document_type, document_name,
      mfiles_id, mfiles_url, uploaded_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      packetId,
      input.document_type,
      input.document_name,
      input.mfiles_id,
      input.mfiles_url || null,
      userId || null,
    ]
  );
  return result!;
}

export async function getPacketDocuments(packetId: string): Promise<PacketDocument[]> {
  return query<PacketDocument>(
    `SELECT * FROM packet_documents WHERE packet_id = $1 ORDER BY created_at`,
    [packetId]
  );
}

// ============================================================================
// PACKET LIFECYCLE
// ============================================================================

export async function sendPacket(id: string, userId: string): Promise<ShoppingPacketDetail | null> {
  const result = await queryOne<ShoppingPacketDetail>(
    `UPDATE shopping_packets
     SET status = 'issued',
         issued_at = NOW(),
         issued_by = $2,
         updated_at = NOW()
     WHERE id = $1 AND status IN ('draft', 'ready')
     RETURNING *`,
    [id, userId]
  );

  // Queue email to shop contact if packet was successfully issued
  if (result) {
    try {
      const { queueEmail } = await import('./email.service');
      // Look up shop contact email
      const shopContact = await queryOne<{ email: string; contact_name: string }>(
        `SELECT email, contact_name FROM shop_contacts WHERE shop_code = $1 AND is_primary = TRUE LIMIT 1`,
        [result.shop_code]
      );
      if (shopContact?.email) {
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        await queueEmail(shopContact.email, shopContact.contact_name, {
          subject: `Shopping Packet ${result.packet_number} — Car ${result.car_number}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #2563eb; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Shopping Packet Issued</h1>
              </div>
              <div style="padding: 20px; background: #f9fafb;">
                <p><strong>Packet:</strong> ${result.packet_number}</p>
                <p><strong>Car:</strong> ${result.car_number}</p>
                <p><strong>Shop:</strong> ${result.shop_code}${result.shop_name ? ` — ${result.shop_name}` : ''}</p>
                ${result.special_instructions ? `<p><strong>Instructions:</strong> ${result.special_instructions}</p>` : ''}
                <p style="margin-top: 20px;">
                  <a href="${appUrl}/shopping"
                     style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    View in RailSync
                  </a>
                </p>
              </div>
            </div>
          `,
          text: `Shopping Packet Issued\n\nPacket: ${result.packet_number}\nCar: ${result.car_number}\nShop: ${result.shop_code}\n${result.special_instructions ? `Instructions: ${result.special_instructions}\n` : ''}`,
        });
        console.log(`[Packet] Email queued to ${shopContact.email} for packet ${result.packet_number}`);
      } else {
        console.log(`[Packet] No primary contact email for shop ${result.shop_code}, skipping email`);
      }
    } catch (err) {
      // Email failure should not block packet issuance
      console.error(`[Packet] Failed to queue email for packet ${id}:`, (err as Error).message);
    }
  }

  return result;
}

export async function acknowledgePacket(id: string): Promise<ShoppingPacketDetail | null> {
  const result = await queryOne<ShoppingPacketDetail>(
    `UPDATE shopping_packets
     SET status = 'acknowledged',
         acknowledged_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND status = 'issued'
     RETURNING *`,
    [id]
  );
  return result;
}

export async function updatePacketStatus(
  id: string,
  status: string
): Promise<ShoppingPacketDetail | null> {
  const result = await queryOne<ShoppingPacketDetail>(
    `UPDATE shopping_packets SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return result;
}
