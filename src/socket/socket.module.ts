import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RetroModule } from '../retro/retro.module';
import { RetroGateway } from './retro.gateway';

@Module({
  imports: [JwtModule.register({}), RetroModule],
  providers: [RetroGateway],
})
export class SocketModule {}
