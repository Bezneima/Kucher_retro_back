import { Injectable } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ANONYMOUS_USER_EMAIL = 'anonymous@system.local';
const ANONYMOUS_USER_NAME = 'Anonymous User';
const ANONYMOUS_USER_PASSWORD_HASH =
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8e9rN6byN1Nsx3Rp3XIanFkFJxux7i';

@Injectable()
export class AnonymousActorService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateGuestUserId(): Promise<string> {
    const existing = await this.prisma.user.findUnique({
      where: { email: ANONYMOUS_USER_EMAIL },
      select: { id: true },
    });

    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.user.create({
      data: {
        email: ANONYMOUS_USER_EMAIL,
        passwordHash: ANONYMOUS_USER_PASSWORD_HASH,
        name: ANONYMOUS_USER_NAME,
        authProvider: AuthProvider.LOCAL,
      },
      select: { id: true },
    });

    return created.id;
  }
}
