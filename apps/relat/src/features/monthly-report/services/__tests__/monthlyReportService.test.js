import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/utils/serviceFactory', () => ({
  API_BASE_URL: 'http://api.test/api',
  getAuthToken: vi.fn(async () => 'token-123'),
}));

import {
  fetchByPeriod,
  saveReport,
  generateDocx,
  fetchSettings,
  saveSettings,
  VersionConflictError,
} from '../monthlyReportService';

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

describe('monthlyReportService', () => {
  it('fetchByPeriod chama by-period com auth e desempacota data', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { id: 'MR-1', engineers: [] } }));
    const report = await fetchByPeriod(2026, 4);
    expect(report.id).toBe('MR-1');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://api.test/api/monthly-reports/by-period?year=2026&month=4');
    expect(options.headers.Authorization).toBe('Bearer token-123');
  });

  it('saveReport faz PUT com envelope { data, meta }', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { id: 'MR-1', version: 2 } }));
    const saved = await saveReport('MR-1', { refYear: 2026, refMonth: 4, version: 1 });
    expect(saved.version).toBe(2);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://api.test/api/monthly-reports/MR-1');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ data: { refYear: 2026, refMonth: 4, version: 1 }, meta: {} });
  });

  it('saveReport lanca VersionConflictError em 409 VERSION_CONFLICT', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'error', code: 'VERSION_CONFLICT', currentVersion: 5 }, 409));
    const err = await saveReport('MR-1', { version: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(VersionConflictError);
    expect(err.currentVersion).toBe(5);
  });

  it('generateDocx faz POST no /generate', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { id: 'JOB-1', statusExecucao: 'queued' } }, 202));
    const job = await generateDocx('MR-1');
    expect(job.id).toBe('JOB-1');
    expect(fetch.mock.calls[0][0]).toBe('http://api.test/api/monthly-reports/MR-1/generate');
    expect(fetch.mock.calls[0][1].method).toBe('POST');
  });

  it('fetchSettings e saveSettings usam o singleton de settings', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { team: [], contrato: { numero: '' } } }));
    await fetchSettings();
    expect(fetch.mock.calls[0][0]).toBe('http://api.test/api/monthly-report-settings');

    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success', data: { team: [{ id: 'm1', name: 'Ana' }] } }));
    const saved = await saveSettings({ team: [{ id: 'm1', name: 'Ana' }] });
    expect(saved.team).toHaveLength(1);
    expect(fetch.mock.calls[1][1].method).toBe('PUT');
  });
});
