import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import {
  ChangePasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  UpdateMeDto,
} from './dto/auth.dto';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './types/authenticated-user.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register user and issue access/refresh tokens' })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user and issue access/refresh tokens' })
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue new token pair' })
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke active refresh token' })
  logout(@CurrentUser() user: AuthenticatedUser, @Body() body: LogoutDto) {
    return this.authService.logout(user.id, body.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update current authenticated user profile' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateMeDto) {
    return this.authService.updateMe(user.id, body.name);
  }

  @ApiBearerAuth()
  @Patch('change-password')
  @ApiOperation({ summary: 'Change current authenticated user password' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      body.oldPassword,
      body.newPassword,
    );
  }
}
