/**
 * Invoice Attachment Service
 * Handles file upload/download, hash verification, filename canonicalization
 */

import { pool } from '../config/database';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logAuditEvent } from './invoice-case.service';

// ==============================================================================
// Types
// ==============================================================================

export type AttachmentType = 'PDF' | 'TXT' | 'SUPPORT' | 'BRC';

export interface InvoiceAttachment {
  id: string;
  invoice_case_id: string;
  attachment_type: AttachmentType;
  filename_original: string;
  filename_canonical: string;
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
  file_hash?: string;
  is_required: boolean;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: Date;
  uploaded_by?: string;
  uploaded_at: Date;
  created_at: Date;
}

export interface CreateAttachmentInput {
  invoice_case_id: string;
  attachment_type: AttachmentType;
  filename_original: string;
  file_buffer: Buffer;
  mime_type?: string;
  uploaded_by?: string;
}

export interface AttachmentValidation {
  hasRequiredFiles: boolean;
  hasPDF: boolean;
  hasTXT: boolean;
  missingTypes: AttachmentType[];
  attachments: InvoiceAttachment[];
}

// ==============================================================================
// Constants
// ==============================================================================

const UPLOAD_DIR = process.env.INVOICE_UPLOAD_DIR || './uploads/invoices';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MIME_TYPES: Record<AttachmentType, string[]> = {
  PDF: ['application/pdf'],
  TXT: ['text/plain', 'application/octet-stream'],
  SUPPORT: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  BRC: ['text/plain', 'application/octet-stream'],
};

const REQUIRED_TYPES: AttachmentType[] = ['PDF', 'TXT'];

// ==============================================================================
// File Operations
// ==============================================================================

/**
 * Canonicalize filename based on invoice number
 * Per spec: Filenames normalized to invoice number
 */
export function canonicalizeFilename(
  invoiceNumber: string,
  attachmentType: AttachmentType,
  originalFilename: string
): string {
  const ext = path.extname(originalFilename).toLowerCase() || getDefaultExtension(attachmentType);
  const sanitizedInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  const timestamp = Date.now();

  return `${sanitizedInvoiceNumber}_${attachmentType.toLowerCase()}_${timestamp}${ext}`;
}

function getDefaultExtension(type: AttachmentType): string {
  switch (type) {
    case 'PDF': return '.pdf';
    case 'TXT': return '.txt';
    case 'BRC': return '.txt';
    case 'SUPPORT': return '.pdf';
    default: return '';
  }
}

/**
 * Calculate SHA-256 hash of file content
 */
export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Detect attachment type from filename and content
 */
export function detectAttachmentType(filename: string, mimeType?: string): AttachmentType {
  const ext = path.extname(filename).toLowerCase();

  // Check for BRC file patterns
  if (filename.toLowerCase().includes('brc') || ext === '.brc') {
    return 'BRC';
  }

  // Check by extension
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return 'PDF';
  }

  if (ext === '.txt' || ext === '.500' || mimeType === 'text/plain') {
    return 'TXT';
  }

  // Default to SUPPORT for other types
  return 'SUPPORT';
}

/**
 * Save file to disk
 */
async function saveFileToDisk(
  caseId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const caseDir = path.join(UPLOAD_DIR, caseId);

  // Ensure directory exists
  await fs.mkdir(caseDir, { recursive: true });

  const filePath = path.join(caseDir, filename);
  await fs.writeFile(filePath, buffer);

  return filePath;
}

/**
 * Read file from disk
 */
export async function readFileFromDisk(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Delete file from disk
 */
async function deleteFileFromDisk(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

// ==============================================================================
// CRUD Operations
// ==============================================================================

/**
 * Upload and create attachment
 */
export async function createAttachment(input: CreateAttachmentInput): Promise<InvoiceAttachment> {
  // Get invoice case to determine invoice number for canonical filename
  const caseResult = await pool.query(
    `SELECT invoice_number FROM invoice_cases WHERE id = $1`,
    [input.invoice_case_id]
  );

  const invoiceNumber = caseResult.rows[0]?.invoice_number || input.invoice_case_id;

  // Generate canonical filename
  const canonicalFilename = canonicalizeFilename(
    invoiceNumber,
    input.attachment_type,
    input.filename_original
  );

  // Calculate file hash
  const fileHash = calculateFileHash(input.file_buffer);

  // Check for duplicate (same hash for same case)
  const duplicateCheck = await pool.query(
    `SELECT id FROM invoice_attachments
     WHERE invoice_case_id = $1 AND file_hash = $2`,
    [input.invoice_case_id, fileHash]
  );

  if (duplicateCheck.rows.length > 0) {
    // Return existing attachment instead of creating duplicate
    return await getAttachment(duplicateCheck.rows[0].id) as InvoiceAttachment;
  }

  // Save file to disk
  const filePath = await saveFileToDisk(
    input.invoice_case_id,
    canonicalFilename,
    input.file_buffer
  );

  // Determine if this is a required type
  const isRequired = REQUIRED_TYPES.includes(input.attachment_type);

  // Insert attachment record
  const result = await pool.query(
    `INSERT INTO invoice_attachments (
       invoice_case_id, attachment_type, filename_original, filename_canonical,
       file_path, file_size_bytes, mime_type, file_hash, is_required, uploaded_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.invoice_case_id,
      input.attachment_type,
      input.filename_original,
      canonicalFilename,
      filePath,
      input.file_buffer.length,
      input.mime_type || null,
      fileHash,
      isRequired,
      input.uploaded_by || null,
    ]
  );

  const attachment = result.rows[0] as InvoiceAttachment;

  // Log audit event (BRC files are ignored per spec but still logged)
  await logAuditEvent({
    invoice_case_id: input.invoice_case_id,
    actor_id: input.uploaded_by,
    action: input.attachment_type === 'BRC' ? 'ATTACHMENT_UPLOADED_IGNORED' : 'ATTACHMENT_UPLOADED',
    event_data: {
      attachment_id: attachment.id,
      attachment_type: input.attachment_type,
      filename: input.filename_original,
      size_bytes: input.file_buffer.length,
    },
  });

  return attachment;
}

/**
 * Get single attachment
 */
export async function getAttachment(id: string): Promise<InvoiceAttachment | null> {
  const result = await pool.query(
    `SELECT * FROM invoice_attachments WHERE id = $1`,
    [id]
  );

  return result.rows.length > 0 ? (result.rows[0] as InvoiceAttachment) : null;
}

/**
 * List attachments for a case
 */
export async function listAttachments(
  caseId: string,
  includeIgnored: boolean = false
): Promise<InvoiceAttachment[]> {
  let query = `SELECT * FROM invoice_attachments WHERE invoice_case_id = $1`;

  // By default, exclude BRC files per spec (they are ignored)
  if (!includeIgnored) {
    query += ` AND attachment_type != 'BRC'`;
  }

  query += ` ORDER BY uploaded_at ASC`;

  const result = await pool.query(query, [caseId]);
  return result.rows as InvoiceAttachment[];
}

/**
 * Delete attachment
 */
export async function deleteAttachment(
  id: string,
  userId?: string
): Promise<boolean> {
  const attachment = await getAttachment(id);
  if (!attachment) return false;

  // Delete file from disk
  if (attachment.file_path) {
    await deleteFileFromDisk(attachment.file_path);
  }

  // Delete record
  await pool.query(`DELETE FROM invoice_attachments WHERE id = $1`, [id]);

  // Log audit event
  await logAuditEvent({
    invoice_case_id: attachment.invoice_case_id,
    actor_id: userId,
    action: 'ATTACHMENT_DELETED',
    event_data: {
      attachment_id: id,
      attachment_type: attachment.attachment_type,
      filename: attachment.filename_original,
    },
  });

  return true;
}

// ==============================================================================
// Validation
// ==============================================================================

/**
 * Validate attachments for a case
 * Per spec: PDF + TXT required, BRC ignored
 */
export async function validateAttachments(caseId: string): Promise<AttachmentValidation> {
  const attachments = await listAttachments(caseId, false); // Exclude BRC

  const hasPDF = attachments.some((a) => a.attachment_type === 'PDF');
  const hasTXT = attachments.some((a) => a.attachment_type === 'TXT');

  const missingTypes: AttachmentType[] = [];
  if (!hasPDF) missingTypes.push('PDF');
  if (!hasTXT) missingTypes.push('TXT');

  return {
    hasRequiredFiles: hasPDF && hasTXT,
    hasPDF,
    hasTXT,
    missingTypes,
    attachments,
  };
}

// ==============================================================================
// Verification
// ==============================================================================

/**
 * Mark attachment as verified
 */
export async function verifyAttachment(
  id: string,
  userId: string
): Promise<InvoiceAttachment | null> {
  const result = await pool.query(
    `UPDATE invoice_attachments
     SET is_verified = true, verified_by = $1, verified_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [userId, id]
  );

  if (result.rows.length > 0) {
    const attachment = result.rows[0] as InvoiceAttachment;
    await logAuditEvent({
      invoice_case_id: attachment.invoice_case_id,
      actor_id: userId,
      action: 'ATTACHMENT_VERIFIED',
      event_data: { attachment_id: id },
    });
    return attachment;
  }

  return null;
}

/**
 * Verify file integrity by comparing hash
 */
export async function verifyFileIntegrity(id: string): Promise<{
  valid: boolean;
  storedHash?: string;
  currentHash?: string;
}> {
  const attachment = await getAttachment(id);
  if (!attachment || !attachment.file_path) {
    return { valid: false };
  }

  const fileBuffer = await readFileFromDisk(attachment.file_path);
  if (!fileBuffer) {
    return { valid: false, storedHash: attachment.file_hash };
  }

  const currentHash = calculateFileHash(fileBuffer);

  return {
    valid: currentHash === attachment.file_hash,
    storedHash: attachment.file_hash || undefined,
    currentHash,
  };
}

// ==============================================================================
// Batch Operations
// ==============================================================================

/**
 * Upload multiple attachments at once
 */
export async function uploadMultipleAttachments(
  caseId: string,
  files: { filename: string; buffer: Buffer; mimeType?: string }[],
  uploadedBy?: string
): Promise<InvoiceAttachment[]> {
  const attachments: InvoiceAttachment[] = [];

  for (const file of files) {
    const attachmentType = detectAttachmentType(file.filename, file.mimeType);

    const attachment = await createAttachment({
      invoice_case_id: caseId,
      attachment_type: attachmentType,
      filename_original: file.filename,
      file_buffer: file.buffer,
      mime_type: file.mimeType,
      uploaded_by: uploadedBy,
    });

    attachments.push(attachment);
  }

  return attachments;
}

/**
 * Get download info for attachment
 */
export async function getDownloadInfo(id: string): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: string;
} | null> {
  const attachment = await getAttachment(id);
  if (!attachment || !attachment.file_path) {
    return null;
  }

  const buffer = await readFileFromDisk(attachment.file_path);
  if (!buffer) {
    return null;
  }

  return {
    buffer,
    filename: attachment.filename_original,
    mimeType: attachment.mime_type || 'application/octet-stream',
  };
}
