import { Module } from '@nestjs/common';
import { PropagationController } from './propagation.controller';
import { PropagationService } from './propagation.service';

@Module({
  controllers: [PropagationController],
  providers: [PropagationService],
  exports: [PropagationService],
})
export class PropagationModule {}
