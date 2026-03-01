import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RetroModule } from './retro/retro.module';
import { SocketModule } from './socket/socket.module';
import { TeamModule } from './team/team.module';
import { TeamInviteModule } from './team-invite/team-invite.module';
import { TimerModule } from './timer/timer.module';

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    AuthModule,
    RetroModule,
    TeamModule,
    TeamInviteModule,
    SocketModule,
    TimerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
