import assert from 'node:assert/strict';
import test from 'node:test';
import { TimerStatus } from '@prisma/client';
import { TimerCleanupService } from '../src/timer/timer-cleanup.service';
import { TimerService } from '../src/timer/timer.service';

class CleanupPrisma {
  timers = new Map<
    number,
    {
      status: TimerStatus;
      endsAt: Date | null;
    }
  >();

  retroBoard = {
    findFirst: async () => ({ id: 1, teamId: 10 }),
  };

  boardTimer = {
    deleteMany: async (args: { where: { status: TimerStatus; endsAt: { lte: Date } } }) => {
      let count = 0;
      for (const [boardId, timer] of this.timers.entries()) {
        if (
          timer.status === args.where.status &&
          timer.endsAt !== null &&
          timer.endsAt.getTime() <= args.where.endsAt.lte.getTime()
        ) {
          this.timers.delete(boardId);
          count += 1;
        }
      }

      return { count };
    },
  };
}

test('cleanup removes only expired running timers', async () => {
  const prisma = new CleanupPrisma();
  const now = Date.now();
  prisma.timers.set(1, { status: TimerStatus.RUNNING, endsAt: new Date(now - 1000) });
  prisma.timers.set(2, { status: TimerStatus.RUNNING, endsAt: new Date(now + 60_000) });
  prisma.timers.set(3, { status: TimerStatus.PAUSED, endsAt: null });

  const timerService = new TimerService(prisma as never);
  const cleanupService = new TimerCleanupService(timerService);

  const deletedCount = await cleanupService.runCleanup();

  assert.equal(deletedCount, 1);
  assert.equal(prisma.timers.has(1), false);
  assert.equal(prisma.timers.has(2), true);
  assert.equal(prisma.timers.has(3), true);
});
