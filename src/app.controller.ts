import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
}
