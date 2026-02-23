import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TeamRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AcceptInviteResponseDto,
  InviteInfoResponseDto,
  ShareLinkResponseDto,
} from './dto/team-invite.dto';

const MAX_CODE_RETRY_ATTEMPTS = 10;

@Injectable()
export class TeamInviteService {
  private readonly frontendBaseUrl: string;

  constructor(private readonly prisma: PrismaService) {
    const rawBaseUrl = process.env.FRONTEND_BASE_URL?.trim();
    this.frontendBaseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : 'http://localhost:5173';
  }

  async getOrCreateShareLink(boardId: number, actorUserId: string): Promise<ShareLinkResponseDto> {
    const board = await this.ensureBoardAdminOrOwner(boardId, actorUserId);

    const existingInvite = await this.prisma.teamInvite.findUnique({
      where: { boardId },
      select: {
        id: true,
        code: true,
        teamId: true,
        boardId: true,
        isActive: true,
      },
    });

    if (existingInvite?.isActive) {
      return this.toShareLinkResponse(existingInvite);
    }

    if (existingInvite) {
      return this.activateExistingInvite(existingInvite.id, board.teamId, board.id, actorUserId);
    }

    return this.createInvite(board.teamId, board.id, actorUserId);
  }

  async regenerateShareLink(boardId: number, actorUserId: string): Promise<ShareLinkResponseDto> {
    const board = await this.ensureBoardAdminOrOwner(boardId, actorUserId);

    const existingInvite = await this.prisma.teamInvite.findUnique({
      where: { boardId },
      select: { id: true },
    });

    if (existingInvite) {
      return this.activateExistingInvite(existingInvite.id, board.teamId, board.id, actorUserId);
    }

    return this.createInvite(board.teamId, board.id, actorUserId);
  }

  async revokeShareLink(boardId: number, actorUserId: string): Promise<{ revoked: true }> {
    await this.ensureBoardAdminOrOwner(boardId, actorUserId);

    await this.prisma.teamInvite.updateMany({
      where: {
        boardId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return { revoked: true };
  }

  async getInviteInfoByCode(code: string): Promise<InviteInfoResponseDto> {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { code },
      select: {
        isActive: true,
        teamId: true,
        boardId: true,
        team: {
          select: {
            name: true,
          },
        },
        board: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invite || !invite.isActive) {
      throw new NotFoundException('Invite not found');
    }

    return {
      valid: true,
      teamId: invite.teamId,
      teamName: invite.team.name,
      boardId: invite.boardId,
      boardName: invite.board.name,
    };
  }

  async acceptInvite(code: string, userId: string): Promise<AcceptInviteResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.teamInvite.findUnique({
        where: { code },
        select: {
          id: true,
          isActive: true,
          teamId: true,
          boardId: true,
        },
      });

      if (!invite || !invite.isActive) {
        throw new NotFoundException('Invite not found');
      }

      const existingMember = await tx.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: invite.teamId,
            userId,
          },
        },
        select: { id: true },
      });

      await tx.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: invite.teamId,
            userId,
          },
        },
        update: {},
        create: {
          teamId: invite.teamId,
          userId,
          role: TeamRole.MEMBER,
        },
      });

      await tx.teamInvite.update({
        where: { id: invite.id },
        data: {
          acceptedCount: { increment: 1 },
          acceptedAt: new Date(),
        },
      });

      const alreadyMember = Boolean(existingMember);

      return {
        joined: !alreadyMember,
        alreadyMember,
        teamId: invite.teamId,
        boardId: invite.boardId,
        redirectPath: `/retro/boards/${invite.boardId}`,
      };
    });
  }

  private async ensureBoardAdminOrOwner(boardId: number, userId: string): Promise<{ id: number; teamId: number }> {
    const board = await this.prisma.retroBoard.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        teamId: true,
      },
    });

    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    const teamMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: board.teamId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!teamMember) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    if (teamMember.role === TeamRole.MEMBER) {
      throw new ForbiddenException('Insufficient permissions to manage board share link');
    }

    return board;
  }

  private async createInvite(teamId: number, boardId: number, actorUserId: string): Promise<ShareLinkResponseDto> {
    for (let attempt = 0; attempt < MAX_CODE_RETRY_ATTEMPTS; attempt += 1) {
      const code = this.generateInviteCode();

      try {
        const invite = await this.prisma.teamInvite.create({
          data: {
            code,
            teamId,
            boardId,
            createdById: actorUserId,
            isActive: true,
          },
          select: {
            code: true,
            teamId: true,
            boardId: true,
          },
        });

        return this.toShareLinkResponse(invite);
      } catch (error) {
        if (this.isUniqueConstraint(error, 'code')) {
          continue;
        }

        if (this.isUniqueConstraint(error, 'boardId')) {
          const existingInvite = await this.prisma.teamInvite.findUnique({
            where: { boardId },
            select: {
              id: true,
              code: true,
              teamId: true,
              boardId: true,
              isActive: true,
            },
          });

          if (existingInvite?.isActive) {
            return this.toShareLinkResponse(existingInvite);
          }

          if (existingInvite) {
            return this.activateExistingInvite(existingInvite.id, teamId, boardId, actorUserId);
          }
        }

        throw error;
      }
    }

    throw new InternalServerErrorException('Failed to generate invite code');
  }

  private async activateExistingInvite(
    inviteId: number,
    teamId: number,
    boardId: number,
    actorUserId: string,
  ): Promise<ShareLinkResponseDto> {
    for (let attempt = 0; attempt < MAX_CODE_RETRY_ATTEMPTS; attempt += 1) {
      const code = this.generateInviteCode();

      try {
        const invite = await this.prisma.teamInvite.update({
          where: { id: inviteId },
          data: {
            code,
            teamId,
            boardId,
            createdById: actorUserId,
            isActive: true,
          },
          select: {
            code: true,
            teamId: true,
            boardId: true,
          },
        });

        return this.toShareLinkResponse(invite);
      } catch (error) {
        if (this.isUniqueConstraint(error, 'code')) {
          continue;
        }

        throw error;
      }
    }

    throw new InternalServerErrorException('Failed to generate invite code');
  }

  private toShareLinkResponse(invite: { code: string; teamId: number; boardId: number }): ShareLinkResponseDto {
    return {
      code: invite.code,
      teamId: invite.teamId,
      boardId: invite.boardId,
      shareUrl: `${this.frontendBaseUrl}/invite/${invite.code}`,
    };
  }

  private generateInviteCode(): string {
    return randomBytes(18).toString('base64url');
  }

  private isUniqueConstraint(error: unknown, field: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = (error.meta as { target?: unknown } | undefined)?.target;
    if (Array.isArray(target)) {
      return target.some((value) => String(value).includes(field));
    }

    if (typeof target === 'string') {
      return target.includes(field);
    }

    return false;
  }
}
