import { Controller, Post } from '@nestjs/common';
import { CrawlerService } from './crawler.service';

@Controller('crawler')
export class CrawlerController {
  constructor(private readonly crawlerService: CrawlerService) {}

  /**
   * Manually trigger a crawl (for development/testing)
   */
  @Post('run')
  async runCrawl() {
    await this.crawlerService.crawlWebsdrOrg();
    return { message: 'Crawl initiated' };
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
