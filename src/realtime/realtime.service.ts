import { Injectable, Logger } from '@nestjs/common';
import { Namespace, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly userSocketIds = new Map<string, Set<string>>();
  private readonly socketUserIds = new Map<string, string>();
  private namespace: Namespace | null = null;

  constructor(private readonly prisma: PrismaService) {}

  bindNamespace(namespace: Namespace) {
    this.namespace = namespace;
  }

  registerClient(client: Socket, userId: string) {
    const sockets = this.userSocketIds.get(userId) ?? new Set<string>();
    sockets.add(client.id);
    this.userSocketIds.set(userId, sockets);
    this.socketUserIds.set(client.id, userId);
  }

  unregisterClient(client: Socket) {
    const userId = this.socketUserIds.get(client.id);
    if (!userId) {
      return;
    }

    this.socketUserIds.delete(client.id);

    const sockets = this.userSocketIds.get(userId);
    if (!sockets) {
      return;
    }

    sockets.delete(client.id);
    if (sockets.size === 0) {
      this.userSocketIds.delete(userId);
    }
  }

  async emitToTeam(
    teamId: number,
    event: string,
    payload: unknown,
    excludedUserId?: string,
  ) {
    if (!this.namespace) {
      this.logger.warn(
        `Skipped broadcast for team ${teamId}: namespace is not initialized`,
      );
      return;
    }

    const teamMembers = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });

    if (teamMembers.length === 0) {
      return;
    }

    const socketIds: string[] = [];
    for (const member of teamMembers) {
      if (excludedUserId && member.userId === excludedUserId) {
        continue;
      }

      const userSockets = this.userSocketIds.get(member.userId);
      if (!userSockets) {
        continue;
      }

      for (const socketId of userSockets) {
        socketIds.push(socketId);
      }
    }

    if (socketIds.length === 0) {
      return;
    }

    this.namespace.to(socketIds).emit(event, payload);
  }
}
