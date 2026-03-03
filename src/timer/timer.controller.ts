import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnonymousActorService } from '../auth/anonymous-actor.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AccessActor } from '../auth/types/access-actor.type';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { RealtimeService } from '../realtime/realtime.service';
import {
  BoardTimerResponseDto,
  DeleteTimerResponseDto,
  StartTimerDto,
} from './dto/timer.dto';
import { TimerService } from './timer.service';

const TIMER_EVENTS = {
  started: 'retro.timer.started',
  paused: 'retro.timer.paused',
  resumed: 'retro.timer.resumed',
  deleted: 'retro.timer.deleted',
} as const;

@ApiTags('timer')
@ApiBearerAuth()
@Public()
@UseGuards(OptionalJwtAuthGuard)
@Controller('retro')
export class TimerController {
  constructor(
    private readonly timerService: TimerService,
    private readonly realtimeService: RealtimeService,
    private readonly anonymousActorService: AnonymousActorService,
  ) {}

  @Post('boards/:boardId/timer/start')
  @ApiOperation({ summary: 'Start or restart board timer' })
  @ApiBody({
    schema: {
      example: {
        seconds: 300,
      },
    },
  })
  @ApiOkResponse({ type: BoardTimerResponseDto })
  async startTimer(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: StartTimerDto,
  ) {
    const actor = await this.resolveActor(user);
    const result = await this.timerService.startTimer(boardId, actor.userId, body.seconds);

    await this.realtimeService.emitToTeam(
      result.teamId,
      TIMER_EVENTS.started,
      { boardId: result.boardId, timer: result.timer },
      this.toExcludedUserId(actor),
    );

    return result.timer;
  }

  @Post('boards/:boardId/timer/pause')
  @ApiOperation({ summary: 'Pause board timer' })
  @ApiOkResponse({ type: BoardTimerResponseDto })
  async pauseTimer(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    const actor = await this.resolveActor(user);
    const result = await this.timerService.pauseTimer(boardId, actor.userId);

    await this.realtimeService.emitToTeam(
      result.teamId,
      TIMER_EVENTS.paused,
      { boardId: result.boardId, timer: result.timer },
      this.toExcludedUserId(actor),
    );

    return result.timer;
  }

  @Post('boards/:boardId/timer/resume')
  @ApiOperation({ summary: 'Resume board timer' })
  @ApiOkResponse({ type: BoardTimerResponseDto })
  async resumeTimer(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    const actor = await this.resolveActor(user);
    const result = await this.timerService.resumeTimer(boardId, actor.userId);

    await this.realtimeService.emitToTeam(
      result.teamId,
      TIMER_EVENTS.resumed,
      { boardId: result.boardId, timer: result.timer },
      this.toExcludedUserId(actor),
    );

    return result.timer;
  }

  @Delete('boards/:boardId/timer')
  @ApiOperation({ summary: 'Delete board timer' })
  @ApiOkResponse({ type: DeleteTimerResponseDto })
  async deleteTimer(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    const actor = await this.resolveActor(user);
    const result = await this.timerService.deleteTimer(boardId, actor.userId);

    await this.realtimeService.emitToTeam(
      result.teamId,
      TIMER_EVENTS.deleted,
      { boardId: result.boardId, deleted: true },
      this.toExcludedUserId(actor),
    );

    return { deleted: true };
  }

  @Get('boards/:boardId/timer')
  @ApiOperation({ summary: 'Get current board timer' })
  @ApiOkResponse({
    schema: {
      oneOf: [{ $ref: '#/components/schemas/BoardTimerResponseDto' }, { type: 'null' }],
    },
  })
  async getCurrentTimer(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    const actor = await this.resolveActor(user);
    return this.timerService.getCurrentTimer(boardId, actor.userId);
  }

  private async resolveActor(user: AuthenticatedUser | undefined): Promise<AccessActor> {
    if (user) {
      return {
        userId: user.id,
        isAnonymous: false,
      };
    }

    return {
      userId: await this.anonymousActorService.getOrCreateGuestUserId(),
      isAnonymous: true,
    };
  }

  private toExcludedUserId(actor: AccessActor): string | undefined {
    if (actor.isAnonymous) {
      return undefined;
    }

    return actor.userId;
  }
}
