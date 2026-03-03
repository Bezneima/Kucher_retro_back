import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeModule } from '../realtime/realtime.module';
import { RetroModule } from '../retro/retro.module';
import { RetroGateway } from './retro.gateway';

@Module({
  imports: [JwtModule.register({}), AuthModule, RetroModule, RealtimeModule],
  providers: [RetroGateway],
})
export class SocketModule {}
