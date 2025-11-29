import { Injectable } from '@nestjs/common';
import { PropagationRing, FrequencyHz } from '@websdr-atlas/shared';

/**
 * Interface for propagation providers
 * Can be implemented with different backends (simple model, VOACAP, etc.)
 */
export interface IPropagationProvider {
  getRingsForStation(
    stationLat: number,
    stationLon: number,
    freqsHz: FrequencyHz[]
  ): Promise<PropagationRing[]>;
}

/**
 * Simple propagation model for MVP
 *
 * This is a very simplified model based on general HF propagation characteristics.
 * In production, this should be replaced with real propagation prediction APIs.
 */
@Injectable()
export class PropagationService implements IPropagationProvider {
  /**
   * Get propagation rings for a station at given frequencies
   */
  async getRingsForStation(
    stationLat: number,
    stationLon: number,
    freqsHz: FrequencyHz[]
  ): Promise<PropagationRing[]> {
    const currentHour = new Date().getUTCHours();
    const isDay = currentHour >= 6 && currentHour <= 18;

    return freqsHz.map((freq) => ({
      centerLat: stationLat,
      centerLon: stationLon,
      frequencyHz: freq,
      radiusKm: this.estimateRadius(freq, isDay),
      label: this.getFrequencyLabel(freq),
    }));
  }

  /**
   * Estimate propagation radius based on frequency and time of day
   *
   * This is a very simplified model:
   * - Lower frequencies (160m-80m): Better at night, shorter range
   * - Middle frequencies (40m-20m): Good day/night, medium-long range
   * - Higher frequencies (15m-10m): Better during day, longer range when open
   *
   * TODO: Replace with proper propagation model or external API
   */
  private estimateRadius(freqHz: FrequencyHz, isDay: boolean): number {
    const freqMHz = freqHz / 1_000_000;

    // VHF/UHF - line of sight, very limited range
    if (freqMHz >= 30) {
      return 100; // ~100 km typical for VHF ground wave
    }

    // HF propagation estimates
    if (freqMHz >= 21) {
      // 15m-10m bands
      // Good for DX during solar maximum, often closed at night
      return isDay ? 5000 : 500;
    }

    if (freqMHz >= 14) {
      // 20m band
      // Excellent for DX, often open 24 hours
      return isDay ? 8000 : 4000;
    }

    if (freqMHz >= 7) {
      // 40m band
      // Good regional/DX day and night
      return isDay ? 3000 : 5000;
    }

    if (freqMHz >= 3.5) {
      // 80m band
      // Regional, better at night
      return isDay ? 500 : 2000;
    }

    if (freqMHz >= 1.8) {
      // 160m band
      // Short range day, longer at night
      return isDay ? 200 : 1500;
    }

    // LF/MF bands
    // Ground wave propagation
    return isDay ? 500 : 1000;
  }

  /**
   * Get human-readable label for frequency
   */
  private getFrequencyLabel(freqHz: FrequencyHz): string {
    const freqMHz = freqHz / 1_000_000;

    if (freqMHz >= 1000) {
      return `${(freqMHz / 1000).toFixed(1)} GHz`;
    }
    if (freqMHz >= 1) {
      return `${freqMHz.toFixed(1)} MHz`;
    }
    return `${(freqHz / 1000).toFixed(0)} kHz`;
  }

  /**
   * Get default frequencies for visualization
   * These are typical amateur radio band edges
   */
  getDefaultFrequencies(): FrequencyHz[] {
    return [
      1_900_000, // 160m
      3_600_000, // 80m
      7_100_000, // 40m
      14_200_000, // 20m
      21_200_000, // 15m
      28_400_000, // 10m
    ];
  }
}
