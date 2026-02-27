import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeModule } from '../realtime/realtime.module';
import { RetroModule } from '../retro/retro.module';
import { RetroGateway } from './retro.gateway';

@Module({
  imports: [JwtModule.register({}), RetroModule, RealtimeModule],
  providers: [RetroGateway],
})
export class SocketModule {}
