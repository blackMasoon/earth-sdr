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

  /**
   * Get the expected content type for waterfall data
   */
  getWaterfallContentType(): string;
}

/**
 * Default adapter for standard WebSDR instances (PA3FWM type)
 * Most WebSDRs use a similar JavaScript-based protocol
 *
 * The standard WebSDR uses AJAX requests to fetch waterfall data:
 * - GET /~~waterfallheader - returns metadata about the waterfall
 * - GET /~~waterfall?... - returns actual FFT data as binary
 */
class StandardWebSdrAdapter implements WebSdrAdapter {
  canHandle(url: string): boolean {
    // Standard WebSDR instances typically run on port 8901
    return url.includes(':8901') || url.includes('websdr');
  }

  getWaterfallUrl(baseUrl: string): string {
    // Standard WebSDR waterfall endpoint
    // Format: baseUrl/~~waterfallheader for initial config
    const cleanUrl = baseUrl.replace(/\/$/, '');
    return `${cleanUrl}/~~waterfallheader`;
  }

  getAudioUrl(baseUrl: string, frequencyHz: number, mode: string): string {
    // Standard WebSDR audio endpoint
    // Format: baseUrl/~~audiostream?f=frequency&mode=mode
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const freqKHz = Math.round(frequencyHz / 1000);
    return `${cleanUrl}/~~audiostream?f=${freqKHz}&mode=${mode.toLowerCase()}`;
  }

  getWaterfallContentType(): string {
    return 'application/octet-stream';
  }

  parseWaterfallData(data: Buffer): WaterfallLine | null {
    // Standard WebSDR sends FFT data as binary
    // Each packet typically contains timestamp + FFT magnitudes
    try {
      if (data.length < 8) return null;

      // Parse header (simplified - actual format may vary)
      const timestamp = Date.now();

      // Convert FFT data (8-bit values normalized 0-255) to magnitudes using Array.from for efficiency
      const magnitudes = Array.from(data, (byte) => byte / 255);

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

  getWaterfallContentType(): string {
    return 'application/octet-stream';
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
 * Cached waterfall header info from WebSDR
 */
interface WaterfallHeader {
  bands: Array<{
    name: string;
    startHz: number;
    endHz: number;
    startPixel: number;
    endPixel: number;
  }>;
  totalWidth: number;
  fetchedAt: number;
}

/**
 * StreamingService - Handles proxying and transforming WebSDR data streams
 *
 * This service provides:
 * 1. CORS proxy for WebSDR streams
 * 2. Adapters for different WebSDR types
 * 3. Data transformation and normalization
 * 4. Connection management and caching
 * 5. Real waterfall data fetching from WebSDR instances
 */
@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly adapters: WebSdrAdapter[] = [new KiwiSdrAdapter(), new StandardWebSdrAdapter()];
  private readonly waterfallHeaderCache = new Map<string, WaterfallHeader>();

  // Constants for cache and data validation
  private readonly HEADER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Minimum data length for valid waterfall response.
   * WebSDR waterfall data typically contains at least a few FFT bins.
   * A response smaller than this is likely an error or empty response.
   */
  private readonly MIN_WATERFALL_DATA_LENGTH = 10;

  /**
   * WebSDR dB scale conversion constants.
   * WebSDR sends FFT data as unsigned 8-bit values (0-255) representing dB scale.
   * DB_OFFSET: The midpoint value representing 0 dB (128 = center of 0-255 range)
   * DB_RANGE: The dynamic range divisor for converting to linear scale
   *           Using 40 dB range gives good visual contrast for radio signals
   */
  private readonly DB_OFFSET = 128;
  private readonly DB_RANGE = 40;

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
   * Fetch waterfall header/configuration from a WebSDR
   * This contains band information and pixel mappings
   */
  async fetchWaterfallHeader(stationUrl: string): Promise<WaterfallHeader | null> {
    // Check cache first
    const cached = this.waterfallHeaderCache.get(stationUrl);
    if (cached && Date.now() - cached.fetchedAt < this.HEADER_CACHE_TTL_MS) {
      return cached;
    }

    try {
      const cleanUrl = stationUrl.replace(/\/$/, '');
      const headerUrl = `${cleanUrl}/~~waterfallheader`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(headerUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'WebSDR-Atlas/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`Failed to fetch waterfall header from ${headerUrl}: ${response.status}`);
        return null;
      }

      const text = await response.text();
      const header = this.parseWaterfallHeader(text);

      if (header) {
        this.waterfallHeaderCache.set(stationUrl, header);
      }

      return header;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Error fetching waterfall header from ${stationUrl}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Parse waterfall header response
   * Format varies by WebSDR version, but typically contains band info
   */
  private parseWaterfallHeader(text: string): WaterfallHeader | null {
    try {
      // The waterfall header is typically JavaScript that sets variables
      // We'll parse the common patterns

      const bands: WaterfallHeader['bands'] = [];
      let totalWidth = 1024; // Default

      // Look for band definitions
      // Common patterns:
      // - band_name[n] = "80m"; band_low[n] = 3500; band_high[n] = 3800;
      // - Or JSON-like structure

      // Extract band names
      const bandNameMatches = text.matchAll(/band_name\[(\d+)\]\s*=\s*["']([^"']+)["']/g);
      const bandNames: Record<number, string> = {};
      for (const match of bandNameMatches) {
        bandNames[parseInt(match[1])] = match[2];
      }

      // Extract band frequencies
      const bandLowMatches = text.matchAll(/band_low\[(\d+)\]\s*=\s*(\d+)/g);
      const bandHighMatches = text.matchAll(/band_high\[(\d+)\]\s*=\s*(\d+)/g);
      const bandLows: Record<number, number> = {};
      const bandHighs: Record<number, number> = {};

      for (const match of bandLowMatches) {
        bandLows[parseInt(match[1])] = parseInt(match[2]) * 1000; // kHz to Hz
      }
      for (const match of bandHighMatches) {
        bandHighs[parseInt(match[1])] = parseInt(match[2]) * 1000; // kHz to Hz
      }

      // Combine into bands array
      const indices = Object.keys(bandNames).map(Number);
      for (const idx of indices) {
        if (bandLows[idx] !== undefined && bandHighs[idx] !== undefined) {
          bands.push({
            name: bandNames[idx] || `Band ${idx}`,
            startHz: bandLows[idx],
            endHz: bandHighs[idx],
            startPixel: 0, // Will be calculated
            endPixel: 0, // Will be calculated
          });
        }
      }

      // Look for total width
      const widthMatch = text.match(/totbw\s*=\s*(\d+)/);
      if (widthMatch) {
        totalWidth = parseInt(widthMatch[1]);
      }

      return {
        bands,
        totalWidth,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      this.logger.warn(`Failed to parse waterfall header: ${error}`);
      return null;
    }
  }

  /**
   * Fetch actual waterfall data from a WebSDR
   * This makes a proxied request to get the FFT data
   */
  async fetchWaterfallData(
    stationUrl: string,
    minHz: number,
    maxHz: number
  ): Promise<WaterfallLine | null> {
    try {
      const cleanUrl = stationUrl.replace(/\/$/, '');

      // Convert Hz to kHz for the WebSDR API
      const minKHz = Math.floor(minHz / 1000);
      const maxKHz = Math.ceil(maxHz / 1000);
      const width = 512; // Number of FFT bins to request

      // Standard WebSDR waterfall data URL format
      const waterfallUrl = `${cleanUrl}/~~waterfall?lo=${minKHz}&hi=${maxKHz}&w=${width}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(waterfallUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'WebSDR-Atlas/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);

      if (data.length < this.MIN_WATERFALL_DATA_LENGTH) {
        return null;
      }

      // Parse the waterfall data
      // Standard WebSDR format: binary FFT magnitudes in dB scale
      const magnitudes: number[] = [];
      for (let i = 0; i < data.length; i++) {
        // Convert from dB scale (0-255) to linear (0-1)
        // Using DB_OFFSET and DB_RANGE constants for the conversion formula
        const dbValue = data[i];
        const linear = Math.pow(10, (dbValue - this.DB_OFFSET) / this.DB_RANGE);
        magnitudes.push(Math.min(1.0, Math.max(0, linear)));
      }

      const freqStepHz = (maxHz - minHz) / magnitudes.length;

      return {
        timestamp: Date.now(),
        freqStartHz: minHz,
        freqStepHz,
        magnitudes,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Failed to fetch waterfall data: ${errorMessage}`);
      return null;
    }
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
    mode: string
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

      // Consider online if status is successful (2xx) or if server doesn't support HEAD (405)
      // Status 405 Method Not Allowed is common for servers that only support GET
      const isOnline = response.ok || response.status === 405;

      return {
        online: isOnline,
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
   * Try to get real waterfall data from a station, fall back to simulated
   */
  async getWaterfallLine(
    stationId: string,
    minHz: number,
    maxHz: number,
    numBins: number
  ): Promise<WaterfallLine> {
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
    });

    if (station) {
      // Try to fetch real data
      const realData = await this.fetchWaterfallData(station.url, minHz, maxHz);
      if (realData) {
        return realData;
      }
    }

    // Fall back to simulated data
    return this.generateSimulatedWaterfallLine(minHz, maxHz, numBins);
  }

  /**
   * Generate simulated waterfall data for testing/MVP
   * This mimics real SDR data with noise floor and signal peaks
   */
  generateSimulatedWaterfallLine(
    freqStartHz: number,
    freqEndHz: number,
    numBins: number
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
