import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { loadProfile, login as doLogin, logout as doLogout, register as doRegister, resetPassword as doResetPassword } from '../services/authService';
import { clearAllDrafts } from '../hooks/useLocalStorageDraft';
import { clearAllServiceCaches } from '../utils/serviceFactory';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    if (!auth.currentUser) {
      setUser(null);
      return null;
    }
    const profile = await loadProfile(auth.currentUser);
    setUser(profile);
    return profile;
  }

  useEffect(() => {
    let isFirstEvent = true;
    let signOutDebounceId = null;

    const unsub = onAuthStateChanged(auth, async (authUser) => {
      if (signOutDebounceId) {
        clearTimeout(signOutDebounceId);
        signOutDebounceId = null;
      }

      if (!authUser) {
        if (isFirstEvent) {
          // Primeira checagem: usuário ainda não autenticado — mostra login imediatamente
          setUser(null);
          setLoading(false);
        } else {
          // Desconexão transitória: espera 3s antes de limpar a sessão
          signOutDebounceId = setTimeout(() => {
            signOutDebounceId = null;
            setUser(null);
            setLoading(false);
          }, 3000);
        }
        isFirstEvent = false;
        return;
      }

      isFirstEvent = false;

      try {
        const profile = await loadProfile(authUser);
        setUser(profile);
      } catch {
        setUser({
          uid: authUser.uid,
          email: authUser.email,
          nome: authUser.displayName || '',
          perfil: 'Utilizador',
          status: 'Pendente',
          role: 'viewer',
          perfilAtualizadoPrimeiroLogin: false,
        });
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsub();
      if (signOutDebounceId) clearTimeout(signOutDebounceId);
    };
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
        await doLogout();
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
