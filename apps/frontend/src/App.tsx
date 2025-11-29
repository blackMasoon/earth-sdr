import { useEffect } from 'react';
import { useAppStore } from '@/store';
import { fetchStations, seedDatabase } from '@/hooks/useApi';
import { MapView } from '@/components/map';
import { StationListView, StationDetailsPanel } from '@/components/stations';
import { WaterfallView, FrequencyCursor } from '@/components/waterfall';
import { SavedProgramsList, SavedProgramsBar } from '@/components/programs';

function App() {
  const viewMode = useAppStore((state) => state.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const setStations = useAppStore((state) => state.setStations);
  const setIsLoadingStations = useAppStore((state) => state.setIsLoadingStations);
  const selectedStation = useAppStore((state) => state.selectedStation);
  const selectedFrequencyHz = useAppStore((state) => state.selectedFrequencyHz);
  const setIsSaveDialogOpen = useAppStore((state) => state.setIsSaveDialogOpen);

  // Load stations on mount
  useEffect(() => {
    const loadStations = async () => {
      setIsLoadingStations(true);
      try {
        let stations = await fetchStations();

        // If no stations, seed the database first
        if (stations.length === 0) {
          console.log('No stations found, seeding database...');
          await seedDatabase();
          stations = await fetchStations();
        }

        setStations(stations);
      } catch (error) {
        console.error('Failed to load stations:', error);
      } finally {
        setIsLoadingStations(false);
      }
    };

    loadStations();
  }, [setStations, setIsLoadingStations]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'm':
          setViewMode(viewMode === 'map' ? 'list' : 'map');
          break;
        case 's':
          // Open save program dialog if station and frequency are selected
          if (selectedStation && selectedFrequencyHz) {
            e.preventDefault();
            setIsSaveDialogOpen(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, setViewMode, selectedStation, selectedFrequencyHz, setIsSaveDialogOpen]);

  return (
    <div className="h-screen w-screen bg-atlas-bg flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-atlas-surface border-b border-atlas-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-atlas-text">🌍 WebSDR Atlas</h1>
          <span className="text-sm text-atlas-text opacity-50">
            Explore WebSDR stations worldwide
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* View mode toggle */}
          <div className="flex bg-atlas-bg rounded">
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 text-sm rounded-l transition-colors ${
                viewMode === 'map'
                  ? 'bg-atlas-accent text-white'
                  : 'text-atlas-text hover:bg-atlas-border'
              }`}
            >
              🗺️ Map
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm rounded-r transition-colors ${
                viewMode === 'list'
                  ? 'bg-atlas-accent text-white'
                  : 'text-atlas-text hover:bg-atlas-border'
              }`}
            >
              📋 List
            </button>
          </div>

          <span className="text-xs text-atlas-text opacity-50">
            Press M to toggle view
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Map or List */}
        <div className="flex-1 flex flex-col">
          {/* Map/List view */}
          <div className="flex-1 relative">
            {viewMode === 'map' ? <MapView /> : <StationListView />}
          </div>
        </div>

        {/* Right panel: Station details + Waterfall */}
        <div className="w-96 flex flex-col border-l border-atlas-border">
          {/* Station details */}
          <div className="p-4">
            <StationDetailsPanel />
          </div>

          {/* Waterfall section */}
          <div className="flex-1 flex flex-col p-4 pt-0 min-h-0">
            {/* Frequency cursor/display */}
            <div className="mb-2">
              <FrequencyCursor />
            </div>

            {/* Programs bar (markers) */}
            <SavedProgramsBar />

            {/* Waterfall display */}
            <div className="flex-1 rounded-lg overflow-hidden border border-atlas-border min-h-[200px]">
              <WaterfallView />
            </div>

            {/* Saved programs list */}
            <div className="mt-4">
              <SavedProgramsList />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-atlas-surface border-t border-atlas-border px-4 py-2 text-xs text-atlas-text opacity-50">
        <div className="flex justify-between">
          <span>WebSDR Atlas v0.1.0 - Open Source Project</span>
          <span>
            Keyboard: M = Toggle Map/List | ←/→ = Tune | S = Save program | +/- = Zoom | 0 = Reset zoom
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
