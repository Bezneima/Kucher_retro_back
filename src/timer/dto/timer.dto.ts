import { TimerStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class StartTimerDto {
  @ApiProperty({ example: 300, minimum: 1, maximum: 86400 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  seconds!: number;
}

export class BoardTimerResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  boardId!: number;

  @ApiProperty({ example: '8f635db5-7d93-4e6e-a1a7-8f7ba4f4f7d2' })
  createdById!: string;

  @ApiProperty({ enum: TimerStatus, example: TimerStatus.RUNNING })
  status!: TimerStatus;

  @ApiProperty({ example: 300 })
  durationSeconds!: number;

  @ApiProperty({ example: 300 })
  remainingSeconds!: number;

  @ApiProperty({ example: '2026-03-01T11:00:00.000Z', nullable: true })
  startedAt!: Date | null;

  @ApiProperty({ example: '2026-03-01T11:05:00.000Z', nullable: true })
  endsAt!: Date | null;

  @ApiProperty({ example: '2026-03-01T10:59:59.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-03-01T11:00:00.000Z' })
  updatedAt!: Date;
}

export class DeleteTimerResponseDto {
  @ApiProperty({ example: true })
  deleted!: boolean;
}
