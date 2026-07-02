import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/utils/serviceFactory', () => ({
  API_BASE_URL: 'http://api.test/api',
  getAuthToken: vi.fn(async () => 'token-123'),
}));

import {
  fetchPlants,
  fetchPlant,
  fetchTemplate,
  createPlant,
  savePlant,
  removePlant,
  generatePaec,
  getJobStatus,
  VersionConflictError,
} from '../paecService';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => 'application/json' },
  };
}

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('paecService', () => {
  it('fetchPlants busca a lista com auth e desempacota data', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: [{ id: 'PAEC-1', name: 'UHE Marimbondo' }] }));
    const plants = await fetchPlants();
    expect(plants).toHaveLength(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://api.test/api/paec/plants');
    expect(options.headers.Authorization).toBe('Bearer token-123');
  });

  it('fetchPlant busca a ficha por id', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { id: 'PAEC-1', fields: {}, pendencies: [] } }));
    const plant = await fetchPlant('PAEC-1');
    expect(plant.id).toBe('PAEC-1');
    expect(fetch.mock.calls[0][0]).toBe('http://api.test/api/paec/plants/PAEC-1');
  });

  it('fetchTemplate busca o manifest do template por id', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { id: 'PAECT-1', manifest: { fields: [] } } }));
    const template = await fetchTemplate('PAECT-1');
    expect(template.manifest).toEqual({ fields: [] });
    expect(fetch.mock.calls[0][0]).toBe('http://api.test/api/paec/templates/PAECT-1');
  });

  it('createPlant faz POST com envelope { data, meta }', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { id: 'PAEC-1', name: 'PCH Anta' } }, 201));
    const plant = await createPlant({ name: 'PCH Anta', plantType: 'PCH' });
    expect(plant.id).toBe('PAEC-1');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://api.test/api/paec/plants');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ data: { name: 'PCH Anta', plantType: 'PCH' }, meta: {} });
  });

  it('createPlant relata 409 NAME_EXISTS com mensagem amigavel', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'error', code: 'NAME_EXISTS', message: 'Ja existe uma ficha PAEC para esta usina.' }, 409));
    await expect(createPlant({ name: 'PCH Anta' })).rejects.toThrow(/ja existe uma ficha/i);
  });

  it('savePlant faz PUT com envelope { data, meta }', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { id: 'PAEC-1', version: 2 } }));
    const saved = await savePlant('PAEC-1', { name: 'PCH Anta', version: 1, fields: {} });
    expect(saved.version).toBe(2);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://api.test/api/paec/plants/PAEC-1');
    expect(options.method).toBe('PUT');
  });

  it('savePlant lanca VersionConflictError em 409 VERSION_CONFLICT', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'error', code: 'VERSION_CONFLICT', currentVersion: 5 }, 409));
    const err = await savePlant('PAEC-1', { version: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(VersionConflictError);
    expect(err.currentVersion).toBe(5);
  });

  it('removePlant faz DELETE', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 204));
    await expect(removePlant('PAEC-1')).resolves.toBeUndefined();
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('generatePaec faz POST no /generate', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { id: 'JOB-1', statusExecucao: 'queued' } }, 202));
    const job = await generatePaec('PAEC-1');
    expect(job.id).toBe('JOB-1');
    expect(fetch.mock.calls[0][0]).toBe('http://api.test/api/paec/plants/PAEC-1/generate');
    expect(fetch.mock.calls[0][1].method).toBe('POST');
  });

  it('generatePaec relata 422 TEMPLATE_UNAVAILABLE com mensagem amigavel', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'error', code: 'TEMPLATE_UNAVAILABLE', message: 'sem docx tokenizado' }, 422));
    await expect(generatePaec('PAEC-1')).rejects.toThrow('sem docx tokenizado');
  });

  it('getJobStatus consulta /report-jobs/:id', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { id: 'JOB-1', statusExecucao: 'completed', outputDocxMediaId: 'M-1' } }));
    const status = await getJobStatus('JOB-1');
    expect(status.statusExecucao).toBe('completed');
    expect(fetch.mock.calls[0][0]).toBe('http://api.test/api/report-jobs/JOB-1');
  });
});
