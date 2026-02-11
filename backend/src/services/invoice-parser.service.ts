/**
 * Invoice Parser Service
 * Handles parsing of invoices from PDF and EDI 500-byte formats
 */

import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { CreateInvoiceInput, CreateLineItemInput } from './invoice.service';

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedInvoice {
  invoice: CreateInvoiceInput;
  line_items: Omit<CreateLineItemInput, 'invoice_id'>[];
  parse_warnings: string[];
  raw_text?: string;
}

export interface EDIInvoiceRecord {
  invoice_number: string;
  vendor_code: string;
  shop_code: string;
  invoice_date: Date;
  car_mark: string;
  car_number: string;
  brc_number: string;
  job_code: string;
  why_made_code: string;
  labor_amount: number;
  material_amount: number;
  total_amount: number;
  description: string;
}

// ============================================================================
// PDF PARSING
// ============================================================================

/**
 * Common invoice PDF patterns
 */
const PDF_PATTERNS = {
  invoiceNumber: [
    /Invoice\s*#?\s*:?\s*([A-Z0-9-]+)/i,
    /Invoice\s+Number\s*:?\s*([A-Z0-9-]+)/i,
    /INV[#-]?\s*([A-Z0-9-]+)/i,
  ],
  invoiceDate: [
    /Invoice\s+Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ],
  vendorCode: [
    /Vendor\s*#?\s*:?\s*([A-Z0-9]+)/i,
    /Vendor\s+Code\s*:?\s*([A-Z0-9]+)/i,
  ],
  shopCode: [
    /Shop\s*#?\s*:?\s*([A-Z0-9-]+)/i,
    /Shop\s+Code\s*:?\s*([A-Z0-9-]+)/i,
    /Location\s*:?\s*([A-Z0-9-]+)/i,
  ],
  invoiceTotal: [
    /Total\s*:?\s*\$?([\d,]+\.?\d*)/i,
    /Invoice\s+Total\s*:?\s*\$?([\d,]+\.?\d*)/i,
    /Amount\s+Due\s*:?\s*\$?([\d,]+\.?\d*)/i,
    /Grand\s+Total\s*:?\s*\$?([\d,]+\.?\d*)/i,
  ],
  carNumber: [
    /([A-Z]{2,4})\s*[-\s]?\s*(\d{4,6})/g, // UTLX 12345 or UTLX-12345
    /Car\s*#?\s*:?\s*([A-Z0-9]+)/gi,
  ],
  lineItem: [
    // Pattern: Car# | Job Code | Why Made | Labor | Material | Total | Description
    /([A-Z]{2,4}\d{4,6})\s+([A-Z0-9]{2,4})\s+([A-Z0-9]{2})\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s*(.*)/gi,
  ],
};

/**
 * Parse a date string into a Date object
 */
function parseDate(dateStr: string): Date {
  const parts = dateStr.split(/[/-]/);
  if (parts.length === 3) {
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000; // Convert 2-digit year
    const month = parseInt(parts[0]) - 1;
    const day = parseInt(parts[1]);
    return new Date(year, month, day);
  }
  return new Date();
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[$,]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Extract value using multiple patterns
 */
function extractWithPatterns(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Extract car numbers from invoice text
 */
function extractCarNumbers(text: string): string[] {
  const carNumbers: Set<string> = new Set();

  // Pattern: UTLX 12345, GATX-123456, etc.
  const carPattern = /\b([A-Z]{2,4})\s*[-]?\s*(\d{4,6})\b/g;
  let match;

  while ((match = carPattern.exec(text)) !== null) {
    const mark = match[1];
    const number = match[2];
    // Validate it looks like a rail car (mark + number)
    if (mark.length >= 2 && mark.length <= 4 && number.length >= 4) {
      carNumbers.add(`${mark}${number}`);
    }
  }

  return Array.from(carNumbers);
}

/**
 * Extract line items from PDF text
 */
function extractLineItems(text: string): Omit<CreateLineItemInput, 'invoice_id'>[] {
  const items: Omit<CreateLineItemInput, 'invoice_id'>[] = [];
  const lines = text.split('\n');

  let lineNumber = 1;

  for (const line of lines) {
    // Try to match line item pattern
    // Format: CAR# | JOB | WHY | LABOR | MAT | TOTAL | DESC
    const lineMatch = line.match(
      /([A-Z]{2,4})[\s-]*(\d{4,6})\s+([A-Z0-9]{2,4})?\s*([A-Z0-9]{2})?\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)(?:\s+(.*))?/i
    );

    if (lineMatch) {
      const carMark = lineMatch[1];
      const carNum = lineMatch[2];
      const jobCode = lineMatch[3] || '';
      const whyMade = lineMatch[4] || '';
      const labor = parseAmount(lineMatch[5]);
      const material = parseAmount(lineMatch[6]);
      const total = parseAmount(lineMatch[7]);
      const desc = lineMatch[8]?.trim() || '';

      if (total > 0) {
        items.push({
          line_number: lineNumber++,
          car_number: `${carMark}${carNum}`,
          job_code: jobCode || undefined,
          why_made_code: whyMade || undefined,
          labor_amount: labor,
          material_amount: material,
          total_amount: total,
          description: desc || undefined,
        });
      }
    }
  }

  // If no structured line items found, try to create simple items from car numbers
  if (items.length === 0) {
    const carNumbers = extractCarNumbers(text);
    for (const carNumber of carNumbers) {
      items.push({
        line_number: lineNumber++,
        car_number: carNumber,
        total_amount: 0, // Will be populated during matching
      });
    }
  }

  return items;
}

/**
 * Parse invoice from PDF file
 */
export async function parsePDFInvoice(filePath: string): Promise<ParsedInvoice> {
  const warnings: string[] = [];

  // Read PDF file
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  const text = pdfData.text;

  // Extract invoice header fields
  const invoiceNumber = extractWithPatterns(text, PDF_PATTERNS.invoiceNumber);
  if (!invoiceNumber) {
    warnings.push('Could not extract invoice number - will generate one');
  }

  const invoiceDateStr = extractWithPatterns(text, PDF_PATTERNS.invoiceDate);
  const invoiceDate = invoiceDateStr ? parseDate(invoiceDateStr) : new Date();

  const vendorCode = extractWithPatterns(text, PDF_PATTERNS.vendorCode);
  const shopCode = extractWithPatterns(text, PDF_PATTERNS.shopCode);

  const invoiceTotalStr = extractWithPatterns(text, PDF_PATTERNS.invoiceTotal);
  const invoiceTotal = invoiceTotalStr ? parseAmount(invoiceTotalStr) : 0;
  if (!invoiceTotal) {
    warnings.push('Could not extract invoice total from PDF');
  }

  // Extract line items
  const lineItems = extractLineItems(text);
  if (lineItems.length === 0) {
    warnings.push('No line items extracted from PDF - manual entry required');
  }

  // Build result
  const invoice: CreateInvoiceInput = {
    invoice_number: invoiceNumber || `PDF-${Date.now()}`,
    vendor_code: vendorCode || undefined,
    shop_code: shopCode || undefined,
    invoice_date: invoiceDate,
    invoice_total: invoiceTotal,
    original_filename: path.basename(filePath),
    file_format: 'pdf',
    file_path: filePath,
    file_size_bytes: dataBuffer.length,
  };

  return {
    invoice,
    line_items: lineItems,
    parse_warnings: warnings,
    raw_text: text,
  };
}

/**
 * Parse invoice from PDF buffer (for upload handling)
 */
export async function parsePDFBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParsedInvoice> {
  const warnings: string[] = [];

  const pdfData = await pdfParse(buffer);
  const text = pdfData.text;

  // Extract invoice header fields
  const invoiceNumber = extractWithPatterns(text, PDF_PATTERNS.invoiceNumber);
  if (!invoiceNumber) {
    warnings.push('Could not extract invoice number - will generate one');
  }

  const invoiceDateStr = extractWithPatterns(text, PDF_PATTERNS.invoiceDate);
  const invoiceDate = invoiceDateStr ? parseDate(invoiceDateStr) : new Date();

  const vendorCode = extractWithPatterns(text, PDF_PATTERNS.vendorCode);
  const shopCode = extractWithPatterns(text, PDF_PATTERNS.shopCode);

  const invoiceTotalStr = extractWithPatterns(text, PDF_PATTERNS.invoiceTotal);
  const invoiceTotal = invoiceTotalStr ? parseAmount(invoiceTotalStr) : 0;
  if (!invoiceTotal) {
    warnings.push('Could not extract invoice total from PDF');
  }

  // Extract line items
  const lineItems = extractLineItems(text);
  if (lineItems.length === 0) {
    warnings.push('No line items extracted from PDF - manual entry required');
  }

  // Build result
  const invoice: CreateInvoiceInput = {
    invoice_number: invoiceNumber || `PDF-${Date.now()}`,
    vendor_code: vendorCode || undefined,
    shop_code: shopCode || undefined,
    invoice_date: invoiceDate,
    invoice_total: invoiceTotal,
    original_filename: filename,
    file_format: 'pdf',
    file_size_bytes: buffer.length,
  };

  return {
    invoice,
    line_items: lineItems,
    parse_warnings: warnings,
    raw_text: text,
  };
}

// ============================================================================
// EDI 500-BYTE PARSING
// ============================================================================

/**
 * Parse Julian date (YYYYDDD) to JavaScript Date
 */
function parseJulianDate(julian: string): Date {
  const year = parseInt(julian.substring(0, 4));
  const dayOfYear = parseInt(julian.substring(4, 7));
  const date = new Date(year, 0, 1);
  date.setDate(dayOfYear);
  return date;
}

/**
 * Parse a single EDI invoice record (500-byte fixed-width format)
 *
 * Format similar to BRC:
 * Position  Length  Description
 * 0-9       10      Invoice Number
 * 10-19     10      Vendor Code
 * 20-27     8       Shop Code
 * 28-35     8       Invoice Date (YYYYMMDD)
 * 36-39     4       Car Mark
 * 40-45     6       Car Number
 * 46-65     20      BRC Number
 * 66-69     4       Job Code
 * 70-71     2       Why Made Code
 * 72-81     10      Labor Amount (cents)
 * 82-91     10      Material Amount (cents)
 * 92-101    10      Total Amount (cents)
 * 102-151   50      Description
 */
export function parseEDIRecord(record: string): EDIInvoiceRecord {
  const padded = record.padEnd(500);

  const invoiceDateStr = padded.substring(28, 36).trim();
  let invoiceDate: Date;

  if (invoiceDateStr.length === 8) {
    // YYYYMMDD format
    const year = parseInt(invoiceDateStr.substring(0, 4));
    const month = parseInt(invoiceDateStr.substring(4, 6)) - 1;
    const day = parseInt(invoiceDateStr.substring(6, 8));
    invoiceDate = new Date(year, month, day);
  } else if (invoiceDateStr.length === 7) {
    // Julian format YYYYDDD
    invoiceDate = parseJulianDate(invoiceDateStr);
  } else {
    invoiceDate = new Date();
  }

  return {
    invoice_number: padded.substring(0, 10).trim(),
    vendor_code: padded.substring(10, 20).trim(),
    shop_code: padded.substring(20, 28).trim(),
    invoice_date: invoiceDate,
    car_mark: padded.substring(36, 40).trim(),
    car_number: padded.substring(40, 46).trim(),
    brc_number: padded.substring(46, 66).trim(),
    job_code: padded.substring(66, 70).trim(),
    why_made_code: padded.substring(70, 72).trim(),
    labor_amount: parseInt(padded.substring(72, 82)) / 100 || 0,
    material_amount: parseInt(padded.substring(82, 92)) / 100 || 0,
    total_amount: parseInt(padded.substring(92, 102)) / 100 || 0,
    description: padded.substring(102, 152).trim(),
  };
}

/**
 * Parse EDI invoice file (multiple 500-byte records)
 */
export function parseEDIFile(content: string | Buffer): EDIInvoiceRecord[] {
  const RECORD_LENGTH = 500;
  const records: EDIInvoiceRecord[] = [];

  const text = typeof content === 'string' ? content : content.toString('ascii');

  // Handle both newline-separated and continuous format
  if (text.includes('\n')) {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length >= 100) {
        records.push(parseEDIRecord(trimmed));
      }
    }
  } else {
    const recordCount = Math.floor(text.length / RECORD_LENGTH);
    for (let i = 0; i < recordCount; i++) {
      const record = text.substring(i * RECORD_LENGTH, (i + 1) * RECORD_LENGTH);
      records.push(parseEDIRecord(record));
    }
  }

  return records;
}

/**
 * Parse EDI file and group into invoice structure
 */
export function parseEDIInvoice(filePath: string): ParsedInvoice {
  const warnings: string[] = [];
  const content = fs.readFileSync(filePath);
  const records = parseEDIFile(content);

  if (records.length === 0) {
    throw new Error('No valid records found in EDI file');
  }

  // Group by invoice number
  const firstRecord = records[0];

  // Calculate total
  const invoiceTotal = records.reduce((sum, r) => sum + r.total_amount, 0);

  // Build invoice
  const invoice: CreateInvoiceInput = {
    invoice_number: firstRecord.invoice_number,
    vendor_code: firstRecord.vendor_code || undefined,
    shop_code: firstRecord.shop_code || undefined,
    invoice_date: firstRecord.invoice_date,
    invoice_total: invoiceTotal,
    original_filename: path.basename(filePath),
    file_format: 'edi500',
    file_path: filePath,
    file_size_bytes: content.length,
  };

  // Build line items
  const lineItems: Omit<CreateLineItemInput, 'invoice_id'>[] = records.map((r, idx) => ({
    line_number: idx + 1,
    car_number: `${r.car_mark}${r.car_number}`,
    brc_number: r.brc_number || undefined,
    job_code: r.job_code || undefined,
    why_made_code: r.why_made_code || undefined,
    labor_amount: r.labor_amount,
    material_amount: r.material_amount,
    total_amount: r.total_amount,
    description: r.description || undefined,
  }));

  return {
    invoice,
    line_items: lineItems,
    parse_warnings: warnings,
  };
}

/**
 * Parse EDI from buffer
 */
export function parseEDIBuffer(buffer: Buffer, filename: string): ParsedInvoice {
  const warnings: string[] = [];
  const records = parseEDIFile(buffer);

  if (records.length === 0) {
    throw new Error('No valid records found in EDI file');
  }

  const firstRecord = records[0];
  const invoiceTotal = records.reduce((sum, r) => sum + r.total_amount, 0);

  const invoice: CreateInvoiceInput = {
    invoice_number: firstRecord.invoice_number,
    vendor_code: firstRecord.vendor_code || undefined,
    shop_code: firstRecord.shop_code || undefined,
    invoice_date: firstRecord.invoice_date,
    invoice_total: invoiceTotal,
    original_filename: filename,
    file_format: 'edi500',
    file_size_bytes: buffer.length,
  };

  const lineItems: Omit<CreateLineItemInput, 'invoice_id'>[] = records.map((r, idx) => ({
    line_number: idx + 1,
    car_number: `${r.car_mark}${r.car_number}`,
    brc_number: r.brc_number || undefined,
    job_code: r.job_code || undefined,
    why_made_code: r.why_made_code || undefined,
    labor_amount: r.labor_amount,
    material_amount: r.material_amount,
    total_amount: r.total_amount,
    description: r.description || undefined,
  }));

  return {
    invoice,
    line_items: lineItems,
    parse_warnings: warnings,
  };
}

// ============================================================================
// AUTO-DETECT AND PARSE
// ============================================================================

/**
 * Detect file format from filename or content
 */
export function detectFormat(filename: string, buffer?: Buffer): 'pdf' | 'edi500' | 'unknown' {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.pdf') return 'pdf';
  if (ext === '.edi' || ext === '.500' || ext === '.txt') {
    // Check if content looks like EDI
    if (buffer) {
      const header = buffer.slice(0, 100).toString('ascii');
      // EDI typically starts with alphanumeric invoice number
      if (/^[A-Z0-9\s]{10}/.test(header)) {
        return 'edi500';
      }
    }
    return 'edi500';
  }

  // Check PDF magic bytes
  if (buffer && buffer.slice(0, 4).toString('ascii') === '%PDF') {
    return 'pdf';
  }

  return 'unknown';
}

/**
 * Parse invoice from file (auto-detect format)
 */
export async function parseInvoiceFile(filePath: string): Promise<ParsedInvoice> {
  const buffer = fs.readFileSync(filePath);
  const format = detectFormat(filePath, buffer);

  switch (format) {
    case 'pdf':
      return parsePDFInvoice(filePath);
    case 'edi500':
      return parseEDIInvoice(filePath);
    default:
      throw new Error(`Unknown file format: ${path.extname(filePath)}`);
  }
}

/**
 * Parse invoice from buffer (auto-detect format)
 */
export async function parseInvoiceBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParsedInvoice> {
  const format = detectFormat(filename, buffer);

  switch (format) {
    case 'pdf':
      return parsePDFBuffer(buffer, filename);
    case 'edi500':
      return parseEDIBuffer(buffer, filename);
    default:
      throw new Error(`Unknown file format: ${path.extname(filename)}`);
  }
}

export default {
  parsePDFInvoice,
  parsePDFBuffer,
  parseEDIInvoice,
  parseEDIBuffer,
  parseEDIFile,
  parseEDIRecord,
  parseInvoiceFile,
  parseInvoiceBuffer,
  detectFormat,
};
