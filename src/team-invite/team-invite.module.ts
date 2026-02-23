import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BoardShareController } from './board-share.controller';
import { TeamInviteController } from './team-invite.controller';
import { TeamInviteService } from './team-invite.service';

@Module({
  imports: [PrismaModule],
  controllers: [BoardShareController, TeamInviteController],
  providers: [TeamInviteService],
})
export class TeamInviteModule {}
