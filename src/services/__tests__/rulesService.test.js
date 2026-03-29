import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/tokenStorage', () => ({
  getAccessToken: vi.fn(() => 'token-123'),
  refreshAccessToken: vi.fn(() => Promise.resolve('token-123')),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  hasStoredSession: vi.fn(() => true),
}));
import { saveRulesConfig, subscribeRulesConfig } from '../rulesService';

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('rulesService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('subscribeRulesConfig busca configuração via API', async () => {
    const onData = vi.fn();
    const onError = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { regra: 'ok', _links: { self: { href: '/api/rules', method: 'GET' } } } })
    });

    const unsub = subscribeRulesConfig(onData, onError);
    await flushPromises();

    expect(fetchMock.mock.calls[0][0]).toContain('/rules');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer token-123' }
    });
    expect(onData).toHaveBeenCalledWith(expect.objectContaining({ regra: 'ok', _links: expect.any(Object) }));
    expect(onError).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('subscribeRulesConfig envia null quando API não possui configuração', async () => {
    const onData = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: null })
    });

    const unsub = subscribeRulesConfig(onData, vi.fn());
    await flushPromises();

    expect(onData).toHaveBeenCalledWith(null);
    unsub();
  });

  it('saveRulesConfig envia PUT e mantém merge true', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { a: 1 } })
    });

    await saveRulesConfig({ a: 1 }, { merge: false, updatedBy: 'ops@empresa.com' });

    expect(fetchMock.mock.calls[0][0]).toContain('/rules');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      data: { a: 1 },
      meta: { merge: true, updatedBy: 'ops@empresa.com' }
    });
  });
});
