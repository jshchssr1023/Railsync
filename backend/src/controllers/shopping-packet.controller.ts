/**
 * Shopping Packet Controller
 * API endpoints for packet management and document handling
 */

import { Request, Response } from 'express';
import logger from '../config/logger';
import * as packetService from '../services/shopping-packet.service';

export async function createPacket(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const packet = await packetService.createPacket(req.body, userId);
    res.status(201).json({ success: true, data: packet });
  } catch (error) {
    logger.error({ err: error }, 'Error creating packet');
    res.status(500).json({ success: false, error: 'Failed to create packet' });
  }
}

export async function getPacket(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const packet = await packetService.getPacket(id);
    if (!packet) {
      res.status(404).json({ success: false, error: 'Packet not found' });
      return;
    }
    res.json({ success: true, data: packet });
  } catch (error) {
    logger.error({ err: error }, 'Error getting packet');
    res.status(500).json({ success: false, error: 'Failed to get packet' });
  }
}

export async function listPackets(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      shopping_event_id: req.query.shopping_event_id as string,
      batch_id: req.query.batch_id as string,
      car_number: req.query.car_number as string,
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await packetService.listPackets(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error listing packets');
    res.status(500).json({ success: false, error: 'Failed to list packets' });
  }
}

export async function addDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = (req as any).file;

    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const doc = await packetService.addDocument(id, {
      document_type: req.body.document_type || 'other',
      document_name: file.originalname,
      file_path: file.path,
      file_size_bytes: file.size,
      mime_type: file.mimetype,
    }, userId);

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    logger.error({ err: error }, 'Error adding document');
    res.status(500).json({ success: false, error: 'Failed to add document' });
  }
}

export async function linkMFilesDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { document_type, document_name, mfiles_id, mfiles_url } = req.body;

    if (!mfiles_id || !document_name) {
      res.status(400).json({ success: false, error: 'mfiles_id and document_name are required' });
      return;
    }

    const doc = await packetService.linkMFilesDocument(id, {
      document_type: document_type || 'other',
      document_name,
      mfiles_id,
      mfiles_url,
    }, userId);

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    logger.error({ err: error }, 'Error linking MFiles document');
    res.status(500).json({ success: false, error: 'Failed to link document' });
  }
}

export async function sendPacket(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const packet = await packetService.sendPacket(id, userId);
    if (!packet) {
      res.status(404).json({ success: false, error: 'Packet not found or not in draft/ready status' });
      return;
    }
    res.json({ success: true, data: packet });
  } catch (error) {
    logger.error({ err: error }, 'Error sending packet');
    res.status(500).json({ success: false, error: 'Failed to send packet' });
  }
}

export async function acknowledgePacket(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const packet = await packetService.acknowledgePacket(id);
    if (!packet) {
      res.status(404).json({ success: false, error: 'Packet not found or not in issued status' });
      return;
    }
    res.json({ success: true, data: packet });
  } catch (error) {
    logger.error({ err: error }, 'Error acknowledging packet');
    res.status(500).json({ success: false, error: 'Failed to acknowledge packet' });
  }
}
