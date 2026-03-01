import { Module } from '@nestjs/common';
import { TimerCleanupService } from './timer-cleanup.service';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';

@Module({
  controllers: [TimerController],
  providers: [TimerService, TimerCleanupService],
  exports: [TimerService],
})
export class TimerModule {}
