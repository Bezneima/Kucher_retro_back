import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ColumnColorDto, CreateBoardDto, ItemPositionChangeDto } from './dto/retro.dto';

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

type ColumnColors = {
  columnColor: string;
  itemColor: string;
  buttonColor: string;
};

const DEFAULT_COLUMN_COLORS: [ColumnColors, ColumnColors, ColumnColors] = [
  {
    columnColor: '#FFDBD7',
    itemColor: '#FF6161',
    buttonColor: '#FF9594',
  },
  {
    columnColor: '#B4DFC4',
    itemColor: '#7FBF7F',
    buttonColor: '#96CD9D',
  },
  {
    columnColor: '#D7CEF9',
    itemColor: '#AB99ED',
    buttonColor: '#C1B3F3',
  },
];

@Injectable()
export class RetroService {
  constructor(private readonly prisma: PrismaService) {}

  async createBoard(userId: string, dto: CreateBoardDto) {
    await this.ensureTeamAdminOrOwner(dto.teamId, userId);

    const board = await this.prisma.retroBoard.create({
      data: {
        teamId: dto.teamId,
        name: dto.name ?? 'New board',
        date: dto.date ? new Date(dto.date) : new Date(),
        description: dto.description ?? '',
        columns: {
          create: [
            {
              name: 'Что было хорошо?',
              color: DEFAULT_COLUMN_COLORS[0] satisfies Prisma.InputJsonValue,
              orderIndex: 0,
            },
            {
              name: 'Что могло быть лучше?',
              color: DEFAULT_COLUMN_COLORS[1] satisfies Prisma.InputJsonValue,
              orderIndex: 1,
            },
            {
              name: 'Actions points',
              color: DEFAULT_COLUMN_COLORS[2] satisfies Prisma.InputJsonValue,
              orderIndex: 2,
            },
          ],
        },
      },
      include: BOARD_INCLUDE,
    });

    return this.mapBoard(board);
  }

  async getBoards(userId: string, teamId?: number) {
    if (teamId !== undefined) {
      await this.ensureTeamMember(teamId, userId);
    }

    const boards = await this.prisma.retroBoard.findMany({
      where: {
        ...(teamId !== undefined ? { teamId } : {}),
        team: {
          members: {
            some: { userId },
          },
        },
      },
      include: BOARD_INCLUDE,
      orderBy: { id: 'asc' },
    });

    return boards.map((board) => this.mapBoard(board));
  }

  async getBoardColumns(boardId: number, userId: string) {
    const board = await this.getBoardOrFail(boardId, userId);
    return this.mapBoard(board).columns;
  }

  async createColumn(
    boardId: number,
    userId: string,
    name?: string,
    description?: string,
    color?: ColumnColorDto,
  ) {
    await this.ensureBoardAccessible(boardId, userId);

    const lastColumn = await this.prisma.retroColumn.findFirst({
      where: {
        boardId,
      },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const createdColumn = await this.prisma.retroColumn.create({
      data: {
        boardId,
        name: name ?? 'Новая колонка',
        description: description ?? '',
        color: this.toColumnColorsInput(color ?? DEFAULT_COLUMN_COLORS[0]),
        orderIndex: lastColumn ? lastColumn.orderIndex + 1 : 0,
      },
    });

    return {
      id: createdColumn.id,
      name: createdColumn.name,
      description: createdColumn.description,
      color: createdColumn.color,
      isNameEditing: false,
      items: [],
    };
  }

  async addItemToColumn(columnId: number, userId: string, description?: string) {
    const column = await this.prisma.retroColumn.findFirst({
      where: {
        id: columnId,
        board: {
          team: {
            members: {
              some: { userId },
            },
          },
        },
      },
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

  async updateColumnName(columnId: number, userId: string, name: string) {
    await this.ensureColumnAccessible(columnId, userId);
    return this.prisma.retroColumn.update({
      where: { id: columnId },
      data: { name },
    });
  }

  async updateColumnColor(columnId: number, userId: string, color: ColumnColorDto) {
    await this.ensureColumnAccessible(columnId, userId);
    return this.prisma.retroColumn.update({
      where: { id: columnId },
      data: { color: this.toColumnColorsInput(color) },
    });
  }

  async updateColumnDescription(columnId: number, userId: string, description: string) {
    await this.ensureColumnAccessible(columnId, userId);
    return this.prisma.retroColumn.update({
      where: { id: columnId },
      data: { description },
    });
  }

  async updateItemDescription(itemId: number, userId: string, description: string) {
    await this.ensureItemAccessible(itemId, userId);
    return this.prisma.retroItem.update({
      where: { id: itemId },
      data: { description },
    });
  }

  async toggleItemLike(itemId: number, userId: string) {
    const item = await this.prisma.retroItem.findFirst({
      where: {
        id: itemId,
        column: {
          board: {
            team: {
              members: {
                some: { userId },
              },
            },
          },
        },
      },
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

  async updateItemColor(itemId: number, userId: string, color?: string) {
    await this.ensureItemAccessible(itemId, userId);
    return this.prisma.retroItem.update({
      where: { id: itemId },
      data: { color: color ?? null },
    });
  }

  async reorderColumns(boardId: number, userId: string, oldIndex: number, newIndex: number) {
    await this.ensureBoardAccessible(boardId, userId);

    const columns = await this.prisma.retroColumn.findMany({
      where: {
        boardId,
      },
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

    return this.getBoardColumns(boardId, userId);
  }

  async syncItemPositions(boardId: number, userId: string, changes: ItemPositionChangeDto[]) {
    if (changes.length === 0) {
      return { updated: 0 };
    }

    await this.ensureBoardAccessible(boardId, userId);

    const columns = await this.prisma.retroColumn.findMany({
      where: {
        boardId,
      },
      select: { id: true },
    });

    if (columns.length === 0) {
      throw new NotFoundException(`Board ${boardId} has no columns`);
    }

    const allowedColumnIds = new Set(columns.map((column) => column.id));

    for (const change of changes) {
      if (!allowedColumnIds.has(change.newColumnId)) {
        throw new BadRequestException(`Column id ${change.newColumnId} not found`);
      }
    }

    const uniqueItemIds = Array.from(new Set(changes.map((change) => change.itemId)));

    const items = await this.prisma.retroItem.findMany({
      where: {
        id: { in: uniqueItemIds },
        column: {
          boardId,
        },
      },
      select: { id: true },
    });

    if (items.length !== uniqueItemIds.length) {
      throw new NotFoundException('One or more items not found');
    }

    await this.prisma.$transaction(
      changes.map((change) =>
        this.prisma.retroItem.update({
          where: { id: change.itemId },
          data: {
            columnId: change.newColumnId,
            rowIndex: change.newRowIndex,
          },
        }),
      ),
    );

    return { updated: changes.length };
  }

  async deleteColumn(columnId: number, userId: string) {
    const column = await this.prisma.retroColumn.findFirst({
      where: {
        id: columnId,
        board: {
          team: {
            members: {
              some: { userId },
            },
          },
        },
      },
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

  async deleteItem(itemId: number, userId: string) {
    await this.ensureItemAccessible(itemId, userId);

    await this.prisma.retroItem.delete({
      where: { id: itemId },
    });

    return { deleted: true };
  }

  private async getBoardOrFail(boardId: number, userId: string) {
    const board = await this.prisma.retroBoard.findFirst({
      where: {
        id: boardId,
        team: {
          members: {
            some: { userId },
          },
        },
      },
      include: BOARD_INCLUDE,
    });

    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    return board;
  }

  private async ensureTeamMember(teamId: number, userId: string) {
    const teamMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!teamMember) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }
  }

  private async ensureTeamAdminOrOwner(teamId: number, userId: string) {
    const teamMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!teamMember) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    if (teamMember.role === TeamRole.MEMBER) {
      throw new ForbiddenException('Insufficient permissions to create board');
    }
  }

  private async ensureBoardAccessible(boardId: number, userId: string) {
    const board = await this.prisma.retroBoard.findFirst({
      where: {
        id: boardId,
        team: {
          members: {
            some: { userId },
          },
        },
      },
      select: { id: true, teamId: true },
    });

    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }
  }

  private async ensureColumnAccessible(columnId: number, userId: string) {
    const column = await this.prisma.retroColumn.findFirst({
      where: {
        id: columnId,
        board: {
          team: {
            members: {
              some: { userId },
            },
          },
        },
      },
      select: { id: true },
    });

    if (!column) {
      throw new NotFoundException(`Column ${columnId} not found`);
    }
  }

  private async ensureItemAccessible(itemId: number, userId: string) {
    const item = await this.prisma.retroItem.findFirst({
      where: {
        id: itemId,
        column: {
          board: {
            team: {
              members: {
                some: { userId },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }
  }

  private mapBoard(board: RetroBoardWithColumns) {
    return {
      id: board.id,
      teamId: board.teamId,
      name: board.name,
      date: board.date.toISOString().slice(0, 10),
      description: board.description,
      columns: board.columns.map((column) => ({
        id: column.id,
        name: column.name,
        description: column.description,
        color: this.toColumnColors(column.color),
        isNameEditing: false,
        items: column.items.map((item) => ({
          id: item.id,
          description: item.description,
          createdAt: item.createdAt,
          likes: item.likes,
          color: item.color ?? undefined,
          columnIndex: column.orderIndex,
          rowIndex: item.rowIndex,
        })),
      })),
    };
  }

  private toColumnColors(color: Prisma.JsonValue): ColumnColors {
    if (typeof color === 'object' && color !== null && !Array.isArray(color)) {
      const value = color as Record<string, unknown>;
      const columnColor = value.columnColor;
      const itemColor = value.itemColor;
      const buttonColor = value.buttonColor;
      if (
        typeof columnColor === 'string' &&
        typeof itemColor === 'string' &&
        typeof buttonColor === 'string'
      ) {
        return { columnColor, itemColor, buttonColor };
      }
    }

    if (typeof color === 'string') {
      return {
        columnColor: color,
        itemColor: color,
        buttonColor: color,
      };
    }

    return DEFAULT_COLUMN_COLORS[0];
  }

  private toColumnColorsInput(color: ColumnColors): Prisma.InputJsonObject {
    return {
      columnColor: color.columnColor,
      itemColor: color.itemColor,
      buttonColor: color.buttonColor,
    };
  }
}
