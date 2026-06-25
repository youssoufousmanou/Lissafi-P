import { apiClient } from '../api/client';
import { AuthSession, User } from './types';

export const DEFAULT_ACTIVITY_TYPE = 'COMMERCE_GENERAL';

type ApiDataResponse<T> = T & {
  data?: T;
  message?: string;
  success?: boolean;
};

type RegisterResponse = {
  identifier?: string;
  userId?: string | number;
  user?: User;
  message?: string;
};

type VerifyOtpResponse = RegisterResponse & Partial<AuthSession>;

type AuthSessionResponse = Partial<AuthSession> & {
  data?: Partial<AuthSession>;
  userId?: string | number;
};

type SetPasswordResponse = AuthSessionResponse;

type LoginResponse = AuthSessionResponse;

export function register(phone: string, activityType = DEFAULT_ACTIVITY_TYPE) {
  return apiClient<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      activity_type: activityType,
    }),
    skipAuth: true,
  });
}

export function verifyOtp(identifier: string, token: string) {
  return apiClient<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier, token }),
    skipAuth: true,
  });
}

export function resendOtp(identifier: string) {
  return apiClient<{ message?: string }>('/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
    skipAuth: true,
  });
}

export function setPassword(userId: string | number, password: string) {
  return apiClient<SetPasswordResponse>('/auth/set-password', {
    method: 'POST',
    body: JSON.stringify({ userId, password }),
    skipAuth: true,
  });
}

export function login(identifier: string, password: string) {
  return apiClient<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
    skipAuth: true,
  });
}

export function normalizeAuthSession(response: ApiDataResponse<Partial<AuthSession>>): AuthSession | null {
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
