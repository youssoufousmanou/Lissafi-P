import * as SecureStore from 'expo-secure-store';

import { AuthSession } from '../auth/types';

const AUTH_SESSION_KEY = 'lissafi.auth.session';

export async function getAuthSession(): Promise<AuthSession | null> {
  const rawSession = await SecureStore.getItemAsync(AUTH_SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    await clearAuthSession();
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}

export async function getAuthToken(): Promise<string | null> {
  const session = await getAuthSession();

  return session?.accessToken ?? null;
}
