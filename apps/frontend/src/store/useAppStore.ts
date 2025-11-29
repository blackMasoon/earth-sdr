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
        
        const newZoomLevel = Math.min(state.zoomLevel * 1.5, 32); // Max 32x zoom
        const fullRange = state.fullFrequencyRange.maxHz - state.fullFrequencyRange.minHz;
        const newRange = fullRange / newZoomLevel;
        
        // Center zoom on current frequency or view center
        const centerHz = state.selectedFrequencyHz || 
          (state.frequencyViewRange.minHz + state.frequencyViewRange.maxHz) / 2;
        
        let newMinHz = centerHz - newRange / 2;
        let newMaxHz = centerHz + newRange / 2;
        
        // Keep within full range bounds
        if (newMinHz < state.fullFrequencyRange.minHz) {
          newMinHz = state.fullFrequencyRange.minHz;
          newMaxHz = newMinHz + newRange;
        }
        if (newMaxHz > state.fullFrequencyRange.maxHz) {
          newMaxHz = state.fullFrequencyRange.maxHz;
          newMinHz = newMaxHz - newRange;
        }
        
        set({
          zoomLevel: newZoomLevel,
          frequencyViewRange: { minHz: Math.round(newMinHz), maxHz: Math.round(newMaxHz) },
        });
      },
      
      zoomOut: () => {
        const state = get();
        if (!state.fullFrequencyRange || !state.frequencyViewRange) return;
        
        const newZoomLevel = Math.max(state.zoomLevel / 1.5, 1); // Min 1x zoom
        const fullRange = state.fullFrequencyRange.maxHz - state.fullFrequencyRange.minHz;
        const newRange = fullRange / newZoomLevel;
        
        // Center zoom on current frequency or view center
        const centerHz = state.selectedFrequencyHz || 
          (state.frequencyViewRange.minHz + state.frequencyViewRange.maxHz) / 2;
        
        let newMinHz = centerHz - newRange / 2;
        let newMaxHz = centerHz + newRange / 2;
        
        // Keep within full range bounds
        if (newMinHz < state.fullFrequencyRange.minHz) {
          newMinHz = state.fullFrequencyRange.minHz;
          newMaxHz = newMinHz + newRange;
        }
        if (newMaxHz > state.fullFrequencyRange.maxHz) {
          newMaxHz = state.fullFrequencyRange.maxHz;
          newMinHz = newMaxHz - newRange;
        }
        
        set({
          zoomLevel: newZoomLevel,
          frequencyViewRange: { minHz: Math.round(newMinHz), maxHz: Math.round(newMaxHz) },
        });
      },
      
      panLeft: () => {
        const state = get();
        if (!state.fullFrequencyRange || !state.frequencyViewRange) return;
        
        const viewRange = state.frequencyViewRange.maxHz - state.frequencyViewRange.minHz;
        const panAmount = viewRange * 0.25; // Pan by 25% of view
        
        const newMinHz = Math.max(
          state.fullFrequencyRange.minHz,
          state.frequencyViewRange.minHz - panAmount
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
        const panAmount = viewRange * 0.25; // Pan by 25% of view
        
        const newMaxHz = Math.min(
          state.fullFrequencyRange.maxHz,
          state.frequencyViewRange.maxHz + panAmount
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
      addProgram: (program) =>
        set((state) => ({ programs: [...state.programs, program] })),
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
