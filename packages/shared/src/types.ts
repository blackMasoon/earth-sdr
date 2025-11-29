/**
 * WebSDR Atlas - Shared Types
 *
 * This package contains all shared TypeScript types used across
 * the backend and frontend applications.
 */

// ============================================
// Frequency Types
// ============================================

/**
 * Frequency in Hertz
 */
export type FrequencyHz = number;

/**
 * Frequency range with minimum and maximum values in Hz
 */
export interface FrequencyRange {
  minHz: FrequencyHz;
  maxHz: FrequencyHz;
}

// ============================================
// Station Types
// ============================================

/**
 * Source of the station listing
 */
export type RawListingSource = 'websdr_org' | 'manual';

/**
 * Radio modulation modes
 */
export type ModulationMode = 'AM' | 'FM' | 'USB' | 'LSB' | 'CW' | 'NFM' | 'WFM';

/**
 * WebSDR Station information
 */
export interface WebSdrStation {
  id: string;
  name: string;
  description?: string;
  url: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  frequencyRanges: FrequencyRange[];
  modes?: ModulationMode[];
  rawListingSource: RawListingSource;
  lastSeenAt: string;
  isOnlineEstimated?: boolean;
  isActive?: boolean;
}

/**
 * Minimal station info for list view
 */
export interface WebSdrStationListItem {
  id: string;
  name: string;
  url: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  isOnlineEstimated?: boolean;
}

// ============================================
// Propagation Types
// ============================================

/**
 * Propagation ring for visualizing estimated coverage
 */
export interface PropagationRing {
  centerLat: number;
  centerLon: number;
  frequencyHz: FrequencyHz;
  radiusKm: number;
  label?: string;
}

// ============================================
// Program Types
// ============================================

/**
 * Saved program (favorite frequency)
 */
export interface SavedProgram {
  id: string;
  userId?: string;
  stationId: string;
  frequencyHz: FrequencyHz;
  name: string;
  colorHex: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new program
 */
export interface CreateProgramInput {
  stationId: string;
  frequencyHz: FrequencyHz;
  name: string;
  colorHex: string;
}

/**
 * Input for updating a program
 */
export interface UpdateProgramInput {
  name?: string;
  colorHex?: string;
}

// ============================================
// Waterfall Types
// ============================================

/**
 * Single line of waterfall data
 */
export interface WaterfallLine {
  timestamp: number;
  freqStartHz: FrequencyHz;
  freqStepHz: FrequencyHz;
  magnitudes: number[];
}

// ============================================
// API Response Types
// ============================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * API Error response
 */
export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
}

// ============================================
// Filter Types
// ============================================

/**
 * Frequency band filter
 */
export type FrequencyBand = 'LF' | 'MF' | 'HF' | 'VHF' | 'UHF';

/**
 * Station filter parameters
 */
export interface StationFilters {
  band?: FrequencyBand;
  country?: string;
  continent?: string;
  onlineOnly?: boolean;
  search?: string;
  bbox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

// ============================================
// UI State Types
// ============================================

/**
 * View mode for station display
 */
export type ViewMode = 'map' | 'list';

/**
 * Frequency view range for waterfall
 */
export interface FrequencyViewRange {
  minHz: FrequencyHz;
  maxHz: FrequencyHz;
}

// ============================================
// Constants
// ============================================

/**
 * Frequency band ranges in Hz
 */
export const FREQUENCY_BANDS: Record<FrequencyBand, FrequencyRange> = {
  LF: { minHz: 30_000, maxHz: 300_000 },
  MF: { minHz: 300_000, maxHz: 3_000_000 },
  HF: { minHz: 3_000_000, maxHz: 30_000_000 },
  VHF: { minHz: 30_000_000, maxHz: 300_000_000 },
  UHF: { minHz: 300_000_000, maxHz: 3_000_000_000 },
};

/**
 * Available program colors
 */
export const PROGRAM_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Light Blue
] as const;

/**
 * Default frequency step sizes in Hz
 */
export const FREQUENCY_STEPS: Record<string, number> = {
  fine: 10,
  normal: 100,
  coarse: 1_000,
  veryCoarse: 5_000,
};
