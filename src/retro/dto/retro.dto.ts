import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreateBoardDto {
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

export class UpdateColumnNameDto {
  @ApiProperty({ example: 'Что было хорошо?' })
  @IsString()
  name!: string;
}

export class UpdateColumnColorDto {
  @ApiProperty({ example: '#34d399' })
  @IsString()
  color!: string;
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

  @ApiPropertyOptional({ example: '#60a5fa' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateItemDto {
  @ApiPropertyOptional({ example: 'йцукйцукйуцйцуа' })
  @IsOptional()
  @IsString()
  description?: string;
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
