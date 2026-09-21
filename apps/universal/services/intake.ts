/**
 * Trip intake client — POST /api/intake
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
