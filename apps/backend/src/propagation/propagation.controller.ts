import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { PropagationService } from './propagation.service';

@Controller('propagation')
export class PropagationController {
  constructor(private readonly propagationService: PropagationService) {}

  @Get()
  async getPropagation(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Query('freqs') freqs?: string
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new BadRequestException('Invalid coordinates');
    }

    const frequencies = freqs
      ? freqs.split(',').map((f) => parseInt(f, 10))
      : this.propagationService.getDefaultFrequencies();

    return this.propagationService.getRingsForStation(latitude, longitude, frequencies);
  }
}
