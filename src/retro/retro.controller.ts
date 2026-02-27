import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateBoardDto,
  CreateColumnDto,
  CreateItemCommentDto,
  CreateItemDto,
  GetBoardsQueryDto,
  ReorderColumnsDto,
  ReorderColumnsResponseDto,
  RetroBoardResponseDto,
  RetroColumnResponseDto,
  RetroItemCommentResponseDto,
  RetroItemResponseDto,
  SyncItemPositionsResponseDto,
  SyncItemPositionsDto,
  UpdateBoardNameDto,
  UpdateColumnColorDto,
  UpdateColumnDescriptionDto,
  UpdateColumnNameDto,
  UpdateItemColorDto,
  UpdateItemCommentDto,
  UpdateItemDescriptionDto,
} from './dto/retro.dto';
import { RetroService } from './retro.service';

const RETRO_EVENTS = {
  boardRenamed: 'retro.board.renamed',
  boardColumnsReordered: 'retro.board.columns.reordered',
  boardItemPositionsSynced: 'retro.board.items.positions.synced',
  columnCreated: 'retro.column.created',
  columnNameUpdated: 'retro.column.name.updated',
  columnColorUpdated: 'retro.column.color.updated',
  columnDescriptionUpdated: 'retro.column.description.updated',
  columnDeleted: 'retro.column.deleted',
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.boardRenamed, updatedBoard);
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.columnCreated, {
      boardId: context.boardId,
      ...column,
    });
    return column;
  }

  @Post('columns/:columnId/items')
  @ApiOperation({ summary: 'Add item to column' })
  @ApiBody({
    schema: {
      example: {
        description: 'йцукйцукйуцйцуа',
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
    const item = await this.retroService.addItemToColumn(columnId, user.id, body.description);
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.itemCreated, {
      boardId: context.boardId,
      ...item,
    });
    return item;
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.columnNameUpdated, {
      ...column,
      boardId: context.boardId,
    });
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.columnColorUpdated, {
      ...column,
      boardId: context.boardId,
    });
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
    );
    return column;
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.itemLikeToggled, {
      boardId: context.boardId,
      ...item,
    });
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.itemColorUpdated, {
      boardId: context.boardId,
      ...item,
    });
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.itemCommentCreated, {
      boardId: context.boardId,
      ...comment,
    });
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.itemCommentUpdated, {
      boardId: context.boardId,
      ...comment,
    });
    return comment;
  }

  @Patch('boards/:boardId/items/positions')
  @ApiOperation({ summary: 'Sync item positions changed on board' })
  @ApiBody({
    schema: {
      example: {
        changes: [{ itemId: 12, newColumnId: 7, newRowIndex: 0 }],
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.columnDeleted, {
      boardId: context.boardId,
      columnId: context.columnId,
      ...result,
    });
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.itemDeleted, {
      boardId: context.boardId,
      itemId: context.itemId,
      ...result,
    });
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
    await this.realtimeService.emitToTeam(context.teamId, RETRO_EVENTS.itemCommentDeleted, {
      boardId: context.boardId,
      commentId: context.commentId,
      itemId: context.itemId,
      ...result,
    });
    return result;
  }
}
