import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  AddTeamMemberDto,
  CreateTeamDto,
  UpdateTeamCardsVisibilityDto,
  UpdateTeamDto,
  UpdateTeamMemberRoleDto,
} from './dto/team.dto';
import { TeamService } from './team.service';

@ApiTags('teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @ApiOperation({ summary: 'Create team and assign current user as OWNER' })
  @ApiBody({
    schema: {
      example: {
        name: 'Platform Team',
      },
    },
  })
  createTeam(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTeamDto) {
    return this.teamService.createTeam(user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get teams where current user is a member' })
  getTeams(@CurrentUser() user: AuthenticatedUser) {
    return this.teamService.getTeams(user.id);
  }

  @Patch(':teamId')
  @ApiOperation({ summary: 'Update team name (OWNER/ADMIN only)' })
  @ApiBody({
    schema: {
      example: {
        name: 'Core Platform Team',
      },
    },
  })
  @ApiOkResponse({
    description: 'Team updated',
    schema: {
      example: {
        id: 1,
        name: 'Core Platform Team',
        createdAt: '2026-02-20T12:00:00.000Z',
        updatedAt: '2026-02-20T12:30:00.000Z',
      },
    },
  })
  updateTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() body: UpdateTeamDto,
  ) {
    return this.teamService.updateTeam(teamId, user.id, body);
  }

  @Patch(':teamId/is-all-cards-hidden')
  @ApiOperation({ summary: 'Update team cards visibility (OWNER/ADMIN only)' })
  @ApiBody({
    schema: {
      example: {
        isAllCardsHidden: true,
      },
    },
  })
  @ApiOkResponse({
    description: 'Team cards visibility updated',
    schema: {
      example: {
        id: 1,
        isAllCardsHidden: true,
        updatedAt: '2026-02-25T12:30:00.000Z',
      },
    },
  })
  updateTeamCardsVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() body: UpdateTeamCardsVisibilityDto,
  ) {
    return this.teamService.updateIsAllCardsHidden(teamId, user.id, body.isAllCardsHidden);
  }

  @Get(':teamId/members')
  @ApiOperation({ summary: 'Get team members' })
  getMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId', ParseIntPipe) teamId: number,
  ) {
    return this.teamService.getMembers(teamId, user.id);
  }

  @Post(':teamId/members')
  @ApiOperation({ summary: 'Add member to team by email (OWNER/ADMIN only)' })
  @ApiBody({
    schema: {
      example: {
        email: 'alice@example.com',
        role: 'MEMBER',
      },
    },
  })
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() body: AddTeamMemberDto,
  ) {
    return this.teamService.addMember(teamId, user.id, body);
  }

  @Delete(':teamId/members/:userId')
  @ApiOperation({ summary: 'Remove team member (OWNER/ADMIN only)' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('userId') memberUserId: string,
  ) {
    return this.teamService.removeMember(teamId, user.id, memberUserId);
  }

  @Delete(':teamId/leave')
  @ApiOperation({ summary: 'Leave team where current user is a member' })
  leaveTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId', ParseIntPipe) teamId: number,
  ) {
    return this.teamService.leaveTeam(teamId, user.id);
  }

  @Patch(':teamId/members/:userId/role')
  @ApiOperation({ summary: 'Update member role (OWNER only)' })
  @ApiBody({
    schema: {
      example: {
        role: 'ADMIN',
      },
    },
  })
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('userId') memberUserId: string,
    @Body() body: UpdateTeamMemberRoleDto,
  ) {
    return this.teamService.updateMemberRole(teamId, user.id, memberUserId, body.role);
  }
}
