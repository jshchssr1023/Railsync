/**
 * Capacity Events Service
 * EventEmitter singleton that broadcasts capacity changes to SSE connections
 */

import { EventEmitter } from 'events';

// Event types for capacity changes
export interface CapacityChangeEvent {
  type: 'allocation_created' | 'allocation_updated' | 'allocation_deleted' | 'capacity_changed';
  shopCode: string;
  month: string;
  allocation?: {
    id: string;
    car_number?: string;
    status: string;
    version: number;
  };
  capacity?: {
    total_capacity: number;
    allocated_count: number;
    available_capacity: number;
    utilization_pct: number;
    version: number;
  };
  timestamp: string;
  userId?: string;
}

/**
 * Singleton EventEmitter for capacity change events
 * Used to broadcast events from services to SSE connections
 */
class CapacityEventEmitter extends EventEmitter {
  private static instance: CapacityEventEmitter;

  private constructor() {
    super();
    // Support many concurrent SSE connections
    this.setMaxListeners(100);
  }

  static getInstance(): CapacityEventEmitter {
    if (!CapacityEventEmitter.instance) {
      CapacityEventEmitter.instance = new CapacityEventEmitter();
    }
    return CapacityEventEmitter.instance;
  }

  /**
   * Emit a capacity change event to all connected clients
   */
  emitCapacityChange(event: CapacityChangeEvent): void {
    this.emit('capacity-change', event);
    console.log(`[SSE] Emitted ${event.type} for ${event.shopCode}/${event.month}`);
  }

  /**
   * Emit allocation created event
   */
  emitAllocationCreated(
    shopCode: string,
    month: string,
    allocation: { id: string; car_number?: string; status: string; version: number },
    userId?: string
  ): void {
    this.emitCapacityChange({
      type: 'allocation_created',
      shopCode,
      month,
      allocation,
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  /**
   * Emit allocation updated event
   */
  emitAllocationUpdated(
    shopCode: string,
    month: string,
    allocation: { id: string; car_number?: string; status: string; version: number },
    userId?: string
  ): void {
    this.emitCapacityChange({
      type: 'allocation_updated',
      shopCode,
      month,
      allocation,
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  /**
   * Emit allocation deleted event
   */
  emitAllocationDeleted(
    shopCode: string,
    month: string,
    allocationId: string,
    userId?: string
  ): void {
    this.emitCapacityChange({
      type: 'allocation_deleted',
      shopCode,
      month,
      allocation: { id: allocationId, status: 'deleted', version: 0 },
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  /**
   * Emit capacity changed event (direct capacity update)
   */
  emitCapacityUpdated(
    shopCode: string,
    month: string,
    capacity: {
      total_capacity: number;
      allocated_count: number;
      available_capacity: number;
      utilization_pct: number;
      version: number;
    },
    userId?: string
  ): void {
    this.emitCapacityChange({
      type: 'capacity_changed',
      shopCode,
      month,
      capacity,
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  /**
   * Get the number of listeners (for monitoring)
   */
  getListenerCount(): number {
    return this.listenerCount('capacity-change');
  }
}

// Export singleton instance
export const capacityEvents = CapacityEventEmitter.getInstance();

export default capacityEvents;
