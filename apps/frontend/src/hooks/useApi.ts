import { WebSdrStation, WebSdrStationListItem, PropagationRing } from '@websdr-atlas/shared';

const API_BASE = '/api';

export async function fetchStations(): Promise<WebSdrStationListItem[]> {
  const response = await fetch(`${API_BASE}/stations`);
  if (!response.ok) {
    throw new Error('Failed to fetch stations');
  }
  return response.json();
}

export async function fetchStation(id: string): Promise<WebSdrStation> {
  const response = await fetch(`${API_BASE}/stations/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch station');
  }
  return response.json();
}

export async function fetchPropagation(
  lat: number,
  lon: number,
  freqs?: number[]
): Promise<PropagationRing[]> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
  });
  if (freqs) {
    params.append('freqs', freqs.join(','));
  }
  const response = await fetch(`${API_BASE}/propagation?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch propagation data');
  }
  return response.json();
}

export async function seedDatabase(): Promise<void> {
  const response = await fetch(`${API_BASE}/crawler/seed`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to seed database');
  }
}
