import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RetroModule } from './retro/retro.module';

@Module({
  imports: [PrismaModule, RetroModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
