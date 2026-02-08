import logger from '../config/logger';
import { Request, Response } from 'express';
import {
  getCCMWithSections as getCCMWithSectionsService,
  listCCMsByLessee as listCCMsByLesseeService,
  addSection as addSectionService,
  updateSection as updateSectionService,
  deleteSection as deleteSectionService,
  getSectionsForSOW as getSectionsForSOWService,
  createCCMForm as createCCMFormService,
  getCCMForm as getCCMFormService,
  listCCMForms as listCCMFormsService,
  updateCCMForm as updateCCMFormService,
  addSealingSection as addSealingSectionService,
  updateSealingSection as updateSealingSectionService,
  removeSealingSection as removeSealingSectionService,
  addLiningSection as addLiningSectionService,
  updateLiningSection as updateLiningSectionService,
  removeLiningSection as removeLiningSectionService,
  addCCMFormAttachment as addCCMFormAttachmentService,
  removeCCMFormAttachment as removeCCMFormAttachmentService,
  getCCMFormSOWSections as getCCMFormSOWSectionsService,
} from '../services/ccm.service';

export async function getCCMWithSections(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const ccm = await getCCMWithSectionsService(id);

    if (!ccm) {
      res.status(404).json({ error: 'CCM document not found' });
      return;
    }

    res.json(ccm);
  } catch (error) {
    logger.error({ err: error }, 'Error getting CCM with sections');
    res.status(500).json({ error: 'Failed to get CCM document' });
  }
}

export async function listCCMsByLessee(req: Request, res: Response): Promise<void> {
  try {
    const lesseeCode = req.query.lessee_code as string;

    if (!lesseeCode) {
      res.status(400).json({ error: 'lessee_code query parameter is required' });
      return;
    }

    const ccms = await listCCMsByLesseeService(lesseeCode);

    res.json(ccms);
  } catch (error) {
    logger.error({ err: error }, 'Error listing CCMs by lessee');
    res.status(500).json({ error: 'Failed to list CCM documents' });
  }
}

export async function addSection(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const ccmDocumentId = req.params.id;
    const { section_number, section_name, content, section_type, can_include_in_sow } = req.body;

    const section = await addSectionService({
      ccm_document_id: ccmDocumentId,
      section_number,
      section_name,
      content,
      section_type,
      can_include_in_sow,
    });

    res.status(201).json(section);
  } catch (error) {
    logger.error({ err: error }, 'Error adding CCM section');
    res.status(500).json({ error: 'Failed to add CCM section' });
  }
}

export async function updateSection(req: Request, res: Response): Promise<void> {
  try {
    const { sectionId } = req.params;
    const input = req.body;

    const section = await updateSectionService(sectionId, input);

    if (!section) {
      res.status(404).json({ error: 'CCM section not found' });
      return;
    }

    res.json(section);
  } catch (error) {
    logger.error({ err: error }, 'Error updating CCM section');
    res.status(500).json({ error: 'Failed to update CCM section' });
  }
}

export async function deleteSection(req: Request, res: Response): Promise<void> {
  try {
    const { sectionId } = req.params;

    const deleted = await deleteSectionService(sectionId);

    if (!deleted) {
      res.status(404).json({ error: 'CCM section not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting CCM section');
    res.status(500).json({ error: 'Failed to delete CCM section' });
  }
}

export async function getSectionsForSOW(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const sections = await getSectionsForSOWService(id);

    res.json(sections);
  } catch (error) {
    logger.error({ err: error }, 'Error getting CCM sections for SOW');
    res.status(500).json({ error: 'Failed to get CCM sections for SOW' });
  }
}

// ============================================================================
// CCM FORM ENDPOINTS (structured form matching AITX template)
// ============================================================================

export async function createCCMForm(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const form = await createCCMFormService(req.body, userId);
    res.status(201).json({ success: true, data: form });
  } catch (error) {
    logger.error({ err: error }, 'Error creating CCM form');
    res.status(500).json({ success: false, error: 'Failed to create CCM form' });
  }
}

export async function getCCMForm(req: Request, res: Response): Promise<void> {
  try {
    const form = await getCCMFormService(req.params.id);
    if (!form) {
      res.status(404).json({ success: false, error: 'CCM form not found' });
      return;
    }
    res.json({ success: true, data: form });
  } catch (error) {
    logger.error({ err: error }, 'Error getting CCM form');
    res.status(500).json({ success: false, error: 'Failed to get CCM form' });
  }
}

export async function listCCMForms(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      lessee_code: req.query.lessee_code as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await listCCMFormsService(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error listing CCM forms');
    res.status(500).json({ success: false, error: 'Failed to list CCM forms' });
  }
}

export async function updateCCMForm(req: Request, res: Response): Promise<void> {
  try {
    const form = await updateCCMFormService(req.params.id, req.body);
    if (!form) {
      res.status(404).json({ success: false, error: 'CCM form not found' });
      return;
    }
    res.json({ success: true, data: form });
  } catch (error) {
    logger.error({ err: error }, 'Error updating CCM form');
    res.status(500).json({ success: false, error: 'Failed to update CCM form' });
  }
}

// -- Sealing --

export async function addSealingSection(req: Request, res: Response): Promise<void> {
  try {
    const section = await addSealingSectionService(req.params.id, req.body);
    res.status(201).json({ success: true, data: section });
  } catch (error) {
    logger.error({ err: error }, 'Error adding sealing section');
    res.status(500).json({ success: false, error: 'Failed to add sealing section' });
  }
}

export async function updateSealingSection(req: Request, res: Response): Promise<void> {
  try {
    const section = await updateSealingSectionService(req.params.sealingId, req.body);
    if (!section) {
      res.status(404).json({ success: false, error: 'Sealing section not found' });
      return;
    }
    res.json({ success: true, data: section });
  } catch (error) {
    logger.error({ err: error }, 'Error updating sealing section');
    res.status(500).json({ success: false, error: 'Failed to update sealing section' });
  }
}

export async function removeSealingSection(req: Request, res: Response): Promise<void> {
  try {
    const deleted = await removeSealingSectionService(req.params.sealingId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Sealing section not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error removing sealing section');
    res.status(500).json({ success: false, error: 'Failed to remove sealing section' });
  }
}

// -- Lining --

export async function addLiningSection(req: Request, res: Response): Promise<void> {
  try {
    const section = await addLiningSectionService(req.params.id, req.body);
    res.status(201).json({ success: true, data: section });
  } catch (error) {
    logger.error({ err: error }, 'Error adding lining section');
    res.status(500).json({ success: false, error: 'Failed to add lining section' });
  }
}

export async function updateLiningSection(req: Request, res: Response): Promise<void> {
  try {
    const section = await updateLiningSectionService(req.params.liningId, req.body);
    if (!section) {
      res.status(404).json({ success: false, error: 'Lining section not found' });
      return;
    }
    res.json({ success: true, data: section });
  } catch (error) {
    logger.error({ err: error }, 'Error updating lining section');
    res.status(500).json({ success: false, error: 'Failed to update lining section' });
  }
}

export async function removeLiningSection(req: Request, res: Response): Promise<void> {
  try {
    const deleted = await removeLiningSectionService(req.params.liningId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Lining section not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error removing lining section');
    res.status(500).json({ success: false, error: 'Failed to remove lining section' });
  }
}

// -- Attachments --

export async function addCCMFormAttachment(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const file = (req as any).file;

    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const attachment = await addCCMFormAttachmentService(req.params.id, {
      file_name: file.originalname,
      file_path: file.path,
      file_size_bytes: file.size,
      mime_type: file.mimetype,
    }, userId);

    res.status(201).json({ success: true, data: attachment });
  } catch (error) {
    logger.error({ err: error }, 'Error adding CCM form attachment');
    res.status(500).json({ success: false, error: 'Failed to add attachment' });
  }
}

export async function removeCCMFormAttachment(req: Request, res: Response): Promise<void> {
  try {
    const deleted = await removeCCMFormAttachmentService(req.params.attachmentId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Attachment not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error removing attachment');
    res.status(500).json({ success: false, error: 'Failed to remove attachment' });
  }
}

export async function getCCMFormSOWSections(req: Request, res: Response): Promise<void> {
  try {
    const sections = await getCCMFormSOWSectionsService(req.params.id);
    res.json({ success: true, data: sections });
  } catch (error) {
    logger.error({ err: error }, 'Error getting CCM form SOW sections');
    res.status(500).json({ success: false, error: 'Failed to get SOW sections' });
  }
}
