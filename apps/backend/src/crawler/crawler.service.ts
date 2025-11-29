import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as cheerio from 'cheerio';

interface ParsedStation {
  name: string;
  url: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  description?: string;
  frequencyRanges: Array<{ minHz: number; maxHz: number }>;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

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
   * Manually trigger a crawl
   */
  async crawlWebsdrOrg(): Promise<void> {
    this.logger.log('Crawling websdr.org...');

    try {
      // Note: In production, you would fetch from websdr.org
      // For now, we'll use seed data since websdr.org may block automated requests
      const stations = await this.fetchAndParseWebsdrOrg();

      for (const station of stations) {
        await this.upsertStation(station);
      }

      this.logger.log(`Crawl complete. Processed ${stations.length} stations.`);
    } catch (error) {
      this.logger.error('Crawl failed:', error);
    }
  }

  /**
   * Fetch and parse websdr.org HTML
   * Note: This is a stub that returns seed data.
   * In production, this would actually fetch from websdr.org
   */
  private async fetchAndParseWebsdrOrg(): Promise<ParsedStation[]> {
    // For MVP, return seed data instead of actually fetching
    // This avoids issues with websdr.org blocking automated requests
    // TODO: Implement actual crawler with proper rate limiting and user-agent
    return this.getSeedStations();
  }

  /**
   * Parse HTML from websdr.org
   * This method is a stub for when we implement actual crawling.
   * 
   * @param html - Raw HTML from websdr.org
   * @returns Parsed station data
   * 
   * TODO: Implement actual parsing when websdr.org structure is analyzed
   */
  private parseWebsdrHtml(html: string): ParsedStation[] {
    // Load HTML with cheerio for future parsing
    const $ = cheerio.load(html);
    const stations: ParsedStation[] = [];

    // Example structure (to be implemented):
    // $('table tr').each((_, row) => {
    //   const name = $(row).find('td:first').text();
    //   const url = $(row).find('a').attr('href');
    //   // ... extract other fields
    //   stations.push({ name, url, ... });
    // });

    this.logger.warn(`parseWebsdrHtml: HTML parsing not yet implemented (${html.length} bytes received)`);
    return stations;
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
