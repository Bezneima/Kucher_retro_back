import { HttpException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import { Public } from '../auth/decorators/public.decorator';
import { RetroService } from '../retro/retro.service';
import { Namespace, Socket } from 'socket.io';

type WsJwtPayload = {
  sub: string;
  email: string;
};

type WsUser = {
  id: string;
  email: string;
};

type RenameBoardPayload = {
  boardId: number;
  name: string;
};

type ReorderColumnsPayload = {
  boardId: number;
  oldIndex: number;
  newIndex: number;
};

type BoardJoinPayload = {
  boardId: number;
};

@Public()
@Injectable()
@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: ['http://localhost:5173', 'http://5.129.220.111'],
    credentials: true,
  },
})
export class RetroGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RetroGateway.name);
  private readonly accessSecret = getRequiredEnv('JWT_ACCESS_SECRET');

  constructor(
    private readonly jwtService: JwtService,
    private readonly retroService: RetroService,
  ) {}

  afterInit(server: Namespace) {
    server.use(async (socket, next) => {
      try {
        const token = this.extractAuthToken(socket);
        const payload = await this.jwtService.verifyAsync<WsJwtPayload>(token, {
          secret: this.accessSecret,
        });

        socket.data.user = {
          id: payload.sub,
          email: payload.email,
        } satisfies WsUser;

        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  handleConnection(client: Socket) {
    const user = client.data.user as WsUser | undefined;
    const userLog = user
      ? `Socket connected: ${client.id}; userId=${user.id}; email=${user.email}`
      : `Socket connected: ${client.id}; user=unknown`;

    this.logger.log(userLog);
    client.send('hello world');
    client.send(userLog);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('board.join')
  async handleBoardJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BoardJoinPayload,
  ) {
    const user = this.requireAuthenticatedUser(client);
    const boardId = this.parseBoardId(body?.boardId);

    try {
      // Reuse existing access checks from RetroService.
      await this.retroService.getBoardColumns(boardId, user.id);
      client.join(this.getBoardRoom(boardId));
      return { joined: true, boardId };
    } catch (error) {
      if (error instanceof HttpException) {
        throw new WsException(error.message);
      }

      throw new WsException('Failed to join board room');
    }
  }

  @SubscribeMessage('board.rename')
  async handleBoardRename(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RenameBoardPayload,
  ) {
    const user = this.requireAuthenticatedUser(client);
    const boardId = this.parseBoardId(body?.boardId);
    const name = this.parseBoardName(body?.name);

    try {
      const updatedBoard = await this.retroService.updateBoardName(boardId, user.id, name);
      client.to(this.getBoardRoom(boardId)).emit('board.renamed', updatedBoard);
      return updatedBoard;
    } catch (error) {
      if (error instanceof HttpException) {
        throw new WsException(error.message);
      }

      throw new WsException('Failed to rename board');
    }
  }

  @SubscribeMessage('board.columns.reorder')
  async handleBoardColumnsReorder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ReorderColumnsPayload,
  ) {
    const user = this.requireAuthenticatedUser(client);
    const boardId = this.parseBoardId(body?.boardId);
    const oldIndex = this.parseNonNegativeInt(body?.oldIndex, 'oldIndex');
    const newIndex = this.parseNonNegativeInt(body?.newIndex, 'newIndex');

    try {
      const columns = await this.retroService.reorderColumns(
        boardId,
        user.id,
        oldIndex,
        newIndex,
      );
      client
        .to(this.getBoardRoom(boardId))
        .emit('board.columns.reordered', { boardId, columns });
      return columns;
    } catch (error) {
      if (error instanceof HttpException) {
        throw new WsException(error.message);
      }

      throw new WsException('Failed to reorder board columns');
    }
  }

  private extractAuthToken(client: Socket): string {
    const token = client.handshake.auth?.token;

    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('Unauthorized');
    }

    return token.trim();
  }

  private requireAuthenticatedUser(client: Socket): WsUser {
    const user = client.data.user as WsUser | undefined;
    if (!user) {
      throw new WsException('Unauthorized');
    }

    return user;
  }

  private parseBoardId(boardId: unknown): number {
    if (typeof boardId !== 'number' || !Number.isInteger(boardId) || boardId < 1) {
      throw new WsException('boardId must be a positive integer');
    }

    return boardId;
  }

  private parseBoardName(name: unknown): string {
    if (typeof name !== 'string' || !name.trim()) {
      throw new WsException('name must be a non-empty string');
    }

    return name.trim();
  }

  private parseNonNegativeInt(value: unknown, fieldName: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new WsException(`${fieldName} must be a non-negative integer`);
    }

    return value;
  }

  private getBoardRoom(boardId: number): string {
    return `board:${boardId}`;
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
