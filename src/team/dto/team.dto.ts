import { TeamRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const ADDABLE_TEAM_ROLES = {
  ADMIN: TeamRole.ADMIN,
  MEMBER: TeamRole.MEMBER,
} as const;

export class CreateTeamDto {
  @ApiProperty({ example: 'Platform Team' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateTeamDto {
  @ApiProperty({ example: 'Core Platform Team' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class AddTeamMemberDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ADDABLE_TEAM_ROLES, example: TeamRole.MEMBER })
  @IsOptional()
  @IsEnum(ADDABLE_TEAM_ROLES)
  role?: TeamRole;
}

export class UpdateTeamMemberRoleDto {
  @ApiProperty({ enum: ADDABLE_TEAM_ROLES, example: TeamRole.ADMIN })
  @IsEnum(ADDABLE_TEAM_ROLES)
  role!: TeamRole;
}
