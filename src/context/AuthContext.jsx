import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadProfile, login as doLogin, logout as doLogout, register as doRegister, resetPassword as doResetPassword } from '../services/authService';
import { clearAllDrafts } from '../hooks/useLocalStorageDraft';
import { clearAllServiceCaches } from '../utils/serviceFactory';
import { hasStoredSession, refreshAccessToken, clearTokens } from '../utils/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    try {
      const profile = await loadProfile();
      setUser(profile);
      return profile;
    } catch {
      setUser(null);
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!hasStoredSession()) {
        setLoading(false);
        return;
      }

      try {
        const token = await refreshAccessToken();
        if (cancelled) return;

        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }

        const profile = await loadProfile();
        if (cancelled) return;
        setUser(profile);
      } catch {
        if (!cancelled) {
          clearTokens();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      refreshProfile,
      async login(email, password) {
        const profile = await doLogin(email, password);
        setUser(profile);
      },
      async register(email, password, nome) {
        const profile = await doRegister(email, password, nome);
        setUser(profile);
      },
      async resetPassword(email) {
        await doResetPassword(email);
      },
      async logout() {
        doLogout();
        clearAllDrafts();
        clearAllServiceCaches();
        setUser(null);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
