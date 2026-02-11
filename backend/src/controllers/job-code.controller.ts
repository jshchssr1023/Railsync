import { Request, Response } from 'express';
import logger from '../config/logger';
import {
  createJobCode as createJobCodeService,
  listJobCodes as listJobCodesService,
  getJobCode as getJobCodeService,
  updateJobCode as updateJobCodeService,
} from '../services/job-code.service';

export async function createJobCode(req: Request, res: Response): Promise<void> {
  try {
    const { code, code_type, description, category } = req.body;

    const jobCode = await createJobCodeService({ code, code_type, description, category });

    res.status(201).json(jobCode);
  } catch (error) {
    logger.error({ err: error }, 'Error creating job code');
    res.status(500).json({ error: 'Failed to create job code' });
  }
}

export async function listJobCodes(req: Request, res: Response): Promise<void> {
  try {
    const { code_type, category, search, is_active } = req.query;

    const filters = {
      code_type: code_type as string | undefined,
      category: category as string | undefined,
      search: search as string | undefined,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
    };

    const jobCodes = await listJobCodesService(filters);

    res.json(jobCodes);
  } catch (error) {
    logger.error({ err: error }, 'Error listing job codes');
    res.status(500).json({ error: 'Failed to list job codes' });
  }
}

export async function getJobCode(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const jobCode = await getJobCodeService(id);

    if (!jobCode) {
      res.status(404).json({ error: 'Job code not found' });
      return;
    }

    res.json(jobCode);
  } catch (error) {
    logger.error({ err: error }, 'Error getting job code');
    res.status(500).json({ error: 'Failed to get job code' });
  }
}

export async function updateJobCode(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const input = req.body;

    const jobCode = await updateJobCodeService(id, input);

    if (!jobCode) {
      res.status(404).json({ error: 'Job code not found' });
      return;
    }

    res.json(jobCode);
  } catch (error) {
    logger.error({ err: error }, 'Error updating job code');
    res.status(500).json({ error: 'Failed to update job code' });
  }
}
