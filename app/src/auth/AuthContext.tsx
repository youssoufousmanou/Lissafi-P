import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { clearAuthSession, getAuthSession, saveAuthSession } from '../storage/authStorage';
import { AuthSession, User } from './types';

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAuthSession()
      .then(setSession)
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.accessToken),
      isLoading,
      accessToken: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      user: session?.user ?? null,
      async signIn(nextSession: AuthSession) {
        await saveAuthSession(nextSession);
        setSession(nextSession);
      },
      async signOut() {
        await clearAuthSession();
        setSession(null);
      },
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider.');
  }

  return context;
}
