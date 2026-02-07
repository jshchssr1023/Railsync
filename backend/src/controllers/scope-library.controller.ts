import { Request, Response } from 'express';
import logger from '../config/logger';
import {
  createScopeTemplate,
  getScopeTemplate,
  listScopeTemplates,
  suggestScopes,
  updateScopeTemplate,
  addTemplateItem,
  updateTemplateItem,
  removeTemplateItem,
  addItemJobCode,
  removeItemJobCode,
} from '../services/scope-library.service';

export async function listScopeTemplatesHandler(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      car_type: req.query.car_type as string | undefined,
      shopping_type_code: req.query.shopping_type_code as string | undefined,
      shopping_reason_code: req.query.shopping_reason_code as string | undefined,
      search: req.query.search as string | undefined,
    };

    const templates = await listScopeTemplates(filters);
    res.json(templates);
  } catch (error) {
    logger.error({ err: error }, 'Error listing scope templates');
    res.status(500).json({ error: 'Failed to list scope templates' });
  }
}

export async function suggestScopesHandler(req: Request, res: Response): Promise<void> {
  try {
    const carType = req.query.car_type as string;
    const shoppingTypeCode = req.query.shopping_type_code as string;
    const shoppingReasonCode = req.query.shopping_reason_code as string;

    const suggestions = await suggestScopes(carType, shoppingTypeCode, shoppingReasonCode);
    res.json(suggestions);
  } catch (error) {
    logger.error({ err: error }, 'Error suggesting scopes');
    res.status(500).json({ error: 'Failed to suggest scopes' });
  }
}

export async function getScopeTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const template = await getScopeTemplate(id);

    if (!template) {
      res.status(404).json({ error: 'Scope template not found' });
      return;
    }

    res.json(template);
  } catch (error) {
    logger.error({ err: error }, 'Error getting scope template');
    res.status(500).json({ error: 'Failed to get scope template' });
  }
}

export async function createScopeTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { name, car_type, shopping_type_code, shopping_reason_code, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const template = await createScopeTemplate(
      { name, car_type, shopping_type_code, shopping_reason_code, description },
      userId
    );

    res.status(201).json(template);
  } catch (error) {
    logger.error({ err: error }, 'Error creating scope template');
    res.status(500).json({ error: 'Failed to create scope template' });
  }
}

export async function updateScopeTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, car_type, shopping_type_code, shopping_reason_code, description } = req.body;

    const template = await updateScopeTemplate(id, {
      name,
      car_type,
      shopping_type_code,
      shopping_reason_code,
      description,
    });

    if (!template) {
      res.status(404).json({ error: 'Scope template not found' });
      return;
    }

    res.json(template);
  } catch (error) {
    logger.error({ err: error }, 'Error updating scope template');
    res.status(500).json({ error: 'Failed to update scope template' });
  }
}

export async function addTemplateItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { line_number, instruction_text, source, ccm_section_id } = req.body;

    if (!line_number || !instruction_text) {
      res.status(400).json({ error: 'line_number and instruction_text are required' });
      return;
    }

    const item = await addTemplateItem(id, { line_number, instruction_text, source, ccm_section_id });
    res.status(201).json(item);
  } catch (error) {
    logger.error({ err: error }, 'Error adding template item');
    res.status(500).json({ error: 'Failed to add template item' });
  }
}

export async function updateTemplateItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;
    const { line_number, instruction_text, source, ccm_section_id } = req.body;

    const item = await updateTemplateItem(itemId, { line_number, instruction_text, source, ccm_section_id });

    if (!item) {
      res.status(404).json({ error: 'Template item not found' });
      return;
    }

    res.json(item);
  } catch (error) {
    logger.error({ err: error }, 'Error updating template item');
    res.status(500).json({ error: 'Failed to update template item' });
  }
}

export async function removeTemplateItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;
    await removeTemplateItem(itemId);
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error removing template item');
    res.status(500).json({ error: 'Failed to remove template item' });
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
    res.status(201).json({ message: 'Job code added to template item' });
  } catch (error) {
    logger.error({ err: error }, 'Error adding item job code');
    res.status(500).json({ error: 'Failed to add job code to template item' });
  }
}

export async function removeItemJobCodeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { itemId, codeId } = req.params;
    await removeItemJobCode(itemId, codeId);
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error removing item job code');
    res.status(500).json({ error: 'Failed to remove job code from template item' });
  }
}
