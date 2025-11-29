import { Controller, Get, Param, Query, Sse, MessageEvent, Logger, Res } from '@nestjs/common';
import { Response } from 'express';
import { Observable, interval, from, switchMap, map, catchError, of } from 'rxjs';
import { StreamingService } from './streaming.service';

/**
 * StreamingController - Proxy endpoints for WebSDR data streams
 *
 * Provides:
 * 1. SSE (Server-Sent Events) for waterfall data
 * 2. Proxy endpoint for audio streams
 * 3. Station status check endpoint
 * 4. Real waterfall data fetching with fallback to simulated data
 *
 * These endpoints allow the frontend to access WebSDR streams
 * without CORS issues, as the browser connects to our backend
 * which then proxies requests to the actual WebSDR servers.
 */
@Controller('streaming')
export class StreamingController {
  private readonly logger = new Logger(StreamingController.name);

  /**
   * Pattern to match waterfall header endpoint suffix in WebSDR URLs.
   * Used to extract the base station URL from waterfall URLs.
   */
  private readonly WATERFALL_HEADER_SUFFIX_PATTERN = /\/~~waterfallheader$/;

  constructor(private readonly streamingService: StreamingService) {}

  /**
   * Get stream information for a station
   * Returns URLs and configuration for connecting to the stream
   */
  @Get('info/:stationId')
  async getStreamInfo(@Param('stationId') stationId: string) {
    const waterfallInfo = await this.streamingService.getWaterfallStreamInfo(stationId);

    if (!waterfallInfo) {
      return {
        error: 'Station not found or no adapter available',
        stationId,
      };
    }

    return {
      stationId,
      waterfall: waterfallInfo,
      // Audio info would require frequency/mode params
      supportsAudio: true,
    };
  }

  /**
   * SSE endpoint for waterfall data
   * Streams waterfall lines to the client in real-time
   *
   * Attempts to fetch real waterfall data from the WebSDR,
   * falls back to simulated data if the station is unreachable.
   */
  @Sse('waterfall/:stationId')
  getWaterfallStream(
    @Param('stationId') stationId: string,
    @Query('minHz') minHz?: string,
    @Query('maxHz') maxHz?: string,
    @Query('useReal') useReal?: string
  ): Observable<MessageEvent> {
    // Default frequency range (HF band)
    const freqMin = minHz ? parseInt(minHz, 10) : 7_000_000;
    const freqMax = maxHz ? parseInt(maxHz, 10) : 7_300_000;
    const numBins = 512;
    const attemptRealData = useReal !== 'false';

    this.logger.log(
      `Starting waterfall stream for station ${stationId}, range: ${freqMin}-${freqMax} Hz, real: ${attemptRealData}`
    );

    // Send waterfall data at approximately 30 lines per second (33ms interval ≈ 30.3 fps)
    // First try to get real data, fall back to simulated if it fails
    return interval(33).pipe(
      switchMap(() => {
        if (attemptRealData) {
          // Try to get real data, fall back to simulated
          return from(
            this.streamingService.getWaterfallLine(stationId, freqMin, freqMax, numBins)
          ).pipe(
            catchError(() => {
              // On error, return simulated data
              return of(
                this.streamingService.generateSimulatedWaterfallLine(freqMin, freqMax, numBins)
              );
            })
          );
        } else {
          // Use simulated data directly
          return of(
            this.streamingService.generateSimulatedWaterfallLine(freqMin, freqMax, numBins)
          );
        }
      }),
      map((line) => ({
        data: line,
        type: 'waterfall',
      }))
    );
  }

  /**
   * Get waterfall header/configuration for a station
   * Returns band information and frequency mappings
   */
  @Get('waterfall-header/:stationId')
  async getWaterfallHeader(@Param('stationId') stationId: string) {
    const waterfallInfo = await this.streamingService.getWaterfallStreamInfo(stationId);

    if (!waterfallInfo) {
      return {
        error: 'Station not found',
        stationId,
      };
    }

    // Extract the station URL from the waterfall info
    // and try to fetch the header from the actual WebSDR
    const stationUrl = waterfallInfo.url.replace(this.WATERFALL_HEADER_SUFFIX_PATTERN, '');
    const header = await this.streamingService.fetchWaterfallHeader(stationUrl);

    if (!header) {
      return {
        stationId,
        bands: [],
        error: 'Could not fetch waterfall header from station',
      };
    }

    return {
      stationId,
      ...header,
    };
  }

  /**
   * Check station online status
   * Returns latency and availability information
   */
  @Get('status/:stationId')
  async checkStatus(@Param('stationId') stationId: string) {
    const status = await this.streamingService.checkStationStatus(stationId);
    return {
      stationId,
      ...status,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Proxy endpoint for audio streams
   * Currently returns a placeholder - real implementation would
   * forward the actual WebSDR audio stream
   *
   * TODO: Implement actual audio proxy when WebSDR integration is complete
   */
  @Get('audio/:stationId')
  async getAudioStream(
    @Param('stationId') stationId: string,
    @Query('freq') freq: string,
    @Query('mode') mode: string,
    @Res() res: Response
  ) {
    const frequencyHz = parseInt(freq, 10);
    const audioMode = mode || 'USB';

    const audioInfo = await this.streamingService.getAudioStreamInfo(
      stationId,
      frequencyHz,
      audioMode
    );

    if (!audioInfo) {
      res.status(404).json({
        error: 'Station not found or audio not available',
        stationId,
      });
      return;
    }

    // For MVP, return info about the stream
    // Real implementation would proxy the actual audio stream
    res.json({
      stationId,
      frequency: frequencyHz,
      mode: audioMode,
      streamUrl: audioInfo.url,
      proxyAvailable: false, // Set to true when audio proxy is implemented
      message: 'Audio proxy not yet implemented. Use streamUrl directly if CORS allows.',
    });
  }
}
