import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

type JwtPayload = {
  sub: string;
  email: string;
  exp?: number;
};

type AuthUserResponse = {
  id: string;
  email: string;
  name: string | null;
};

type AuthWithTokensResponse = {
  user: AuthUserResponse;
  accessToken: string;
  refreshToken: string;
};

type JwtExpiresIn = NonNullable<SignOptions['expiresIn']>;

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly accessSecret = getRequiredEnv('JWT_ACCESS_SECRET');
  private readonly accessExpiresIn = getJwtExpiresInEnv('JWT_ACCESS_EXPIRES_IN');
  private readonly refreshSecret = getRequiredEnv('JWT_REFRESH_SECRET');
  private readonly refreshExpiresIn = getJwtExpiresInEnv(
    'JWT_REFRESH_EXPIRES_IN',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthWithTokensResponse> {
    const email = normalizeEmail(dto.email);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name?.trim() || null,
      },
    });

    const tokenPair = await this.issueTokenPair(user);
    await this.storeRefreshToken(user.id, tokenPair.refreshToken);

    return {
      user: this.toAuthUser(user),
      ...tokenPair,
    };
  }

  async login(dto: LoginDto): Promise<AuthWithTokensResponse> {
    const email = normalizeEmail(dto.email);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokenPair = await this.issueTokenPair(user);
    await this.storeRefreshToken(user.id, tokenPair.refreshToken);

    return {
      user: this.toAuthUser(user),
      ...tokenPair,
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const tokenPair = await this.issueTokenPair(storedToken.user);
    await this.storeRefreshToken(storedToken.user.id, tokenPair.refreshToken);

    return tokenPair;
  }

  async logout(userId: string, refreshToken: string) {
    const tokenHash = hashToken(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  async me(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateMe(userId: string, name: string): Promise<AuthUserResponse> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Name cannot be empty');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existingUser) {
      throw new UnauthorizedException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { name: normalizedName },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    const isNewPasswordSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isNewPasswordSame) {
      throw new BadRequestException(
        'New password must be different from old password',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  private async issueTokenPair(user: Pick<User, 'id' | 'email'>) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const decoded = this.jwtService.decode(refreshToken) as JwtPayload | null;
    if (!decoded?.exp) {
      throw new InternalServerErrorException(
        'Refresh token expiration is missing',
      );
    }

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private toAuthUser(
    user: Pick<User, 'id' | 'email' | 'name'>,
  ): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getJwtExpiresInEnv(name: string): JwtExpiresIn {
  const value = getRequiredEnv(name).trim();
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  return value as JwtExpiresIn;
}
