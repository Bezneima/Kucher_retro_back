import { Controller, Delete, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ShareLinkResponseDto } from './dto/team-invite.dto';
import { TeamInviteService } from './team-invite.service';

@ApiTags('team-invites')
@ApiBearerAuth()
@Controller('retro/boards')
export class BoardShareController {
  constructor(private readonly teamInviteService: TeamInviteService) {}

  @Post(':boardId/share-link')
  @ApiOperation({ summary: 'Get existing active board share link or create a new one' })
  @ApiOkResponse({ type: ShareLinkResponseDto })
  getOrCreateShareLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.teamInviteService.getOrCreateShareLink(boardId, user.id);
  }

  @Post(':boardId/share-link/regenerate')
  @ApiOperation({ summary: 'Regenerate board share link and invalidate previous one' })
  @ApiOkResponse({ type: ShareLinkResponseDto })
  regenerateShareLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.teamInviteService.regenerateShareLink(boardId, user.id);
  }

  @Delete(':boardId/share-link')
  @ApiOperation({ summary: 'Revoke board share link' })
  revokeShareLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.teamInviteService.revokeShareLink(boardId, user.id);
  }
}
