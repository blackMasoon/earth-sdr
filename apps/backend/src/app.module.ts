import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { StationsModule } from './stations/stations.module';
import { CrawlerModule } from './crawler/crawler.module';
import { PropagationModule } from './propagation/propagation.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    StationsModule,
    CrawlerModule,
    PropagationModule,
  ],
})
export class AppModule {}
