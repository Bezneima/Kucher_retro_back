import { Module } from '@nestjs/common';
import { RetroController } from './retro.controller';
import { RetroService } from './retro.service';

@Module({
  controllers: [RetroController],
  providers: [RetroService],
})
export class RetroModule {}

