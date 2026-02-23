import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AcceptInviteResponseDto, InviteInfoResponseDto } from './dto/team-invite.dto';
import { TeamInviteService } from './team-invite.service';

@ApiTags('team-invites')
@Controller('team-invites')
export class TeamInviteController {
  constructor(private readonly teamInviteService: TeamInviteService) {}

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'Get invite info by code (public)' })
  @ApiOkResponse({ type: InviteInfoResponseDto })
  getInviteInfo(@Param('code') code: string) {
    return this.teamInviteService.getInviteInfoByCode(code);
  }

  @ApiBearerAuth()
  @Post(':code/accept')
  @ApiOperation({ summary: 'Accept invite and join team for target board' })
  @ApiOkResponse({ type: AcceptInviteResponseDto })
  acceptInvite(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.teamInviteService.acceptInvite(code, user.id);
  }
}
