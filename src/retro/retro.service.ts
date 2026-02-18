import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardDto, ItemPositionChangeDto } from './dto/retro.dto';

const BOARD_INCLUDE = {
  columns: {
    orderBy: { orderIndex: 'asc' },
    include: {
      items: {
        orderBy: { rowIndex: 'asc' },
      },
    },
  },
} satisfies Prisma.RetroBoardInclude;
type RetroBoardWithColumns = Prisma.RetroBoardGetPayload<{
  include: typeof BOARD_INCLUDE;
}>;

@Injectable()
export class RetroService {
  constructor(private readonly prisma: PrismaService) {}

  async createBoardForUser(userId: string, dto: CreateBoardDto) {
    const board = await this.prisma.retroBoard.create({
      data: {
        userId,
        name: dto.name ?? 'New board',
        date: dto.date ? new Date(dto.date) : new Date(),
        description: dto.description ?? '',
        columns: {
          create: [
            {
              name: 'Что было хорошо?',
              color: '#34d399',
              orderIndex: 0,
            },
            {
              name: 'Что могло быть лучше?',
              color: '#f87171',
              orderIndex: 1,
            },
            {
              name: 'Actions points',
              color: '#c084fc',
              orderIndex: 2,
            },
          ],
        },
      },
      include: BOARD_INCLUDE,
    });

    return this.mapBoard(board);
  }

  async getBoards(userId?: string) {
    const boards = await this.prisma.retroBoard.findMany({
      where: userId ? { userId } : undefined,
      include: BOARD_INCLUDE,
      orderBy: { id: 'asc' },
    });
    return boards.map((board) => this.mapBoard(board));
  }

  async getBoardColumns(boardId: number) {
    const board = await this.getBoardOrFail(boardId);
    return this.mapBoard(board).columns;
  }

  async createColumn(boardId: number, name?: string, color?: string) {
    const board = await this.prisma.retroBoard.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    const lastColumn = await this.prisma.retroColumn.findFirst({
      where: { boardId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const createdColumn = await this.prisma.retroColumn.create({
      data: {
        boardId,
        name: name ?? 'Новая колонка',
        color: color ?? '#60a5fa',
        orderIndex: lastColumn ? lastColumn.orderIndex + 1 : 0,
      },
    });

    return {
      id: createdColumn.id,
      name: createdColumn.name,
      color: createdColumn.color,
      isNameEditing: false,
      items: [],
    };
  }

  async addItemToColumn(columnId: number, description?: string) {
    const column = await this.prisma.retroColumn.findUnique({
      where: { id: columnId },
      select: { id: true, orderIndex: true },
    });
    if (!column) {
      throw new NotFoundException(`Column ${columnId} not found`);
    }

    const createdItem = await this.prisma.$transaction(async (tx) => {
      await tx.retroItem.updateMany({
        where: { columnId },
        data: { rowIndex: { increment: 1 } },
      });

      return tx.retroItem.create({
        data: {
          description: description ?? 'Напишите описание нового элемента',
          likes: [],
          rowIndex: 0,
          columnId,
        },
      });
    });

    return {
      ...createdItem,
      columnIndex: column.orderIndex,
    };
  }

  async updateColumnName(columnId: number, name: string) {
    try {
      return await this.prisma.retroColumn.update({
        where: { id: columnId },
        data: { name },
      });
    } catch {
      throw new NotFoundException(`Column ${columnId} not found`);
    }
  }

  async updateColumnColor(columnId: number, color: string) {
    try {
      return await this.prisma.retroColumn.update({
        where: { id: columnId },
        data: { color },
      });
    } catch {
      throw new NotFoundException(`Column ${columnId} not found`);
    }
  }

  async updateItemDescription(itemId: number, description: string) {
    try {
      return await this.prisma.retroItem.update({
        where: { id: itemId },
        data: { description },
      });
    } catch {
      throw new NotFoundException(`Item ${itemId} not found`);
    }
  }

  async toggleItemLike(itemId: number, userId: string) {
    const item = await this.prisma.retroItem.findUnique({
      where: { id: itemId },
      select: { likes: true },
    });
    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }

    const likes = [...item.likes];
    const index = likes.indexOf(userId);
    if (index === -1) {
      likes.push(userId);
    } else {
      likes.splice(index, 1);
    }

    return this.prisma.retroItem.update({
      where: { id: itemId },
      data: { likes },
    });
  }

  async updateItemColor(itemId: number, color?: string) {
    try {
      return await this.prisma.retroItem.update({
        where: { id: itemId },
        data: { color: color ?? null },
      });
    } catch {
      throw new NotFoundException(`Item ${itemId} not found`);
    }
  }

  async reorderColumns(boardId: number, oldIndex: number, newIndex: number) {
    const columns = await this.prisma.retroColumn.findMany({
      where: { boardId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, orderIndex: true },
    });
    if (columns.length === 0) {
      throw new NotFoundException(`Board ${boardId} has no columns`);
    }
    if (
      oldIndex < 0 ||
      newIndex < 0 ||
      oldIndex >= columns.length ||
      newIndex >= columns.length
    ) {
      throw new BadRequestException('Invalid oldIndex/newIndex');
    }

    const reordered = [...columns];
    const removed = reordered.splice(oldIndex, 1)[0];
    reordered.splice(newIndex, 0, removed);

    await this.prisma.$transaction(
      reordered.map((column, index) =>
        this.prisma.retroColumn.update({
          where: { id: column.id },
          data: { orderIndex: index },
        }),
      ),
    );

    return this.getBoardColumns(boardId);
  }

  async syncItemPositions(boardId: number, changes: ItemPositionChangeDto[]) {
    if (changes.length === 0) {
      return { updated: 0 };
    }

    const columns = await this.prisma.retroColumn.findMany({
      where: { boardId },
      select: { id: true },
    });
    if (columns.length === 0) {
      throw new NotFoundException(`Board ${boardId} has no columns`);
    }

    const allowedColumnIds = new Set(columns.map((column) => column.id));

    await this.prisma.$transaction(
      changes.map((change) => {
        if (!allowedColumnIds.has(change.newColumnId)) {
          throw new BadRequestException(
            `Column id ${change.newColumnId} not found`,
          );
        }

        return this.prisma.retroItem.update({
          where: { id: change.itemId },
          data: {
            columnId: change.newColumnId,
            rowIndex: change.newRowIndex,
          },
        });
      }),
    );

    return { updated: changes.length };
  }

  async deleteColumn(columnId: number) {
    const column = await this.prisma.retroColumn.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true, orderIndex: true },
    });
    if (!column) {
      throw new NotFoundException(`Column ${columnId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.retroColumn.delete({
        where: { id: columnId },
      });

      await tx.retroColumn.updateMany({
        where: {
          boardId: column.boardId,
          orderIndex: { gt: column.orderIndex },
        },
        data: { orderIndex: { decrement: 1 } },
      });
    });

    return { deleted: true };
  }

  async deleteItem(itemId: number) {
    try {
      await this.prisma.retroItem.delete({
        where: { id: itemId },
      });
      return { deleted: true };
    } catch {
      throw new NotFoundException(`Item ${itemId} not found`);
    }
  }

  private async getBoardOrFail(boardId: number) {
    const board = await this.prisma.retroBoard.findUnique({
      where: { id: boardId },
      include: BOARD_INCLUDE,
    });
    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }
    return board;
  }

  private mapBoard(board: RetroBoardWithColumns) {
    return {
      id: board.id,
      name: board.name,
      date: board.date.toISOString().slice(0, 10),
      description: board.description,
      columns: board.columns.map((column) => ({
        id: column.id,
        name: column.name,
        color: column.color,
        isNameEditing: false,
        items: column.items.map((item) => ({
          id: item.id,
          description: item.description,
          likes: item.likes,
          color: item.color ?? undefined,
          columnIndex: column.orderIndex,
          rowIndex: item.rowIndex,
        })),
      })),
    };
  }
}
