import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BoardTimer, TimerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoardTimerResponseDto } from './dto/timer.dto';

type TimerActionResult = {
  boardId: number;
  teamId: number;
  timer: BoardTimerResponseDto;
};

type TimerDeleteResult = {
  boardId: number;
  teamId: number;
  deleted: boolean;
};

@Injectable()
export class TimerService {
  private readonly logger = new Logger(TimerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async startTimer(boardId: number, userId: string, seconds: number): Promise<TimerActionResult> {
    const context = await this.getBoardContextOrFail(boardId, userId);
    const now = new Date();
    const endsAt = new Date(now.getTime() + seconds * 1000);

    const timer = await this.prisma.boardTimer.upsert({
      where: { boardId },
      create: {
        boardId,
        createdById: userId,
        status: TimerStatus.RUNNING,
        durationSeconds: seconds,
        remainingSeconds: seconds,
        startedAt: now,
        endsAt,
      },
      update: {
        createdById: userId,
        status: TimerStatus.RUNNING,
        durationSeconds: seconds,
        remainingSeconds: seconds,
        startedAt: now,
        endsAt,
      },
    });

    return {
      boardId,
      teamId: context.teamId,
      timer: this.mapTimer(timer),
    };
  }

  async pauseTimer(boardId: number, userId: string): Promise<TimerActionResult> {
    const context = await this.getBoardContextOrFail(boardId, userId);
    const current = await this.getTimerOrFail(boardId);

    if (current.status !== TimerStatus.RUNNING) {
      throw new BadRequestException('Timer is not running');
    }

    if (!current.endsAt) {
      throw new BadRequestException('Running timer has no end time');
    }

    const now = new Date();
    const remainingSeconds = Math.max(
      0,
      Math.ceil((current.endsAt.getTime() - now.getTime()) / 1000),
    );

    if (remainingSeconds <= 0) {
      await this.prisma.boardTimer.delete({ where: { boardId } });
      throw new NotFoundException(`Timer for board ${boardId} already expired`);
    }

    const timer = await this.prisma.boardTimer.update({
      where: { boardId },
      data: {
        status: TimerStatus.PAUSED,
        remainingSeconds,
        startedAt: null,
        endsAt: null,
      },
    });

    return {
      boardId,
      teamId: context.teamId,
      timer: this.mapTimer(timer),
    };
  }

  async resumeTimer(boardId: number, userId: string): Promise<TimerActionResult> {
    const context = await this.getBoardContextOrFail(boardId, userId);
    const current = await this.getTimerOrFail(boardId);

    if (current.status !== TimerStatus.PAUSED) {
      throw new BadRequestException('Timer is not paused');
    }

    if (current.remainingSeconds <= 0) {
      await this.prisma.boardTimer.delete({ where: { boardId } });
      throw new NotFoundException(`Timer for board ${boardId} already expired`);
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + current.remainingSeconds * 1000);

    const timer = await this.prisma.boardTimer.update({
      where: { boardId },
      data: {
        status: TimerStatus.RUNNING,
        startedAt: now,
        endsAt,
      },
    });

    return {
      boardId,
      teamId: context.teamId,
      timer: this.mapTimer(timer),
    };
  }

  async deleteTimer(boardId: number, userId: string): Promise<TimerDeleteResult> {
    const context = await this.getBoardContextOrFail(boardId, userId);
    const result = await this.prisma.boardTimer.deleteMany({ where: { boardId } });

    return {
      boardId,
      teamId: context.teamId,
      deleted: result.count > 0,
    };
  }

  async getCurrentTimer(boardId: number, userId: string): Promise<BoardTimerResponseDto | null> {
    await this.getBoardContextOrFail(boardId, userId);

    const timer = await this.prisma.boardTimer.findUnique({
      where: { boardId },
    });

    return timer ? this.mapTimer(timer) : null;
  }

  async cleanupExpiredRunningTimers(): Promise<number> {
    const result = await this.prisma.boardTimer.deleteMany({
      where: {
        status: TimerStatus.RUNNING,
        endsAt: {
          lte: new Date(),
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Deleted ${result.count} expired running timers`);
    }

    return result.count;
  }

  private mapTimer(timer: BoardTimer): BoardTimerResponseDto {
    return {
      id: timer.id,
      boardId: timer.boardId,
      createdById: timer.createdById,
      status: timer.status,
      durationSeconds: timer.durationSeconds,
      remainingSeconds: timer.remainingSeconds,
      startedAt: timer.startedAt,
      endsAt: timer.endsAt,
      createdAt: timer.createdAt,
      updatedAt: timer.updatedAt,
    };
  }

  private async getBoardContextOrFail(boardId: number, userId: string): Promise<{ boardId: number; teamId: number }> {
    const board = await this.prisma.retroBoard.findFirst({
      where: {
        id: boardId,
        team: {
          members: {
            some: { userId },
          },
        },
      },
      select: {
        id: true,
        teamId: true,
      },
    });

    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    return {
      boardId: board.id,
      teamId: board.teamId,
    };
  }

  private async getTimerOrFail(boardId: number): Promise<BoardTimer> {
    const timer = await this.prisma.boardTimer.findUnique({
      where: { boardId },
    });

    if (!timer) {
      throw new NotFoundException(`Timer for board ${boardId} not found`);
    }

    return timer;
  }
}
