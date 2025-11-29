import { useAppStore } from '@/store';
import { formatFrequency } from '@websdr-atlas/shared';

export function StationDetailsPanel() {
  const selectedStation = useAppStore((state) => state.selectedStation);

  if (!selectedStation) {
    return (
      <div className="bg-atlas-surface rounded-lg p-4 text-atlas-text">
        <p className="text-center text-sm opacity-75">
          Select a station to view details
        </p>
      </div>
    );
  }

  return (
    <div className="bg-atlas-surface rounded-lg p-4 text-atlas-text">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold">{selectedStation.name}</h2>
          {selectedStation.countryCode && (
            <p className="text-sm opacity-75">{selectedStation.countryCode}</p>
          )}
        </div>
        <a
          href={selectedStation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-atlas-accent hover:bg-atlas-accent-hover px-4 py-2 rounded text-white text-sm transition-colors"
        >
          Open WebSDR
        </a>
      </div>

      {selectedStation.description && (
        <p className="text-sm opacity-75 mb-4">{selectedStation.description}</p>
      )}

      <div className="mb-4">
        <h3 className="font-semibold mb-2">Frequency Ranges</h3>
        <div className="flex flex-wrap gap-2">
          {selectedStation.frequencyRanges.map((range, index) => (
            <span
              key={index}
              className="bg-atlas-border px-3 py-1 rounded text-sm"
            >
              {formatFrequency(range.minHz)} - {formatFrequency(range.maxHz)}
            </span>
          ))}
        </div>
      </div>

      {selectedStation.modes && selectedStation.modes.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Modes</h3>
          <div className="flex flex-wrap gap-2">
            {selectedStation.modes.map((mode, index) => (
              <span
                key={index}
                className="bg-atlas-border px-2 py-1 rounded text-xs"
              >
                {mode}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-atlas-border text-xs opacity-50">
        <p>
          Coordinates: {selectedStation.latitude.toFixed(4)},{' '}
          {selectedStation.longitude.toFixed(4)}
        </p>
        <p>Source: {selectedStation.rawListingSource}</p>
      </div>
    </div>
  );
}
