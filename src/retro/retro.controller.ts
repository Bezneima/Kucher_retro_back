import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateColumnDto,
  CreateBoardDto,
  CreateItemCommentDto,
  CreateItemDto,
  GetBoardsQueryDto,
  ReorderColumnsDto,
  RetroBoardResponseDto,
  RetroItemCommentResponseDto,
  RetroColumnResponseDto,
  RetroItemResponseDto,
  SyncItemPositionsDto,
  UpdateBoardNameDto,
  UpdateColumnColorDto,
  UpdateColumnDescriptionDto,
  UpdateColumnNameDto,
  UpdateItemCommentDto,
  UpdateItemColorDto,
  UpdateItemDescriptionDto,
} from './dto/retro.dto';
import { RetroService } from './retro.service';

@ApiTags('retro')
@ApiBearerAuth()
@Controller('retro')
export class RetroController {
  constructor(private readonly retroService: RetroService) {}

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
  @ApiOperation({ summary: 'Rename board (OWNER/ADMIN only)' })
  @ApiBody({
    schema: {
      example: {
        name: 'Sprint 13 Retro',
      },
    },
  })
  @ApiOkResponse({ type: RetroBoardResponseDto })
  updateBoardName(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: UpdateBoardNameDto,
  ) {
    return this.retroService.updateBoardName(boardId, user.id, body.name);
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
  createColumn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: CreateColumnDto,
  ) {
    return this.retroService.createColumn(
      boardId,
      user.id,
      body.name,
      body.description,
      body.color,
    );
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
  addItemToColumn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() body: CreateItemDto,
  ) {
    return this.retroService.addItemToColumn(columnId, user.id, body.description);
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
  updateColumnName(
    @CurrentUser() user: AuthenticatedUser,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() body: UpdateColumnNameDto,
  ) {
    return this.retroService.updateColumnName(columnId, user.id, body.name);
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
  updateColumnColor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) columnId: number,
    @Body() body: UpdateColumnColorDto,
  ) {
    return this.retroService.updateColumnColor(columnId, user.id, body.color);
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
  updateColumnDescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() body: UpdateColumnDescriptionDto,
  ) {
    return this.retroService.updateColumnDescription(columnId, user.id, body.description);
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
  updateItemDescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: UpdateItemDescriptionDto,
  ) {
    return this.retroService.updateItemDescription(itemId, user.id, body.description);
  }

  @Patch('items/:itemId/like')
  @ApiOperation({ summary: 'Toggle item like for current user' })
  toggleItemLike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.retroService.toggleItemLike(itemId, user.id);
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
  updateItemColor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: UpdateItemColorDto,
  ) {
    return this.retroService.updateItemColor(itemId, user.id, body.color);
  }

  @Get('items/:itemId/comments')
  @ApiOperation({ summary: 'Get all comments for item (oldest first)' })
  @ApiOkResponse({ type: [RetroItemCommentResponseDto] })
  getItemComments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.retroService.getItemComments(itemId, user.id);
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
  createItemComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: CreateItemCommentDto,
  ) {
    return this.retroService.createItemComment(itemId, user.id, body.text);
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
  updateItemComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() body: UpdateItemCommentDto,
  ) {
    return this.retroService.updateItemComment(commentId, user.id, body.text);
  }

  @Patch('boards/:boardId/columns/reorder')
  @ApiOperation({ summary: 'Reorder board columns by indexes' })
  @ApiBody({
    schema: {
      example: {
        oldIndex: 0,
        newIndex: 2,
      },
    },
  })
  reorderColumns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: ReorderColumnsDto,
  ) {
    return this.retroService.reorderColumns(boardId, user.id, body.oldIndex, body.newIndex);
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
  syncItemPositions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: SyncItemPositionsDto,
  ) {
    return this.retroService.syncItemPositions(boardId, user.id, body.changes);
  }

  @Delete('columns/:columnId')
  @ApiOperation({ summary: 'Delete column with all items' })
  deleteColumn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('columnId', ParseIntPipe) columnId: number,
  ) {
    return this.retroService.deleteColumn(columnId, user.id);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Delete item' })
  deleteItem(@CurrentUser() user: AuthenticatedUser, @Param('itemId', ParseIntPipe) itemId: number) {
    return this.retroService.deleteItem(itemId, user.id);
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete item comment (author or ADMIN/OWNER only)' })
  deleteItemComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    return this.retroService.deleteItemComment(commentId, user.id);
  }
}
