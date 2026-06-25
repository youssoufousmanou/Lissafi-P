import { apiClient } from '../api/client';
import { AuthSession, User } from './types';

export const DEFAULT_ACTIVITY_TYPE = 'COMMERCE_GENERAL';

type RegisterResponse = {
  identifier?: string;
  userId?: string | number;
  user?: User;
  message?: string;
};

type VerifyOtpResponse = RegisterResponse & Partial<AuthSession>;

type SetPasswordResponse = Partial<AuthSession> & {
  data?: Partial<AuthSession>;
  userId?: string | number;
};

export function register(phone: string, activityType = DEFAULT_ACTIVITY_TYPE) {
  return apiClient<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      activity_type: activityType,
    }),
  });
}

export function verifyOtp(identifier: string, token: string) {
  return apiClient<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier, token }),
  });
}

export function resendOtp(identifier: string) {
  return apiClient<{ message?: string }>('/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

export function setPassword(userId: string | number, password: string) {
  return apiClient<SetPasswordResponse>('/auth/set-password', {
    method: 'POST',
    body: JSON.stringify({ userId, password }),
  });
}

export function normalizeAuthSession(response: SetPasswordResponse): AuthSession | null {
  const payload = response.data ?? response;

  if (payload.accessToken && payload.refreshToken && payload.user) {
    return {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user,
    };
  }

  return null;
}
