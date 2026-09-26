/**
 * Trip intake client — POST /api/intake + email verification
 */

import type { IntakePayload } from '@outbound/core';

import { ApiError, getApiUrl } from '@/services/api';
import { getStoredAccessToken } from '@/services/tokenStorage';

export type IntakeSuccess = {
  success: true;
  tripId: string;
  message: string;
};

export type IntakeValidationError = {
  error: string;
  details?: Array<{ path: string; message: string }>;
};

export type VerifyEmailSuccess = {
  success: true;
  alreadyVerified: boolean;
  message: string;
  clientProfileId: string;
  tripId: string | null;
};

export type VerifyEmailFailure = {
  success: false;
  error: string;
  reason: 'invalid' | 'expired' | 'already_used';
};

export type VerifyStatus =
  | { status: 'valid'; clientProfileId: string }
  | { status: 'expired' | 'already_used' | 'invalid' };

export async function submitIntake(
  payload: IntakePayload
): Promise<IntakeSuccess> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = await getStoredAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiUrl()}/api/intake`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errBody = body as IntakeValidationError | { error?: string } | null;
    const message =
      errBody && typeof errBody === 'object' && 'error' in errBody && errBody.error
        ? String(errBody.error)
        : `Request failed (${response.status})`;
    const error = new ApiError(response.status, message) as ApiError & {
      details?: Array<{ path: string; message: string }>;
    };
    if (
      errBody &&
      typeof errBody === 'object' &&
      'details' in errBody &&
      Array.isArray(errBody.details)
    ) {
      error.details = errBody.details;
    }
    throw error;
  }

  return body as IntakeSuccess;
}

/** Non-mutating GET status for a verification token. */
export async function peekVerifyToken(token: string): Promise<VerifyStatus> {
  const response = await fetch(
    `${getApiUrl()}/api/intake/verify?token=${encodeURIComponent(token)}`
  );
  if (!response.ok) {
    throw new ApiError(response.status, 'Could not check verification status');
  }
  return (await response.json()) as VerifyStatus;
}

/** POST — consume token and start composition when newly verified. */
export async function postVerifyToken(
  token: string
): Promise<VerifyEmailSuccess> {
  const response = await fetch(`${getApiUrl()}/api/intake/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errBody = body as VerifyEmailFailure | { error?: string } | null;
    const message =
      errBody && typeof errBody === 'object' && 'error' in errBody && errBody.error
        ? String(errBody.error)
        : `Verification failed (${response.status})`;
    const error = new ApiError(response.status, message) as ApiError & {
      reason?: string;
    };
    if (
      errBody &&
      typeof errBody === 'object' &&
      'reason' in errBody &&
      typeof errBody.reason === 'string'
    ) {
      error.reason = errBody.reason;
    }
    throw error;
  }

  return body as VerifyEmailSuccess;
}
