import { Body, Controller, Get, Patch, Post, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import {
  ChangePasswordDto,
  GoogleExchangeResponseDto,
  GoogleExchangeTokenDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  UpdateMeDto,
} from './dto/auth.dto';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './types/authenticated-user.type';
import { GoogleOAuthService } from './google-oauth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

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

  @Public()
  @Get('google/start')
  @ApiOperation({ summary: 'Start Google OAuth Authorization Code flow' })
  @ApiQuery({
    name: 'returnTo',
    required: false,
    example: '/teams',
    description: 'Frontend relative path to continue after login',
  })
  @ApiFoundResponse({
    description: '302 redirect to Google OAuth consent screen',
  })
  async googleStart(
    @Query('returnTo') returnTo: string | undefined,
    @Res() response: Response,
  ) {
    const redirectUrl = await this.googleOAuthService.getStartRedirectUrl(returnTo);
    return response.redirect(302, redirectUrl);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({
    summary:
      'Google OAuth callback: validates state and redirects to frontend callback with exchangeToken',
  })
  @ApiQuery({ name: 'state', required: false, example: 'oauth_state_value' })
  @ApiQuery({ name: 'code', required: false, example: '4/0Ad...' })
  @ApiQuery({ name: 'error', required: false, example: 'access_denied' })
  @ApiFoundResponse({
    description:
      '302 redirect to frontend callback with exchangeToken, or /auth with error query',
  })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    const redirectUrl = await this.googleOAuthService.handleCallback({
      code,
      state,
      error,
    });

    return response.redirect(302, redirectUrl);
  }

  @Public()
  @Post('google/exchange')
  @ApiOperation({
    summary:
      'Exchange one-time exchangeToken for app accessToken/refreshToken token pair',
  })
  @ApiBody({ type: GoogleExchangeTokenDto })
  @ApiOkResponse({ type: GoogleExchangeResponseDto })
  exchangeGoogleToken(@Body() body: GoogleExchangeTokenDto) {
    return this.googleOAuthService.exchangeToken(body.exchangeToken);
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
