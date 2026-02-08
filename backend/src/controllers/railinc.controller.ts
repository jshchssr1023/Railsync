import { Request, Response } from 'express';
import * as railincService from '../services/railinc-edi.service';

export async function importEDIFile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: 'EDI file content is required' }); return; }
    const result = await railincService.importEDIFile(content, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to import EDI file' });
  }
}

export async function parseEDIPreview(req: Request, res: Response): Promise<void> {
  try {
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: 'EDI file content is required' }); return; }
    const parsed = railincService.parseEDIContent(content);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to parse EDI file' });
  }
}

export async function checkConnection(req: Request, res: Response): Promise<void> {
  try {
    const result = await railincService.checkRailincConnection();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check Railinc connection' });
  }
}
