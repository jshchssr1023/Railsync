/**
 * Invoice Matching Service
 * Compares invoice line items to BRC allocations and handles auto-approval logic
 */

import { query, queryOne } from '../config/database';
import * as invoiceService from './invoice.service';
import {
  InvoiceLineItem,
  MatchStatus,
  VARIANCE_THRESHOLD,
} from './invoice.service';

// ============================================================================
// TYPES
// ============================================================================

export interface AllocationMatch {
  allocation_id: string;
  car_number: string;
  shop_code: string;
  brc_number?: string;
  actual_cost: number;
  job_codes: { code: string; amount: number }[];
  why_made_code?: string;
}

export interface LineMatchResult {
  line_item_id: string;
  match_status: MatchStatus;
  matched_allocation_id?: string;
  match_confidence: number;
  match_notes: string;
}

export interface InvoiceMatchSummary {
  invoice_id: string;
  invoice_total: number;
  brc_total: number;
  variance_amount: number;
  variance_pct: number;
  within_tolerance: boolean;
  exact_match_count: number;
  close_match_count: number;
  unmatched_count: number;
  recommended_status: 'auto_approved' | 'manual_review';
  match_details: LineMatchResult[];
}

// ============================================================================
// ALLOCATION LOOKUP
// ============================================================================

/**
 * Find allocations by car numbers with BRC data
 */
export async function findAllocationsByCarNumbers(
  carNumbers: string[]
): Promise<AllocationMatch[]> {
  if (carNumbers.length === 0) return [];

  const result = await query<{
    id: string;
    car_number: string;
    shop_code: string;
    brc_number: string | null;
    actual_cost: number | null;
    actual_cost_breakdown: { job_codes?: { code: string; amount: number }[] } | null;
    why_made_code: string | null;
  }>(
    `SELECT a.id, a.car_number, a.shop_code, a.brc_number, a.actual_cost, a.actual_cost_breakdown,
            (a.actual_cost_breakdown->>'why_made_code')::text as why_made_code
     FROM allocations a
     WHERE a.car_number = ANY($1)
       AND a.actual_cost IS NOT NULL
       AND a.status IN ('completed', 'brc_received')
     ORDER BY a.updated_at DESC`,
    [carNumbers]
  );

  return result.map((r) => ({
    allocation_id: r.id,
    car_number: r.car_number,
    shop_code: r.shop_code,
    brc_number: r.brc_number || undefined,
    actual_cost: r.actual_cost || 0,
    job_codes: r.actual_cost_breakdown?.job_codes || [],
    why_made_code: r.why_made_code || undefined,
  }));
}

/**
 * Find allocation by BRC number
 */
export async function findAllocationByBRC(brcNumber: string): Promise<AllocationMatch | null> {
  const result = await queryOne<{
    id: string;
    car_number: string;
    shop_code: string;
    brc_number: string | null;
    actual_cost: number | null;
    actual_cost_breakdown: { job_codes?: { code: string; amount: number }[] } | null;
  }>(
    `SELECT a.id, a.car_number, a.shop_code, a.brc_number, a.actual_cost, a.actual_cost_breakdown
     FROM allocations a
     WHERE a.brc_number = $1
     ORDER BY a.updated_at DESC
     LIMIT 1`,
    [brcNumber]
  );

  if (!result) return null;

  return {
    allocation_id: result.id,
    car_number: result.car_number,
    shop_code: result.shop_code,
    brc_number: result.brc_number || undefined,
    actual_cost: result.actual_cost || 0,
    job_codes: result.actual_cost_breakdown?.job_codes || [],
  };
}

// ============================================================================
// LINE ITEM MATCHING
// ============================================================================

/**
 * Calculate match confidence between invoice line and BRC allocation
 */
function calculateMatchConfidence(
  lineItem: InvoiceLineItem,
  allocation: AllocationMatch
): { confidence: number; matchType: MatchStatus; notes: string[] } {
  const notes: string[] = [];
  let score = 0;
  const maxScore = 100;

  // Car number match (required, worth 40%)
  if (lineItem.car_number === allocation.car_number) {
    score += 40;
  } else {
    return { confidence: 0, matchType: 'no_match', notes: ['Car number mismatch'] };
  }

  // Amount match (worth 40%)
  const amountDiff = Math.abs(lineItem.total_amount - allocation.actual_cost);
  const amountPct = allocation.actual_cost > 0
    ? amountDiff / allocation.actual_cost
    : amountDiff > 0 ? 1 : 0;

  if (amountPct === 0) {
    score += 40;
    notes.push('Exact amount match');
  } else if (amountPct <= 0.01) {
    score += 38;
    notes.push(`Amount within 1% ($${amountDiff.toFixed(2)} difference)`);
  } else if (amountPct <= 0.05) {
    score += 30;
    notes.push(`Amount within 5% ($${amountDiff.toFixed(2)} difference)`);
  } else if (amountPct <= 0.10) {
    score += 20;
    notes.push(`Amount within 10% ($${amountDiff.toFixed(2)} difference)`);
  } else {
    notes.push(`Amount differs by ${(amountPct * 100).toFixed(1)}% ($${amountDiff.toFixed(2)})`);
  }

  // Job code match (worth 10%)
  if (lineItem.job_code && allocation.job_codes.length > 0) {
    const jobMatch = allocation.job_codes.some(jc => jc.code === lineItem.job_code);
    if (jobMatch) {
      score += 10;
      notes.push(`Job code ${lineItem.job_code} matched`);
    } else {
      notes.push(`Job code ${lineItem.job_code} not found in BRC`);
    }
  } else if (!lineItem.job_code) {
    score += 5; // Partial credit if no job code to match
  }

  // Why made code match (worth 10%)
  if (lineItem.why_made_code && allocation.why_made_code) {
    if (lineItem.why_made_code === allocation.why_made_code) {
      score += 10;
      notes.push(`Why made code ${lineItem.why_made_code} matched`);
    } else {
      notes.push(`Why made code mismatch: ${lineItem.why_made_code} vs ${allocation.why_made_code}`);
    }
  } else if (!lineItem.why_made_code) {
    score += 5; // Partial credit if no why made code to match
  }

  // Determine match type based on score
  const confidence = Math.round((score / maxScore) * 100);
  let matchType: MatchStatus;

  if (confidence >= 90) {
    matchType = 'exact_match';
  } else if (confidence >= 70) {
    matchType = 'close_match';
  } else {
    matchType = 'no_match';
  }

  return { confidence, matchType, notes };
}

/**
 * Match a single line item to available allocations
 */
export async function matchLineItem(
  lineItem: InvoiceLineItem,
  allocations: AllocationMatch[]
): Promise<LineMatchResult> {
  // Find allocations for this car number
  const carAllocations = allocations.filter(a => a.car_number === lineItem.car_number);

  if (carAllocations.length === 0) {
    return {
      line_item_id: lineItem.id,
      match_status: 'no_match',
      match_confidence: 0,
      match_notes: `No BRC found for car ${lineItem.car_number}`,
    };
  }

  // Find best match among car's allocations
  let bestMatch: {
    allocation: AllocationMatch;
    confidence: number;
    matchType: MatchStatus;
    notes: string[];
  } | null = null;

  for (const allocation of carAllocations) {
    const result = calculateMatchConfidence(lineItem, allocation);
    if (!bestMatch || result.confidence > bestMatch.confidence) {
      bestMatch = {
        allocation,
        ...result,
      };
    }
  }

  if (!bestMatch || bestMatch.confidence < 50) {
    return {
      line_item_id: lineItem.id,
      match_status: 'no_match',
      match_confidence: bestMatch?.confidence || 0,
      match_notes: bestMatch?.notes.join('; ') || 'No suitable match found',
    };
  }

  return {
    line_item_id: lineItem.id,
    match_status: bestMatch.matchType,
    matched_allocation_id: bestMatch.allocation.allocation_id,
    match_confidence: bestMatch.confidence,
    match_notes: bestMatch.notes.join('; '),
  };
}

// ============================================================================
// INVOICE MATCHING
// ============================================================================

/**
 * Run matching for all line items in an invoice
 */
export async function matchInvoice(invoiceId: string): Promise<InvoiceMatchSummary> {
  // Get invoice and line items
  const invoice = await invoiceService.getInvoice(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const lineItems = await invoiceService.getInvoiceLineItems(invoiceId);

  // Get unique car numbers from line items
  const carNumbers = [...new Set(lineItems.map(li => li.car_number).filter(Boolean) as string[])];

  // Find all matching allocations
  const allocations = await findAllocationsByCarNumbers(carNumbers);

  // Match each line item
  const matchResults: LineMatchResult[] = [];
  let brcTotal = 0;

  for (const lineItem of lineItems) {
    const result = await matchLineItem(lineItem, allocations);
    matchResults.push(result);

    // Update line item in database
    await invoiceService.updateLineItemMatch(
      lineItem.id,
      result.match_status,
      result.matched_allocation_id,
      result.match_confidence,
      result.match_notes
    );

    // Track matched allocation for BRC total
    if (result.matched_allocation_id) {
      const matchedAlloc = allocations.find(a => a.allocation_id === result.matched_allocation_id);
      if (matchedAlloc) {
        // Create BRC match record
        await invoiceService.createBrcMatch(
          invoiceId,
          matchedAlloc.allocation_id,
          result.match_status === 'exact_match' ? 'exact' : result.match_status === 'close_match' ? 'close' : 'manual',
          matchedAlloc.brc_number,
          matchedAlloc.actual_cost,
          lineItem.total_amount
        );
        brcTotal += matchedAlloc.actual_cost;
      }
    }
  }

  // Calculate summary stats
  const exactMatches = matchResults.filter(r => r.match_status === 'exact_match').length;
  const closeMatches = matchResults.filter(r => r.match_status === 'close_match').length;
  const unmatched = matchResults.filter(r => r.match_status === 'no_match' || r.match_status === 'pending').length;

  const varianceAmount = invoice.invoice_total - brcTotal;
  const variancePct = brcTotal > 0 ? (varianceAmount / brcTotal) * 100 : 0;
  const withinTolerance = Math.abs(variancePct) <= VARIANCE_THRESHOLD * 100;

  // Determine recommended status
  const recommendedStatus: 'auto_approved' | 'manual_review' =
    withinTolerance && unmatched === 0 ? 'auto_approved' : 'manual_review';

  // Update invoice with match stats
  await invoiceService.updateInvoiceMatchStats(invoiceId, {
    brc_total: brcTotal,
    variance_amount: varianceAmount,
    variance_pct: variancePct,
    match_count: exactMatches + closeMatches,
    exact_match_count: exactMatches,
    close_match_count: closeMatches,
    unmatched_count: unmatched,
  });

  return {
    invoice_id: invoiceId,
    invoice_total: invoice.invoice_total,
    brc_total: brcTotal,
    variance_amount: varianceAmount,
    variance_pct: variancePct,
    within_tolerance: withinTolerance,
    exact_match_count: exactMatches,
    close_match_count: closeMatches,
    unmatched_count: unmatched,
    recommended_status: recommendedStatus,
    match_details: matchResults,
  };
}

/**
 * Process invoice and auto-approve if within tolerance
 */
export async function processInvoice(invoiceId: string): Promise<InvoiceMatchSummary> {
  const matchSummary = await matchInvoice(invoiceId);

  // Auto-approve if within tolerance and all lines matched
  if (matchSummary.recommended_status === 'auto_approved') {
    await invoiceService.updateInvoiceStatus(
      invoiceId,
      'auto_approved',
      undefined,
      `Auto-approved: within ${VARIANCE_THRESHOLD * 100}% tolerance (${matchSummary.variance_pct.toFixed(2)}% variance)`
    );
  } else {
    await invoiceService.updateInvoiceStatus(
      invoiceId,
      'manual_review',
      undefined,
      `Requires manual review: ${matchSummary.unmatched_count} unmatched lines, ${matchSummary.variance_pct.toFixed(2)}% variance`
    );
  }

  return matchSummary;
}

/**
 * Re-run matching for an invoice (after manual corrections)
 */
export async function rematchInvoice(invoiceId: string): Promise<InvoiceMatchSummary> {
  // Clear existing BRC matches
  await query('DELETE FROM invoice_brc_matches WHERE invoice_id = $1', [invoiceId]);

  // Reset line item match statuses
  await query(
    `UPDATE invoice_line_items
     SET match_status = 'pending', matched_allocation_id = NULL, match_confidence = NULL, match_notes = NULL
     WHERE invoice_id = $1`,
    [invoiceId]
  );

  // Re-run matching
  return processInvoice(invoiceId);
}

export default {
  findAllocationsByCarNumbers,
  findAllocationByBRC,
  matchLineItem,
  matchInvoice,
  processInvoice,
  rematchInvoice,
};
