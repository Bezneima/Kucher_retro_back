import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateBoardDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId!: number;

  @ApiPropertyOptional({ example: 'Sprint 12 Retro' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '2026-02-16' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 'Командная ретроспектива по спринту' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class GetBoardsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;
}

export class UpdateBoardNameDto {
  @ApiProperty({ example: 'Sprint 13 Retro' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateColumnNameDto {
  @ApiProperty({ example: 'Что было хорошо?' })
  @IsString()
  name!: string;
}

export class ColumnColorDto {
  @ApiProperty({ example: '#FFDBD7' })
  @IsHexColor()
  columnColor!: string;

  @ApiProperty({ example: '#FF6161' })
  @IsHexColor()
  itemColor!: string;

  @ApiProperty({ example: '#FF9594' })
  @IsHexColor()
  buttonColor!: string;
}

export class UpdateColumnColorDto {
  @ApiProperty({
    type: ColumnColorDto,
    example: {
      columnColor: '#FFDBD7',
      itemColor: '#FF6161',
      buttonColor: '#FF9594',
    },
  })
  @ValidateNested()
  @Type(() => ColumnColorDto)
  color!: ColumnColorDto;
}

export class UpdateColumnDescriptionDto {
  @ApiProperty({ example: 'Фокус: стабильность CI и speed delivery' })
  @IsString()
  description!: string;
}

export class CreateColumnDto {
  @ApiPropertyOptional({ example: 'Новая колонка' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Подсказка для участников по заполнению колонки' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: ColumnColorDto,
    example: {
      columnColor: '#FFDBD7',
      itemColor: '#FF6161',
      buttonColor: '#FF9594',
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ColumnColorDto)
  color?: ColumnColorDto;
}

export class CreateItemDto {
  @ApiPropertyOptional({ example: 'йцукйцукйуцйцуа' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 3, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId?: number | null;
}

export class UpdateItemDescriptionDto {
  @ApiProperty({ example: 'Нужно улучшить code review процесс' })
  @IsString()
  description!: string;
}

export class UpdateItemColorDto {
  @ApiPropertyOptional({ example: '#34d399' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateItemCommentDto {
  @ApiProperty({ example: 'Согласен, это нужно поправить в следующем спринте' })
  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class UpdateItemCommentDto {
  @ApiProperty({ example: 'Обновил формулировку после обсуждения' })
  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class CreateGroupDto {
  @ApiPropertyOptional({ example: 'Новая группа' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Подсказка для участников по заполнению группы' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: ColumnColorDto,
    example: {
      columnColor: '#FFDBD7',
      itemColor: '#FF6161',
      buttonColor: '#FF9594',
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ColumnColorDto)
  color?: ColumnColorDto;
}

export class UpdateGroupNameDto {
  @ApiProperty({ example: 'Что обсудить отдельно?' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateGroupColorDto {
  @ApiProperty({
    type: ColumnColorDto,
    example: {
      columnColor: '#FFDBD7',
      itemColor: '#FF6161',
      buttonColor: '#FF9594',
    },
  })
  @ValidateNested()
  @Type(() => ColumnColorDto)
  color!: ColumnColorDto;
}

export class UpdateGroupDescriptionDto {
  @ApiProperty({ example: 'Группа для связанных карточек по релизу' })
  @IsString()
  description!: string;
}

export class ReorderColumnsDto {
  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  oldIndex!: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  newIndex!: number;
}

export class ItemPositionChangeDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  itemId!: number;

  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  newColumnId!: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  newRowIndex!: number;

  @ApiPropertyOptional({ example: 3, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  newGroupId?: number | null;
}

export class SyncItemPositionsDto {
  @ApiProperty({
    type: [ItemPositionChangeDto],
    example: [{ itemId: 12, newColumnId: 7, newRowIndex: 0 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPositionChangeDto)
  changes!: ItemPositionChangeDto[];
}

export class GroupPositionChangeDto {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId!: number;

  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  newColumnId!: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  newOrderIndex!: number;
}

export class SyncGroupPositionsDto {
  @ApiProperty({
    type: [GroupPositionChangeDto],
    example: [{ groupId: 5, newColumnId: 7, newOrderIndex: 0 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupPositionChangeDto)
  changes!: GroupPositionChangeDto[];
}

export class RetroItemResponseDto {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: 'Нужно улучшить code review процесс' })
  description!: string;

  @ApiProperty({ example: '2026-02-22T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: [String], example: ['user-id-1'] })
  likes!: string[];

  @ApiPropertyOptional({ example: '#34d399' })
  color?: string;

  @ApiProperty({ example: 1 })
  columnIndex!: number;

  @ApiProperty({ example: 0 })
  rowIndex!: number;

  @ApiPropertyOptional({ example: 3, nullable: true })
  groupId?: number | null;

  @ApiProperty({ example: 3 })
  commentsCount!: number;
}

export class CommentCreatorDto {
  @ApiProperty({ example: '8f635db5-7d93-4e6e-a1a7-8f7ba4f4f7d2' })
  id!: string;

  @ApiProperty({ example: 'alice@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Alice' })
  name?: string | null;
}

export class RetroItemCommentResponseDto {
  @ApiProperty({ example: 15 })
  id!: number;

  @ApiProperty({ example: 42 })
  itemId!: number;

  @ApiProperty({ example: 'Согласен, это нужно поправить в следующем спринте' })
  text!: string;

  @ApiProperty({ example: '2026-02-22T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: CommentCreatorDto })
  creator!: CommentCreatorDto;
}

export class RetroGroupResponseDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 7 })
  columnId!: number;

  @ApiProperty({ example: 'Технические долги' })
  name!: string;

  @ApiProperty({ example: 'Группа для карточек по техдолгу' })
  description!: string;

  @ApiProperty({
    type: ColumnColorDto,
    example: {
      columnColor: '#FFDBD7',
      itemColor: '#FF6161',
      buttonColor: '#FF9594',
    },
  })
  color!: ColumnColorDto;

  @ApiProperty({ example: 0 })
  orderIndex!: number;

  @ApiProperty({ example: false })
  isNameEditing!: boolean;

  @ApiProperty({ type: [RetroItemResponseDto] })
  items!: RetroItemResponseDto[];
}

export class RetroColumnEntryResponseDto {
  @ApiProperty({ example: 'ITEM' })
  type!: 'ITEM' | 'GROUP';

  @ApiProperty({ example: 0 })
  orderIndex!: number;

  @ApiPropertyOptional({ type: RetroItemResponseDto })
  item?: RetroItemResponseDto;

  @ApiPropertyOptional({ type: RetroGroupResponseDto })
  group?: RetroGroupResponseDto;
}

export class RetroColumnResponseDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ example: 'Что было хорошо?' })
  name!: string;

  @ApiProperty({ example: 'Подсказка для участников по заполнению колонки' })
  description!: string;

  @ApiProperty({
    type: ColumnColorDto,
    example: {
      columnColor: '#FFDBD7',
      itemColor: '#FF6161',
      buttonColor: '#FF9594',
    },
  })
  color!: ColumnColorDto;

  @ApiProperty({ example: false })
  isNameEditing!: boolean;

  @ApiProperty({ type: [RetroItemResponseDto] })
  items!: RetroItemResponseDto[];

  @ApiProperty({ type: [RetroGroupResponseDto] })
  groups!: RetroGroupResponseDto[];

  @ApiProperty({ type: [RetroColumnEntryResponseDto] })
  entries!: RetroColumnEntryResponseDto[];
}

export class ReorderColumnsResponseDto {
  @ApiProperty({ example: 1 })
  boardId!: number;

  @ApiProperty({ type: [RetroColumnResponseDto] })
  columns!: RetroColumnResponseDto[];
}

export class SyncItemPositionsResponseDto {
  @ApiProperty({ example: 1 })
  boardId!: number;

  @ApiProperty({ example: 2 })
  updated!: number;

  @ApiProperty({ type: [Number], example: [7, 8] })
  changedColumnIds!: number[];

  @ApiProperty({ type: [RetroColumnResponseDto] })
  columns!: RetroColumnResponseDto[];
}

export class SyncGroupPositionsResponseDto {
  @ApiProperty({ example: 1 })
  boardId!: number;

  @ApiProperty({ example: 2 })
  updated!: number;

  @ApiProperty({ type: [Number], example: [7, 8] })
  changedColumnIds!: number[];

  @ApiProperty({ type: [RetroColumnResponseDto] })
  columns!: RetroColumnResponseDto[];
}

export class RetroBoardResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  teamId!: number;

  @ApiProperty({ example: false })
  isAllCardsHidden!: boolean;

  @ApiProperty({ example: 'Sprint 12 Retro' })
  name!: string;

  @ApiProperty({ example: '2026-02-16' })
  date!: string;

  @ApiProperty({ example: 'Командная ретроспектива по спринту' })
  description!: string;

  @ApiProperty({ type: [RetroColumnResponseDto] })
  columns!: RetroColumnResponseDto[];
}
