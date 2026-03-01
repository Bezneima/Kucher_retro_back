import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
@Controller('retro')
export class TimerController {
  constructor(
    private readonly timerService: TimerService,
    private readonly realtimeService: RealtimeService,
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: StartTimerDto,
  ) {
    const result = await this.timerService.startTimer(boardId, user.id, body.seconds);

    await this.realtimeService.emitToTeam(
      result.teamId,
      TIMER_EVENTS.started,
      { boardId: result.boardId, timer: result.timer },
      user.id,
    );

    return result.timer;
  }

  @Post('boards/:boardId/timer/pause')
  @ApiOperation({ summary: 'Pause board timer' })
  @ApiOkResponse({ type: BoardTimerResponseDto })
  async pauseTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    const result = await this.timerService.pauseTimer(boardId, user.id);

    await this.realtimeService.emitToTeam(
      result.teamId,
      TIMER_EVENTS.paused,
      { boardId: result.boardId, timer: result.timer },
      user.id,
    );

    return result.timer;
  }

  @Post('boards/:boardId/timer/resume')
  @ApiOperation({ summary: 'Resume board timer' })
  @ApiOkResponse({ type: BoardTimerResponseDto })
  async resumeTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    const result = await this.timerService.resumeTimer(boardId, user.id);

    await this.realtimeService.emitToTeam(
      result.teamId,
      TIMER_EVENTS.resumed,
      { boardId: result.boardId, timer: result.timer },
      user.id,
    );

    return result.timer;
  }

  @Delete('boards/:boardId/timer')
  @ApiOperation({ summary: 'Delete board timer' })
  @ApiOkResponse({ type: DeleteTimerResponseDto })
  async deleteTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    const result = await this.timerService.deleteTimer(boardId, user.id);

    await this.realtimeService.emitToTeam(
      result.teamId,
      TIMER_EVENTS.deleted,
      { boardId: result.boardId, deleted: true },
      user.id,
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
  getCurrentTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.timerService.getCurrentTimer(boardId, user.id);
  }
}
