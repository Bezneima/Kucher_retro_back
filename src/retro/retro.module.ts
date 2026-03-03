import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RetroController } from './retro.controller';
import { RetroService } from './retro.service';

@Module({
  imports: [AuthModule],
  controllers: [RetroController],
  providers: [RetroService],
  exports: [RetroService],
})
export class RetroModule {}
