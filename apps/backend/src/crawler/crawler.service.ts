import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

interface ParsedStation {
  name: string;
  url: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  description?: string;
  frequencyRanges: Array<{ minHz: number; maxHz: number }>;
}

/**
 * Result of a crawl operation
 */
export interface CrawlResult {
  success: boolean;
  stationsProcessed: number;
  stationsFromWebsdr: number;
  stationsFromSeed: number;
  errors: string[];
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly WEBSDR_ORG_URL = 'http://websdr.org';
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private readonly USER_AGENT = 'WebSDR-Atlas/1.0 (https://github.com/websdr-atlas; crawler@websdr-atlas.org)';

  constructor(private prisma: PrismaService) {}

  /**
   * Run crawler every 6 hours to update station data
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledCrawl() {
    this.logger.log('Starting scheduled WebSDR crawl...');
    await this.crawlWebsdrOrg();
  }

  /**
   * Manually trigger a crawl with detailed results
   */
  async crawlWebsdrOrg(): Promise<CrawlResult> {
    this.logger.log('Crawling websdr.org...');
    const result: CrawlResult = {
      success: false,
      stationsProcessed: 0,
      stationsFromWebsdr: 0,
      stationsFromSeed: 0,
      errors: [],
    };

    try {
      // Try to fetch from websdr.org first
      const webStations = await this.fetchAndParseWebsdrOrg();
      result.stationsFromWebsdr = webStations.length;

      // If websdr.org fetch failed or returned no results, use seed data
      const seedStations = this.getSeedStations();
      result.stationsFromSeed = seedStations.length;

      // Merge both sources, preferring websdr.org data
      const allStations = this.mergeStationSources(webStations, seedStations);

      for (const station of allStations) {
        try {
          await this.upsertStation(station);
          result.stationsProcessed++;
        } catch (stationError) {
          const errorMessage = stationError instanceof Error ? stationError.message : String(stationError);
          result.errors.push(`Failed to upsert ${station.name}: ${errorMessage}`);
        }
      }

      result.success = result.stationsProcessed > 0;
      this.logger.log(
        `Crawl complete. Processed ${result.stationsProcessed} stations ` +
        `(${result.stationsFromWebsdr} from websdr.org, ${result.stationsFromSeed} seed stations).`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      this.logger.error('Crawl failed:', error);
    }

    return result;
  }

  /**
   * Merge stations from multiple sources, preferring websdr.org data
   */
  private mergeStationSources(webStations: ParsedStation[], seedStations: ParsedStation[]): ParsedStation[] {
    const stationsByUrl = new Map<string, ParsedStation>();

    // Add seed stations first
    for (const station of seedStations) {
      stationsByUrl.set(station.url, station);
    }

    // Override with websdr.org data where available
    for (const station of webStations) {
      stationsByUrl.set(station.url, station);
    }

    return Array.from(stationsByUrl.values());
  }

  /**
   * Fetch and parse websdr.org HTML
   * Falls back to empty array if fetch fails
   */
  private async fetchAndParseWebsdrOrg(): Promise<ParsedStation[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(this.WEBSDR_ORG_URL, {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`websdr.org returned ${response.status}: ${response.statusText}`);
        return [];
      }

      const html = await response.text();
      this.logger.log(`Fetched ${html.length} bytes from websdr.org`);

      return this.parseWebsdrHtml(html);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to fetch websdr.org: ${errorMessage}. Using seed data.`);
      return [];
    }
  }

  /**
   * Parse HTML from websdr.org
   * 
   * The websdr.org page typically contains a table with station information.
   * Structure may vary, so we attempt multiple parsing strategies.
   * 
   * @param html - Raw HTML from websdr.org
   * @returns Parsed station data
   */
  private parseWebsdrHtml(html: string): ParsedStation[] {
    const $ = cheerio.load(html);
    const stations: ParsedStation[] = [];

    // Strategy 1: Look for table rows with station data
    // websdr.org typically uses tables to list stations
    $('table tr').each((_, row) => {
      try {
        const station = this.parseTableRow($, row);
        if (station) {
          stations.push(station);
        }
      } catch {
        // Skip malformed rows
      }
    });

    // Strategy 2: Look for links that point to websdr instances
    // Common pattern: http://hostname:8901/
    if (stations.length === 0) {
      $('a[href*=":8901"]').each((_, link) => {
        try {
          const station = this.parseWebsdrLink($, link);
          if (station) {
            stations.push(station);
          }
        } catch {
          // Skip malformed links
        }
      });
    }

    this.logger.log(`Parsed ${stations.length} stations from websdr.org HTML`);
    return stations;
  }

  /**
   * Parse a table row for station data
   */
  private parseTableRow($: cheerio.CheerioAPI, row: Element): ParsedStation | null {
    const cells = $(row).find('td');
    if (cells.length < 2) return null;

    // Find the link to the websdr
    const link = $(row).find('a[href*="websdr"], a[href*=":8901"]').first();
    const url = link.attr('href');
    if (!url) return null;

    // Extract name from link text or first cell
    const name = link.text().trim() || $(cells[0]).text().trim();
    if (!name) return null;

    // Try to extract description from subsequent cells
    const description = $(cells[1]).text().trim() || undefined;

    // Try to extract country code from text (usually 2-letter codes)
    const countryMatch = $(row).text().match(/\b([A-Z]{2})\b/);
    const countryCode = countryMatch ? countryMatch[1] : undefined;

    // Extract coordinates if available (some listings include lat/lon)
    const { latitude, longitude } = this.extractCoordinates($(row).text());

    // Try to parse frequency ranges from text
    const frequencyRanges = this.extractFrequencyRanges($(row).text());

    return {
      name,
      url: this.normalizeUrl(url),
      latitude,
      longitude,
      countryCode,
      description,
      frequencyRanges: frequencyRanges.length > 0 ? frequencyRanges : [{ minHz: 0, maxHz: 30_000_000 }],
    };
  }

  /**
   * Parse a websdr link element
   */
  private parseWebsdrLink($: cheerio.CheerioAPI, link: Element): ParsedStation | null {
    const url = $(link).attr('href');
    if (!url) return null;

    const name = $(link).text().trim() || this.extractNameFromUrl(url);
    if (!name) return null;

    // Get surrounding text for context
    const parentText = $(link).parent().text();

    const { latitude, longitude } = this.extractCoordinates(parentText);
    const frequencyRanges = this.extractFrequencyRanges(parentText);

    return {
      name,
      url: this.normalizeUrl(url),
      latitude,
      longitude,
      frequencyRanges: frequencyRanges.length > 0 ? frequencyRanges : [{ minHz: 0, maxHz: 30_000_000 }],
    };
  }

  /**
   * Extract coordinates from text
   * Looks for patterns like "52.23N, 6.85E" or decimal coordinates
   */
  private extractCoordinates(text: string): { latitude: number; longitude: number } {
    // Pattern: decimal degrees with N/S/E/W
    const dmsPattern = /(\d+\.?\d*)[°]?\s*([NS])[,\s]+(\d+\.?\d*)[°]?\s*([EW])/i;
    const dmsMatch = text.match(dmsPattern);
    if (dmsMatch) {
      let lat = parseFloat(dmsMatch[1]);
      let lon = parseFloat(dmsMatch[3]);
      if (dmsMatch[2].toUpperCase() === 'S') lat = -lat;
      if (dmsMatch[4].toUpperCase() === 'W') lon = -lon;
      return { latitude: lat, longitude: lon };
    }

    // Pattern: plain decimal coordinates
    const decimalPattern = /(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/;
    const decimalMatch = text.match(decimalPattern);
    if (decimalMatch) {
      const lat = parseFloat(decimalMatch[1]);
      const lon = parseFloat(decimalMatch[2]);
      // Validate ranges
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { latitude: lat, longitude: lon };
      }
    }

    // Default to center of the world (will be corrected later if station is geocoded)
    return { latitude: 0, longitude: 0 };
  }

  /**
   * Extract frequency ranges from text
   * Looks for patterns like "0-30 MHz", "7.0-7.3 MHz", "40m", etc.
   */
  private extractFrequencyRanges(text: string): Array<{ minHz: number; maxHz: number }> {
    const ranges: Array<{ minHz: number; maxHz: number }> = [];

    // Pattern: range like "0-30 MHz" or "7.0-7.3 MHz"
    const rangePattern = /(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(MHz|kHz|GHz)/gi;
    let match;
    while ((match = rangePattern.exec(text)) !== null) {
      const min = parseFloat(match[1]);
      const max = parseFloat(match[2]);
      const unit = match[3].toLowerCase();
      const multiplier = unit === 'ghz' ? 1_000_000_000 : unit === 'mhz' ? 1_000_000 : 1_000;
      ranges.push({
        minHz: Math.round(min * multiplier),
        maxHz: Math.round(max * multiplier),
      });
    }

    // Pattern: single frequency like "7 MHz" (assume ±150kHz bandwidth)
    const singlePattern = /(\d+\.?\d*)\s*(MHz|kHz|GHz)/gi;
    while ((match = singlePattern.exec(text)) !== null) {
      const freq = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      const multiplier = unit === 'ghz' ? 1_000_000_000 : unit === 'mhz' ? 1_000_000 : 1_000;
      const centerHz = Math.round(freq * multiplier);
      // Only add if not overlapping with existing ranges
      const exists = ranges.some(r => centerHz >= r.minHz && centerHz <= r.maxHz);
      if (!exists) {
        ranges.push({
          minHz: centerHz - 150_000,
          maxHz: centerHz + 150_000,
        });
      }
    }

    // Pattern: band names like "40m", "20m", "80m"
    const bandPattern = /\b(\d{1,3})m\b/gi;
    const bandFrequencies: Record<string, { minHz: number; maxHz: number }> = {
      '160': { minHz: 1_800_000, maxHz: 2_000_000 },
      '80': { minHz: 3_500_000, maxHz: 4_000_000 },
      '60': { minHz: 5_350_000, maxHz: 5_450_000 },
      '40': { minHz: 7_000_000, maxHz: 7_300_000 },
      '30': { minHz: 10_100_000, maxHz: 10_150_000 },
      '20': { minHz: 14_000_000, maxHz: 14_350_000 },
      '17': { minHz: 18_068_000, maxHz: 18_168_000 },
      '15': { minHz: 21_000_000, maxHz: 21_450_000 },
      '12': { minHz: 24_890_000, maxHz: 24_990_000 },
      '10': { minHz: 28_000_000, maxHz: 29_700_000 },
      '6': { minHz: 50_000_000, maxHz: 54_000_000 },
      '2': { minHz: 144_000_000, maxHz: 148_000_000 },
    };
    while ((match = bandPattern.exec(text)) !== null) {
      const band = match[1];
      const bandRange = bandFrequencies[band];
      if (bandRange) {
        const exists = ranges.some(
          r => r.minHz === bandRange.minHz && r.maxHz === bandRange.maxHz
        );
        if (!exists) {
          ranges.push(bandRange);
        }
      }
    }

    return ranges;
  }

  /**
   * Extract a name from a WebSDR URL
   */
  private extractNameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Return hostname without common prefixes/suffixes
      return parsed.hostname
        .replace(/^(www\.|websdr\.)/i, '')
        .replace(/\.(com|org|net|nl|de|uk)$/i, '')
        .toUpperCase();
    } catch {
      return 'Unknown WebSDR';
    }
  }

  /**
   * Normalize a WebSDR URL
   */
  private normalizeUrl(url: string): string {
    try {
      // Ensure URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
      }
      // Remove trailing slash for consistency
      return url.replace(/\/$/, '');
    } catch {
      return url;
    }
  }

  /**
   * Upsert a station into the database
   */
  private async upsertStation(station: ParsedStation): Promise<void> {
    const existing = await this.prisma.station.findUnique({
      where: { url: station.url },
    });

    if (existing) {
      // Update existing station
      await this.prisma.station.update({
        where: { id: existing.id },
        data: {
          name: station.name,
          latitude: station.latitude,
          longitude: station.longitude,
          countryCode: station.countryCode,
          description: station.description,
          lastSeenAt: new Date(),
          isActive: true,
        },
      });

      // Update frequency ranges
      await this.prisma.stationFrequencyRange.deleteMany({
        where: { stationId: existing.id },
      });

      for (const range of station.frequencyRanges) {
        await this.prisma.stationFrequencyRange.create({
          data: {
            stationId: existing.id,
            minHz: range.minHz,
            maxHz: range.maxHz,
          },
        });
      }
    } else {
      // Create new station
      await this.prisma.station.create({
        data: {
          name: station.name,
          url: station.url,
          latitude: station.latitude,
          longitude: station.longitude,
          countryCode: station.countryCode,
          description: station.description,
          rawListingSource: 'websdr_org',
          lastSeenAt: new Date(),
          isActive: true,
          ranges: {
            create: station.frequencyRanges.map(range => ({
              minHz: range.minHz,
              maxHz: range.maxHz,
            })),
          },
        },
      });
    }
  }

  /**
   * Seed data for MVP development
   * These are real WebSDR stations with approximate data
   */
  private getSeedStations(): ParsedStation[] {
    return [
      {
        name: 'University of Twente',
        url: 'http://websdr.ewi.utwente.nl:8901/',
        latitude: 52.2389,
        longitude: 6.8563,
        countryCode: 'NL',
        description: 'Wide-coverage SDR at University of Twente, Netherlands - One of the most popular WebSDRs worldwide',
        frequencyRanges: [
          { minHz: 0, maxHz: 29_000_000 }, // 0-29 MHz
        ],
      },
      {
        name: 'Hack Green SDR',
        url: 'http://hackgreensdr.org:8901/',
        latitude: 53.0639,
        longitude: -2.5277,
        countryCode: 'GB',
        description: 'Located at the former nuclear bunker in Cheshire, UK',
        frequencyRanges: [
          { minHz: 0, maxHz: 30_000_000 }, // 0-30 MHz
        ],
      },
      {
        name: 'K3FEF WebSDR',
        url: 'http://k3fef.com:8901/',
        latitude: 39.9612,
        longitude: -76.7307,
        countryCode: 'US',
        description: 'Amateur radio SDR in Pennsylvania, USA',
        frequencyRanges: [
          { minHz: 3_500_000, maxHz: 4_000_000 }, // 80m
          { minHz: 7_000_000, maxHz: 7_300_000 }, // 40m
          { minHz: 14_000_000, maxHz: 14_350_000 }, // 20m
          { minHz: 21_000_000, maxHz: 21_450_000 }, // 15m
          { minHz: 28_000_000, maxHz: 29_700_000 }, // 10m
        ],
      },
      {
        name: 'SUWS WebSDR',
        url: 'http://suws.net/websdr/',
        latitude: 50.9376,
        longitude: -1.3963,
        countryCode: 'GB',
        description: 'Southampton University Wireless Society - VHF/UHF coverage',
        frequencyRanges: [
          { minHz: 144_000_000, maxHz: 146_000_000 }, // 2m VHF
          { minHz: 430_000_000, maxHz: 440_000_000 }, // 70cm UHF
        ],
      },
      {
        name: 'PI4THT WebSDR',
        url: 'http://websdr.pi4tht.nl:8901/',
        latitude: 52.0705,
        longitude: 4.3007,
        countryCode: 'NL',
        description: 'Netherlands amateur radio WebSDR',
        frequencyRanges: [
          { minHz: 3_500_000, maxHz: 3_800_000 }, // 80m
          { minHz: 7_000_000, maxHz: 7_200_000 }, // 40m
          { minHz: 14_000_000, maxHz: 14_350_000 }, // 20m
        ],
      },
      {
        name: 'W4AX WebSDR',
        url: 'http://w4ax.com:8901/',
        latitude: 35.7796,
        longitude: -78.6382,
        countryCode: 'US',
        description: 'North Carolina amateur radio SDR',
        frequencyRanges: [
          { minHz: 1_800_000, maxHz: 2_000_000 }, // 160m
          { minHz: 3_500_000, maxHz: 4_000_000 }, // 80m
          { minHz: 7_000_000, maxHz: 7_300_000 }, // 40m
          { minHz: 14_000_000, maxHz: 14_350_000 }, // 20m
        ],
      },
      {
        name: 'NA5B WebSDR',
        url: 'http://na5b.com:8901/',
        latitude: 32.3668,
        longitude: -106.7406,
        countryCode: 'US',
        description: 'New Mexico amateur radio SDR',
        frequencyRanges: [
          { minHz: 1_800_000, maxHz: 30_000_000 }, // 160m to 10m
        ],
      },
      {
        name: 'DD5XX WebSDR',
        url: 'http://websdr.dd5xx.de:8901/',
        latitude: 50.1109,
        longitude: 8.6821,
        countryCode: 'DE',
        description: 'German amateur radio WebSDR near Frankfurt',
        frequencyRanges: [
          { minHz: 0, maxHz: 30_000_000 }, // 0-30 MHz
        ],
      },
      {
        name: 'VKHAM WebSDR',
        url: 'http://vkham.com:8901/',
        latitude: -33.8688,
        longitude: 151.2093,
        countryCode: 'AU',
        description: 'Australian amateur radio WebSDR in Sydney',
        frequencyRanges: [
          { minHz: 3_500_000, maxHz: 3_700_000 }, // 80m
          { minHz: 7_000_000, maxHz: 7_300_000 }, // 40m
          { minHz: 14_000_000, maxHz: 14_350_000 }, // 20m
          { minHz: 21_000_000, maxHz: 21_450_000 }, // 15m
        ],
      },
      {
        name: 'JN1SDD WebSDR',
        url: 'http://websdr.jn1sdd.jp:8901/',
        latitude: 35.6762,
        longitude: 139.6503,
        countryCode: 'JP',
        description: 'Japanese amateur radio WebSDR in Tokyo',
        frequencyRanges: [
          { minHz: 7_000_000, maxHz: 7_200_000 }, // 40m
          { minHz: 14_000_000, maxHz: 14_350_000 }, // 20m
          { minHz: 21_000_000, maxHz: 21_450_000 }, // 15m
        ],
      },
      // Additional stations for broader coverage
      {
        name: 'ZS6BKW WebSDR',
        url: 'http://zs6bkw.com:8901/',
        latitude: -26.0382,
        longitude: 28.1123,
        countryCode: 'ZA',
        description: 'South African amateur radio WebSDR near Johannesburg',
        frequencyRanges: [
          { minHz: 3_500_000, maxHz: 4_000_000 }, // 80m
          { minHz: 7_000_000, maxHz: 7_300_000 }, // 40m
          { minHz: 14_000_000, maxHz: 14_350_000 }, // 20m
          { minHz: 21_000_000, maxHz: 21_450_000 }, // 15m
        ],
      },
      {
        name: 'PY2GN WebSDR',
        url: 'http://py2gn.com:8901/',
        latitude: -23.5505,
        longitude: -46.6333,
        countryCode: 'BR',
        description: 'Brazilian amateur radio WebSDR in São Paulo',
        frequencyRanges: [
          { minHz: 7_000_000, maxHz: 7_300_000 }, // 40m
          { minHz: 14_000_000, maxHz: 14_350_000 }, // 20m
          { minHz: 28_000_000, maxHz: 29_700_000 }, // 10m
        ],
      },
      {
        name: 'VE3HOA WebSDR',
        url: 'http://ve3hoa.org:8901/',
        latitude: 43.6532,
        longitude: -79.3832,
        countryCode: 'CA',
        description: 'Canadian amateur radio WebSDR in Toronto',
        frequencyRanges: [
          { minHz: 3_500_000, maxHz: 4_000_000 }, // 80m
          { minHz: 7_000_000, maxHz: 7_300_000 }, // 40m
          { minHz: 14_000_000, maxHz: 14_350_000 }, // 20m
        ],
      },
      {
        name: 'LA4TEN WebSDR',
        url: 'http://la4ten.no:8901/',
        latitude: 59.9139,
        longitude: 10.7522,
        countryCode: 'NO',
        description: 'Norwegian amateur radio WebSDR in Oslo',
        frequencyRanges: [
          { minHz: 1_800_000, maxHz: 2_000_000 }, // 160m
          { minHz: 3_500_000, maxHz: 3_800_000 }, // 80m
          { minHz: 7_000_000, maxHz: 7_200_000 }, // 40m
        ],
      },
      {
        name: 'SM5BSZ WebSDR',
        url: 'http://sm5bsz.com:8901/',
        latitude: 59.3293,
        longitude: 18.0686,
        countryCode: 'SE',
        description: 'Swedish amateur radio WebSDR in Stockholm',
        frequencyRanges: [
          { minHz: 7_000_000, maxHz: 7_200_000 }, // 40m
          { minHz: 14_000_000, maxHz: 14_350_000 }, // 20m
        ],
      },
    ];
  }

  /**
   * Seed the database with initial stations (for development)
   */
  async seedDatabase(): Promise<void> {
    this.logger.log('Seeding database with initial stations...');
    const stations = this.getSeedStations();

    for (const station of stations) {
      await this.upsertStation(station);
    }

    this.logger.log(`Seeded ${stations.length} stations.`);
  }
}
