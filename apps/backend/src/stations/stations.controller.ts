import { Controller, Get, Param, Query } from '@nestjs/common';
import { StationsService } from './stations.service';
import { GetStationsQueryDto } from './dto';

@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  findAll(@Query() query: GetStationsQueryDto) {
    return this.stationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stationsService.findOne(id);
  }
}
