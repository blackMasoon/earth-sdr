import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WaterfallLine } from '@websdr-atlas/shared';

/**
 * WebSDR adapter interface for different WebSDR implementations
 */
export interface WebSdrAdapter {
  /**
   * Check if the adapter can handle this WebSDR URL
   */
  canHandle(url: string): boolean;

  /**
   * Get the waterfall data stream URL for a WebSDR
   */
  getWaterfallUrl(baseUrl: string): string;

  /**
   * Get the audio stream URL for a WebSDR
   */
  getAudioUrl(baseUrl: string, frequencyHz: number, mode: string): string;

  /**
   * Parse waterfall data from raw response
   */
  parseWaterfallData(data: Buffer): WaterfallLine | null;
}

/**
 * Default adapter for standard WebSDR instances (PA3FWM type)
 * Most WebSDRs use a similar JavaScript-based protocol
 */
class StandardWebSdrAdapter implements WebSdrAdapter {
  canHandle(url: string): boolean {
    // Standard WebSDR instances typically run on port 8901
    return url.includes(':8901') || url.includes('websdr');
  }

  getWaterfallUrl(baseUrl: string): string {
    // Standard WebSDR waterfall endpoint
    // Format: baseUrl/~~waterfalldata?...
    const cleanUrl = baseUrl.replace(/\/$/, '');
    return `${cleanUrl}/~~waterfall`;
  }

  getAudioUrl(baseUrl: string, frequencyHz: number, mode: string): string {
    // Standard WebSDR audio endpoint
    // Format: baseUrl/~~audiostream?f=frequency&mode=mode
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const freqKHz = Math.round(frequencyHz / 1000);
    return `${cleanUrl}/~~audiostream?f=${freqKHz}&mode=${mode.toLowerCase()}`;
  }

  parseWaterfallData(data: Buffer): WaterfallLine | null {
    // Standard WebSDR sends FFT data as binary
    // Each packet typically contains timestamp + FFT magnitudes
    try {
      if (data.length < 8) return null;

      // Parse header (simplified - actual format may vary)
      const timestamp = Date.now();
      const magnitudes: number[] = [];

      // Read FFT data (typically 8-bit values normalized 0-255)
      for (let i = 0; i < data.length; i++) {
        magnitudes.push(data[i] / 255);
      }

      return {
        timestamp,
        freqStartHz: 0, // Will be set by caller
        freqStepHz: 0, // Will be set by caller
        magnitudes,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Adapter for KiwiSDR instances
 * KiwiSDR uses WebSocket protocol
 */
class KiwiSdrAdapter implements WebSdrAdapter {
  canHandle(url: string): boolean {
    return url.includes('kiwisdr') || url.includes(':8073');
  }

  getWaterfallUrl(baseUrl: string): string {
    const cleanUrl = baseUrl.replace(/^https?/, 'ws').replace(/\/$/, '');
    return `${cleanUrl}/kiwi/waterfall`;
  }

  getAudioUrl(baseUrl: string, frequencyHz: number, mode: string): string {
    const cleanUrl = baseUrl.replace(/^https?/, 'ws').replace(/\/$/, '');
    const freqKHz = frequencyHz / 1000;
    return `${cleanUrl}/kiwi/audio?f=${freqKHz}&mode=${mode}`;
  }

  parseWaterfallData(data: Buffer): WaterfallLine | null {
    // KiwiSDR protocol parsing - simplified
    // Actual implementation would need full WebSocket protocol handling
    try {
      const magnitudes: number[] = [];
      for (let i = 0; i < data.length; i++) {
        magnitudes.push(data[i] / 255);
      }
      return {
        timestamp: Date.now(),
        freqStartHz: 0,
        freqStepHz: 0,
        magnitudes,
      };
    } catch {
      return null;
    }
  }
}

/**
 * StreamingService - Handles proxying and transforming WebSDR data streams
 *
 * This service provides:
 * 1. CORS proxy for WebSDR streams
 * 2. Adapters for different WebSDR types
 * 3. Data transformation and normalization
 * 4. Connection management and caching
 */
@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly adapters: WebSdrAdapter[] = [
    new KiwiSdrAdapter(),
    new StandardWebSdrAdapter(),
  ];

  constructor(private prisma: PrismaService) {}

  /**
   * Get the appropriate adapter for a WebSDR URL
   */
  getAdapter(url: string): WebSdrAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Proxy waterfall data from a WebSDR
   * Returns the stream URL and configuration for the client
   */
  async getWaterfallStreamInfo(stationId: string): Promise<{
    url: string;
    proxyUrl: string;
    type: 'standard' | 'kiwisdr' | 'unknown';
  } | null> {
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
      include: { ranges: true },
    });

    if (!station) {
      this.logger.warn(`Station not found: ${stationId}`);
      return null;
    }

    const adapter = this.getAdapter(station.url);
    if (!adapter) {
      this.logger.warn(`No adapter found for URL: ${station.url}`);
      return {
        url: station.url,
        proxyUrl: `/api/streaming/waterfall/${stationId}`,
        type: 'unknown',
      };
    }

    const type = adapter instanceof KiwiSdrAdapter ? 'kiwisdr' : 'standard';
    const waterfallUrl = adapter.getWaterfallUrl(station.url);

    return {
      url: waterfallUrl,
      proxyUrl: `/api/streaming/waterfall/${stationId}`,
      type,
    };
  }

  /**
   * Proxy audio stream from a WebSDR
   * Returns the stream URL and configuration for the client
   */
  async getAudioStreamInfo(
    stationId: string,
    frequencyHz: number,
    mode: string,
  ): Promise<{
    url: string;
    proxyUrl: string;
    type: 'standard' | 'kiwisdr' | 'unknown';
  } | null> {
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
    });

    if (!station) {
      this.logger.warn(`Station not found: ${stationId}`);
      return null;
    }

    const adapter = this.getAdapter(station.url);
    if (!adapter) {
      return null;
    }

    const type = adapter instanceof KiwiSdrAdapter ? 'kiwisdr' : 'standard';
    const audioUrl = adapter.getAudioUrl(station.url, frequencyHz, mode);

    return {
      url: audioUrl,
      proxyUrl: `/api/streaming/audio/${stationId}?freq=${frequencyHz}&mode=${mode}`,
      type,
    };
  }

  /**
   * Check if a WebSDR station is reachable/online
   * This is a simple HTTP HEAD check
   */
  async checkStationStatus(stationId: string): Promise<{
    online: boolean;
    latencyMs: number | null;
    error?: string;
  }> {
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
    });

    if (!station) {
      return { online: false, latencyMs: null, error: 'Station not found' };
    }

    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(station.url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      return {
        online: response.ok || response.status === 405, // Some servers don't support HEAD
        latencyMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Station ${station.name} is offline: ${errorMessage}`);
      return {
        online: false,
        latencyMs: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate simulated waterfall data for testing/MVP
   * This mimics real SDR data with noise floor and signal peaks
   */
  generateSimulatedWaterfallLine(
    freqStartHz: number,
    freqEndHz: number,
    numBins: number,
  ): WaterfallLine {
    const magnitudes: number[] = [];
    const freqStepHz = (freqEndHz - freqStartHz) / numBins;

    // Base noise floor (varies slightly)
    const noiseFloor = 0.1 + Math.random() * 0.05;

    for (let i = 0; i < numBins; i++) {
      let value = noiseFloor + Math.random() * 0.05;

      // Add some simulated signals at typical frequencies
      // 7.074 MHz - FT8
      // 7.000-7.050 MHz - CW
      // 7.100-7.125 MHz - SSB
      const freqHz = freqStartHz + i * freqStepHz;
      const freqMHz = freqHz / 1_000_000;

      // FT8 signals around x.074 MHz
      if (Math.abs((freqMHz % 1) - 0.074) < 0.002) {
        value += 0.3 + Math.random() * 0.4;
      }

      // CW activity in lower portion of bands
      const bandStart = Math.floor(freqMHz);
      if (freqMHz - bandStart < 0.05 && Math.random() > 0.7) {
        value += 0.2 + Math.random() * 0.3;
      }

      // Random signals
      if (Math.random() > 0.98) {
        value += 0.4 + Math.random() * 0.4;
      }

      magnitudes.push(Math.min(value, 1.0));
    }

    return {
      timestamp: Date.now(),
      freqStartHz,
      freqStepHz,
      magnitudes,
    };
  }
}
