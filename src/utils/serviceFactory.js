import { getAccessToken, refreshAccessToken } from './tokenStorage';
import { fetchWithHateoas, isNetworkFailureError, normalizeRequestError } from './apiClient';

const FALLBACK_PROD_API_BASE_URL = 'https://geomonitor-api.fly.dev/api';

const CACHE_PREFIX = '__geocache_v1_';
const CACHE_TTL_MS = 20 * 60 * 1000;
const ACTIVE_REFRESHERS = new Map();

const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 60000;
const RETRY_JITTER = 0.2;

function isAuthError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('não autenticado')
    || msg.includes('nao autenticado')
    || msg.includes('401')
    || msg.includes('403')
    || msg.includes('unauthorized')
    || msg.includes('forbidden')
    || msg.includes('expired');
}

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return !payload.exp || (payload.exp * 1000) < (Date.now() + 30000);
  } catch {
    return true;
  }
}

function getRetryDelay(attempt) {
  const base = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS);
  const jitter = base * RETRY_JITTER * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

function getCacheStorageKey(key) {
  return CACHE_PREFIX + key;
}

function clearCache(key) {
  try {
    sessionStorage.removeItem(getCacheStorageKey(key));
  } catch { /* ignore */ }
}

function registerActiveRefresher(resourcePath, refresher) {
  const key = String(resourcePath || '').trim();
  if (!key || typeof refresher !== 'function') return () => { };

  if (!ACTIVE_REFRESHERS.has(key)) {
    ACTIVE_REFRESHERS.set(key, new Set());
  }

  const refreshers = ACTIVE_REFRESHERS.get(key);
  refreshers.add(refresher);

  return () => {
    refreshers.delete(refresher);
    if (refreshers.size === 0) {
      ACTIVE_REFRESHERS.delete(key);
    }
  };
}

function triggerActiveRefresh(resourcePath) {
  const refreshers = ACTIVE_REFRESHERS.get(String(resourcePath || '').trim());
  if (!refreshers || refreshers.size === 0) return;
  refreshers.forEach((refresh) => {
    try {
      refresh();
    } catch {
      // Ignore refresh failures and let the next poll recover.
    }
  });
}

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(getCacheStorageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const isWrappedEntry = parsed
      && typeof parsed === 'object'
      && !Array.isArray(parsed)
      && Object.prototype.hasOwnProperty.call(parsed, 'data')
      && Object.prototype.hasOwnProperty.call(parsed, 'timestamp');

    if (!isWrappedEntry) {
      clearCache(key);
      return null;
    }

    const timestamp = Number(parsed.timestamp);
    if (!Number.isFinite(timestamp) || (Date.now() - timestamp) > CACHE_TTL_MS) {
      clearCache(key);
      return null;
    }

    return parsed.data ?? null;
  } catch { return null; }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(getCacheStorageKey(key), JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch { /* ignore */ }
}

export function clearAllServiceCaches() {
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}
const DEFAULT_POLL_INTERVAL_MS = 900000;

function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const hasWindow = typeof window !== 'undefined';
  const hostname = hasWindow ? String(window.location.hostname || '').toLowerCase() : '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (configured) {
    const pointsToLocal = /localhost|127\.0\.0\.1/i.test(configured);
    if (!isLocalHost && pointsToLocal) {
      return 'https://geomonitor-api.fly.dev/api';
    }
    return configured;
  }

  return isLocalHost ? 'http://localhost:8080/api' : 'https://geomonitor-api.fly.dev/api';
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function getAuthToken(forceRefresh = false) {
  let token = getAccessToken();
  if (!token || forceRefresh || isTokenExpired(token)) {
    token = await refreshAccessToken();
  }
  if (!token) throw new Error('Usuário não autenticado.');
  return token;
}

function extractPayload(result, fallbackValue) {
  if (result && typeof result === 'object' && 'data' in result) {
    return result.data;
  }
  return fallbackValue;
}

export function createCrudService({
  resourcePath,
  itemName,
  defaultIdGenerator = (d) => String(d.id || '').trim(),
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}) {
  const baseUrl = `${API_BASE_URL}/${resourcePath}`;
  const fallbackBaseUrl = API_BASE_URL === FALLBACK_PROD_API_BASE_URL
    ? ''
    : `${FALLBACK_PROD_API_BASE_URL}/${resourcePath}`;

  const getToken = getAuthToken;

  async function fetchWithToken(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        ...options,
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        let message = `Erro na operação (${itemName}).`;
        try {
          const errorData = await response.json();
          if (errorData?.message) message = errorData.message;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      return response.json();
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.');
      }
      if (isNetworkFailureError(error) && fallbackBaseUrl && typeof url === 'string' && url.startsWith(baseUrl)) {
        const retryUrl = `${fallbackBaseUrl}${url.slice(baseUrl.length)}`;
        try {
          const retryResponse = await fetch(retryUrl, {
            ...options,
            cache: 'no-store',
          });
          if (!retryResponse.ok) {
            let retryMessage = `Erro na operação (${itemName}).`;
            try {
              const retryErrorData = await retryResponse.json();
              if (retryErrorData?.message) retryMessage = retryErrorData.message;
            } catch { /* ignore */ }
            throw new Error(retryMessage);
          }
          return retryResponse.json();
        } catch (retryError) {
          throw normalizeRequestError(
            retryError,
            'Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.',
          );
        }
      }

      throw normalizeRequestError(
        error,
        'Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function list(options = {}) {
    const token = await getToken(options.forceTokenRefresh || false);
    return fetchWithToken(baseUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }

  async function get(itemOrId) {
    const _links = itemOrId?._links || itemOrId;
    if (_links?.self) {
      return fetchWithHateoas(_links.self, null, API_BASE_URL);
    }

    const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
    const token = await getToken();
    return fetchWithToken(`${baseUrl}/${id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }

  function subscribe(onData, onError) {
    let disposed = false;
    let intervalId = null;
    let inFlight = false;
    let rerunRequested = false;
    let retryTimeoutId = null;
    let visibilityChangeHandler = null;
    let retryCount = 0;
    let inErrorState = false;

    // Serve cached data immediately so the UI is never blank on remount
    const cached = readCache(resourcePath);
    if (Array.isArray(cached)) onData?.(cached);

    const run = async (options = {}) => {
      const { force = false, forceTokenRefresh = false } = options;
      if (disposed) return;
      if (inFlight) {
        if (force) rerunRequested = true;
        return;
      }
      if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inFlight = true;

      try {
        const result = await list({ forceTokenRefresh });
        if (!disposed) {
          const data = Array.isArray(extractPayload(result, [])) ? extractPayload(result, []) : [];
          onData?.(data);
          writeCache(resourcePath, data);
          retryCount = 0;
          if (inErrorState) inErrorState = false;
        }
      } catch (error) {
        if (!disposed) {
          if (!inErrorState) {
            inErrorState = true;
            onError?.(error);
          }
          const delay = getRetryDelay(retryCount);
          retryCount++;
          const shouldForceToken = isAuthError(error);
          retryTimeoutId = setTimeout(() => {
            retryTimeoutId = null;
            run({ force: true, forceTokenRefresh: shouldForceToken });
          }, delay);
        }
      } finally {
        inFlight = false;
        if (!disposed && rerunRequested) {
          rerunRequested = false;
          queueMicrotask(() => {
            run({ force: true });
          });
        }
      }
    };

    const unregisterRefresher = registerActiveRefresher(resourcePath, () => {
      if (retryTimeoutId) { clearTimeout(retryTimeoutId); retryTimeoutId = null; }
      retryCount = 0;
      run({ force: true });
    });

    run();

    if (pollIntervalMs > 0) {
      intervalId = window.setInterval(run, pollIntervalMs);
      if (typeof document !== 'undefined') {
        visibilityChangeHandler = () => {
          if (document.visibilityState === 'visible') {
            if (retryTimeoutId) { clearTimeout(retryTimeoutId); retryTimeoutId = null; }
            run({ force: true });
          }
        };
        document.addEventListener('visibilitychange', visibilityChangeHandler);
      }
    }

    return () => {
      disposed = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      if (visibilityChangeHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityChangeHandler);
      }
      unregisterRefresher();
    };
  }

  return {
    list,
    get,
    subscribe,

    async create(data, meta = {}, generateId = defaultIdGenerator) {
      const id = generateId(data);
      if (!id) throw new Error(`${itemName} precisa de ID`);

      const token = await getToken();
      const result = await fetchWithToken(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { ...data, id }, meta })
      });
      clearCache(resourcePath);
      triggerActiveRefresh(resourcePath);
      return result;
    },

    async update(id, data, meta = {}, options = {}) {
      if (data?._links?.update) {
        const result = await fetchWithHateoas(data._links.update, { data: { ...data, id }, meta }, API_BASE_URL);
        clearCache(resourcePath);
        if (!options.skipRefresh) triggerActiveRefresh(resourcePath);
        return result;
      }

      const token = await getToken();
      const result = await fetchWithToken(`${baseUrl}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { ...data, id }, meta })
      });
      clearCache(resourcePath);
      if (!options.skipRefresh) triggerActiveRefresh(resourcePath);
      return result;
    },

    async save(id, data, meta = {}) {
      if (data?._links?.update) {
        const result = await fetchWithHateoas(data._links.update, { data: { ...data, id }, meta }, API_BASE_URL);
        clearCache(resourcePath);
        triggerActiveRefresh(resourcePath);
        return result;
      }

      const token = await getToken();
      const fetchMethod = meta.merge ? 'PUT' : 'POST';
      const url = meta.merge ? `${baseUrl}/${id}` : baseUrl;
      
      const result = await fetchWithToken(url, {
        method: fetchMethod,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { ...data, id }, meta })
      });
      clearCache(resourcePath);
      triggerActiveRefresh(resourcePath);
      return result;
    },

    async remove(itemOrId) {
      const _links = itemOrId?._links || itemOrId;
      if (_links?.delete) {
        const result = await fetchWithHateoas(_links.delete, null, API_BASE_URL);
        clearCache(resourcePath);
        triggerActiveRefresh(resourcePath);
        return result;
      }
      const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
      const token = await getToken();
      const result = await fetchWithToken(`${baseUrl}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      clearCache(resourcePath);
      triggerActiveRefresh(resourcePath);
      return result;
    }
  };
}

export function createSingletonService({ resourcePath, itemName, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS }) {
  const baseUrl = `${API_BASE_URL}/${resourcePath}`;
  const fallbackBaseUrl = API_BASE_URL === FALLBACK_PROD_API_BASE_URL
    ? ''
    : `${FALLBACK_PROD_API_BASE_URL}/${resourcePath}`;

  async function fetchWithToken(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        ...options,
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        let message = `Erro na operação (${itemName}).`;
        try {
          const errorData = await response.json();
          if (errorData?.message) message = errorData.message;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      return response.json();
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.');
      }
      if (isNetworkFailureError(error) && fallbackBaseUrl && typeof url === 'string' && url.startsWith(baseUrl)) {
        const retryUrl = `${fallbackBaseUrl}${url.slice(baseUrl.length)}`;
        try {
          const retryResponse = await fetch(retryUrl, {
            ...options,
            cache: 'no-store',
          });
          if (!retryResponse.ok) {
            let retryMessage = `Erro na operação (${itemName}).`;
            try {
              const retryErrorData = await retryResponse.json();
              if (retryErrorData?.message) retryMessage = retryErrorData.message;
            } catch { /* ignore */ }
            throw new Error(retryMessage);
          }
          return retryResponse.json();
        } catch (retryError) {
          throw normalizeRequestError(
            retryError,
            'Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.',
          );
        }
      }

      throw normalizeRequestError(
        error,
        'Nao foi possivel conectar ao servidor. Verifique se o backend esta rodando e se a URL da API esta correta.',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function get(document, options = {}) {
    if (document?._links?.self) {
      return fetchWithHateoas(document._links.self, null, API_BASE_URL);
    }

    const token = await getAuthToken(options.forceTokenRefresh || false);
    return fetchWithToken(baseUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }

  async function save(data, meta = {}) {
    if (data?._links?.update) {
      const result = await fetchWithHateoas(data._links.update, { data, meta }, API_BASE_URL);
      clearCache(resourcePath);
      triggerActiveRefresh(resourcePath);
      return result;
    }

    const token = await getAuthToken();
    const result = await fetchWithToken(baseUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ data, meta })
    });
    clearCache(resourcePath);
    triggerActiveRefresh(resourcePath);
    return result;
  }

  function subscribe(onData, onError) {
    let disposed = false;
    let intervalId = null;
    let inFlight = false;
    let rerunRequested = false;
    let retryTimeoutId = null;
    let visibilityChangeHandler = null;
    let retryCount = 0;
    let inErrorState = false;

    // Serve cached data immediately so the UI is never blank on remount
    const cached = readCache(resourcePath);
    if (cached !== null) onData?.(cached);

    const run = async (options = {}) => {
      const { force = false, forceTokenRefresh = false } = options;
      if (disposed) return;
      if (inFlight) {
        if (force) rerunRequested = true;
        return;
      }
      if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inFlight = true;

      try {
        const result = await get(undefined, { forceTokenRefresh });
        if (!disposed) {
          const data = extractPayload(result, null);
          onData?.(data);
          if (data !== null) writeCache(resourcePath, data);
          retryCount = 0;
          if (inErrorState) inErrorState = false;
        }
      } catch (error) {
        if (!disposed) {
          if (!inErrorState) {
            inErrorState = true;
            onError?.(error);
          }
          const delay = getRetryDelay(retryCount);
          retryCount++;
          const shouldForceToken = isAuthError(error);
          retryTimeoutId = setTimeout(() => {
            retryTimeoutId = null;
            run({ force: true, forceTokenRefresh: shouldForceToken });
          }, delay);
        }
      } finally {
        inFlight = false;
        if (!disposed && rerunRequested) {
          rerunRequested = false;
          queueMicrotask(() => {
            run({ force: true });
          });
        }
      }
    };

    const unregisterRefresher = registerActiveRefresher(resourcePath, () => {
      if (retryTimeoutId) { clearTimeout(retryTimeoutId); retryTimeoutId = null; }
      retryCount = 0;
      run({ force: true });
    });

    run();

    if (pollIntervalMs > 0) {
      intervalId = window.setInterval(run, pollIntervalMs);
      if (typeof document !== 'undefined') {
        visibilityChangeHandler = () => {
          if (document.visibilityState === 'visible') {
            if (retryTimeoutId) { clearTimeout(retryTimeoutId); retryTimeoutId = null; }
            run({ force: true });
          }
        };
        document.addEventListener('visibilitychange', visibilityChangeHandler);
      }
    }

    return () => {
      disposed = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      if (visibilityChangeHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityChangeHandler);
      }
      unregisterRefresher();
    };
  }

  return {
    get,
    save,
    subscribe,
  };
}
