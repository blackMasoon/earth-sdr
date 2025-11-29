import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  FrequencyHz,
  FrequencyViewRange,
  SavedProgram,
  ViewMode,
  WebSdrStation,
  WebSdrStationListItem,
} from '@websdr-atlas/shared';

// Zoom constants
const ZOOM_FACTOR = 1.5;
const MAX_ZOOM_LEVEL = 32;
const MIN_ZOOM_LEVEL = 1;
const PAN_AMOUNT = 0.25; // Pan by 25% of view

interface AppState {
  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Selected station
  selectedStationId: string | null;
  selectedStation: WebSdrStation | null;
  setSelectedStation: (station: WebSdrStation | null) => void;

  // Stations list
  stations: WebSdrStationListItem[];
  setStations: (stations: WebSdrStationListItem[]) => void;
  isLoadingStations: boolean;
  setIsLoadingStations: (loading: boolean) => void;

  // Frequency state
  selectedFrequencyHz: FrequencyHz | null;
  setSelectedFrequency: (hz: FrequencyHz | null) => void;
  frequencyViewRange: FrequencyViewRange | null;
  setFrequencyViewRange: (range: FrequencyViewRange | null) => void;

  // Waterfall zoom/pan state
  fullFrequencyRange: FrequencyViewRange | null; // Original range from station
  zoomLevel: number; // 1 = no zoom, 2 = 2x zoom, etc.
  zoomIn: () => void;
  zoomOut: () => void;
  panLeft: () => void;
  panRight: () => void;
  resetZoom: () => void;

  // Save program dialog
  isSaveDialogOpen: boolean;
  setIsSaveDialogOpen: (open: boolean) => void;

  // Saved programs (localStorage)
  programs: SavedProgram[];
  addProgram: (program: SavedProgram) => void;
  updateProgram: (id: string, patch: Partial<SavedProgram>) => void;
  deleteProgram: (id: string) => void;
}

/**
 * Helper function to calculate new frequency view range after zoom
 */
function calculateZoomedRange(
  fullRange: FrequencyViewRange,
  currentRange: FrequencyViewRange,
  newZoomLevel: number,
  centerHz: number | null
): FrequencyViewRange {
  const fullRangeHz = fullRange.maxHz - fullRange.minHz;
  const newRangeHz = fullRangeHz / newZoomLevel;

  // Center zoom on provided frequency or view center
  const center = centerHz ?? (currentRange.minHz + currentRange.maxHz) / 2;

  let newMinHz = center - newRangeHz / 2;
  let newMaxHz = center + newRangeHz / 2;

  // Keep within full range bounds
  if (newMinHz < fullRange.minHz) {
    newMinHz = fullRange.minHz;
    newMaxHz = newMinHz + newRangeHz;
  }
  if (newMaxHz > fullRange.maxHz) {
    newMaxHz = fullRange.maxHz;
    newMinHz = newMaxHz - newRangeHz;
  }

  return { minHz: Math.round(newMinHz), maxHz: Math.round(newMaxHz) };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // View state
      viewMode: 'map',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Selected station
      selectedStationId: null,
      selectedStation: null,
      setSelectedStation: (station) => {
        const fullRange = station?.frequencyRanges[0]
          ? {
              minHz: station.frequencyRanges[0].minHz,
              maxHz: station.frequencyRanges[0].maxHz,
            }
          : null;
        set({
          selectedStation: station,
          selectedStationId: station?.id || null,
          // Reset zoom when selecting a new station
          fullFrequencyRange: fullRange,
          frequencyViewRange: fullRange,
          zoomLevel: 1,
        });
      },

      // Stations list
      stations: [],
      setStations: (stations) => set({ stations }),
      isLoadingStations: false,
      setIsLoadingStations: (loading) => set({ isLoadingStations: loading }),

      // Frequency state
      selectedFrequencyHz: null,
      setSelectedFrequency: (hz) => set({ selectedFrequencyHz: hz }),
      frequencyViewRange: null,
      setFrequencyViewRange: (range) => set({ frequencyViewRange: range }),

      // Waterfall zoom/pan state
      fullFrequencyRange: null,
      zoomLevel: 1,

      zoomIn: () => {
        const state = get();
        if (!state.fullFrequencyRange || !state.frequencyViewRange) return;

        const newZoomLevel = Math.min(state.zoomLevel * ZOOM_FACTOR, MAX_ZOOM_LEVEL);
        const newRange = calculateZoomedRange(
          state.fullFrequencyRange,
          state.frequencyViewRange,
          newZoomLevel,
          state.selectedFrequencyHz
        );

        set({ zoomLevel: newZoomLevel, frequencyViewRange: newRange });
      },

      zoomOut: () => {
        const state = get();
        if (!state.fullFrequencyRange || !state.frequencyViewRange) return;

        const newZoomLevel = Math.max(state.zoomLevel / ZOOM_FACTOR, MIN_ZOOM_LEVEL);
        const newRange = calculateZoomedRange(
          state.fullFrequencyRange,
          state.frequencyViewRange,
          newZoomLevel,
          state.selectedFrequencyHz
        );

        set({ zoomLevel: newZoomLevel, frequencyViewRange: newRange });
      },

      panLeft: () => {
        const state = get();
        if (!state.fullFrequencyRange || !state.frequencyViewRange) return;

        const viewRange = state.frequencyViewRange.maxHz - state.frequencyViewRange.minHz;
        const panAmountHz = viewRange * PAN_AMOUNT;

        const newMinHz = Math.max(
          state.fullFrequencyRange.minHz,
          state.frequencyViewRange.minHz - panAmountHz
        );
        const newMaxHz = newMinHz + viewRange;

        set({
          frequencyViewRange: { minHz: Math.round(newMinHz), maxHz: Math.round(newMaxHz) },
        });
      },

      panRight: () => {
        const state = get();
        if (!state.fullFrequencyRange || !state.frequencyViewRange) return;

        const viewRange = state.frequencyViewRange.maxHz - state.frequencyViewRange.minHz;
        const panAmountHz = viewRange * PAN_AMOUNT;

        const newMaxHz = Math.min(
          state.fullFrequencyRange.maxHz,
          state.frequencyViewRange.maxHz + panAmountHz
        );
        const newMinHz = newMaxHz - viewRange;

        set({
          frequencyViewRange: { minHz: Math.round(newMinHz), maxHz: Math.round(newMaxHz) },
        });
      },

      resetZoom: () => {
        const state = get();
        if (!state.fullFrequencyRange) return;

        set({
          zoomLevel: 1,
          frequencyViewRange: { ...state.fullFrequencyRange },
        });
      },

      // Save program dialog
      isSaveDialogOpen: false,
      setIsSaveDialogOpen: (open) => set({ isSaveDialogOpen: open }),

      // Saved programs
      programs: [],
      addProgram: (program) => set((state) => ({ programs: [...state.programs, program] })),
      updateProgram: (id, patch) =>
        set((state) => ({
          programs: state.programs.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
          ),
        })),
      deleteProgram: (id) =>
        set((state) => ({ programs: state.programs.filter((p) => p.id !== id) })),
    }),
    {
      name: 'websdr-atlas-storage',
      partialize: (state) => ({
        programs: state.programs,
        viewMode: state.viewMode,
      }),
    }
  )
);
