import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetStationsQueryDto } from './dto';
import { FREQUENCY_BANDS, FrequencyBand, WebSdrStation, WebSdrStationListItem } from '@websdr-atlas/shared';

@Injectable()
export class StationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: GetStationsQueryDto): Promise<WebSdrStationListItem[]> {
    const { band, country, search, onlineOnly, north, south, east, west } = query;

    const where: any = {
      isActive: true,
    };

    if (country) {
      where.countryCode = country;
    }

    if (onlineOnly) {
      // For now, we consider all active stations as online
      // In the future, we might implement a ping check
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Bounding box filter
    if (north !== undefined && south !== undefined && east !== undefined && west !== undefined) {
      where.latitude = { gte: south, lte: north };
      where.longitude = { gte: west, lte: east };
    }

    let stations = await this.prisma.station.findMany({
      where,
      include: {
        ranges: true,
      },
      orderBy: { name: 'asc' },
    });

    // Filter by frequency band if specified
    if (band && FREQUENCY_BANDS[band as FrequencyBand]) {
      const bandRange = FREQUENCY_BANDS[band as FrequencyBand];
      stations = stations.filter(station =>
        station.ranges.some(
          range => range.minHz <= bandRange.maxHz && range.maxHz >= bandRange.minHz
        )
      );
    }

    return stations.map(station => ({
      id: station.id,
      name: station.name,
      url: station.url,
      latitude: station.latitude,
      longitude: station.longitude,
      countryCode: station.countryCode || undefined,
      isOnlineEstimated: station.isActive,
    }));
  }

  async findOne(id: string): Promise<WebSdrStation> {
    const station = await this.prisma.station.findUnique({
      where: { id },
      include: {
        ranges: true,
      },
    });

    if (!station) {
      throw new NotFoundException(`Station with ID ${id} not found`);
    }

    return {
      id: station.id,
      name: station.name,
      description: station.description || undefined,
      url: station.url,
      latitude: station.latitude,
      longitude: station.longitude,
      countryCode: station.countryCode || undefined,
      frequencyRanges: station.ranges.map(r => ({
        minHz: r.minHz,
        maxHz: r.maxHz,
      })),
      rawListingSource: station.rawListingSource as 'websdr_org' | 'manual',
      lastSeenAt: station.lastSeenAt?.toISOString() || new Date().toISOString(),
      isOnlineEstimated: station.isActive,
      isActive: station.isActive,
    };
  }
}
