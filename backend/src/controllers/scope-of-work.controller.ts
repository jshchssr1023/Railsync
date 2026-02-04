import { Request, Response } from 'express';
import {
  createSOW,
  getSOW,
  addSOWItem,
  updateSOWItem,
  removeSOWItem,
  addItemJobCode,
  removeItemJobCode,
  populateFromLibrary,
  populateFromCCM,
  finalizeSOW,
  saveAsTemplate,
} from '../services/scope-of-work.service';

export async function createSOWHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const { scope_library_id } = req.body;

    const sow = await createSOW({ scope_library_id }, userId);
    res.status(201).json(sow);
  } catch (error) {
    console.error('Error creating scope of work:', error);
    res.status(500).json({ error: 'Failed to create scope of work' });
  }
}

export async function getSOWHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const sow = await getSOW(id);

    if (!sow) {
      res.status(404).json({ error: 'Scope of work not found' });
      return;
    }

    res.json(sow);
  } catch (error) {
    console.error('Error getting scope of work:', error);
    res.status(500).json({ error: 'Failed to get scope of work' });
  }
}

export async function addSOWItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { line_number, instruction_text, source, ccm_section_id, scope_library_item_id } = req.body;

    if (!line_number || !instruction_text) {
      res.status(400).json({ error: 'line_number and instruction_text are required' });
      return;
    }

    const item = await addSOWItem(id, { line_number, instruction_text, source, ccm_section_id, scope_library_item_id });
    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding SOW item:', error);
    res.status(500).json({ error: 'Failed to add scope of work item' });
  }
}

export async function updateSOWItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;
    const { line_number, instruction_text, source, ccm_section_id } = req.body;

    const item = await updateSOWItem(itemId, { line_number, instruction_text, source, ccm_section_id });

    if (!item) {
      res.status(404).json({ error: 'SOW item not found' });
      return;
    }

    res.json(item);
  } catch (error: any) {
    if (error.message === 'Cannot update items on a finalized scope of work') {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Error updating SOW item:', error);
    res.status(500).json({ error: 'Failed to update scope of work item' });
  }
}

export async function removeSOWItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;
    await removeSOWItem(itemId);
    res.status(204).send();
  } catch (error) {
    console.error('Error removing SOW item:', error);
    res.status(500).json({ error: 'Failed to remove scope of work item' });
  }
}

export async function addItemJobCodeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;
    const { job_code_id, is_expected, notes } = req.body;

    if (!job_code_id) {
      res.status(400).json({ error: 'job_code_id is required' });
      return;
    }

    await addItemJobCode(itemId, job_code_id, is_expected, notes);
    res.status(201).json({ message: 'Job code added to SOW item' });
  } catch (error) {
    console.error('Error adding item job code:', error);
    res.status(500).json({ error: 'Failed to add job code to SOW item' });
  }
}

export async function removeItemJobCodeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { itemId, codeId } = req.params;
    await removeItemJobCode(itemId, codeId);
    res.status(204).send();
  } catch (error) {
    console.error('Error removing item job code:', error);
    res.status(500).json({ error: 'Failed to remove job code from SOW item' });
  }
}

export async function populateFromLibraryHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { template_id } = req.body;

    if (!template_id) {
      res.status(400).json({ error: 'template_id is required' });
      return;
    }

    const insertedCount = await populateFromLibrary(id, template_id);
    res.json({ inserted_count: insertedCount });
  } catch (error) {
    console.error('Error populating from library:', error);
    res.status(500).json({ error: 'Failed to populate from library' });
  }
}

export async function populateFromCCMHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { section_ids } = req.body;

    if (!section_ids || !Array.isArray(section_ids) || section_ids.length === 0) {
      res.status(400).json({ error: 'section_ids array is required' });
      return;
    }

    const insertedCount = await populateFromCCM(id, section_ids);
    res.json({ inserted_count: insertedCount });
  } catch (error) {
    console.error('Error populating from CCM:', error);
    res.status(500).json({ error: 'Failed to populate from CCM' });
  }
}

export async function finalizeSOWHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const sow = await finalizeSOW(id, userId);

    if (!sow) {
      res.status(404).json({ error: 'Scope of work not found or already finalized' });
      return;
    }

    res.json(sow);
  } catch (error) {
    console.error('Error finalizing scope of work:', error);
    res.status(500).json({ error: 'Failed to finalize scope of work' });
  }
}

export async function saveAsTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const template = await saveAsTemplate(id, name, userId);
    res.status(201).json(template);
  } catch (error) {
    console.error('Error saving as template:', error);
    res.status(500).json({ error: 'Failed to save as template' });
  }
}
