import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TimerService } from './timer.service';

@Injectable()
export class TimerCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimerCleanupService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private readonly timerService: TimerService) {}

  onModuleInit() {
    this.intervalId = setInterval(() => {
      void this.runCleanup();
    }, 30_000);
  }

  onModuleDestroy() {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  async runCleanup(): Promise<number> {
    try {
      return await this.timerService.cleanupExpiredRunningTimers();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cleanup timers: ${message}`);
      return 0;
    }
  }
}
