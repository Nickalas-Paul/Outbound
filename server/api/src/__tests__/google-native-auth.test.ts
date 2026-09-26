/**
 * Unit tests for Google ID token verification (mocked JWT / google-auth-library).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const verifyIdTokenMock = vi.fn();

vi.mock('../config/database', () => ({
  pool: {
    query: (...args: unknown[]) => queryMock(...args),
    connect: vi.fn(),
  },
}));

vi.mock('../config/redis', () => ({
  cacheRevokedRefreshToken: vi.fn(),
  isRefreshTokenRevokedInCache: vi.fn().mockResolvedValue(false),
}));

vi.mock('../config/env', () => ({}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdTokenMock;
  },
}));

describe('handleGoogleNativeIdToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.GOOGLE_CLIENT_ID = 'test-web-client-id.apps.googleusercontent.com';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-unit-tests';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
  });

  it('rejects tokens with wrong issuer', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        sub: 'g-1',
        email: 'user@example.com',
        iss: 'https://evil.example',
        aud: process.env.GOOGLE_CLIENT_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    });

    const { handleGoogleNativeIdToken, AuthError } = await import(
      '../services/auth.service'
    );

    await expect(handleGoogleNativeIdToken('fake.jwt')).rejects.toBeInstanceOf(
      AuthError
    );
    await expect(handleGoogleNativeIdToken('fake.jwt')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid Google ID token issuer',
    });
  });

  it('rejects tokens with wrong audience', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        sub: 'g-1',
        email: 'user@example.com',
        iss: 'https://accounts.google.com',
        aud: 'other-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    });

    const { handleGoogleNativeIdToken } = await import('../services/auth.service');

    await expect(handleGoogleNativeIdToken('fake.jwt')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid Google ID token audience',
    });
  });

  it('upserts user and returns Outbound tokens for a valid ID token', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-42',
        email: 'nico@example.com',
        name: 'Nico',
        picture: 'https://example.com/a.png',
        iss: 'accounts.google.com',
        aud: process.env.GOOGLE_CLIENT_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    });

    const userRow = {
      id: 'user-1',
      email: 'nico@example.com',
      password_hash: null,
      display_name: 'Nico',
      avatar_url: 'https://example.com/a.png',
      subscription_tier: 'free',
      google_id: 'google-sub-42',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // by google_id
      .mockResolvedValueOnce({ rows: [] }) // by email
      .mockResolvedValueOnce({ rows: [userRow] }) // insert user
      .mockResolvedValueOnce({ rows: [] }); // insert refresh_token

    const { handleGoogleNativeIdToken } = await import('../services/auth.service');
    const result = await handleGoogleNativeIdToken('valid.jwt.token');

    expect(result.user.email).toBe('nico@example.com');
    expect(result.user.googleId).toBe('google-sub-42');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(verifyIdTokenMock).toHaveBeenCalledWith({
      idToken: 'valid.jwt.token',
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  });
});
