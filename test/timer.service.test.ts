import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { TimerStatus } from '@prisma/client';
import { TimerService } from '../src/timer/timer.service';

type MockBoard = {
  id: number;
  teamId: number;
  userIds: string[];
};

type MockTimer = {
  id: number;
  boardId: number;
  createdById: string;
  status: TimerStatus;
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

class InMemoryPrisma {
  private timerIdSeq = 1;
  readonly boards: MockBoard[] = [];
  readonly timers = new Map<number, MockTimer>();

  retroBoard = {
    findFirst: async (args: { where: { id: number; team: { members: { some: { userId: string } } } } }) => {
      const boardId = args.where.id;
      const userId = args.where.team.members.some.userId;
      const board = this.boards.find((item) => item.id === boardId && item.userIds.includes(userId));
      if (!board) {
        return null;
      }

      return {
        id: board.id,
        teamId: board.teamId,
      };
    },
  };

  boardTimer = {
    upsert: async (args: {
      where: { boardId: number };
      create: Omit<MockTimer, 'id' | 'createdAt' | 'updatedAt'>;
      update: Partial<Omit<MockTimer, 'id' | 'createdAt'>>;
    }) => {
      const existing = this.timers.get(args.where.boardId);
      const now = new Date();
      if (existing) {
        const updated: MockTimer = {
          ...existing,
          ...args.update,
          updatedAt: now,
        };
        this.timers.set(args.where.boardId, updated);
        return updated;
      }

      const created: MockTimer = {
        id: this.timerIdSeq++,
        ...args.create,
        createdAt: now,
        updatedAt: now,
      };
      this.timers.set(args.where.boardId, created);
      return created;
    },

    findUnique: async (args: { where: { boardId: number } }) => {
      return this.timers.get(args.where.boardId) ?? null;
    },

    update: async (args: {
      where: { boardId: number };
      data: Partial<Omit<MockTimer, 'id' | 'boardId' | 'createdAt' | 'createdById'>>;
    }) => {
      const existing = this.timers.get(args.where.boardId);
      if (!existing) {
        throw new Error('Timer not found');
      }

      const updated: MockTimer = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };

      this.timers.set(args.where.boardId, updated);
      return updated;
    },

    delete: async (args: { where: { boardId: number } }) => {
      const existing = this.timers.get(args.where.boardId);
      if (!existing) {
        throw new Error('Timer not found');
      }

      this.timers.delete(args.where.boardId);
      return existing;
    },

    deleteMany: async (args: {
      where: {
        boardId?: number;
        status?: TimerStatus;
        endsAt?: { lte: Date };
      };
    }) => {
      let count = 0;
      for (const [boardId, timer] of this.timers.entries()) {
        const byBoard = args.where.boardId === undefined || args.where.boardId === boardId;
        const byStatus = args.where.status === undefined || args.where.status === timer.status;
        const byEndsAt =
          args.where.endsAt === undefined ||
          (timer.endsAt !== null && timer.endsAt.getTime() <= args.where.endsAt.lte.getTime());

        if (byBoard && byStatus && byEndsAt) {
          this.timers.delete(boardId);
          count += 1;
        }
      }

      return { count };
    },
  };
}

function setup() {
  const prisma = new InMemoryPrisma();
  prisma.boards.push({ id: 1, teamId: 10, userIds: ['u-1', 'u-2'] });
  prisma.boards.push({ id: 2, teamId: 11, userIds: ['u-2'] });
  const service = new TimerService(prisma as never);

  return { prisma, service };
}

test('startTimer creates timer and startTimer again replaces timer settings', async () => {
  const { prisma, service } = setup();

  const first = await service.startTimer(1, 'u-1', 90);
  const second = await service.startTimer(1, 'u-2', 45);

  assert.equal(first.timer.status, TimerStatus.RUNNING);
  assert.equal(first.timer.durationSeconds, 90);
  assert.equal(second.timer.durationSeconds, 45);
  assert.equal(second.timer.remainingSeconds, 45);
  assert.equal(second.timer.createdById, 'u-2');
  assert.equal(prisma.timers.size, 1);
});

test('pauseTimer stores remaining seconds and resumeTimer continues from pause', async () => {
  const { service } = setup();

  await service.startTimer(1, 'u-1', 120);
  const paused = await service.pauseTimer(1, 'u-1');

  assert.equal(paused.timer.status, TimerStatus.PAUSED);
  assert.equal(paused.timer.startedAt, null);
  assert.equal(paused.timer.endsAt, null);
  assert.ok(paused.timer.remainingSeconds > 0);
  assert.ok(paused.timer.remainingSeconds <= 120);

  const resumed = await service.resumeTimer(1, 'u-1');
  assert.equal(resumed.timer.status, TimerStatus.RUNNING);
  assert.ok(resumed.timer.startedAt instanceof Date);
  assert.ok(resumed.timer.endsAt instanceof Date);
  assert.ok(resumed.timer.endsAt.getTime() > resumed.timer.startedAt.getTime());
});

test('deleteTimer removes timer and getCurrentTimer returns null', async () => {
  const { service } = setup();

  await service.startTimer(1, 'u-1', 30);
  const deleted = await service.deleteTimer(1, 'u-1');
  const current = await service.getCurrentTimer(1, 'u-1');

  assert.equal(deleted.deleted, true);
  assert.equal(current, null);
});

test('startTimer throws for inaccessible board', async () => {
  const { service } = setup();

  await assert.rejects(async () => service.startTimer(1, 'u-x', 30), NotFoundException);
});
