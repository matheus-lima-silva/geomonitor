import { auth } from '../firebase/config';
import { fetchWithHateoas, isNetworkFailureError, normalizeRequestError } from './apiClient';

const FALLBACK_PROD_API_BASE_URL = 'https://geomonitor-api.fly.dev/api';

const CACHE_PREFIX = '__geocache_v1_';

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(key, data) {
  try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data)); } catch { /* ignore */ }
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

export async function getAuthToken() {
  const token = await auth?.currentUser?.getIdToken();
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
      const response = await fetch(url, { ...options, signal: controller.signal });
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
          const retryResponse = await fetch(retryUrl, options);
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

  async function list() {
    const token = await getToken();
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
    let retryTimeoutId = null;
    let visibilityChangeHandler = null;

    // Serve cached data immediately so the UI is never blank on remount
    const cached = readCache(resourcePath);
    if (Array.isArray(cached)) onData?.(cached);

    const run = async () => {
      if (disposed || inFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inFlight = true;

      try {
        const result = await list();
        if (!disposed) {
          const data = Array.isArray(extractPayload(result, [])) ? extractPayload(result, []) : [];
          onData?.(data);
          writeCache(resourcePath, data);
        }
      } catch (error) {
        if (!disposed) {
          onError?.(error);
          retryTimeoutId = setTimeout(() => { retryTimeoutId = null; run(); }, 5000);
        }
      } finally {
        inFlight = false;
      }
    };

    run();

    if (pollIntervalMs > 0) {
      intervalId = window.setInterval(run, pollIntervalMs);
      if (typeof document !== 'undefined') {
        visibilityChangeHandler = () => {
          if (document.visibilityState === 'visible') run();
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
      return fetchWithToken(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { ...data, id }, meta })
      });
    },

    async update(id, data, meta = {}) {
      if (data?._links?.update) {
        return fetchWithHateoas(data._links.update, { data: { ...data, id }, meta }, API_BASE_URL);
      }

      const token = await getToken();
      return fetchWithToken(`${baseUrl}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { ...data, id }, meta })
      });
    },

    async save(id, data, meta = {}) {
      if (data?._links?.update) {
        return fetchWithHateoas(data._links.update, { data: { ...data, id }, meta }, API_BASE_URL);
      }

      const token = await getToken();
      const fetchMethod = meta.merge ? 'PUT' : 'POST';
      const url = meta.merge ? `${baseUrl}/${id}` : baseUrl;
      
      return fetchWithToken(url, {
        method: fetchMethod,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { ...data, id }, meta })
      });
    },

    async remove(itemOrId) {
      const _links = itemOrId?._links || itemOrId;
      if (_links?.delete) {
        return fetchWithHateoas(_links.delete, null, API_BASE_URL);
      }
      const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
      const token = await getToken();
      return fetchWithToken(`${baseUrl}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
      const response = await fetch(url, { ...options, signal: controller.signal });
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
          const retryResponse = await fetch(retryUrl, options);
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

  async function get(document) {
    if (document?._links?.self) {
      return fetchWithHateoas(document._links.self, null, API_BASE_URL);
    }

    const token = await getAuthToken();
    return fetchWithToken(baseUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }

  async function save(data, meta = {}) {
    if (data?._links?.update) {
      return fetchWithHateoas(data._links.update, { data, meta }, API_BASE_URL);
    }

    const token = await getAuthToken();
    return fetchWithToken(baseUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ data, meta })
    });
  }

  function subscribe(onData, onError) {
    let disposed = false;
    let intervalId = null;
    let inFlight = false;
    let retryTimeoutId = null;
    let visibilityChangeHandler = null;

    // Serve cached data immediately so the UI is never blank on remount
    const cached = readCache(resourcePath);
    if (cached !== null) onData?.(cached);

    const run = async () => {
      if (disposed || inFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inFlight = true;

      try {
        const result = await get();
        if (!disposed) {
          const data = extractPayload(result, null);
          onData?.(data);
          if (data !== null) writeCache(resourcePath, data);
        }
      } catch (error) {
        if (!disposed) {
          onError?.(error);
          retryTimeoutId = setTimeout(() => { retryTimeoutId = null; run(); }, 5000);
        }
      } finally {
        inFlight = false;
      }
    };

    run();

    if (pollIntervalMs > 0) {
      intervalId = window.setInterval(run, pollIntervalMs);
      if (typeof document !== 'undefined') {
        visibilityChangeHandler = () => {
          if (document.visibilityState === 'visible') run();
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
    };
  }

  return {
    get,
    save,
    subscribe,
  };
}
