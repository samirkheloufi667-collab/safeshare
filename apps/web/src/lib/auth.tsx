import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken } from './api';
import type { Me } from './types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  me: Me | null;
  login: (email: string, password: string) => Promise<Me>;
  register: (input: { name: string; email: string; password: string }) => Promise<Me>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Simple indice « une session a été ouverte sur ce navigateur » — pas un
 * secret : le jeton reste dans le cookie httpOnly. Il évite d'appeler
 * /auth/refresh (et un 401 en console) pour un visiteur jamais connecté.
 */
const SESSION_HINT = 'safeshare.session';

function setHint(on: boolean) {
  try {
    if (on) localStorage.setItem(SESSION_HINT, '1');
    else localStorage.removeItem(SESSION_HINT);
  } catch {
    // Stockage indisponible (navigation privée) : sans conséquence.
  }
}

function hasHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(async () => {
    const profile = await api<Me>('/auth/me');
    setMe(profile);
    setStatus('authenticated');
    return profile;
  }, []);

  // Au chargement, le cookie de rafraîchissement suffit à retrouver la session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = hasHint() && (await refreshSession());
      if (cancelled) return;
      if (!ok) {
        setHint(false);
        setStatus('anonymous');
        return;
      }
      try {
        await loadMe();
      } catch {
        if (!cancelled) setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  const openSession = useCallback(
    async (path: string, body: unknown) => {
      const { accessToken } = await api<{ accessToken: string }>(path, { method: 'POST', json: body });
      setAccessToken(accessToken);
      setHint(true);
      return loadMe();
    },
    [loadMe],
  );

  const login = useCallback((email: string, password: string) => openSession('/auth/login', { email, password }), [openSession]);
  const register = useCallback((input: { name: string; email: string; password: string }) => openSession('/auth/register', input), [openSession]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    setHint(false);
    setMe(null);
    setStatus('anonymous');
  }, []);

  const reload = useCallback(async () => {
    await loadMe().catch(() => undefined);
  }, [loadMe]);

  const value = useMemo(
    () => ({ status, me, login, register, logout, reload }),
    [status, me, login, register, logout, reload],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
