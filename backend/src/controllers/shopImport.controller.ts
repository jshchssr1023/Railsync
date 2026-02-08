import { Request, Response } from 'express';
import logger from '../config/logger';
import * as shopImportService from '../services/shopImport.service';
import { logFromRequest } from '../services/audit.service';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Import shop attributes from CSV
 * POST /api/shops/import/attributes
 */
export async function importShopAttributes(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ success: false, error: 'rows array required' });
      return;
    }

    const result = await shopImportService.importShopAttributes(rows);

    await logFromRequest(req, 'import', 'shops', 'batch', undefined, {
      inserted: result.inserted,
      updated: result.updated,
      errors: result.errors.length,
    });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import shop attributes error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * Import shop capabilities from CSV
 * POST /api/shops/import/capabilities
 */
export async function importShopCapabilities(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ success: false, error: 'rows array required' });
      return;
    }

    const result = await shopImportService.importShopCapabilities(rows);

    await logFromRequest(req, 'import', 'shop_capabilities', 'batch', undefined, {
      inserted: result.inserted,
      errors: result.errors.length,
    });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import shop capabilities error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * Import monthly capacity from CSV
 * POST /api/capacity/import/monthly
 */
export async function importMonthlyCapacity(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ success: false, error: 'rows array required' });
      return;
    }

    const result = await shopImportService.importMonthlyCapacity(rows);

    await logFromRequest(req, 'import', 'shop_monthly_capacity', 'batch', undefined, {
      inserted: result.inserted,
      errors: result.errors.length,
    });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import monthly capacity error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * Import work type capacity from CSV
 * POST /api/capacity/import/work
 */
export async function importWorkCapacity(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ success: false, error: 'rows array required' });
      return;
    }

    const result = await shopImportService.importWorkCapacity(rows);

    await logFromRequest(req, 'import', 'shop_capacity', 'batch', undefined, {
      inserted: result.inserted,
      errors: result.errors.length,
    });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import work capacity error');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export default {
  importShopAttributes,
  importShopCapabilities,
  importMonthlyCapacity,
  importWorkCapacity,
};
