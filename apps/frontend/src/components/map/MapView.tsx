import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAppStore } from '@/store';
import { fetchStation, fetchPropagation } from '@/hooks/useApi';
import { PropagationRing, formatFrequency } from '@websdr-atlas/shared';

// Fix for default marker icon in Leaflet with Vite
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icon for stations
const stationIcon = new L.DivIcon({
  className: 'custom-marker',
  html: `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const selectedStationIcon = new L.DivIcon({
  className: 'custom-marker',
  html: `<div class="w-6 h-6 bg-green-500 border-2 border-white rounded-full shadow-lg animate-pulse"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapController() {
  const map = useMap();
  const selectedStation = useAppStore((state) => state.selectedStation);

  useEffect(() => {
    if (selectedStation) {
      map.flyTo([selectedStation.latitude, selectedStation.longitude], 8, {
        duration: 1,
      });
    }
  }, [selectedStation, map]);

  return null;
}

export function MapView() {
  const stations = useAppStore((state) => state.stations);
  const selectedStation = useAppStore((state) => state.selectedStation);
  const setSelectedStation = useAppStore((state) => state.setSelectedStation);

  const [propagationRings, setPropagationRings] = useState<PropagationRing[]>([]);

  const handleStationClick = useCallback(
    async (id: string) => {
      try {
        const station = await fetchStation(id);
        setSelectedStation(station);

        // Fetch propagation data
        const rings = await fetchPropagation(station.latitude, station.longitude);
        setPropagationRings(rings);
      } catch (error) {
        console.error('Failed to load station:', error);
      }
    },
    [setSelectedStation]
  );

  // Ring colors based on frequency
  const getRingColor = (freqHz: number): string => {
    const freqMHz = freqHz / 1_000_000;
    if (freqMHz < 3) return '#ef4444'; // Red - LF/MF
    if (freqMHz < 8) return '#f97316'; // Orange - 80m/40m
    if (freqMHz < 15) return '#eab308'; // Yellow - 30m/20m
    if (freqMHz < 22) return '#22c55e'; // Green - 17m/15m
    if (freqMHz < 30) return '#3b82f6'; // Blue - 12m/10m
    return '#8b5cf6'; // Purple - VHF+
  };

  return (
    <div className="h-full w-full">
      <MapContainer center={[30, 0]} zoom={2} className="h-full w-full" worldCopyJump={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController />

        {/* Propagation rings */}
        {propagationRings.map((ring, index) => (
          <Circle
            key={`${ring.frequencyHz}-${index}`}
            center={[ring.centerLat, ring.centerLon]}
            radius={ring.radiusKm * 1000}
            pathOptions={{
              color: getRingColor(ring.frequencyHz),
              fillColor: getRingColor(ring.frequencyHz),
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 5',
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{formatFrequency(ring.frequencyHz)}</strong>
                <br />
                Estimated range: {ring.radiusKm.toLocaleString()} km
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Station markers */}
        {stations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={selectedStation?.id === station.id ? selectedStationIcon : stationIcon}
            eventHandlers={{
              click: () => handleStationClick(station.id),
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-bold text-lg">{station.name}</h3>
                {station.countryCode && (
                  <p className="text-sm text-gray-600">{station.countryCode}</p>
                )}
                <a
                  href={station.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-sm"
                >
                  Open WebSDR →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
