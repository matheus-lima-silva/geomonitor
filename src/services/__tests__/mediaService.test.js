import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/serviceFactory', () => ({
  API_BASE_URL: 'https://geo.lima.rio.br/api',
  getAuthToken: vi.fn(async () => 'token-123'),
}));

import { resolveMediaDownload } from '../mediaService';

function mockAccessUrlResponse(data) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data }),
  }));
}

describe('resolveMediaDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('marca como remoto quando backend = tigris (URL assinada, navega direto)', async () => {
    mockAccessUrlResponse({
      accessUrl: 'https://geo.lima.rio.br/bucket/key.kmz?X-Amz-Signature=abc',
      backend: 'tigris',
    });

    const result = await resolveMediaDownload('MED-1');

    expect(result.isRemote).toBe(true);
    expect(result.backend).toBe('tigris');
    expect(result.accessUrl).toContain('X-Amz-Signature');
  });

  it('mesmo same-origin com o app (caso homelab), tigris segue remoto — nao cai no blob', async () => {
    // O MinIO publico do homelab e servido sob o mesmo host do app via Caddy;
    // a heuristica de origin daria falso-positivo, por isso usamos `backend`.
    mockAccessUrlResponse({
      accessUrl: 'https://geo.lima.rio.br/geomonitor-media/key.kmz?X-Amz-Signature=abc',
      backend: 'tigris',
    });

    const result = await resolveMediaDownload('MED-1');

    expect(result.isRemote).toBe(true);
  });

  it('marca como local (blob) quando backend = local (exige Bearer no fetch)', async () => {
    mockAccessUrlResponse({
      accessUrl: 'https://geo.lima.rio.br/api/media/MED-1/content',
      backend: 'local',
    });

    const result = await resolveMediaDownload('MED-1');

    expect(result.isRemote).toBe(false);
    expect(result.backend).toBe('local');
  });

  it('lanca erro quando a URL de acesso vem vazia', async () => {
    mockAccessUrlResponse({ accessUrl: '', backend: 'tigris' });
    await expect(resolveMediaDownload('MED-1')).rejects.toThrow();
  });
});
