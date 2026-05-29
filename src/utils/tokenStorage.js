import { API_BASE_URL } from './serviceFactory';

let accessToken = null;
let refreshPromise = null;

const REFRESH_TOKEN_KEY = '__geomonitor_refresh_token';
// Flag (nao-httpOnly) setado pelo backend junto ao cookie httpOnly do refresh.
// Sinaliza que ha sessao compartilhada entre subdominios (SSO) mesmo sem token
// no localStorage — ex.: o relat abrindo apos login feito no geo.
const SESSION_HINT_COOKIE = 'gm_session';

export function storeTokens(newAccessToken, newRefreshToken) {
  accessToken = newAccessToken;
  if (newRefreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
  }
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function hasSessionHintCookie() {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((c) => c.trim().startsWith(`${SESSION_HINT_COOKIE}=`));
}

// Apaga o hint cookie no cliente (best-effort) para evitar tentativas repetidas
// de refresh apos uma falha. O clear autoritativo e o /auth/logout no servidor.
function clearSessionHintCookie() {
  if (typeof document === 'undefined') return;
  const onLimaRio = typeof window !== 'undefined'
    && String(window.location.hostname || '').endsWith('lima.rio.br');
  const domainPart = onLimaRio ? '; domain=.lima.rio.br' : '';
  document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; path=/${domainPart}`;
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearSessionHintCookie();
}

export function hasStoredSession() {
  return !!localStorage.getItem(REFRESH_TOKEN_KEY) || hasSessionHintCookie();
}

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const storedRefreshToken = getRefreshToken();
  // Sem token no localStorage E sem hint cookie => nao ha sessao a restaurar.
  if (!storedRefreshToken && !hasSessionHintCookie()) {
    accessToken = null;
    return null;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Envia o cookie httpOnly gm_refresh (SSO). Body so quando ha token local.
        credentials: 'include',
        body: JSON.stringify(storedRefreshToken ? { refreshToken: storedRefreshToken } : {}),
      });

      if (!res.ok) {
        clearTokens();
        return null;
      }

      const { data } = await res.json();
      storeTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
