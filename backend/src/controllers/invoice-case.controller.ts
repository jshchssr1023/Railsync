/**
 * Invoice Case Controller
 * API endpoints for invoice case workflow, state transitions, attachments, and audit
 */

import { Request, Response } from 'express';
import * as invoiceCaseService from '../services/invoice-case.service';
import * as invoiceValidationService from '../services/invoice-validation.service';
import * as invoiceAttachmentService from '../services/invoice-attachment.service';

// ==============================================================================
// Invoice Case CRUD
// ==============================================================================

/**
 * Create a new invoice case
 * POST /api/invoice-cases
 */
export async function createInvoiceCase(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const invoiceCase = await invoiceCaseService.createInvoiceCase(req.body, userId);

    res.status(201).json({
      success: true,
      data: invoiceCase,
    });
  } catch (error) {
    console.error('Error creating invoice case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create invoice case',
    });
  }
}

/**
 * Get a single invoice case
 * GET /api/invoice-cases/:id
 */
export async function getInvoiceCase(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Support lookup by ID or case number
    let invoiceCase = await invoiceCaseService.getInvoiceCase(id);
    if (!invoiceCase) {
      invoiceCase = await invoiceCaseService.getInvoiceCaseByCaseNumber(id);
    }

    if (!invoiceCase) {
      return res.status(404).json({
        success: false,
        error: 'Invoice case not found',
      });
    }

    res.json({
      success: true,
      data: invoiceCase,
    });
  } catch (error) {
    console.error('Error fetching invoice case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice case',
    });
  }
}

/**
 * Get invoice case with full summary
 * GET /api/invoice-cases/:id/summary
 */
export async function getInvoiceCaseSummary(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const summary = await invoiceCaseService.getCaseSummary(id);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Invoice case not found',
      });
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching invoice case summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice case summary',
    });
  }
}

/**
 * List invoice cases with filters
 * GET /api/invoice-cases
 */
export async function listInvoiceCases(req: Request, res: Response) {
  try {
    const {
      workflow_state,
      invoice_type,
      assigned_admin_id,
      shop_code,
      lessee,
      search,
      from_date,
      to_date,
      page = '1',
      limit = '25',
    } = req.query;

    const result = await invoiceCaseService.listInvoiceCases(
      {
        workflow_state: workflow_state as invoiceValidationService.WorkflowState | undefined,
        invoice_type: invoice_type as invoiceValidationService.InvoiceType | undefined,
        assigned_admin_id: assigned_admin_id as string | undefined,
        shop_code: shop_code as string | undefined,
        lessee: lessee as string | undefined,
        search: search as string | undefined,
        from_date: from_date ? new Date(from_date as string) : undefined,
        to_date: to_date ? new Date(to_date as string) : undefined,
      },
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: result.cases,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Error listing invoice cases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list invoice cases',
    });
  }
}

/**
 * Update invoice case
 * PUT /api/invoice-cases/:id
 */
export async function updateInvoiceCase(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const invoiceCase = await invoiceCaseService.updateInvoiceCase(id, req.body, userId);

    if (!invoiceCase) {
      return res.status(404).json({
        success: false,
        error: 'Invoice case not found',
      });
    }

    res.json({
      success: true,
      data: invoiceCase,
    });
  } catch (error) {
    console.error('Error updating invoice case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update invoice case',
    });
  }
}

// ==============================================================================
// State Transitions
// ==============================================================================

/**
 * Validate state transition without performing it
 * POST /api/invoice-cases/:id/validate
 */
export async function validateStateTransition(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { target_state } = req.body;

    if (!target_state) {
      return res.status(400).json({
        success: false,
        error: 'target_state is required',
      });
    }

    const validation = await invoiceValidationService.validateInvoice(id, target_state);

    // Save validation result
    await invoiceValidationService.saveValidationResult(validation, req.user?.id);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Error validating state transition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate state transition',
    });
  }
}

/**
 * Perform state transition
 * POST /api/invoice-cases/:id/transition
 */
export async function transitionState(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { target_state, notes } = req.body;
    const userId = req.user?.id;

    if (!target_state) {
      return res.status(400).json({
        success: false,
        error: 'target_state is required',
      });
    }

    const result = await invoiceCaseService.transitionState(
      id,
      target_state,
      userId,
      notes,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        validation: result.validation,
      });
    }

    res.json({
      success: true,
      data: result.case,
      validation: result.validation,
    });
  } catch (error) {
    console.error('Error transitioning state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transition state',
    });
  }
}

// ==============================================================================
// Assignment
// ==============================================================================

/**
 * Assign case to admin
 * PUT /api/invoice-cases/:id/assign
 */
export async function assignCase(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { admin_id, notes } = req.body;
    const userId = req.user?.id;

    if (!admin_id) {
      return res.status(400).json({
        success: false,
        error: 'admin_id is required',
      });
    }

    const invoiceCase = await invoiceCaseService.assignCase(id, admin_id, userId, notes);

    if (!invoiceCase) {
      return res.status(404).json({
        success: false,
        error: 'Invoice case not found',
      });
    }

    res.json({
      success: true,
      data: invoiceCase,
    });
  } catch (error) {
    console.error('Error assigning case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign case',
    });
  }
}

/**
 * Unassign case
 * DELETE /api/invoice-cases/:id/assign
 */
export async function unassignCase(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const invoiceCase = await invoiceCaseService.unassignCase(id, userId);

    if (!invoiceCase) {
      return res.status(404).json({
        success: false,
        error: 'Invoice case not found',
      });
    }

    res.json({
      success: true,
      data: invoiceCase,
    });
  } catch (error) {
    console.error('Error unassigning case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unassign case',
    });
  }
}

// ==============================================================================
// Special Lessee Approval
// ==============================================================================

/**
 * Confirm special lessee approval
 * POST /api/invoice-cases/:id/special-lessee-approval
 */
export async function confirmSpecialLesseeApproval(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const invoiceCase = await invoiceCaseService.confirmSpecialLesseeApproval(id, userId, notes);

    if (!invoiceCase) {
      return res.status(404).json({
        success: false,
        error: 'Invoice case not found',
      });
    }

    res.json({
      success: true,
      data: invoiceCase,
    });
  } catch (error) {
    console.error('Error confirming special lessee approval:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm special lessee approval',
    });
  }
}

// ==============================================================================
// Attachments
// ==============================================================================

/**
 * Upload attachment
 * POST /api/invoice-cases/:id/attachments
 */
export async function uploadAttachment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    // Detect attachment type from filename
    const attachmentType = req.body.attachment_type ||
      invoiceAttachmentService.detectAttachmentType(req.file.originalname, req.file.mimetype);

    const attachment = await invoiceAttachmentService.createAttachment({
      invoice_case_id: id,
      attachment_type: attachmentType,
      filename_original: req.file.originalname,
      file_buffer: req.file.buffer,
      mime_type: req.file.mimetype,
      uploaded_by: userId,
    });

    res.status(201).json({
      success: true,
      data: attachment,
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload attachment',
    });
  }
}

/**
 * List attachments for a case
 * GET /api/invoice-cases/:id/attachments
 */
export async function listAttachments(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const includeIgnored = req.query.include_ignored === 'true';

    const attachments = await invoiceAttachmentService.listAttachments(id, includeIgnored);

    res.json({
      success: true,
      data: attachments,
    });
  } catch (error) {
    console.error('Error listing attachments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list attachments',
    });
  }
}

/**
 * Get attachment download
 * GET /api/invoice-cases/:caseId/attachments/:attachmentId/download
 */
export async function downloadAttachment(req: Request, res: Response) {
  try {
    const { attachmentId } = req.params;

    const downloadInfo = await invoiceAttachmentService.getDownloadInfo(attachmentId);

    if (!downloadInfo) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found',
      });
    }

    res.setHeader('Content-Type', downloadInfo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.filename}"`);
    res.send(downloadInfo.buffer);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download attachment',
    });
  }
}

/**
 * Delete attachment
 * DELETE /api/invoice-cases/:caseId/attachments/:attachmentId
 */
export async function deleteAttachment(req: Request, res: Response) {
  try {
    const { attachmentId } = req.params;
    const userId = req.user?.id;

    const deleted = await invoiceAttachmentService.deleteAttachment(attachmentId, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found',
      });
    }

    res.json({
      success: true,
      message: 'Attachment deleted',
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete attachment',
    });
  }
}

/**
 * Validate attachments for a case
 * GET /api/invoice-cases/:id/attachments/validate
 */
export async function validateAttachments(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const validation = await invoiceAttachmentService.validateAttachments(id);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Error validating attachments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate attachments',
    });
  }
}

/**
 * Verify attachment
 * POST /api/invoice-cases/:caseId/attachments/:attachmentId/verify
 */
export async function verifyAttachment(req: Request, res: Response) {
  try {
    const { attachmentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const attachment = await invoiceAttachmentService.verifyAttachment(attachmentId, userId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found',
      });
    }

    res.json({
      success: true,
      data: attachment,
    });
  } catch (error) {
    console.error('Error verifying attachment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify attachment',
    });
  }
}

// ==============================================================================
// Audit Events
// ==============================================================================

/**
 * Get audit events for a case
 * GET /api/invoice-cases/:id/audit-events
 */
export async function getAuditEvents(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const events = await invoiceCaseService.getAuditEvents(id, limit);

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('Error fetching audit events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit events',
    });
  }
}

// ==============================================================================
// Dashboard / Summary
// ==============================================================================

/**
 * Get cases by state
 * GET /api/invoice-cases/by-state
 */
export async function getCasesByState(req: Request, res: Response) {
  try {
    const stats = await invoiceCaseService.getCasesByState();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching cases by state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cases by state',
    });
  }
}
