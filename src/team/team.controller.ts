import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamMemberRoleDto } from './dto/team.dto';
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
