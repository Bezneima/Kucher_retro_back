import { UnauthorizedException } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import assert from 'node:assert/strict';
import { GoogleOAuthService } from '../src/auth/google-oauth.service';

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  authProvider: AuthProvider;
  googleSub: string | null;
  googleEmail: string | null;
};

type OauthStateRecord = {
  id: string;
  stateHash: string;
  returnTo: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

type ExchangeRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

class InMemoryPrisma {
  users: UserRecord[] = [];
  oauthStates: OauthStateRecord[] = [];
  authExchangeTokens: ExchangeRecord[] = [];

  private idSeq = 1;

  oauthState = {
    create: async ({ data }: { data: Omit<OauthStateRecord, 'id' | 'createdAt' | 'usedAt'> & { usedAt?: Date | null } }) => {
      const record: OauthStateRecord = {
        id: this.nextId('state'),
        stateHash: data.stateHash,
        returnTo: data.returnTo,
        expiresAt: data.expiresAt,
        usedAt: data.usedAt ?? null,
        createdAt: new Date(),
      };
      this.oauthStates.push(record);
      return record;
    },
    findUnique: async ({ where }: { where: { stateHash: string } }) => {
      return this.oauthStates.find((item) => item.stateHash === where.stateHash) ?? null;
    },
    updateMany: async ({ where, data }: { where: { id: string; usedAt: null; expiresAt: { gt: Date } }; data: { usedAt: Date } }) => {
      const state = this.oauthStates.find((item) => item.id === where.id);
      if (!state) {
        return { count: 0 };
      }

      if (state.usedAt !== where.usedAt) {
        return { count: 0 };
      }

      if (state.expiresAt <= where.expiresAt.gt) {
        return { count: 0 };
      }

      state.usedAt = data.usedAt;
      return { count: 1 };
    },
  };

  authExchangeToken = {
    create: async ({ data }: { data: Omit<ExchangeRecord, 'id' | 'createdAt' | 'usedAt'> & { usedAt?: Date | null } }) => {
      const record: ExchangeRecord = {
        id: this.nextId('exchange'),
        tokenHash: data.tokenHash,
        userId: data.userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        usedAt: data.usedAt ?? null,
        createdAt: new Date(),
      };
      this.authExchangeTokens.push(record);
      return record;
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }) => {
      const record = this.authExchangeTokens.find((item) => item.tokenHash === where.tokenHash);
      if (!record) {
        return null;
      }

      return {
        id: record.id,
        accessToken: record.accessToken,
        refreshToken: record.refreshToken,
        usedAt: record.usedAt,
        expiresAt: record.expiresAt,
      };
    },
    updateMany: async ({ where, data }: { where: { id: string; usedAt: null; expiresAt: { gt: Date } }; data: { usedAt: Date } }) => {
      const exchange = this.authExchangeTokens.find((item) => item.id === where.id);
      if (!exchange) {
        return { count: 0 };
      }

      if (exchange.usedAt !== where.usedAt) {
        return { count: 0 };
      }

      if (exchange.expiresAt <= where.expiresAt.gt) {
        return { count: 0 };
      }

      exchange.usedAt = data.usedAt;
      return { count: 1 };
    },
  };

  user = {
    findUnique: async ({ where }: { where: { id?: string; email?: string; googleSub?: string } }) => {
      if (where.id) {
        return this.users.find((user) => user.id === where.id) ?? null;
      }

      if (where.email) {
        return this.users.find((user) => user.email === where.email) ?? null;
      }

      if (where.googleSub) {
        return this.users.find((user) => user.googleSub === where.googleSub) ?? null;
      }

      return null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<UserRecord> }) => {
      const user = this.users.find((item) => item.id === where.id);
      if (!user) {
        throw new Error('user not found');
      }

      Object.assign(user, data);
      return user;
    },
    create: async ({ data }: { data: Omit<UserRecord, 'id'> }) => {
      const user: UserRecord = {
        id: this.nextId('user'),
        ...data,
      };
      this.users.push(user);
      return user;
    },
  };

  async $transaction<T>(
    input: ((tx: InMemoryPrisma) => Promise<T>) | Promise<unknown>[],
  ): Promise<T> {
    if (Array.isArray(input)) {
      await Promise.all(input);
      return undefined as T;
    }

    return input(this);
  }

  private nextId(prefix: string): string {
    const id = `${prefix}-${this.idSeq}`;
    this.idSeq += 1;
    return id;
  }
}

class FakeAuthService {
  async issueAppTokenPair(user: { id: string }) {
    return {
      accessToken: `access-${user.id}`,
      refreshToken: `refresh-${user.id}`,
    };
  }
}

function setRequiredEnv() {
  process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  process.env.GOOGLE_OAUTH_SCOPES = 'openid email profile';
  process.env.GOOGLE_OAUTH_STATE_TTL_SEC = '300';
  process.env.GOOGLE_EXCHANGE_TOKEN_TTL_SEC = '60';
}

function createService() {
  setRequiredEnv();
  const prisma = new InMemoryPrisma();
  const authService = new FakeAuthService();
  const service = new GoogleOAuthService(prisma as never, authService as never);

  return { service, prisma };
}

function getQueryParam(urlString: string, key: string): string {
  const value = new URL(urlString).searchParams.get(key);
  assert.ok(value, `Missing query param: ${key}`);
  return value;
}

async function assertUnauthorized(action: () => Promise<unknown>) {
  try {
    await action();
    assert.fail('Expected UnauthorizedException');
  } catch (error) {
    assert.ok(error instanceof UnauthorizedException);
  }
}

async function run() {
  await testExistingGoogleUserLogin();
  await testCreateNewGoogleUser();
  await testLinkLocalAccountByEmail();
  await testStateMismatchExpiredAndReused();
  await testExchangeTokenExpiredAndReused();
  await testNoAppTokensInUrl();
  await testConsentDeniedRedirect();

  console.log('Google OAuth flow tests: OK');
}

async function testExistingGoogleUserLogin() {
  const { service, prisma } = createService();

  prisma.users.push({
    id: 'u-google',
    email: 'google@example.com',
    passwordHash: 'hash',
    name: 'Google User',
    authProvider: AuthProvider.GOOGLE,
    googleSub: 'sub-existing',
    googleEmail: 'google@example.com',
  });

  const startUrl = await service.getStartRedirectUrl('/teams');
  const state = getQueryParam(startUrl, 'state');

  (service as unknown as { exchangeCodeForGoogleTokens: (code: string) => Promise<{ id_token: string }> }).exchangeCodeForGoogleTokens = async (code: string) => {
    assert.equal(code, 'valid-code');
    return { id_token: 'id-token' };
  };

  (service as unknown as { validateGoogleIdToken: () => Promise<{ sub: string; email: string; email_verified: true; iss: string; aud: string; exp: number; name: string }> }).validateGoogleIdToken = async () => ({
    sub: 'sub-existing',
    email: 'google@example.com',
    email_verified: true,
    iss: 'https://accounts.google.com',
    aud: 'google-client-id',
    exp: Math.floor(Date.now() / 1000) + 300,
    name: 'Google User',
  });

  const callbackUrl = await service.handleCallback({ code: 'valid-code', state });
  const exchangeToken = getQueryParam(callbackUrl, 'exchangeToken');
  assert.equal(getQueryParam(callbackUrl, 'returnTo'), '/teams');

  const exchangeResult = await service.exchangeToken(exchangeToken);
  assert.deepEqual(exchangeResult, {
    accessToken: 'access-u-google',
    refreshToken: 'refresh-u-google',
  });

  await assertUnauthorized(async () => {
    await service.exchangeToken(exchangeToken);
  });
}

async function testCreateNewGoogleUser() {
  const { service, prisma } = createService();

  const startUrl = await service.getStartRedirectUrl('/teams');
  const state = getQueryParam(startUrl, 'state');

  (service as unknown as { exchangeCodeForGoogleTokens: () => Promise<{ id_token: string }> }).exchangeCodeForGoogleTokens = async () => ({
    id_token: 'id-token',
  });

  (service as unknown as { validateGoogleIdToken: () => Promise<{ sub: string; email: string; email_verified: true; iss: string; aud: string; exp: number; name: string }> }).validateGoogleIdToken = async () => ({
    sub: 'sub-new',
    email: 'new-user@example.com',
    email_verified: true,
    iss: 'https://accounts.google.com',
    aud: 'google-client-id',
    exp: Math.floor(Date.now() / 1000) + 300,
    name: 'New User',
  });

  const callbackUrl = await service.handleCallback({ code: 'valid-code', state });
  const exchangeToken = getQueryParam(callbackUrl, 'exchangeToken');

  assert.equal(prisma.users.length, 1);
  assert.equal(prisma.users[0].email, 'new-user@example.com');
  assert.equal(prisma.users[0].authProvider, AuthProvider.GOOGLE);
  assert.equal(prisma.users[0].googleSub, 'sub-new');

  const exchangeResult = await service.exchangeToken(exchangeToken);
  assert.equal(exchangeResult.accessToken, `access-${prisma.users[0].id}`);
}

async function testLinkLocalAccountByEmail() {
  const { service, prisma } = createService();

  prisma.users.push({
    id: 'u-local',
    email: 'local@example.com',
    passwordHash: 'local-hash',
    name: 'Local User',
    authProvider: AuthProvider.LOCAL,
    googleSub: null,
    googleEmail: null,
  });

  const startUrl = await service.getStartRedirectUrl('/teams');
  const state = getQueryParam(startUrl, 'state');

  (service as unknown as { exchangeCodeForGoogleTokens: () => Promise<{ id_token: string }> }).exchangeCodeForGoogleTokens = async () => ({
    id_token: 'id-token',
  });

  (service as unknown as { validateGoogleIdToken: () => Promise<{ sub: string; email: string; email_verified: true; iss: string; aud: string; exp: number; name: string }> }).validateGoogleIdToken = async () => ({
    sub: 'sub-local-link',
    email: 'local@example.com',
    email_verified: true,
    iss: 'https://accounts.google.com',
    aud: 'google-client-id',
    exp: Math.floor(Date.now() / 1000) + 300,
    name: 'Local User',
  });

  await service.handleCallback({ code: 'valid-code', state });

  assert.equal(prisma.users.length, 1);
  assert.equal(prisma.users[0].id, 'u-local');
  assert.equal(prisma.users[0].googleSub, 'sub-local-link');
  assert.equal(prisma.users[0].authProvider, AuthProvider.GOOGLE);
}

async function testStateMismatchExpiredAndReused() {
  const { service, prisma } = createService();

  const mismatchUrl = await service.handleCallback({
    code: 'valid-code',
    state: 'unknown-state',
  });
  assert.equal(getQueryParam(mismatchUrl, 'error'), 'google_state_invalid');

  const expiredStart = await service.getStartRedirectUrl('/teams');
  const expiredState = getQueryParam(expiredStart, 'state');
  assert.ok(prisma.oauthStates[0]);
  prisma.oauthStates[0].expiresAt = new Date(Date.now() - 1000);

  const expiredUrl = await service.handleCallback({
    code: 'valid-code',
    state: expiredState,
  });
  assert.equal(getQueryParam(expiredUrl, 'error'), 'google_state_expired');

  const reusedStart = await service.getStartRedirectUrl('/teams');
  const reusedState = getQueryParam(reusedStart, 'state');

  (service as unknown as { exchangeCodeForGoogleTokens: () => Promise<{ id_token: string }> }).exchangeCodeForGoogleTokens = async () => ({
    id_token: 'id-token',
  });

  (service as unknown as { validateGoogleIdToken: () => Promise<{ sub: string; email: string; email_verified: true; iss: string; aud: string; exp: number; name: string }> }).validateGoogleIdToken = async () => ({
    sub: 'sub-reused',
    email: 'reused@example.com',
    email_verified: true,
    iss: 'https://accounts.google.com',
    aud: 'google-client-id',
    exp: Math.floor(Date.now() / 1000) + 300,
    name: 'Reused User',
  });

  await service.handleCallback({ code: 'valid-code', state: reusedState });

  const reusedUrl = await service.handleCallback({
    code: 'valid-code',
    state: reusedState,
  });
  assert.equal(getQueryParam(reusedUrl, 'error'), 'google_state_reused');
}

async function testExchangeTokenExpiredAndReused() {
  const { service, prisma } = createService();

  const startUrl = await service.getStartRedirectUrl('/teams');
  const state = getQueryParam(startUrl, 'state');

  (service as unknown as { exchangeCodeForGoogleTokens: () => Promise<{ id_token: string }> }).exchangeCodeForGoogleTokens = async () => ({
    id_token: 'id-token',
  });

  (service as unknown as { validateGoogleIdToken: () => Promise<{ sub: string; email: string; email_verified: true; iss: string; aud: string; exp: number; name: string }> }).validateGoogleIdToken = async () => ({
    sub: 'sub-expired',
    email: 'expired@example.com',
    email_verified: true,
    iss: 'https://accounts.google.com',
    aud: 'google-client-id',
    exp: Math.floor(Date.now() / 1000) + 300,
    name: 'Expired User',
  });

  const callbackUrl = await service.handleCallback({ code: 'valid-code', state });
  const exchangeToken = getQueryParam(callbackUrl, 'exchangeToken');

  assert.equal(prisma.authExchangeTokens.length, 1);
  prisma.authExchangeTokens[0].expiresAt = new Date(Date.now() - 1000);

  await assertUnauthorized(async () => {
    await service.exchangeToken(exchangeToken);
  });
}

async function testNoAppTokensInUrl() {
  const { service } = createService();

  const startUrl = await service.getStartRedirectUrl('/teams');
  assert.equal(new URL(startUrl).searchParams.get('accessToken'), null);
  assert.equal(new URL(startUrl).searchParams.get('refreshToken'), null);

  const state = getQueryParam(startUrl, 'state');

  (service as unknown as { exchangeCodeForGoogleTokens: () => Promise<{ id_token: string }> }).exchangeCodeForGoogleTokens = async () => ({
    id_token: 'id-token',
  });

  (service as unknown as { validateGoogleIdToken: () => Promise<{ sub: string; email: string; email_verified: true; iss: string; aud: string; exp: number; name: string }> }).validateGoogleIdToken = async () => ({
    sub: 'sub-no-url-tokens',
    email: 'safe-url@example.com',
    email_verified: true,
    iss: 'https://accounts.google.com',
    aud: 'google-client-id',
    exp: Math.floor(Date.now() / 1000) + 300,
    name: 'Safe URL User',
  });

  const callbackUrl = await service.handleCallback({ code: 'valid-code', state });
  const callback = new URL(callbackUrl);

  assert.equal(callback.searchParams.get('accessToken'), null);
  assert.equal(callback.searchParams.get('refreshToken'), null);
  assert.ok(callback.searchParams.get('exchangeToken'));
}

async function testConsentDeniedRedirect() {
  const { service } = createService();

  const startUrl = await service.getStartRedirectUrl('/teams');
  const state = getQueryParam(startUrl, 'state');

  const callbackUrl = await service.handleCallback({
    error: 'access_denied',
    state,
  });

  assert.equal(getQueryParam(callbackUrl, 'error'), 'google_consent_denied');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
