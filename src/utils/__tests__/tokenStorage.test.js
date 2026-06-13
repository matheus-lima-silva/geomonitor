import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  storeTokens,
  getAccessToken,
  clearTokens,
  hasStoredSession,
  refreshAccessToken,
} from '../tokenStorage';

function setHintCookie() {
  document.cookie = 'gm_session=1; path=/';
}
function clearHintCookie() {
  document.cookie = 'gm_session=; Max-Age=0; path=/';
}

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    clearTokens(); // zera accessToken em memoria + localStorage + hint cookie
    clearHintCookie();
  });

  afterEach(() => {
    localStorage.clear();
    clearHintCookie();
    vi.unstubAllGlobals();
  });

  describe('hasStoredSession', () => {
    it('false sem token e sem hint cookie', () => {
      expect(hasStoredSession()).toBe(false);
    });

    it('true com refresh token no localStorage', () => {
      storeTokens('acc', 'ref');
      expect(hasStoredSession()).toBe(true);
    });

    it('true com hint cookie de sessao (SSO entre subdominios)', () => {
      setHintCookie();
      expect(hasStoredSession()).toBe(true);
    });
  });

  describe('refreshAccessToken', () => {
    it('retorna null sem fazer fetch quando nao ha sessao', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('tenta refresh com credentials quando ha hint cookie (sem token local)', async () => {
      setHintCookie();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { accessToken: 'novo-acc', refreshToken: 'novo-ref' } }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const token = await refreshAccessToken();

      expect(token).toBe('novo-acc');
      expect(fetchMock.mock.calls[0][0]).toContain('/auth/refresh');
      expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
      expect(getAccessToken()).toBe('novo-acc');
    });

    it('envia o refresh token do localStorage no body quando presente', async () => {
      storeTokens(null, 'ref-local');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { accessToken: 'a2', refreshToken: 'r2' } }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await refreshAccessToken();

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'ref-local' });
    });
  });
});
