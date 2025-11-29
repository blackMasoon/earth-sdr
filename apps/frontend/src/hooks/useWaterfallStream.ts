import { useEffect, useRef, useCallback, useState } from 'react';
import { WaterfallLine } from '@websdr-atlas/shared';

interface UseWaterfallStreamOptions {
  stationId: string | null;
  minHz?: number;
  maxHz?: number;
  enabled?: boolean;
  onLine?: (line: WaterfallLine) => void;
}

interface UseWaterfallStreamReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => void;
}

/**
 * Custom hook for connecting to the waterfall SSE stream
 *
 * Uses Server-Sent Events (SSE) to receive real-time waterfall data
 * from the backend streaming proxy.
 */
export function useWaterfallStream({
  stationId,
  minHz,
  maxHz,
  enabled = true,
  onLine,
}: UseWaterfallStreamOptions): UseWaterfallStreamReturn {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!stationId || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnecting(true);
    setError(null);

    // Build URL with query params
    let url = `/api/streaming/waterfall/${stationId}`;
    const params = new URLSearchParams();
    if (minHz !== undefined) params.set('minHz', minHz.toString());
    if (maxHz !== undefined) params.set('maxHz', maxHz.toString());
    if (params.toString()) url += `?${params.toString()}`;

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && onLine) {
            onLine(data as WaterfallLine);
          }
        } catch (e) {
          console.error('Failed to parse waterfall data:', e);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setError('Connection lost');

        // EventSource will auto-reconnect, but we can manage this ourselves
        eventSource.close();
        eventSourceRef.current = null;

        // Retry after a delay
        setTimeout(() => {
          if (enabled && stationId) {
            connect();
          }
        }, 3000);
      };
    } catch (e) {
      setIsConnecting(false);
      setError(e instanceof Error ? e.message : 'Connection failed');
    }
  }, [stationId, minHz, maxHz, enabled, onLine]);

  // Connect when station changes or on mount
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    reconnect: connect,
  };
}

/**
 * Fetch stream info for a station
 */
export async function fetchStreamInfo(stationId: string): Promise<{
  waterfall: {
    url: string;
    proxyUrl: string;
    type: 'standard' | 'kiwisdr' | 'unknown';
  };
  supportsAudio: boolean;
} | null> {
  try {
    const response = await fetch(`/api/streaming/info/${stationId}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Check station online status
 */
export async function checkStationStatus(stationId: string): Promise<{
  online: boolean;
  latencyMs: number | null;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/streaming/status/${stationId}`);
    if (!response.ok) {
      return { online: false, latencyMs: null, error: 'Failed to check status' };
    }
    return response.json();
  } catch (e) {
    return {
      online: false,
      latencyMs: null,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}
