import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { setTokenAccessors } from '@shire/api-client';
import { AuthContext } from './auth-context.js';
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
} from './token-store.js';

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

// Wire up the API client fetcher
setTokenAccessors(getAccessToken, refreshAccessToken);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  // Try to restore session on mount
  useEffect(() => {
    const restore = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }

      const token = await refreshAccessToken();
      if (token) {
        setIsAuthenticated(true);
        // Fetch user info
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const user = (await res.json()) as { name?: string };
            setUserName(user.name ?? null);
          }
        } catch {
          // Not critical
        }
      }
      setIsLoading(false);
    };
    void restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? 'Login failed');
    }

    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      user?: { name?: string };
    };
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setIsAuthenticated(true);
    setUserName(data.user?.name ?? null);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setIsAuthenticated(false);
    setUserName(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, userName }}>
      {children}
    </AuthContext.Provider>
  );
}
