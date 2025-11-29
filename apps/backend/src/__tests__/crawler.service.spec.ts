import { CrawlerService } from '../crawler/crawler.service';
import { PrismaService } from '../prisma/prisma.service';
import { FrequencyRange } from '@websdr-atlas/shared';

// Define types for mock prisma service
interface MockStationMethods {
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
}

interface MockStationFrequencyRangeMethods {
  create: jest.Mock;
  deleteMany: jest.Mock;
}

interface MockPrismaService {
  station: MockStationMethods;
  stationFrequencyRange: MockStationFrequencyRangeMethods;
}

// Create a mock PrismaService
const mockPrismaService: MockPrismaService = {
  station: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  stationFrequencyRange: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

// Type for private method access in tests
interface CrawlerServiceTestable {
  extractFrequencyRanges(text: string): FrequencyRange[];
  extractCoordinates(text: string): { latitude: number; longitude: number };
  normalizeUrl(url: string): string;
  getSeedStations(): Array<{
    name: string;
    url: string;
    latitude: number;
    longitude: number;
    frequencyRanges: FrequencyRange[];
  }>;
}

describe('CrawlerService', () => {
  let service: CrawlerService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let testableService: CrawlerServiceTestable;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create service with mock PrismaService
    service = new CrawlerService(mockPrismaService as unknown as PrismaService);
    testableService = service as unknown as CrawlerServiceTestable;
  });

  describe('Frequency extraction', () => {
    // Access private method via type assertion for testing
    const extractFrequencyRanges = (text: string): FrequencyRange[] => {
      return (service as unknown as CrawlerServiceTestable).extractFrequencyRanges(text);
    };

    it('should extract MHz range patterns', () => {
      const ranges = extractFrequencyRanges('Coverage: 7.0-7.3 MHz');

      expect(ranges).toHaveLength(1);
      expect(ranges[0].minHz).toBe(7_000_000);
      expect(ranges[0].maxHz).toBe(7_300_000);
    });

    it('should extract kHz range patterns', () => {
      const ranges = extractFrequencyRanges('Coverage: 3500-4000 kHz');

      expect(ranges).toHaveLength(1);
      expect(ranges[0].minHz).toBe(3_500_000);
      expect(ranges[0].maxHz).toBe(4_000_000);
    });

    it('should extract amateur band patterns like 40m, 20m', () => {
      const ranges = extractFrequencyRanges('Available bands: 40m, 20m, 10m');

      expect(ranges.length).toBeGreaterThanOrEqual(3);
      // Check for 40m band (7 MHz)
      const band40m = ranges.find((r) => r.minHz === 7_000_000);
      expect(band40m).toBeDefined();
    });

    it('should handle text with no frequencies', () => {
      const ranges = extractFrequencyRanges('Just some text without frequencies');

      expect(ranges).toHaveLength(0);
    });
  });

  describe('Coordinate extraction', () => {
    const extractCoordinates = (text: string): { latitude: number; longitude: number } => {
      return (service as unknown as CrawlerServiceTestable).extractCoordinates(text);
    };

    it('should extract decimal coordinates with N/S/E/W', () => {
      const coords = extractCoordinates('Location: 52.23N, 6.85E');

      expect(coords.latitude).toBeCloseTo(52.23);
      expect(coords.longitude).toBeCloseTo(6.85);
    });

    it('should handle south and west coordinates', () => {
      const coords = extractCoordinates('33.86S, 151.21W');

      expect(coords.latitude).toBeCloseTo(-33.86);
      expect(coords.longitude).toBeCloseTo(-151.21);
    });

    it('should return default coords for invalid text', () => {
      const coords = extractCoordinates('No coordinates here');

      expect(coords.latitude).toBe(0);
      expect(coords.longitude).toBe(0);
    });
  });

  describe('URL normalization', () => {
    const normalizeUrl = (url: string): string => {
      return (service as unknown as CrawlerServiceTestable).normalizeUrl(url);
    };

    it('should add http:// protocol if missing', () => {
      const url = normalizeUrl('websdr.example.com:8901');

      expect(url).toBe('http://websdr.example.com:8901');
    });

    it('should preserve existing http:// protocol', () => {
      const url = normalizeUrl('http://websdr.example.com:8901');

      expect(url).toBe('http://websdr.example.com:8901');
    });

    it('should remove trailing slash', () => {
      const url = normalizeUrl('http://websdr.example.com:8901/');

      expect(url).toBe('http://websdr.example.com:8901');
    });
  });

  describe('Seed data', () => {
    it('should return seed stations', () => {
      const seedStations = (service as unknown as CrawlerServiceTestable).getSeedStations();

      expect(seedStations.length).toBeGreaterThan(0);

      // Check first station has required fields
      const station = seedStations[0];
      expect(station.name).toBeDefined();
      expect(station.url).toBeDefined();
      expect(station.latitude).toBeDefined();
      expect(station.longitude).toBeDefined();
      expect(station.frequencyRanges).toBeDefined();
      expect(station.frequencyRanges.length).toBeGreaterThan(0);
    });
  });
});
