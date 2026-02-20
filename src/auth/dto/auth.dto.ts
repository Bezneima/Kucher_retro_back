import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'strongpassword123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: 'Alice' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'strongpassword123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  refreshToken!: string;
}

export class UpdateMeDto {
  @ApiProperty({ example: 'Alice Johnson' })
  @IsString()
  @MinLength(1)
  name!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'strongpassword123' })
  @IsString()
  @MinLength(8)
  oldPassword!: string;

  @ApiProperty({ example: 'newstrongpassword123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
