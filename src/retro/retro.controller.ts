import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateBoardDto,
  CreateColumnDto,
  CreateGroupDto,
  CreateItemCommentDto,
  CreateItemDto,
  GetBoardsQueryDto,
  ReorderColumnsDto,
  ReorderColumnsResponseDto,
  RetroBoardResponseDto,
  RetroColumnResponseDto,
  RetroGroupResponseDto,
  RetroItemCommentResponseDto,
  RetroItemResponseDto,
  SyncGroupPositionsDto,
  SyncGroupPositionsResponseDto,
  SyncItemPositionsResponseDto,
  SyncItemPositionsDto,
  UpdateBoardNameDto,
  UpdateColumnColorDto,
  UpdateColumnDescriptionDto,
  UpdateColumnNameDto,
  UpdateGroupColorDto,
  UpdateGroupDescriptionDto,
  UpdateGroupNameDto,
  UpdateItemColorDto,
  UpdateItemCommentDto,
  UpdateItemDescriptionDto,
} from './dto/retro.dto';
import { RetroService } from './retro.service';

const RETRO_EVENTS = {
  boardRenamed: 'retro.board.renamed',
  boardColumnsReordered: 'retro.board.columns.reordered',
  boardGroupsPositionsSynced: 'retro.board.groups.positions.synced',
  boardItemPositionsSynced: 'retro.board.items.positions.synced',
  columnCreated: 'retro.column.created',
  columnNameUpdated: 'retro.column.name.updated',
  columnColorUpdated: 'retro.column.color.updated',
  columnDescriptionUpdated: 'retro.column.description.updated',
  columnDeleted: 'retro.column.deleted',
  groupCreated: 'retro.group.created',
  groupNameUpdated: 'retro.group.name.updated',
  groupColorUpdated: 'retro.group.color.updated',
  groupDescriptionUpdated: 'retro.group.description.updated',
  groupDeleted: 'retro.group.deleted',
  itemCreated: 'retro.item.created',
  itemDescriptionUpdated: 'retro.item.description.updated',
  itemLikeToggled: 'retro.item.like.toggled',
  itemColorUpdated: 'retro.item.color.updated',
  itemDeleted: 'retro.item.deleted',
  itemCommentsFetched: 'retro.item.comments.fetched',
  itemCommentCreated: 'retro.item.comment.created',
  itemCommentUpdated: 'retro.item.comment.updated',
  itemCommentDeleted: 'retro.item.comment.deleted',
} as const;

@ApiTags('retro')
@ApiBearerAuth()
@Controller('retro')
export class RetroController {
  constructor(
    private readonly retroService: RetroService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @Post('boards')
  @ApiOperation({ summary: 'Create new board for team (OWNER/ADMIN only)' })
  @ApiBody({
    schema: {
      example: {
        teamId: 1,
        name: 'Sprint 12 Retro',
        date: '2026-02-16',
        description: 'Командная ретроспектива по спринту',
      },
    },
  })
  createBoard(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBoardDto) {
    return this.retroService.createBoard(user.id, body);
  }

  @Get('boards')
  @ApiOperation({ summary: 'Get retro boards for current user teams' })
  @ApiQuery({
    name: 'teamId',
    required: false,
    description: 'Filter boards by team id',
    schema: { type: 'integer', minimum: 1 },
  })
  @ApiOkResponse({ type: [RetroBoardResponseDto] })
  getBoards(@CurrentUser() user: AuthenticatedUser, @Query() query: GetBoardsQueryDto) {
    return this.retroService.getBoards(user.id, query.teamId);
  }

  @Get('boards/:boardId/columns')
  @ApiOperation({ summary: 'Get board columns' })
  @ApiOkResponse({ type: [RetroColumnResponseDto] })
  getBoardColumns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.retroService.getBoardColumns(boardId, user.id);
  }

  @Patch('boards/:boardId/name')
  @ApiOperation({ summary: 'Rename board' })
  @ApiBody({
    schema: {
      example: {
        name: 'Sprint 13 Retro',
      },
    },
  })
  async updateBoardName(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: UpdateBoardNameDto,
  ) {
    const context = await this.retroService.getBoardRealtimeContext(boardId, user.id);
    const updatedBoard = await this.retroService.updateBoardName(boardId, user.id, body.name);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.boardRenamed,
      updatedBoard,
      user.id,
    );
    return updatedBoard;
  }

  @Patch('boards/:boardId/columns/reorder')
  @ApiOperation({ summary: 'Reorder board columns' })
  @ApiBody({
    schema: {
      example: {
        oldIndex: 0,
        newIndex: 2,
      },
    },
  })
  @ApiOkResponse({ type: ReorderColumnsResponseDto })
  async reorderColumns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: ReorderColumnsDto,
  ) {
    const context = await this.retroService.getBoardRealtimeContext(boardId, user.id);
    const columns = await this.retroService.reorderColumns(
      boardId,
      user.id,
      body.oldIndex,
      body.newIndex,
    );
    const payload = {
      boardId: context.boardId,
      columns,
    };
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.boardColumnsReordered,
      payload,
      user.id,
    );
    return payload;
  }

  @Post('boards/:boardId/columns')
  @ApiOperation({ summary: 'Create new column on board' })
  @ApiBody({
    schema: {
      example: {
        name: 'Новая колонка',
        color: {
          columnColor: '#FFDBD7',
          itemColor: '#FF6161',
          buttonColor: '#FF9594',
        },
      },
    },
  })
  async createColumn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: CreateColumnDto,
  ) {
    const context = await this.retroService.getBoardRealtimeContext(boardId, user.id);
    const column = await this.retroService.createColumn(
      boardId,
      user.id,
      body.name,
      body.description,
      body.color,
    );
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.columnCreated,
      {
        boardId: context.boardId,
        ...column,
      },
      user.id,
    );
    return column;
  }

  @Post('columns/:columnId/items')
  @ApiOperation({ summary: 'Add item to column' })
  @ApiBody({
    schema: {
      example: {
        description: 'йцукйцукйуцйцуа',
        groupId: 3,
      },
    },
  })
  @ApiOkResponse({ type: RetroItemResponseDto })
  async addItemToColumn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() body: CreateItemDto,
  ) {
    const context = await this.retroService.getColumnRealtimeContext(columnId, user.id);
    const item = await this.retroService.addItemToColumn(
      columnId,
      user.id,
      body.description,
      body.groupId,
    );
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.itemCreated,
      {
        boardId: context.boardId,
        ...item,
      },
      user.id,
    );
    return item;
  }

  @Post('columns/:columnId/groups')
  @ApiOperation({ summary: 'Create new group inside column' })
  @ApiBody({
    schema: {
      example: {
        name: 'Технические долги',
        description: 'Отдельно обсуждаем карточки по техдолгу',
        color: {
          columnColor: '#FFDBD7',
          itemColor: '#FF6161',
          buttonColor: '#FF9594',
        },
      },
    },
  })
  @ApiOkResponse({ type: RetroGroupResponseDto })
  async createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() body: CreateGroupDto,
  ) {
    const context = await this.retroService.getColumnRealtimeContext(columnId, user.id);
    const group = await this.retroService.createGroup(
      columnId,
      user.id,
      body.name,
      body.description,
    );
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.groupCreated,
      {
        boardId: context.boardId,
        ...group,
      },
      user.id,
    );
    return group;
  }

  @Patch('columns/:columnId/name')
  @ApiOperation({ summary: 'Update column name' })
  @ApiBody({
    schema: {
      example: {
        name: 'Что было хорошо?',
      },
    },
  })
  async updateColumnName(
    @CurrentUser() user: AuthenticatedUser,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() body: UpdateColumnNameDto,
  ) {
    const context = await this.retroService.getColumnRealtimeContext(columnId, user.id);
    const column = await this.retroService.updateColumnName(columnId, user.id, body.name);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.columnNameUpdated,
      {
        ...column,
        boardId: context.boardId,
      },
      user.id,
    );
    return column;
  }

  @Patch('columns/:id/color')
  @ApiOperation({ summary: 'Update column color' })
  @ApiBody({
    schema: {
      example: {
        color: {
          columnColor: '#FFDBD7',
          itemColor: '#FF6161',
          buttonColor: '#FF9594',
        },
      },
    },
  })
  async updateColumnColor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) columnId: number,
    @Body() body: UpdateColumnColorDto,
  ) {
    const context = await this.retroService.getColumnRealtimeContext(columnId, user.id);
    const column = await this.retroService.updateColumnColor(columnId, user.id, body.color);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.columnColorUpdated,
      {
        ...column,
        boardId: context.boardId,
      },
      user.id,
    );
    return column;
  }

  @Patch('columns/:columnId/description')
  @ApiOperation({ summary: 'Update column description' })
  @ApiBody({
    schema: {
      example: {
        description: 'Фокус: стабильность CI и speed delivery',
      },
    },
  })
  async updateColumnDescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() body: UpdateColumnDescriptionDto,
  ) {
    const context = await this.retroService.getColumnRealtimeContext(columnId, user.id);
    const column = await this.retroService.updateColumnDescription(columnId, user.id, body.description);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.columnDescriptionUpdated,
      {
        ...column,
        boardId: context.boardId,
      },
      user.id,
    );
    return column;
  }

  @Patch('groups/:groupId/name')
  @ApiOperation({ summary: 'Update group name' })
  @ApiBody({
    schema: {
      example: {
        name: 'Технические риски',
      },
    },
  })
  async updateGroupName(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: UpdateGroupNameDto,
  ) {
    const context = await this.retroService.getGroupRealtimeContext(groupId, user.id);
    const group = await this.retroService.updateGroupName(groupId, user.id, body.name);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.groupNameUpdated,
      {
        boardId: context.boardId,
        ...group,
      },
      user.id,
    );
    return group;
  }

  @Patch('groups/:groupId/color')
  @ApiOperation({ summary: 'Update group color' })
  @ApiBody({
    schema: {
      example: {
        color: {
          columnColor: '#FFDBD7',
          itemColor: '#FF6161',
          buttonColor: '#FF9594',
        },
      },
    },
  })
  async updateGroupColor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: UpdateGroupColorDto,
  ) {
    const context = await this.retroService.getGroupRealtimeContext(groupId, user.id);
    const group = await this.retroService.updateGroupColor(groupId, user.id, body.color);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.groupColorUpdated,
      {
        boardId: context.boardId,
        ...group,
      },
      user.id,
    );
    return group;
  }

  @Patch('groups/:groupId/description')
  @ApiOperation({ summary: 'Update group description' })
  @ApiBody({
    schema: {
      example: {
        description: 'Связанные карточки по итогам релиза',
      },
    },
  })
  async updateGroupDescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: UpdateGroupDescriptionDto,
  ) {
    const context = await this.retroService.getGroupRealtimeContext(groupId, user.id);
    const group = await this.retroService.updateGroupDescription(groupId, user.id, body.description);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.groupDescriptionUpdated,
      {
        boardId: context.boardId,
        ...group,
      },
      user.id,
    );
    return group;
  }

  @Patch('items/:itemId/description')
  @ApiOperation({ summary: 'Update item description' })
  @ApiBody({
    schema: {
      example: {
        description: 'Нужно улучшить code review процесс',
      },
    },
  })
  async updateItemDescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: UpdateItemDescriptionDto,
  ) {
    const context = await this.retroService.getItemRealtimeContext(itemId, user.id);
    const item = await this.retroService.updateItemDescription(itemId, user.id, body.description);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.itemDescriptionUpdated,
      {
        boardId: context.boardId,
        ...item,
      },
      user.id,
    );
    return item;
  }

  @Patch('items/:itemId/like')
  @ApiOperation({ summary: 'Toggle item like for current user' })
  async toggleItemLike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    const context = await this.retroService.getItemRealtimeContext(itemId, user.id);
    const item = await this.retroService.toggleItemLike(itemId, user.id);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.itemLikeToggled,
      {
        boardId: context.boardId,
        ...item,
      },
      user.id,
    );
    return item;
  }

  @Patch('items/:itemId/color')
  @ApiOperation({ summary: 'Update item color' })
  @ApiBody({
    schema: {
      example: {
        color: '#34d399',
      },
    },
  })
  async updateItemColor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: UpdateItemColorDto,
  ) {
    const context = await this.retroService.getItemRealtimeContext(itemId, user.id);
    const item = await this.retroService.updateItemColor(itemId, user.id, body.color);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.itemColorUpdated,
      {
        boardId: context.boardId,
        ...item,
      },
      user.id,
    );
    return item;
  }

  @Get('items/:itemId/comments')
  @ApiOperation({ summary: 'Get all comments for item (oldest first)' })
  @ApiOkResponse({ type: [RetroItemCommentResponseDto] })
  async getItemComments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    const context = await this.retroService.getItemRealtimeContext(itemId, user.id);
    const comments = await this.retroService.getItemComments(itemId, user.id);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.itemCommentsFetched,
      {
        boardId: context.boardId,
        itemId: context.itemId,
        comments,
      },
      user.id,
    );
    return comments;
  }

  @Post('items/:itemId/comments')
  @ApiOperation({ summary: 'Create comment for item' })
  @ApiBody({
    schema: {
      example: {
        text: 'Согласен, это нужно поправить в следующем спринте',
      },
    },
  })
  @ApiOkResponse({ type: RetroItemCommentResponseDto })
  async createItemComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: CreateItemCommentDto,
  ) {
    const context = await this.retroService.getItemRealtimeContext(itemId, user.id);
    const comment = await this.retroService.createItemComment(itemId, user.id, body.text);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.itemCommentCreated,
      {
        boardId: context.boardId,
        ...comment,
      },
      user.id,
    );
    return comment;
  }

  @Patch('comments/:commentId')
  @ApiOperation({ summary: 'Update item comment (author or ADMIN/OWNER only)' })
  @ApiBody({
    schema: {
      example: {
        text: 'Обновил формулировку после обсуждения',
      },
    },
  })
  @ApiOkResponse({ type: RetroItemCommentResponseDto })
  async updateItemComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() body: UpdateItemCommentDto,
  ) {
    const context = await this.retroService.getCommentRealtimeContext(commentId, user.id);
    const comment = await this.retroService.updateItemComment(commentId, user.id, body.text);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.itemCommentUpdated,
      {
        boardId: context.boardId,
        ...comment,
      },
      user.id,
    );
    return comment;
  }

  @Patch('boards/:boardId/items/positions')
  @ApiOperation({ summary: 'Sync item positions changed on board' })
  @ApiBody({
    schema: {
      example: {
        changes: [{ itemId: 12, newColumnId: 7, newGroupId: 3, newRowIndex: 0 }],
      },
    },
  })
  @ApiOkResponse({ type: SyncItemPositionsResponseDto })
  async syncItemPositions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: SyncItemPositionsDto,
  ) {
    const context = await this.retroService.getBoardRealtimeContext(boardId, user.id);
    const result = await this.retroService.syncItemPositions(boardId, user.id, body.changes);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.boardItemPositionsSynced,
      result,
      user.id,
    );
    return result;
  }

  @Patch('boards/:boardId/groups/positions')
  @ApiOperation({ summary: 'Sync group positions changed on board' })
  @ApiBody({
    schema: {
      example: {
        changes: [{ groupId: 5, newColumnId: 7, newOrderIndex: 0 }],
      },
    },
  })
  @ApiOkResponse({ type: SyncGroupPositionsResponseDto })
  async syncGroupPositions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: SyncGroupPositionsDto,
  ) {
    const context = await this.retroService.getBoardRealtimeContext(boardId, user.id);
    const result = await this.retroService.syncGroupPositions(boardId, user.id, body.changes);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.boardGroupsPositionsSynced,
      result,
      user.id,
    );
    return result;
  }

  @Delete('columns/:columnId')
  @ApiOperation({ summary: 'Delete column with all items' })
  async deleteColumn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('columnId', ParseIntPipe) columnId: number,
  ) {
    const context = await this.retroService.getColumnRealtimeContext(columnId, user.id);
    const result = await this.retroService.deleteColumn(columnId, user.id);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.columnDeleted,
      {
        boardId: context.boardId,
        columnId: context.columnId,
        ...result,
      },
      user.id,
    );
    return result;
  }

  @Delete('groups/:groupId')
  @ApiOperation({ summary: 'Delete group and ungroup all cards in column' })
  async deleteGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    const context = await this.retroService.getGroupRealtimeContext(groupId, user.id);
    const result = await this.retroService.deleteGroup(groupId, user.id);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.groupDeleted,
      {
        boardId: context.boardId,
        groupId: context.groupId,
        columnId: context.columnId,
        ...result,
      },
      user.id,
    );
    return result;
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Delete item' })
  async deleteItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    const context = await this.retroService.getItemRealtimeContext(itemId, user.id);
    const result = await this.retroService.deleteItem(itemId, user.id);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.itemDeleted,
      {
        boardId: context.boardId,
        itemId: context.itemId,
        ...result,
      },
      user.id,
    );
    return result;
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete item comment (author or ADMIN/OWNER only)' })
  async deleteItemComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    const context = await this.retroService.getCommentRealtimeContext(commentId, user.id);
    const result = await this.retroService.deleteItemComment(commentId, user.id);
    await this.realtimeService.emitToTeam(
      context.teamId,
      RETRO_EVENTS.itemCommentDeleted,
      {
        boardId: context.boardId,
        commentId: context.commentId,
        itemId: context.itemId,
        ...result,
      },
      user.id,
    );
    return result;
  }
}
