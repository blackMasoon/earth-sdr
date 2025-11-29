import { useCallback } from 'react';
import { useAppStore } from '@/store';
import { fetchStation } from '@/hooks/useApi';

export function StationListView() {
  const stations = useAppStore((state) => state.stations);
  const selectedStation = useAppStore((state) => state.selectedStation);
  const setSelectedStation = useAppStore((state) => state.setSelectedStation);
  const isLoadingStations = useAppStore((state) => state.isLoadingStations);

  const handleStationClick = useCallback(
    async (id: string) => {
      try {
        const station = await fetchStation(id);
        setSelectedStation(station);
      } catch (error) {
        console.error('Failed to load station:', error);
      }
    },
    [setSelectedStation]
  );

  if (isLoadingStations) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-atlas-text">Loading stations...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <h2 className="text-xl font-bold text-atlas-text mb-4">
        WebSDR Stations ({stations.length})
      </h2>
      <div className="space-y-2">
        {stations.map((station) => (
          <div
            key={station.id}
            onClick={() => handleStationClick(station.id)}
            className={`p-4 rounded-lg cursor-pointer transition-colors ${
              selectedStation?.id === station.id
                ? 'bg-atlas-accent text-white'
                : 'bg-atlas-surface hover:bg-atlas-border text-atlas-text'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{station.name}</h3>
                {station.countryCode && (
                  <p className="text-sm opacity-75">{station.countryCode}</p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  station.isOnlineEstimated
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {station.isOnlineEstimated ? 'Online' : 'Unknown'}
              </span>
            </div>
            <a
              href={station.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-400 hover:underline mt-2 inline-block"
            >
              Open WebSDR →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
