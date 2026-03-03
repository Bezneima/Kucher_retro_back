import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TimerCleanupService } from './timer-cleanup.service';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';

@Module({
  imports: [AuthModule],
  controllers: [TimerController],
  providers: [TimerService, TimerCleanupService],
  exports: [TimerService],
})
export class TimerModule {}
