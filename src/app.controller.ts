import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { Public } from './auth/decorators/public.decorator';
import { AuthService } from './auth/auth.service';
import { AuthenticatedUser } from './auth/types/authenticated-user.type';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiOkResponse({
    schema: {
      example: {
        id: 'f2f0f8a8-30f2-45f8-b1f3-c145fa45f9c5',
        email: 'user@example.com',
        name: 'John Doe',
      },
    },
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}
