import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocka serviceFactory para fornecer API_BASE_URL + getAuthToken previsiveis.
vi.mock('../../../../utils/serviceFactory', () => ({
  API_BASE_URL: 'https://api.test/api',
  getAuthToken: vi.fn(async () => 'TOKEN'),
}));

import {
  listConditions,
  createCondition,
  bulkReplaceConditions,
  updateCondition,
  deleteCondition,
} from '../licenseConditionService';

function mockOkJson(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

describe('licenseConditionService', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('listConditions chama GET em API_BASE_URL (nunca path relativo)', async () => {
    globalThis.fetch.mockResolvedValue(mockOkJson({ data: [{ id: 'C1' }] }));
    const out = await listConditions('LO-X');
    expect(out).toEqual([{ id: 'C1' }]);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    // URL completa apontando pra API host, nao relativa "/api/..."
    expect(url).toBe('https://api.test/api/licenses/LO-X/conditions');
    expect(url.startsWith('/api')).toBe(false);
    expect(opts.method).toBe('GET');
    expect(opts.headers.Authorization).toBe('Bearer TOKEN');
  });

  it('listConditions devolve [] quando licenseId vazio', async () => {
    const out = await listConditions('');
    expect(out).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('createCondition envia POST com body { data }', async () => {
    globalThis.fetch.mockResolvedValue(mockOkJson({ data: { id: 'C1' } }, 201));
    const out = await createCondition('LO-X', { numero: '2.1', texto: 'Programa X' });
    expect(out).toEqual({ id: 'C1' });
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/licenses/LO-X/conditions');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ data: { numero: '2.1', texto: 'Programa X' } });
  });

  it('bulkReplaceConditions envia PUT com array de items', async () => {
    globalThis.fetch.mockResolvedValue(mockOkJson({ data: [{ id: 'C1' }] }));
    const out = await bulkReplaceConditions('LO-X', [{ numero: '2.1', texto: 'X' }]);
    expect(out).toEqual([{ id: 'C1' }]);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/licenses/LO-X/conditions');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body).data).toHaveLength(1);
  });

  it('updateCondition usa path flat /license-conditions/:id', async () => {
    globalThis.fetch.mockResolvedValue(mockOkJson({ data: { id: 'C1', texto: 'novo' } }));
    const out = await updateCondition({ id: 'C1' }, { texto: 'novo' });
    expect(out.texto).toBe('novo');
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/license-conditions/C1');
    expect(opts.method).toBe('PUT');
  });

  it('deleteCondition usa DELETE + nao tenta parsear JSON em 204', async () => {
    globalThis.fetch.mockResolvedValue(mockOkJson(null, 204));
    await deleteCondition({ id: 'C1' });
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/license-conditions/C1');
    expect(opts.method).toBe('DELETE');
  });

  it('erro HTTP propaga message + status + code da API', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Licenca nao encontrada', code: 'NOT_FOUND' }),
    });
    await expect(listConditions('LO-NOPE')).rejects.toMatchObject({
      message: 'Licenca nao encontrada',
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});
