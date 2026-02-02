/**
 * SSE Controller
 * Handles Server-Sent Events for real-time capacity updates
 */

import { Request, Response } from 'express';
import { capacityEvents, CapacityChangeEvent } from '../services/capacity-events.service';

// Track active connections for monitoring
let connectionCount = 0;

/**
 * GET /api/events/capacity
 * Subscribe to real-time capacity change events via SSE
 */
export function subscribeToCapacityEvents(req: Request, res: Response): void {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  connectionCount++;
  const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[SSE] Client ${clientId} connected. Active connections: ${connectionCount}`);

  // Send initial connection confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({
    status: 'connected',
    clientId,
    timestamp: new Date().toISOString(),
  })}\n\n`);

  // Subscribe to capacity changes
  const onCapacityChange = (event: CapacityChangeEvent) => {
    try {
      const eventId = `${Date.now()}-${event.shopCode}-${event.month}`;
      res.write(`id: ${eventId}\nevent: capacity-change\ndata: ${JSON.stringify(event)}\n\n`);
    } catch (err) {
      console.error(`[SSE] Error sending event to client ${clientId}:`, err);
    }
  };

  capacityEvents.on('capacity-change', onCapacityChange);

  // Heartbeat to keep connection alive (every 30 seconds)
  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat ${new Date().toISOString()}\n\n`);
    } catch (err) {
      // Connection likely closed
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    connectionCount--;
    console.log(`[SSE] Client ${clientId} disconnected. Active connections: ${connectionCount}`);
    capacityEvents.off('capacity-change', onCapacityChange);
    clearInterval(heartbeat);
  });

  // Handle errors
  req.on('error', (err) => {
    console.error(`[SSE] Client ${clientId} error:`, err);
    connectionCount--;
    capacityEvents.off('capacity-change', onCapacityChange);
    clearInterval(heartbeat);
  });
}

/**
 * GET /api/events/status
 * Get SSE connection status for monitoring
 */
export function getConnectionStatus(req: Request, res: Response): void {
  res.json({
    success: true,
    data: {
      activeConnections: connectionCount,
      listenerCount: capacityEvents.getListenerCount(),
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * POST /api/events/test
 * Test endpoint to emit a sample event (for development/debugging)
 */
export function emitTestEvent(req: Request, res: Response): void {
  const { shopCode = 'TEST-SHOP', month = '2026-01' } = req.body;

  capacityEvents.emitCapacityChange({
    type: 'capacity_changed',
    shopCode,
    month,
    capacity: {
      total_capacity: 50,
      allocated_count: 25,
      available_capacity: 25,
      utilization_pct: 50,
      version: 1,
    },
    timestamp: new Date().toISOString(),
    userId: req.user?.id,
  });

  res.json({
    success: true,
    message: `Test event emitted for ${shopCode}/${month}`,
  });
}

export default {
  subscribeToCapacityEvents,
  getConnectionStatus,
  emitTestEvent,
};
