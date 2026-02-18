import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  CreateColumnDto,
  CreateItemDto,
  CreateBoardDto,
  ReorderColumnsDto,
  SyncItemPositionsDto,
  ToggleItemLikeDto,
  UpdateColumnNameDto,
  UpdateItemColorDto,
  UpdateItemDescriptionDto,
} from './dto/retro.dto';
import { RetroService } from './retro.service';

@ApiTags('retro')
@Controller('retro')
export class RetroController {
  constructor(private readonly retroService: RetroService) {}

  @Post('users/:userId/boards')
  @ApiOperation({ summary: 'Create new board for user' })
  @ApiParam({ name: 'userId', example: 'user_42' })
  @ApiBody({
    schema: {
      example: {
        name: 'Sprint 12 Retro',
        date: '2026-02-16',
        description: 'Командная ретроспектива по спринту',
      },
    },
  })
  createBoardForUser(@Param('userId') userId: string, @Body() body: CreateBoardDto) {
    return this.retroService.createBoardForUser(userId, body);
  }

  @Get('boards')
  @ApiOperation({ summary: 'Get all retro boards' })
  @ApiQuery({ name: 'userId', required: false, example: 'user_42' })
  getBoards(@Query('userId') userId?: string) {
    return this.retroService.getBoards(userId);
  }

  @Get('boards/:boardId/columns')
  @ApiOperation({ summary: 'Get board columns' })
  getBoardColumns(@Param('boardId', ParseIntPipe) boardId: number) {
    return this.retroService.getBoardColumns(boardId);
  }

  @Post('boards/:boardId/columns')
  @ApiOperation({ summary: 'Create new column on board' })
  @ApiBody({
    schema: {
      example: {
        name: 'Новая колонка',
        color: '#60a5fa',
      },
    },
  })
  createColumn(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: CreateColumnDto,
  ) {
    return this.retroService.createColumn(boardId, body.name, body.color);
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
  addItemToColumn(
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() body: CreateItemDto,
  ) {
    return this.retroService.addItemToColumn(columnId, body.description);
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
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() body: UpdateColumnNameDto,
  ) {
    return this.retroService.updateColumnName(columnId, body.name);
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
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: UpdateItemDescriptionDto,
  ) {
    return this.retroService.updateItemDescription(itemId, body.description);
  }

  @Patch('items/:itemId/like')
  @ApiOperation({ summary: 'Toggle item like by userId' })
  @ApiBody({
    schema: {
      example: {
        userId: 'user_42',
      },
    },
  })
  toggleItemLike(@Param('itemId', ParseIntPipe) itemId: number, @Body() body: ToggleItemLikeDto) {
    return this.retroService.toggleItemLike(itemId, body.userId);
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
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: UpdateItemColorDto,
  ) {
    return this.retroService.updateItemColor(itemId, body.color);
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
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: ReorderColumnsDto,
  ) {
    return this.retroService.reorderColumns(boardId, body.oldIndex, body.newIndex);
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
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() body: SyncItemPositionsDto,
  ) {
    return this.retroService.syncItemPositions(boardId, body.changes);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Delete item' })
  deleteItem(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.retroService.deleteItem(itemId);
  }
}
