/**
 * WebSDR Atlas - Shared Utilities
 * 
 * Common utility functions used across the application.
 */

import { FrequencyHz, FrequencyBand, FREQUENCY_BANDS } from './types';

/**
 * Format frequency in Hz to a human-readable string
 */
export function formatFrequency(hz: FrequencyHz): string {
  if (hz >= 1_000_000_000) {
    return `${(hz / 1_000_000_000).toFixed(3)} GHz`;
  }
  if (hz >= 1_000_000) {
    return `${(hz / 1_000_000).toFixed(3)} MHz`;
  }
  if (hz >= 1_000) {
    return `${(hz / 1_000).toFixed(3)} kHz`;
  }
  return `${hz} Hz`;
}

/**
 * Parse a frequency string to Hz
 */
export function parseFrequency(freqStr: string): FrequencyHz | null {
  const normalized = freqStr.toLowerCase().trim();
  const match = normalized.match(/^([\d.]+)\s*(ghz|mhz|khz|hz)?$/);
  
  if (!match) return null;
  
  const value = parseFloat(match[1]);
  if (isNaN(value)) return null;
  
  const unit = match[2] || 'hz';
  
  switch (unit) {
    case 'ghz':
      return value * 1_000_000_000;
    case 'mhz':
      return value * 1_000_000;
    case 'khz':
      return value * 1_000;
    default:
      return value;
  }
}

/**
 * Determine the frequency band for a given frequency
 */
export function getFrequencyBand(hz: FrequencyHz): FrequencyBand | null {
  for (const [band, range] of Object.entries(FREQUENCY_BANDS)) {
    if (hz >= range.minHz && hz < range.maxHz) {
      return band as FrequencyBand;
    }
  }
  return null;
}

/**
 * Calculate distance between two coordinates in km (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
