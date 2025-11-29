import { Controller, Get, Param, Query, Sse, MessageEvent, Logger, Res } from '@nestjs/common';
import { Response } from 'express';
import { Observable, interval, map } from 'rxjs';
import { StreamingService } from './streaming.service';

/**
 * StreamingController - Proxy endpoints for WebSDR data streams
 *
 * Provides:
 * 1. SSE (Server-Sent Events) for waterfall data
 * 2. Proxy endpoint for audio streams
 * 3. Station status check endpoint
 *
 * These endpoints allow the frontend to access WebSDR streams
 * without CORS issues, as the browser connects to our backend
 * which then proxies requests to the actual WebSDR servers.
 */
@Controller('api/streaming')
export class StreamingController {
  private readonly logger = new Logger(StreamingController.name);

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
   * For MVP: Uses simulated data until real WebSDR integration is complete
   */
  @Sse('waterfall/:stationId')
  getWaterfallStream(
    @Param('stationId') stationId: string,
    @Query('minHz') minHz?: string,
    @Query('maxHz') maxHz?: string,
  ): Observable<MessageEvent> {
    // Default frequency range (HF band)
    const freqMin = minHz ? parseInt(minHz, 10) : 7_000_000;
    const freqMax = maxHz ? parseInt(maxHz, 10) : 7_300_000;
    const numBins = 512;

    this.logger.log(
      `Starting waterfall stream for station ${stationId}, range: ${freqMin}-${freqMax} Hz`,
    );

    // Send waterfall data at approximately 30 lines per second (33ms interval ≈ 30.3 fps)
    // In production, this would proxy real WebSDR data
    return interval(33).pipe(
      map(() => {
        const line = this.streamingService.generateSimulatedWaterfallLine(
          freqMin,
          freqMax,
          numBins,
        );
        return {
          data: line,
          type: 'waterfall',
        };
      }),
    );
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
    @Res() res: Response,
  ) {
    const frequencyHz = parseInt(freq, 10);
    const audioMode = mode || 'USB';

    const audioInfo = await this.streamingService.getAudioStreamInfo(
      stationId,
      frequencyHz,
      audioMode,
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
      message:
        'Audio proxy not yet implemented. Use streamUrl directly if CORS allows.',
    });
  }
}
