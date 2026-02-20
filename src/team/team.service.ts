import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddTeamMemberDto, CreateTeamDto } from './dto/team.dto';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async createTeam(userId: string, dto: CreateTeamDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Team name is required');
    }

    const team = await this.prisma.team.create({
      data: {
        name,
        members: {
          create: {
            userId,
            role: TeamRole.OWNER,
          },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });

    return {
      id: team.id,
      name: team.name,
      role: team.members[0]?.role ?? TeamRole.OWNER,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  async getTeams(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      select: {
        role: true,
        team: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        team: {
          id: 'asc',
        },
      },
    });

    return memberships.map((membership) => ({
      id: membership.team.id,
      name: membership.team.name,
      role: membership.role,
      createdAt: membership.team.createdAt,
      updatedAt: membership.team.updatedAt,
    }));
  }

  async getMembers(teamId: number, userId: string) {
    await this.ensureTeamMember(teamId, userId);

    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
    });

    return members.map((member) => ({
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      role: member.role,
      joinedAt: member.createdAt,
    }));
  }

  async addMember(teamId: number, actorUserId: string, dto: AddTeamMemberDto) {
    await this.ensureTeamAdminOrOwner(teamId, actorUserId);

    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: user.id,
        },
      },
      select: { id: true },
    });

    if (existingMember) {
      throw new ConflictException(`User ${email} is already a team member`);
    }

    const member = await this.prisma.teamMember.create({
      data: {
        teamId,
        userId: user.id,
        role: dto.role ?? TeamRole.MEMBER,
      },
    });

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: member.role,
      joinedAt: member.createdAt,
    };
  }

  async removeMember(teamId: number, actorUserId: string, memberUserId: string) {
    await this.ensureTeamAdminOrOwner(teamId, actorUserId);

    if (actorUserId === memberUserId) {
      throw new BadRequestException('Use a dedicated leave-team flow to remove yourself');
    }

    const targetMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: memberUserId,
        },
      },
      select: { id: true, role: true },
    });

    if (!targetMember) {
      throw new NotFoundException(`Member ${memberUserId} not found in team ${teamId}`);
    }

    if (targetMember.role === TeamRole.OWNER) {
      throw new ConflictException('Removing OWNER is not supported in MVP');
    }

    await this.prisma.teamMember.delete({
      where: { id: targetMember.id },
    });

    return { deleted: true };
  }

  async updateMemberRole(
    teamId: number,
    actorUserId: string,
    memberUserId: string,
    role: TeamRole,
  ) {
    await this.ensureTeamOwner(teamId, actorUserId);

    if (actorUserId === memberUserId) {
      throw new BadRequestException('Changing your own role is not allowed');
    }

    const targetMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: memberUserId,
        },
      },
      select: { id: true, role: true, userId: true, user: { select: { email: true, name: true } } },
    });

    if (!targetMember) {
      throw new NotFoundException(`Member ${memberUserId} not found in team ${teamId}`);
    }

    if (targetMember.role === TeamRole.OWNER) {
      throw new ConflictException('Changing OWNER role is not supported in MVP');
    }

    const updatedMember = await this.prisma.teamMember.update({
      where: { id: targetMember.id },
      data: { role },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    return {
      userId: updatedMember.userId,
      email: updatedMember.user.email,
      name: updatedMember.user.name,
      role: updatedMember.role,
      joinedAt: updatedMember.createdAt,
    };
  }

  private async ensureTeamMember(teamId: number, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }
  }

  private async ensureTeamAdminOrOwner(teamId: number, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!member) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    if (member.role === TeamRole.MEMBER) {
      throw new ForbiddenException('Insufficient permissions to manage team members');
    }
  }

  private async ensureTeamOwner(teamId: number, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!member) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    if (member.role !== TeamRole.OWNER) {
      throw new ForbiddenException('Only OWNER can change member roles');
    }
  }
}
