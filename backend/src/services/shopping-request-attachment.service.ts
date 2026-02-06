import { query, queryOne } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

export interface ShoppingRequestAttachment {
  id: string;
  shopping_request_id: string;
  file_name: string;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  document_type: string;
  uploaded_by_id: string | null;
  created_at: string;
}

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'shopping-requests');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadAttachment(
  requestId: string,
  file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
  documentType: string,
  userId: string
): Promise<ShoppingRequestAttachment> {
  const destDir = path.join(UPLOAD_DIR, requestId);
  ensureDir(destDir);

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destPath = path.join(destDir, `${Date.now()}-${safeName}`);

  fs.writeFileSync(destPath, file.buffer);

  const result = await queryOne<ShoppingRequestAttachment>(
    `INSERT INTO shopping_request_attachments (
      shopping_request_id, file_name, file_path, file_size_bytes, mime_type, document_type, uploaded_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [requestId, file.originalname, destPath, file.size, file.mimetype, documentType || 'other', userId]
  );

  return result!;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listAttachments(requestId: string): Promise<ShoppingRequestAttachment[]> {
  return query<ShoppingRequestAttachment>(
    `SELECT * FROM shopping_request_attachments WHERE shopping_request_id = $1 ORDER BY created_at`,
    [requestId]
  );
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const attachment = await queryOne<ShoppingRequestAttachment>(
    `SELECT * FROM shopping_request_attachments WHERE id = $1`,
    [attachmentId]
  );

  if (!attachment) {
    throw new Error('Attachment not found');
  }

  // Delete the file from disk
  if (attachment.file_path && fs.existsSync(attachment.file_path)) {
    fs.unlinkSync(attachment.file_path);
  }

  await queryOne(
    `DELETE FROM shopping_request_attachments WHERE id = $1`,
    [attachmentId]
  );
}
