import { PropagationService } from '../propagation/propagation.service';

describe('PropagationService', () => {
  let service: PropagationService;

  beforeEach(() => {
    service = new PropagationService();
  });

  describe('getRingsForStation', () => {
    it('should return propagation rings for given frequencies', async () => {
      const lat = 52.23;
      const lon = 6.85;
      const freqs = [7_000_000, 14_000_000, 21_000_000];

      const rings = await service.getRingsForStation(lat, lon, freqs);

      expect(rings).toHaveLength(3);
      expect(rings[0].frequencyHz).toBe(7_000_000);
      expect(rings[0].centerLat).toBe(lat);
      expect(rings[0].centerLon).toBe(lon);
      expect(rings[0].radiusKm).toBeGreaterThan(0);
    });

    it('should return different radii for different bands', async () => {
      const lat = 52.23;
      const lon = 6.85;
      const hfFreq = 14_000_000; // 20m - good DX
      const vhfFreq = 144_000_000; // 2m - line of sight

      const rings = await service.getRingsForStation(lat, lon, [hfFreq, vhfFreq]);

      // HF should have longer range than VHF
      expect(rings[0].radiusKm).toBeGreaterThan(rings[1].radiusKm);
    });

    it('should include frequency labels', async () => {
      const rings = await service.getRingsForStation(0, 0, [7_100_000]);

      expect(rings[0].label).toContain('MHz');
    });
  });

  describe('getDefaultFrequencies', () => {
    it('should return standard amateur radio frequencies', () => {
      const freqs = service.getDefaultFrequencies();

      expect(freqs.length).toBeGreaterThan(0);
      // Should include common HF bands
      expect(freqs).toContain(7_100_000); // 40m
      expect(freqs).toContain(14_200_000); // 20m
    });
  });
});
