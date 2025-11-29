import { useCallback, useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { fetchStation } from '@/hooks/useApi';

// Country code to name mapping for common countries
const COUNTRY_NAMES: Record<string, string> = {
  NL: 'Netherlands',
  GB: 'United Kingdom',
  US: 'United States',
  DE: 'Germany',
  AU: 'Australia',
  JP: 'Japan',
  ZA: 'South Africa',
  BR: 'Brazil',
  CA: 'Canada',
  NO: 'Norway',
  SE: 'Sweden',
};

export function StationListView() {
  const stations = useAppStore((state) => state.stations);
  const selectedStation = useAppStore((state) => state.selectedStation);
  const setSelectedStation = useAppStore((state) => state.setSelectedStation);
  const isLoadingStations = useAppStore((state) => state.isLoadingStations);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'country'>('name');

  // Filter and sort stations
  const filteredStations = useMemo(() => {
    let result = stations;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (station) =>
          station.name.toLowerCase().includes(query) ||
          station.countryCode?.toLowerCase().includes(query) ||
          COUNTRY_NAMES[station.countryCode || '']?.toLowerCase().includes(query)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'country') {
        const countryA = a.countryCode || 'ZZZ';
        const countryB = b.countryCode || 'ZZZ';
        return countryA.localeCompare(countryB);
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [stations, searchQuery, sortBy]);

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

      {/* Search and sort controls */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search stations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-atlas-bg border border-atlas-border rounded px-3 py-2 text-atlas-text text-sm"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'country')}
          className="bg-atlas-bg border border-atlas-border rounded px-3 py-2 text-atlas-text text-sm"
        >
          <option value="name">Sort by Name</option>
          <option value="country">Sort by Country</option>
        </select>
      </div>

      {/* Results count */}
      {searchQuery && (
        <p className="text-xs text-atlas-text opacity-50 mb-2">
          Found {filteredStations.length} station
          {filteredStations.length !== 1 ? 's' : ''}
        </p>
      )}

      <div className="space-y-2">
        {filteredStations.map((station) => (
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
                  <p className="text-sm opacity-75">
                    {COUNTRY_NAMES[station.countryCode] || station.countryCode}
                  </p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  station.isOnlineEstimated
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-500/20 text-gray-400'
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

      {filteredStations.length === 0 && searchQuery && (
        <div className="text-center text-atlas-text opacity-50 mt-4">
          No stations found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
}
