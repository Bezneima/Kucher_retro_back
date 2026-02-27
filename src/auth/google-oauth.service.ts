import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthProvider, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, createVerify, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

type GoogleTokenResponse = {
  id_token?: string;
};

type GoogleJwtHeader = {
  alg: string;
  kid: string;
  typ?: string;
};

type GoogleIdTokenPayload = {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

type GoogleCertCache = {
  certs: Record<string, string>;
  expiresAtMs: number;
};

type GoogleCallbackParams = {
  code?: string;
  state?: string;
  error?: string;
};

type ConsumedStateResult =
  | { ok: true; returnTo: string }
  | { ok: false; reason: 'missing' | 'mismatch' | 'expired' | 'reused' };

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
const DEFAULT_SCOPES = 'openid email profile';
const DEFAULT_STATE_TTL_SEC = 300;
const DEFAULT_EXCHANGE_TOKEN_TTL_SEC = 60;
const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class GoogleOAuthService {
  private readonly googleClientId = getRequiredEnv('GOOGLE_CLIENT_ID');
  private readonly googleClientSecret = getRequiredEnv('GOOGLE_CLIENT_SECRET');
  private readonly googleRedirectUri = getRequiredEnv('GOOGLE_OAUTH_REDIRECT_URI');
  private readonly frontendUrl = getRequiredEnv('FRONTEND_URL');
  private readonly scopes = getStringEnv('GOOGLE_OAUTH_SCOPES', DEFAULT_SCOPES);
  private readonly stateTtlSec = getIntEnv(
    'GOOGLE_OAUTH_STATE_TTL_SEC',
    DEFAULT_STATE_TTL_SEC,
  );
  private readonly exchangeTokenTtlSec = getIntEnv(
    'GOOGLE_EXCHANGE_TOKEN_TTL_SEC',
    DEFAULT_EXCHANGE_TOKEN_TTL_SEC,
  );

  private certCache: GoogleCertCache | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async getStartRedirectUrl(returnToRaw?: string): Promise<string> {
    const returnTo = normalizeReturnTo(returnToRaw);

    const state = generateRandomToken();
    const stateHash = hashToken(state);

    await this.prisma.oauthState.create({
      data: {
        stateHash,
        returnTo,
        expiresAt: addSeconds(this.stateTtlSec),
      },
    });

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set('client_id', this.googleClientId);
    url.searchParams.set('redirect_uri', this.googleRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');

    return url.toString();
  }

  async handleCallback(params: GoogleCallbackParams): Promise<string> {
    const stateResult = await this.consumeState(params.state);
    if (!stateResult.ok) {
      return this.buildAuthErrorRedirect(stateErrorToCode(stateResult.reason));
    }

    if (params.error === 'access_denied') {
      return this.buildAuthErrorRedirect('google_consent_denied', stateResult.returnTo);
    }

    if (params.error) {
      return this.buildAuthErrorRedirect('google_oauth_error', stateResult.returnTo);
    }

    if (!params.code) {
      return this.buildAuthErrorRedirect('google_code_missing', stateResult.returnTo);
    }

    try {
      const googleTokens = await this.exchangeCodeForGoogleTokens(params.code);
      const claims = await this.validateGoogleIdToken(googleTokens.id_token);
      const user = await this.findOrCreateGoogleUser(claims);
      const appTokens = await this.authService.issueAppTokenPair(user);

      const exchangeToken = generateRandomToken();
      await this.prisma.authExchangeToken.create({
        data: {
          tokenHash: hashToken(exchangeToken),
          userId: user.id,
          accessToken: appTokens.accessToken,
          refreshToken: appTokens.refreshToken,
          expiresAt: addSeconds(this.exchangeTokenTtlSec),
        },
      });

      return this.buildFrontendUrl('/auth/google/callback', {
        exchangeToken,
        returnTo: stateResult.returnTo,
      });
    } catch (error) {
      if (error instanceof AccountLinkConflictError) {
        return this.buildAuthErrorRedirect('google_account_link_conflict', stateResult.returnTo);
      }

      return this.buildAuthErrorRedirect('google_auth_failed', stateResult.returnTo);
    }
  }

  async exchangeToken(exchangeTokenRaw: string) {
    const exchangeToken = exchangeTokenRaw.trim();
    if (!exchangeToken) {
      throw new BadRequestException('exchangeToken is required');
    }

    const exchangeRecord = await this.prisma.$transaction(async (tx) => {
      const tokenHash = hashToken(exchangeToken);
      const record = await tx.authExchangeToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          accessToken: true,
          refreshToken: true,
          usedAt: true,
          expiresAt: true,
        },
      });

      if (!record || record.usedAt || record.expiresAt <= new Date()) {
        return null;
      }

      const updateResult = await tx.authExchangeToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (updateResult.count !== 1) {
        return null;
      }

      return {
        accessToken: record.accessToken,
        refreshToken: record.refreshToken,
      };
    });

    if (!exchangeRecord) {
      throw new UnauthorizedException('Invalid or expired exchange token');
    }

    return exchangeRecord;
  }

  private async consumeState(stateRaw?: string): Promise<ConsumedStateResult> {
    const state = stateRaw?.trim();
    if (!state) {
      return { ok: false, reason: 'missing' };
    }

    const stateRecord = await this.prisma.oauthState.findUnique({
      where: { stateHash: hashToken(state) },
      select: {
        id: true,
        returnTo: true,
        usedAt: true,
        expiresAt: true,
      },
    });

    if (!stateRecord) {
      return { ok: false, reason: 'mismatch' };
    }

    if (stateRecord.usedAt) {
      return { ok: false, reason: 'reused' };
    }

    if (stateRecord.expiresAt <= new Date()) {
      return { ok: false, reason: 'expired' };
    }

    const updateResult = await this.prisma.oauthState.updateMany({
      where: {
        id: stateRecord.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (updateResult.count !== 1) {
      return { ok: false, reason: 'reused' };
    }

    return { ok: true, returnTo: stateRecord.returnTo };
  }

  private async exchangeCodeForGoogleTokens(code: string): Promise<GoogleTokenResponse> {
    const formData = new URLSearchParams({
      code,
      client_id: this.googleClientId,
      client_secret: this.googleClientSecret,
      redirect_uri: this.googleRedirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to exchange Google authorization code');
    }

    const payload = (await response.json()) as GoogleTokenResponse;
    if (!payload.id_token) {
      throw new Error('Google response does not contain id_token');
    }

    return payload;
  }

  private async validateGoogleIdToken(idToken?: string): Promise<GoogleIdTokenPayload> {
    if (!idToken) {
      throw new Error('id_token is required');
    }

    const chunks = idToken.split('.');
    if (chunks.length !== 3) {
      throw new Error('Malformed id_token');
    }

    const [rawHeader, rawPayload, rawSignature] = chunks;
    const header = parseJwtPart<GoogleJwtHeader>(rawHeader);
    const payload = parseJwtPart<GoogleIdTokenPayload>(rawPayload);

    if (header.alg !== 'RS256' || !header.kid) {
      throw new Error('Unsupported Google token header');
    }

    const cert = await this.getGoogleCertByKid(header.kid);

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${rawHeader}.${rawPayload}`);
    verifier.end();

    const signature = decodeBase64Url(rawSignature);
    const isSignatureValid = verifier.verify(cert, signature);
    if (!isSignatureValid) {
      throw new Error('Invalid Google token signature');
    }

    if (!payload.sub) {
      throw new Error('Google token subject is missing');
    }

    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      throw new Error('Google token is expired');
    }

    const validIssuers = new Set(['accounts.google.com', 'https://accounts.google.com']);
    if (!validIssuers.has(payload.iss)) {
      throw new Error('Google token issuer is invalid');
    }

    if (payload.aud !== this.googleClientId) {
      throw new Error('Google token audience is invalid');
    }

    return payload;
  }

  private async getGoogleCertByKid(kid: string): Promise<string> {
    const now = Date.now();
    const certFromCache = this.certCache?.certs[kid];

    if (certFromCache && this.certCache && this.certCache.expiresAtMs > now) {
      return certFromCache;
    }

    const response = await fetch(GOOGLE_CERTS_URL, { method: 'GET' });
    if (!response.ok) {
      throw new Error('Failed to fetch Google certs');
    }

    const certs = (await response.json()) as Record<string, string>;
    const maxAgeMs = getMaxAgeFromCacheControl(response.headers.get('cache-control')) * 1000;

    this.certCache = {
      certs,
      expiresAtMs: now + maxAgeMs,
    };

    const cert = certs[kid];
    if (!cert) {
      throw new Error('Google cert for token kid not found');
    }

    return cert;
  }

  private async findOrCreateGoogleUser(claims: GoogleIdTokenPayload): Promise<User> {
    const email = claims.email ? normalizeEmail(claims.email) : '';
    const name = claims.name?.trim() || null;

    if (!email || claims.email_verified !== true) {
      throw new Error('Google email is missing or not verified');
    }

    const passwordHash = await bcrypt.hash(generateRandomToken(), PASSWORD_SALT_ROUNDS);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingBySub = await tx.user.findUnique({
          where: { googleSub: claims.sub },
        });

        if (existingBySub) {
          if (
            existingBySub.googleEmail !== email ||
            existingBySub.authProvider !== AuthProvider.GOOGLE
          ) {
            return tx.user.update({
              where: { id: existingBySub.id },
              data: {
                authProvider: AuthProvider.GOOGLE,
                googleEmail: email,
              },
            });
          }

          return existingBySub;
        }

        const existingByEmail = await tx.user.findUnique({
          where: { email },
        });

        if (existingByEmail) {
          if (existingByEmail.googleSub && existingByEmail.googleSub !== claims.sub) {
            throw new AccountLinkConflictError();
          }

          return tx.user.update({
            where: { id: existingByEmail.id },
            data: {
              authProvider: AuthProvider.GOOGLE,
              googleSub: claims.sub,
              googleEmail: email,
            },
          });
        }

        return tx.user.create({
          data: {
            email,
            passwordHash,
            name,
            authProvider: AuthProvider.GOOGLE,
            googleSub: claims.sub,
            googleEmail: email,
          },
        });
      });
    } catch (error) {
      if (error instanceof AccountLinkConflictError) {
        throw error;
      }

      if (isUniqueViolation(error)) {
        const existingBySub = await this.prisma.user.findUnique({
          where: { googleSub: claims.sub },
        });
        if (existingBySub) {
          return existingBySub;
        }
      }

      throw error;
    }
  }

  private buildAuthErrorRedirect(errorCode: string, returnTo = '/'): string {
    return this.buildFrontendUrl('/auth', {
      error: errorCode,
      returnTo,
    });
  }

  private buildFrontendUrl(pathname: string, params: Record<string, string>): string {
    const url = new URL(pathname, this.frontendUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }
}

class AccountLinkConflictError extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function generateRandomToken(): string {
  return randomBytes(32).toString('base64url');
}

function decodeBase64Url(input: string): Buffer {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);

  return Buffer.from(`${base64}${padding}`, 'base64');
}

function parseJwtPart<T>(input: string): T {
  const payload = decodeBase64Url(input).toString('utf8');
  return JSON.parse(payload) as T;
}

function getMaxAgeFromCacheControl(cacheControl: string | null): number {
  if (!cacheControl) {
    return 300;
  }

  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  if (!maxAgeMatch) {
    return 300;
  }

  const parsed = Number(maxAgeMatch[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 300;
  }

  return parsed;
}

function addSeconds(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getStringEnv(name: string, fallbackValue: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallbackValue;
  }

  return value;
}

function getIntEnv(name: string, fallbackValue: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallbackValue;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function stateErrorToCode(
  reason: 'missing' | 'mismatch' | 'expired' | 'reused',
): string {
  switch (reason) {
    case 'expired':
      return 'google_state_expired';
    case 'reused':
      return 'google_state_reused';
    case 'mismatch':
    case 'missing':
      return 'google_state_invalid';
    default:
      return 'google_state_invalid';
  }
}

export function normalizeReturnTo(returnToRaw?: string): string {
  const returnTo = returnToRaw?.trim();
  if (!returnTo) {
    return '/';
  }

  if (!isSafeReturnTo(returnTo)) {
    throw new BadRequestException('Invalid returnTo value');
  }

  return returnTo;
}

export function isSafeReturnTo(returnTo: string): boolean {
  if (!returnTo.startsWith('/')) {
    return false;
  }

  if (returnTo.startsWith('//')) {
    return false;
  }

  if (returnTo.includes('\\')) {
    return false;
  }

  try {
    const parsed = new URL(returnTo, 'http://localhost');
    return parsed.origin === 'http://localhost' && parsed.pathname.startsWith('/');
  } catch {
    return false;
  }
}
