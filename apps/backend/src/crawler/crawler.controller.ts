import { Controller, Get, Post } from '@nestjs/common';
import { CrawlerService, CrawlResult } from './crawler.service';

@Controller('crawler')
export class CrawlerController {
  constructor(private readonly crawlerService: CrawlerService) {}

  /**
   * Manually trigger a crawl (for development/testing)
   * Returns detailed results of the crawl operation
   */
  @Post('run')
  async runCrawl(): Promise<CrawlResult> {
    return this.crawlerService.crawlWebsdrOrg();
  }

  /**
   * Get crawl status (for health checks)
   */
  @Get('status')
  getStatus() {
    return {
      service: 'crawler',
      status: 'ready',
      scheduledInterval: 'every 6 hours',
    };
  }

  /**
   * Seed the database with initial stations
   */
  @Post('seed')
  async seedDatabase() {
    await this.crawlerService.seedDatabase();
    return { message: 'Database seeded' };
  }
}
