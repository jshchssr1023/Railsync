/**
 * useCapacityEvents Hook
 * Subscribes to real-time capacity change events via SSE
 */

import { useEffect, useRef, useCallback, useState } from 'react';

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

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseCapacityEventsOptions {
  onCapacityChange?: (event: CapacityChangeEvent) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  enabled?: boolean;
}

interface UseCapacityEventsReturn {
  status: ConnectionStatus;
  lastEventTime: string | null;
  reconnect: () => void;
  disconnect: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function useCapacityEvents(options: UseCapacityEventsOptions = {}): UseCapacityEventsReturn {
  const { onCapacityChange, onConnectionChange, enabled = true } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastEventTime, setLastEventTime] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  // Store callbacks in refs to avoid dependency issues
  const onCapacityChangeRef = useRef(onCapacityChange);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onCapacityChangeRef.current = onCapacityChange;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onCapacityChange, onConnectionChange]);

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onConnectionChangeRef.current?.(newStatus);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    updateStatus('connecting');

    try {
      eventSourceRef.current = new EventSource(`${API_URL}/events/capacity`);

      eventSourceRef.current.onopen = () => {
        console.log('[SSE] Connected to capacity events');
        updateStatus('connected');
        reconnectAttempts.current = 0;
      };

      // Handle connected event
      eventSourceRef.current.addEventListener('connected', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('[SSE] Connection confirmed:', data.clientId);
        } catch (err) {
          console.warn('[SSE] Failed to parse connected event:', err);
        }
      });

      // Handle capacity change events
      eventSourceRef.current.addEventListener('capacity-change', (e) => {
        try {
          const event: CapacityChangeEvent = JSON.parse(e.data);
          setLastEventTime(event.timestamp);
          onCapacityChangeRef.current?.(event);
        } catch (err) {
          console.error('[SSE] Failed to parse capacity event:', err);
        }
      });

      eventSourceRef.current.onerror = (err) => {
        console.error('[SSE] Connection error:', err);
        updateStatus('error');
        eventSourceRef.current?.close();

        // Exponential backoff reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('[SSE] Max reconnection attempts reached');
          updateStatus('disconnected');
        }
      };
    } catch (err) {
      console.error('[SSE] Failed to create EventSource:', err);
      updateStatus('error');
    }
  }, [enabled, updateStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reconnectAttempts.current = 0;
    updateStatus('disconnected');
    console.log('[SSE] Disconnected');
  }, [updateStatus]);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    status,
    lastEventTime,
    reconnect,
    disconnect,
  };
}

export default useCapacityEvents;
