import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ColumnColorDto,
  CreateBoardDto,
  GroupPositionChangeDto,
  ItemPositionChangeDto,
} from './dto/retro.dto';

const ITEM_WITH_COMMENTS_COUNT_INCLUDE = {
  _count: {
    select: { comments: true },
  },
} satisfies Prisma.RetroItemInclude;

const GROUP_ITEMS_INCLUDE = {
  items: {
    orderBy: [{ rowIndex: 'asc' }, { id: 'asc' }],
    include: ITEM_WITH_COMMENTS_COUNT_INCLUDE,
  },
} satisfies Prisma.RetroGroupInclude;

const COLUMN_WITH_GROUPS_INCLUDE = {
  items: {
    where: { groupId: null },
    orderBy: { rowIndex: 'asc' },
    include: ITEM_WITH_COMMENTS_COUNT_INCLUDE,
  },
  groups: {
    orderBy: { orderIndex: 'asc' },
    include: GROUP_ITEMS_INCLUDE,
  },
} satisfies Prisma.RetroColumnInclude;

const BOARD_INCLUDE = {
  team: {
    select: {
      isAllCardsHidden: true,
    },
  },
  columns: {
    orderBy: { orderIndex: 'asc' },
    include: COLUMN_WITH_GROUPS_INCLUDE,
  },
} satisfies Prisma.RetroBoardInclude;

type RetroBoardWithColumns = Prisma.RetroBoardGetPayload<{
  include: typeof BOARD_INCLUDE;
}>;
type RetroBoardColumn = RetroBoardWithColumns['columns'][number];
type RetroBoardGroup = RetroBoardColumn['groups'][number];
type RetroColumnWithItems = Prisma.RetroColumnGetPayload<{
  include: typeof COLUMN_WITH_GROUPS_INCLUDE;
}>;
type RetroGroupWithItems = Prisma.RetroGroupGetPayload<{
  include: typeof GROUP_ITEMS_INCLUDE;
}>;
type RetroItemWithCount = Prisma.RetroItemGetPayload<{
  include: typeof ITEM_WITH_COMMENTS_COUNT_INCLUDE;
}>;

const COMMENT_INCLUDE = {
  creator: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} satisfies Prisma.RetroItemCommentInclude;

type RetroItemCommentWithCreator = Prisma.RetroItemCommentGetPayload<{
  include: typeof COMMENT_INCLUDE;
}>;

type RootEntryType = 'ITEM' | 'GROUP';
type RootEntryMoveMeta = {
  oldIndex?: number;
  newIndex: number;
  changeOrder: number;
};

type ColumnColors = {
  columnColor: string;
  itemColor: string;
  buttonColor: string;
};

const AVAILABLE_COLUMN_COLORS: readonly ColumnColors[] = [
  // Red
  {
    columnColor: '#FFDBD7',
    itemColor: '#FF6161',
    buttonColor: '#FF9594',
  },
  // Orange
  {
    columnColor: '#FFE0A0',
    itemColor: '#FFB061',
    buttonColor: '#FFC37A',
  },
  // Yellow
  {
    columnColor: '#F9E99E',
    itemColor: '#FED13E',
    buttonColor: '#FCDC69',
  },
  // Green
  {
    columnColor: '#B4DFC4',
    itemColor: '#7FBF7F',
    buttonColor: '#96CD9D',
  },
  // Blue
  {
    columnColor: '#B6D9F7',
    itemColor: '#5FB0EF',
    buttonColor: '#8AC4F3',
  },
  // Pink
  {
    columnColor: '#FFD8F0',
    itemColor: '#E49EE5',
    buttonColor: '#E49EE5',
  },
  // Purple
  {
    columnColor: '#D7CEF9',
    itemColor: '#AB99ED',
    buttonColor: '#C1B3F3',
  },
] as const;

const DEFAULT_COLUMN_COLORS: [ColumnColors, ColumnColors, ColumnColors] = [
  AVAILABLE_COLUMN_COLORS[0],
  AVAILABLE_COLUMN_COLORS[3],
  AVAILABLE_COLUMN_COLORS[6],
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

    return boards.map((board: RetroBoardWithColumns) => this.mapBoard(board));
  }

  async getBoardColumns(boardId: number, userId: string) {
    const board = await this.getBoardOrFail(boardId, userId);
    return this.mapBoard(board).columns;
  }

  async getBoardRealtimeContext(boardId: number, userId: string) {
    const board = await this.prisma.retroBoard.findFirst({
      where: {
        id: boardId,
        team: {
          members: {
            some: { userId },
          },
        },
      },
      select: { teamId: true },
    });

    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    return {
      teamId: board.teamId,
      boardId,
    };
  }

  async getColumnRealtimeContext(columnId: number, userId: string) {
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
      select: {
        id: true,
        board: {
          select: {
            id: true,
            teamId: true,
          },
        },
      },
    });

    if (!column) {
      throw new NotFoundException(`Column ${columnId} not found`);
    }

    return {
      teamId: column.board.teamId,
      boardId: column.board.id,
      columnId: column.id,
    };
  }

  async getGroupRealtimeContext(groupId: number, userId: string) {
    const group = await this.prisma.retroGroup.findFirst({
      where: {
        id: groupId,
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
      select: {
        id: true,
        column: {
          select: {
            id: true,
            board: {
              select: {
                id: true,
                teamId: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    return {
      teamId: group.column.board.teamId,
      boardId: group.column.board.id,
      columnId: group.column.id,
      groupId: group.id,
    };
  }

  async getItemRealtimeContext(itemId: number, userId: string) {
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
      select: {
        id: true,
        column: {
          select: {
            id: true,
            board: {
              select: {
                id: true,
                teamId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }

    return {
      teamId: item.column.board.teamId,
      boardId: item.column.board.id,
      itemId: item.id,
      columnId: item.column.id,
    };
  }

  async getCommentRealtimeContext(commentId: number, userId: string) {
    const comment = await this.prisma.retroItemComment.findFirst({
      where: {
        id: commentId,
        item: {
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
      },
      select: {
        id: true,
        item: {
          select: {
            id: true,
            column: {
              select: {
                board: {
                  select: {
                    id: true,
                    teamId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    return {
      teamId: comment.item.column.board.teamId,
      boardId: comment.item.column.board.id,
      commentId: comment.id,
      itemId: comment.item.id,
    };
  }

  async updateBoardName(boardId: number, userId: string, name: string) {
    await this.ensureBoardAdminOrOwner(boardId, userId);

    const board = await this.prisma.retroBoard.update({
      where: { id: boardId },
      data: { name },
      include: BOARD_INCLUDE,
    });

    return this.mapBoard(board);
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
      color: this.toColumnColors(createdColumn.color),
      isNameEditing: false,
      items: [],
      groups: [],
      entries: [],
    };
  }

  async createGroup(
    columnId: number,
    userId: string,
    name?: string,
    description?: string,
  ) {
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
      select: {
        color: true,
      },
    });

    if (!column) {
      throw new NotFoundException(`Column ${columnId} not found`);
    }

    const createdGroup = await this.prisma.retroGroup.create({
      data: {
        columnId,
        name: name ?? 'Новая группа',
        description: description ?? '',
        color: this.toColumnColorsInput(
          this.getAlternativeGroupColor(this.toColumnColors(column.color)),
        ),
        orderIndex: await this.getNextRootEntryIndex(columnId),
      },
    });

    return {
      id: createdGroup.id,
      columnId: createdGroup.columnId,
      name: createdGroup.name,
      description: createdGroup.description,
      color: this.toColumnColors(createdGroup.color),
      orderIndex: createdGroup.orderIndex,
      isNameEditing: false,
      items: [],
    };
  }

  async addItemToColumn(
    columnId: number,
    userId: string,
    description?: string,
    groupId?: number | null,
  ) {
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
      select: {
        id: true,
        orderIndex: true,
        board: {
          select: {
            team: {
              select: {
                isAllCardsHidden: true,
              },
            },
          },
        },
      },
    });

    if (!column) {
      throw new NotFoundException(`Column ${columnId} not found`);
    }

    const normalizedGroupId = groupId ?? null;

    if (normalizedGroupId !== null) {
      const group = await this.prisma.retroGroup.findFirst({
        where: {
          id: normalizedGroupId,
          columnId,
        },
        select: { id: true },
      });

      if (!group) {
        throw new BadRequestException(
          `Group id ${normalizedGroupId} not found in column ${columnId}`,
        );
      }
    }

    const createdItem = await this.prisma.$transaction(async (tx) => {
      if (normalizedGroupId === null) {
        await Promise.all([
          tx.retroItem.updateMany({
            where: {
              columnId,
              groupId: null,
            },
            data: { rowIndex: { increment: 1 } },
          }),
          tx.retroGroup.updateMany({
            where: {
              columnId,
            },
            data: { orderIndex: { increment: 1 } },
          }),
        ]);
      } else {
        await tx.retroItem.updateMany({
          where: {
            columnId,
            groupId: normalizedGroupId,
          },
          data: { rowIndex: { increment: 1 } },
        });
      }

      return tx.retroItem.create({
        data: {
          description: description ?? 'Напишите описание нового элемента',
          likes: [],
          rowIndex: 0,
          columnId,
          groupId: normalizedGroupId,
        },
        include: ITEM_WITH_COMMENTS_COUNT_INCLUDE,
      });
    });

    return {
      ...this.mapItem(
        createdItem,
        column.orderIndex,
        column.board.team.isAllCardsHidden,
      ),
    };
  }

  async updateColumnName(columnId: number, userId: string, name: string) {
    await this.ensureColumnAccessible(columnId, userId);
    return this.prisma.retroColumn.update({
      where: { id: columnId },
      data: { name },
    });
  }

  async updateColumnColor(
    columnId: number,
    userId: string,
    color: ColumnColorDto,
  ) {
    await this.ensureColumnAccessible(columnId, userId);
    return this.prisma.retroColumn.update({
      where: { id: columnId },
      data: { color: this.toColumnColorsInput(color) },
    });
  }

  async updateColumnDescription(
    columnId: number,
    userId: string,
    description: string,
  ) {
    await this.ensureColumnAccessible(columnId, userId);
    return this.prisma.retroColumn.update({
      where: { id: columnId },
      data: { description },
    });
  }

  async updateGroupName(groupId: number, userId: string, name: string) {
    await this.ensureGroupAccessible(groupId, userId);
    return this.prisma.retroGroup.update({
      where: { id: groupId },
      data: { name },
    });
  }

  async updateGroupColor(groupId: number, userId: string, color: ColumnColorDto) {
    await this.ensureGroupAccessible(groupId, userId);
    return this.prisma.retroGroup.update({
      where: { id: groupId },
      data: { color: this.toColumnColorsInput(color) },
    });
  }

  async updateGroupDescription(
    groupId: number,
    userId: string,
    description: string,
  ) {
    await this.ensureGroupAccessible(groupId, userId);
    return this.prisma.retroGroup.update({
      where: { id: groupId },
      data: { description },
    });
  }

  async updateItemDescription(
    itemId: number,
    userId: string,
    description: string,
  ) {
    await this.ensureItemAccessible(itemId, userId);

    const isAllCardsHidden = await this.getIsAllCardsHiddenByItemId(itemId);

    const updatedItem = await this.prisma.retroItem.update({
      where: { id: itemId },
      data: { description },
    });

    return {
      ...updatedItem,
      description: this.maskItemDescription(
        updatedItem.description,
        isAllCardsHidden,
      ),
    };
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
      select: {
        likes: true,
        column: {
          select: {
            board: {
              select: {
                team: {
                  select: {
                    isAllCardsHidden: true,
                  },
                },
              },
            },
          },
        },
      },
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

    const updatedItem = await this.prisma.retroItem.update({
      where: { id: itemId },
      data: { likes },
    });

    return {
      ...updatedItem,
      description: this.maskItemDescription(
        updatedItem.description,
        item.column.board.team.isAllCardsHidden,
      ),
    };
  }

  async updateItemColor(itemId: number, userId: string, color?: string) {
    await this.ensureItemAccessible(itemId, userId);

    const isAllCardsHidden = await this.getIsAllCardsHiddenByItemId(itemId);

    const updatedItem = await this.prisma.retroItem.update({
      where: { id: itemId },
      data: { color: color ?? null },
    });

    return {
      ...updatedItem,
      description: this.maskItemDescription(
        updatedItem.description,
        isAllCardsHidden,
      ),
    };
  }

  async getItemComments(itemId: number, userId: string) {
    await this.ensureItemAccessible(itemId, userId);

    const comments = await this.prisma.retroItemComment.findMany({
      where: { itemId },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((comment: RetroItemCommentWithCreator) =>
      this.mapComment(comment),
    );
  }

  async createItemComment(itemId: number, userId: string, text: string) {
    await this.ensureItemAccessible(itemId, userId);

    const comment = await this.prisma.retroItemComment.create({
      data: {
        itemId,
        creatorId: userId,
        text,
      },
      include: COMMENT_INCLUDE,
    });

    return this.mapComment(comment);
  }

  async updateItemComment(commentId: number, userId: string, text: string) {
    await this.ensureCommentManageAccess(commentId, userId);

    const comment = await this.prisma.retroItemComment.update({
      where: { id: commentId },
      data: { text },
      include: COMMENT_INCLUDE,
    });

    return this.mapComment(comment);
  }

  async deleteItemComment(commentId: number, userId: string) {
    await this.ensureCommentManageAccess(commentId, userId);

    await this.prisma.retroItemComment.delete({
      where: { id: commentId },
    });

    return { deleted: true };
  }

  async reorderColumns(
    boardId: number,
    userId: string,
    oldIndex: number,
    newIndex: number,
  ) {
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

  async syncGroupPositions(
    boardId: number,
    userId: string,
    changes: GroupPositionChangeDto[],
  ) {
    if (changes.length === 0) {
      return {
        boardId,
        updated: 0,
        changedColumnIds: [],
        columns: [],
      };
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

    const allowedColumnIds = new Set(
      columns.map((column: { id: number }) => column.id),
    );

    for (const change of changes) {
      if (!allowedColumnIds.has(change.newColumnId)) {
        throw new BadRequestException(
          `Column id ${change.newColumnId} not found`,
        );
      }
    }

    const uniqueGroupIds = Array.from(
      new Set(changes.map((change) => change.groupId)),
    );

    const groups = await this.prisma.retroGroup.findMany({
      where: {
        id: { in: uniqueGroupIds },
        column: {
          boardId,
        },
      },
      select: {
        id: true,
        columnId: true,
        orderIndex: true,
      },
    });

    if (groups.length !== uniqueGroupIds.length) {
      throw new NotFoundException('One or more groups not found');
    }

    const changedColumnIdsSet = new Set<number>();

    for (const group of groups) {
      changedColumnIdsSet.add(group.columnId);
    }

    for (const change of changes) {
      changedColumnIdsSet.add(change.newColumnId);
    }

    const groupById = new Map(groups.map((group) => [group.id, group]));
    const preferredEntriesByColumn = new Map<number, Map<string, RootEntryMoveMeta>>();
    for (let changeOrder = 0; changeOrder < changes.length; changeOrder += 1) {
      const change = changes[changeOrder];
      const previousGroup = groupById.get(change.groupId);
      this.setRootEntryMoveMeta(preferredEntriesByColumn, {
        columnId: change.newColumnId,
        key: this.createRootEntryKey('GROUP', change.groupId),
        newIndex: change.newOrderIndex,
        oldIndex:
          previousGroup && previousGroup.columnId === change.newColumnId
            ? previousGroup.orderIndex
            : undefined,
        changeOrder,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const change of changes) {
        const previousGroup = groupById.get(change.groupId);
        await tx.retroGroup.update({
          where: {
            id: change.groupId,
          },
          data: {
            columnId: change.newColumnId,
            orderIndex: change.newOrderIndex,
          },
        });

        if (previousGroup && previousGroup.columnId !== change.newColumnId) {
          await tx.retroItem.updateMany({
            where: {
              groupId: change.groupId,
            },
            data: {
              columnId: change.newColumnId,
            },
          });
        }
      }

      for (const columnId of changedColumnIdsSet) {
        await this.normalizeColumnRootEntryOrder(
          tx,
          columnId,
          preferredEntriesByColumn.get(columnId),
        );
      }
    });

    const [board, changedColumns] = await Promise.all([
      this.prisma.retroBoard.findUnique({
        where: { id: boardId },
        select: {
          team: {
            select: {
              isAllCardsHidden: true,
            },
          },
        },
      }),
      this.prisma.retroColumn.findMany({
        where: {
          boardId,
          id: {
            in: Array.from(changedColumnIdsSet),
          },
        },
        orderBy: { orderIndex: 'asc' },
        include: COLUMN_WITH_GROUPS_INCLUDE,
      }),
    ]);

    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    return {
      boardId,
      updated: changes.length,
      changedColumnIds: changedColumns.map((column) => column.id),
      columns: changedColumns.map((column) =>
        this.mapColumn(column, board.team.isAllCardsHidden),
      ),
    };
  }

  async syncItemPositions(
    boardId: number,
    userId: string,
    changes: ItemPositionChangeDto[],
  ) {
    if (changes.length === 0) {
      return {
        boardId,
        updated: 0,
        changedColumnIds: [],
        columns: [],
      };
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

    const allowedColumnIds = new Set(
      columns.map((column: { id: number }) => column.id),
    );

    for (const change of changes) {
      if (!allowedColumnIds.has(change.newColumnId)) {
        throw new BadRequestException(
          `Column id ${change.newColumnId} not found`,
        );
      }
    }

    const uniqueTargetGroupIds = Array.from(
      new Set(
        changes
          .map((change) => change.newGroupId)
          .filter((groupId): groupId is number => groupId !== null && groupId !== undefined),
      ),
    );

    const groupById = new Map<number, { id: number; columnId: number }>();

    if (uniqueTargetGroupIds.length > 0) {
      const groups = await this.prisma.retroGroup.findMany({
        where: {
          id: {
            in: uniqueTargetGroupIds,
          },
          column: {
            boardId,
          },
        },
        select: {
          id: true,
          columnId: true,
        },
      });

      if (groups.length !== uniqueTargetGroupIds.length) {
        throw new BadRequestException('One or more target groups not found');
      }

      for (const group of groups) {
        groupById.set(group.id, group);
      }

      for (const change of changes) {
        if (change.newGroupId === null || change.newGroupId === undefined) {
          continue;
        }

        const targetGroup = groupById.get(change.newGroupId);
        if (!targetGroup || targetGroup.columnId !== change.newColumnId) {
          throw new BadRequestException(
            `Group id ${change.newGroupId} does not belong to column id ${change.newColumnId}`,
          );
        }
      }
    }

    const uniqueItemIds = Array.from(
      new Set(changes.map((change) => change.itemId)),
    );

    const items = await this.prisma.retroItem.findMany({
      where: {
        id: { in: uniqueItemIds },
        column: {
          boardId,
        },
      },
      select: { id: true, columnId: true, groupId: true, rowIndex: true },
    });

    if (items.length !== uniqueItemIds.length) {
      throw new NotFoundException('One or more items not found');
    }
    const itemById = new Map(items.map((item) => [item.id, item]));

    const changedColumnIdsSet = new Set<number>();
    for (const item of items) {
      changedColumnIdsSet.add(item.columnId);
    }
    for (const change of changes) {
      changedColumnIdsSet.add(change.newColumnId);
    }

    const preferredEntriesByColumn = new Map<number, Map<string, RootEntryMoveMeta>>();
    for (let changeOrder = 0; changeOrder < changes.length; changeOrder += 1) {
      const change = changes[changeOrder];
      if (change.newGroupId !== null && change.newGroupId !== undefined) {
        continue;
      }

      const previousItem = itemById.get(change.itemId);
      this.setRootEntryMoveMeta(preferredEntriesByColumn, {
        columnId: change.newColumnId,
        key: this.createRootEntryKey('ITEM', change.itemId),
        newIndex: change.newRowIndex,
        oldIndex:
          previousItem &&
          previousItem.columnId === change.newColumnId &&
          previousItem.groupId === null
            ? previousItem.rowIndex
            : undefined,
        changeOrder,
      });
    }

    const changedGroupIdsSet = new Set<number>();

    await this.prisma.$transaction(async (tx) => {
      for (const change of changes) {
        await tx.retroItem.update({
          where: { id: change.itemId },
          data: {
            columnId: change.newColumnId,
            groupId: change.newGroupId ?? null,
            rowIndex: change.newRowIndex,
          },
        });
      }

      for (const change of changes) {
        const previousItem = itemById.get(change.itemId);
        if (previousItem?.groupId !== null && previousItem?.groupId !== undefined) {
          changedGroupIdsSet.add(previousItem.groupId);
        }
        if (change.newGroupId !== null && change.newGroupId !== undefined) {
          changedGroupIdsSet.add(change.newGroupId);
        }
      }

      for (const groupId of changedGroupIdsSet) {
        await this.normalizeGroupItemsOrder(tx, groupId);
      }
      for (const columnId of changedColumnIdsSet) {
        await this.normalizeColumnRootEntryOrder(
          tx,
          columnId,
          preferredEntriesByColumn.get(columnId),
        );
      }
    });

    const changedColumnIds = Array.from(changedColumnIdsSet);

    const [board, changedColumns] = await Promise.all([
      this.prisma.retroBoard.findUnique({
        where: { id: boardId },
        select: {
          team: {
            select: {
              isAllCardsHidden: true,
            },
          },
        },
      }),
      this.prisma.retroColumn.findMany({
        where: {
          boardId,
          id: {
            in: changedColumnIds,
          },
        },
        orderBy: { orderIndex: 'asc' },
        include: COLUMN_WITH_GROUPS_INCLUDE,
      }),
    ]);

    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    return {
      boardId,
      updated: changes.length,
      changedColumnIds: changedColumns.map((column) => column.id),
      columns: changedColumns.map((column) =>
        this.mapColumn(column, board.team.isAllCardsHidden),
      ),
    };
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

  async deleteGroup(groupId: number, userId: string) {
    const group = await this.prisma.retroGroup.findFirst({
      where: {
        id: groupId,
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
      select: {
        id: true,
        columnId: true,
        orderIndex: true,
      },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      const [ungroupedItems, siblingGroups, groupedItems] = await Promise.all([
        tx.retroItem.findMany({
          where: {
            columnId: group.columnId,
            groupId: null,
          },
          orderBy: { rowIndex: 'asc' },
          select: { id: true, rowIndex: true },
        }),
        tx.retroGroup.findMany({
          where: {
            columnId: group.columnId,
            id: {
              not: groupId,
            },
          },
          orderBy: { orderIndex: 'asc' },
          select: { id: true, orderIndex: true },
        }),
        tx.retroItem.findMany({
          where: {
            groupId,
          },
          orderBy: { rowIndex: 'asc' },
          select: { id: true },
        }),
      ]);

      const rootTokens: Array<{ type: 'ITEM' | 'GROUP'; id: number; index: number }> = [
        ...ungroupedItems.map((item) => ({
          type: 'ITEM' as const,
          id: item.id,
          index: item.rowIndex,
        })),
        ...siblingGroups.map((currentGroup) => ({
          type: 'GROUP' as const,
          id: currentGroup.id,
          index: currentGroup.orderIndex,
        })),
      ].sort((a, b) => a.index - b.index || a.id - b.id);

      const insertAt = Math.max(0, Math.min(group.orderIndex, rootTokens.length));
      rootTokens.splice(
        insertAt,
        0,
        ...groupedItems.map((item) => ({
          type: 'ITEM' as const,
          id: item.id,
          index: -1,
        })),
      );

      await tx.retroItem.updateMany({
        where: {
          groupId,
        },
        data: {
          groupId: null,
        },
      });

      await tx.retroGroup.delete({
        where: { id: groupId },
      });

      for (let index = 0; index < rootTokens.length; index += 1) {
        const token = rootTokens[index];
        if (token.type === 'ITEM') {
          await tx.retroItem.update({
            where: { id: token.id },
            data: { rowIndex: index },
          });
          continue;
        }

        await tx.retroGroup.update({
          where: { id: token.id },
          data: { orderIndex: index },
        });
      }

      await this.normalizeColumnRootEntryOrder(tx, group.columnId);
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

  private async ensureBoardAdminOrOwner(boardId: number, userId: string) {
    const board = await this.prisma.retroBoard.findUnique({
      where: { id: boardId },
      select: { teamId: true },
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
      select: { role: true },
    });

    if (!teamMember) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    if (teamMember.role === TeamRole.MEMBER) {
      throw new ForbiddenException('Insufficient permissions to rename board');
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

  private async ensureGroupAccessible(groupId: number, userId: string) {
    const group = await this.prisma.retroGroup.findFirst({
      where: {
        id: groupId,
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

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
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

  private async ensureCommentManageAccess(commentId: number, userId: string) {
    const comment = await this.prisma.retroItemComment.findFirst({
      where: {
        id: commentId,
        item: {
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
      },
      select: {
        id: true,
        creatorId: true,
        item: {
          select: {
            column: {
              select: {
                board: {
                  select: {
                    teamId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    if (comment.creatorId === userId) {
      return;
    }

    const teamMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: comment.item.column.board.teamId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!teamMember || teamMember.role === TeamRole.MEMBER) {
      throw new ForbiddenException(
        'Insufficient permissions to manage comment',
      );
    }
  }

  private async normalizeGroupItemsOrder(
    tx: Prisma.TransactionClient,
    groupId: number,
  ) {
    const items = await tx.retroItem.findMany({
      where: {
        groupId,
      },
      orderBy: [{ rowIndex: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
      },
    });

    for (let index = 0; index < items.length; index += 1) {
      await tx.retroItem.update({
        where: {
          id: items[index].id,
        },
        data: {
          rowIndex: index,
        },
      });
    }
  }

  private async normalizeColumnRootEntryOrder(
    tx: Prisma.TransactionClient,
    columnId: number,
    preferredEntries?: Map<string, RootEntryMoveMeta>,
  ) {
    const [ungroupedItems, groups] = await Promise.all([
      tx.retroItem.findMany({
        where: {
          columnId,
          groupId: null,
        },
        orderBy: [{ rowIndex: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          rowIndex: true,
        },
      }),
      tx.retroGroup.findMany({
        where: {
          columnId,
        },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          orderIndex: true,
        },
      }),
    ]);

    const entries: Array<{
      type: 'ITEM' | 'GROUP';
      id: number;
      index: number;
    }> = [
      ...ungroupedItems.map((item) => ({
        type: 'ITEM' as const,
        id: item.id,
        index: item.rowIndex,
      })),
      ...groups.map((group) => ({
        type: 'GROUP' as const,
        id: group.id,
        index: group.orderIndex,
      })),
    ].sort((a, b) => {
      if (a.index !== b.index) {
        return a.index - b.index;
      }

      if (preferredEntries) {
        const aMoveMeta = preferredEntries.get(this.createRootEntryKey(a.type, a.id));
        const bMoveMeta = preferredEntries.get(this.createRootEntryKey(b.type, b.id));
        const aPriority = this.getRootEntryTieBreakPriority(aMoveMeta);
        const bPriority = this.getRootEntryTieBreakPriority(bMoveMeta);

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        if (aMoveMeta && bMoveMeta && aMoveMeta.changeOrder !== bMoveMeta.changeOrder) {
          return aMoveMeta.changeOrder - bMoveMeta.changeOrder;
        }
      }

      return a.id - b.id;
    });

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry.type === 'ITEM') {
        await tx.retroItem.update({
          where: {
            id: entry.id,
          },
          data: {
            rowIndex: index,
          },
        });
        continue;
      }

      await tx.retroGroup.update({
        where: {
          id: entry.id,
        },
        data: {
          orderIndex: index,
        },
      });
    }
  }

  private async getNextRootEntryIndex(columnId: number) {
    const [lastUngroupedItem, lastGroup] = await Promise.all([
      this.prisma.retroItem.findFirst({
        where: {
          columnId,
          groupId: null,
        },
        orderBy: { rowIndex: 'desc' },
        select: { rowIndex: true },
      }),
      this.prisma.retroGroup.findFirst({
        where: {
          columnId,
        },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      }),
    ]);

    const maxItemIndex = lastUngroupedItem?.rowIndex ?? -1;
    const maxGroupIndex = lastGroup?.orderIndex ?? -1;
    return Math.max(maxItemIndex, maxGroupIndex) + 1;
  }

  private createRootEntryKey(type: RootEntryType, id: number): string {
    return `${type}:${id}`;
  }

  private setRootEntryMoveMeta(
    metadataByColumn: Map<number, Map<string, RootEntryMoveMeta>>,
    entry: {
      columnId: number;
      key: string;
      oldIndex?: number;
      newIndex: number;
      changeOrder: number;
    },
  ) {
    const current = metadataByColumn.get(entry.columnId) ?? new Map<string, RootEntryMoveMeta>();
    current.set(entry.key, {
      oldIndex: entry.oldIndex,
      newIndex: entry.newIndex,
      changeOrder: entry.changeOrder,
    });
    metadataByColumn.set(entry.columnId, current);
  }

  private getRootEntryTieBreakPriority(moveMeta?: RootEntryMoveMeta): number {
    if (!moveMeta) {
      return 1;
    }
    if (moveMeta.oldIndex === undefined) {
      return 0;
    }
    if (moveMeta.oldIndex > moveMeta.newIndex) {
      return 0;
    }
    if (moveMeta.oldIndex < moveMeta.newIndex) {
      return 2;
    }
    return 1;
  }

  private mapItem(
    item: RetroItemWithCount,
    columnIndex: number,
    isAllCardsHidden: boolean,
  ) {
    return {
      id: item.id,
      description: this.maskItemDescription(item.description, isAllCardsHidden),
      createdAt: item.createdAt,
      likes: item.likes,
      color: item.color ?? undefined,
      columnIndex,
      rowIndex: item.rowIndex,
      groupId: item.groupId,
      commentsCount: item._count.comments,
    };
  }

  private mapGroup(
    group: RetroBoardGroup | RetroGroupWithItems,
    columnIndex: number,
    isAllCardsHidden: boolean,
  ) {
    return {
      id: group.id,
      columnId: group.columnId,
      name: group.name,
      description: group.description,
      color: this.toColumnColors(group.color),
      orderIndex: group.orderIndex,
      isNameEditing: false,
      items: group.items.map((item) =>
        this.mapItem(item as RetroItemWithCount, columnIndex, isAllCardsHidden),
      ),
    };
  }

  private mapColumn(
    column: RetroBoardColumn | RetroColumnWithItems,
    isAllCardsHidden: boolean,
  ) {
    const mappedItems = column.items.map((item) =>
      this.mapItem(item as RetroItemWithCount, column.orderIndex, isAllCardsHidden),
    );
    const mappedGroups = column.groups.map((group) =>
      this.mapGroup(group, column.orderIndex, isAllCardsHidden),
    );
    const entries = [
      ...mappedItems.map((item) => ({
        type: 'ITEM' as const,
        orderIndex: item.rowIndex,
        item,
      })),
      ...mappedGroups.map((group) => ({
        type: 'GROUP' as const,
        orderIndex: group.orderIndex,
        group,
      })),
    ].sort((a, b) => a.orderIndex - b.orderIndex);

    return {
      id: column.id,
      name: column.name,
      description: column.description,
      color: this.toColumnColors(column.color),
      isNameEditing: false,
      items: mappedItems,
      groups: mappedGroups,
      entries,
    };
  }

  private mapBoard(board: RetroBoardWithColumns) {
    return {
      id: board.id,
      teamId: board.teamId,
      isAllCardsHidden: board.team.isAllCardsHidden,
      name: board.name,
      date: board.date.toISOString().slice(0, 10),
      description: board.description,
      columns: board.columns.map((column: RetroBoardColumn) =>
        this.mapColumn(column, board.team.isAllCardsHidden),
      ),
    };
  }

  private mapComment(comment: RetroItemCommentWithCreator) {
    return {
      id: comment.id,
      itemId: comment.itemId,
      text: comment.text,
      createdAt: comment.createdAt,
      creator: {
        id: comment.creator.id,
        email: comment.creator.email,
        name: comment.creator.name,
      },
    };
  }

  private async getIsAllCardsHiddenByItemId(itemId: number) {
    const item = await this.prisma.retroItem.findUnique({
      where: { id: itemId },
      select: {
        column: {
          select: {
            board: {
              select: {
                team: {
                  select: {
                    isAllCardsHidden: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }

    return item.column.board.team.isAllCardsHidden;
  }

  private maskItemDescription(
    description: string,
    isAllCardsHidden: boolean,
  ) {
    return isAllCardsHidden ? '' : description;
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

  private getAlternativeGroupColor(columnColor: ColumnColors): ColumnColors {
    const alternatives = AVAILABLE_COLUMN_COLORS.filter(
      (color) => !this.isSamePaletteColor(color, columnColor),
    );

    if (alternatives.length === 0) {
      return DEFAULT_COLUMN_COLORS[0];
    }

    const randomIndex = Math.floor(Math.random() * alternatives.length);
    return alternatives[randomIndex];
  }

  private isSamePaletteColor(a: ColumnColors, b: ColumnColors): boolean {
    return (
      a.columnColor === b.columnColor &&
      a.itemColor === b.itemColor &&
      a.buttonColor === b.buttonColor
    );
  }
}
