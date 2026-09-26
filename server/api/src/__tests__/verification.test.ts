/**
 * Unit tests for email verification consume + idempotency.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const connectMock = vi.fn();
const beginMock = vi.fn();
const commitMock = vi.fn();
const rollbackMock = vi.fn();
const releaseMock = vi.fn();

vi.mock('../config/database', () => ({
  pool: {
    query: (...args: unknown[]) => queryMock(...args),
    connect: () => connectMock(),
  },
}));

vi.mock('../config/env', () => ({}));

import {
  consumeVerificationToken,
  peekVerificationToken,
} from '../services/verification';

function clientQuery(handler: (sql: string, params?: unknown[]) => unknown) {
  return async (sql: string, params?: unknown[]) => {
    const s = sql.replace(/\s+/g, ' ');
    if (s.includes('BEGIN')) {
      beginMock();
      return { rows: [] };
    }
    if (s.includes('COMMIT')) {
      commitMock();
      return { rows: [] };
    }
    if (s.includes('ROLLBACK')) {
      rollbackMock();
      return { rows: [] };
    }
    return handler(s, params);
  };
}

describe('consumeVerificationToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectMock.mockResolvedValue({
      query: clientQuery(() => ({ rows: [] })),
      release: releaseMock,
    });
  });

  it('returns alreadyVerified without mutating when token used and email verified', async () => {
    let updateCount = 0;
    connectMock.mockResolvedValue({
      query: clientQuery((sql) => {
        if (sql.includes('FROM verification_tokens') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: 'tok-1',
                client_profile_id: 'cp-1',
                expires_at: new Date(Date.now() + 60_000),
                used_at: new Date(),
              },
            ],
          };
        }
        if (sql.includes('FROM client_profiles')) {
          return { rows: [{ email_verified: true }] };
        }
        if (sql.includes('FROM trips')) {
          return { rows: [{ id: 'trip-9' }] };
        }
        if (sql.includes('UPDATE')) {
          updateCount += 1;
        }
        return { rows: [] };
      }),
      release: releaseMock,
    });

    const result = await consumeVerificationToken('abc123');
    expect(result).toEqual({
      ok: true,
      alreadyVerified: true,
      clientProfileId: 'cp-1',
      tripId: 'trip-9',
    });
    expect(updateCount).toBe(0);
    expect(commitMock).toHaveBeenCalled();
  });

  it('marks unused token, advances trip, and signals schedule needed', async () => {
    connectMock.mockResolvedValue({
      query: clientQuery((sql) => {
        if (sql.includes('FROM verification_tokens') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: 'tok-2',
                client_profile_id: 'cp-2',
                expires_at: new Date(Date.now() + 60_000),
                used_at: null,
              },
            ],
          };
        }
        if (sql.includes("SET status = 'composing'")) {
          return { rows: [{ id: 'trip-new' }] };
        }
        return { rows: [] };
      }),
      release: releaseMock,
    });

    const result = await consumeVerificationToken('fresh-token');
    expect(result).toEqual({
      ok: true,
      alreadyVerified: false,
      clientProfileId: 'cp-2',
      tripId: 'trip-new',
      composed: true,
    });
    expect(commitMock).toHaveBeenCalled();
  });

  it('returns expired for past expiry', async () => {
    connectMock.mockResolvedValue({
      query: clientQuery((sql) => {
        if (sql.includes('FROM verification_tokens') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: 'tok-3',
                client_profile_id: 'cp-3',
                expires_at: new Date(Date.now() - 1000),
                used_at: null,
              },
            ],
          };
        }
        return { rows: [] };
      }),
      release: releaseMock,
    });

    const result = await consumeVerificationToken('old-token');
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('peekVerificationToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports status without mutating', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          client_profile_id: 'cp-1',
          expires_at: new Date(Date.now() + 60_000),
          used_at: null,
        },
      ],
    });

    const result = await peekVerificationToken('peek-me');
    expect(result).toEqual({ status: 'valid', clientProfileId: 'cp-1' });
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('reports already_used', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          client_profile_id: 'cp-1',
          expires_at: new Date(Date.now() + 60_000),
          used_at: new Date(),
        },
      ],
    });

    const result = await peekVerificationToken('used');
    expect(result).toEqual({ status: 'already_used' });
  });
});
