import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/tokenStorage', () => ({
  getAccessToken: vi.fn(() => 'token-123'),
  refreshAccessToken: vi.fn(() => Promise.resolve('token-123')),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  hasStoredSession: vi.fn(() => true),
}));
import { importarFeriadosNacionais, saveRulesConfig, subscribeRulesConfig } from '../rulesService';

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

  it('importarFeriadosNacionais usa _links quando presente', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { ano: 2026, feriados: [{ data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' }] },
      }),
    });

    const rulesConfig = {
      _links: {
        importarFeriados: { href: 'http://api.local/api/rules/feriados/importar', method: 'GET' },
      },
    };

    const result = await importarFeriadosNacionais(2026, rulesConfig);

    expect(result).toEqual({
      ano: 2026,
      feriados: [{ data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' }],
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/rules/feriados/importar?ano=2026');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('importarFeriadosNacionais monta URL por fallback quando _links ausente', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { ano: 2026, feriados: [] } }),
    });

    const result = await importarFeriadosNacionais(2026, null);

    expect(result).toEqual({ ano: 2026, feriados: [] });
    expect(fetchMock.mock.calls[0][0]).toContain('/rules/feriados/importar?ano=2026');
  });

  it('importarFeriadosNacionais rejeita ano invalido sem chamar fetch', async () => {
    await expect(importarFeriadosNacionais(1800, null)).rejects.toThrow(/ano/i);
    expect(fetchMock).not.toHaveBeenCalled();
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
