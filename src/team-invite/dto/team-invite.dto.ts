import { ApiProperty } from '@nestjs/swagger';

export class ShareLinkResponseDto {
  @ApiProperty({ example: 'https://app.example.com/invite/AbCdEf123' })
  shareUrl!: string;

  @ApiProperty({ example: 'AbCdEf123' })
  code!: string;

  @ApiProperty({ example: 12 })
  teamId!: number;

  @ApiProperty({ example: 77 })
  boardId!: number;
}

export class InviteInfoResponseDto {
  @ApiProperty({ example: true })
  valid!: boolean;

  @ApiProperty({ example: 12 })
  teamId!: number;

  @ApiProperty({ example: 'Platform Team' })
  teamName!: string;

  @ApiProperty({ example: 77 })
  boardId!: number;

  @ApiProperty({ example: 'Sprint 24 Retro' })
  boardName!: string;
}

export class AcceptInviteResponseDto {
  @ApiProperty({ example: true })
  joined!: boolean;

  @ApiProperty({ example: false })
  alreadyMember!: boolean;

  @ApiProperty({ example: 12 })
  teamId!: number;

  @ApiProperty({ example: 77 })
  boardId!: number;

  @ApiProperty({ example: '/retro/boards/77' })
  redirectPath!: string;
}
