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

  // Saved programs (localStorage)
  programs: SavedProgram[];
  addProgram: (program: SavedProgram) => void;
  updateProgram: (id: string, patch: Partial<SavedProgram>) => void;
  deleteProgram: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // View state
      viewMode: 'map',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Selected station
      selectedStationId: null,
      selectedStation: null,
      setSelectedStation: (station) =>
        set({
          selectedStation: station,
          selectedStationId: station?.id || null,
          // Auto-set frequency range when selecting a station
          frequencyViewRange: station?.frequencyRanges[0]
            ? {
                minHz: station.frequencyRanges[0].minHz,
                maxHz: station.frequencyRanges[0].maxHz,
              }
            : null,
        }),

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
