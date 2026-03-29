import { API_BASE_URL } from './serviceFactory';

let accessToken = null;
let refreshPromise = null;

const REFRESH_TOKEN_KEY = '__geomonitor_refresh_token';

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

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasStoredSession() {
  return !!localStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const storedRefreshToken = getRefreshToken();
  if (!storedRefreshToken) {
    accessToken = null;
    return null;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
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
