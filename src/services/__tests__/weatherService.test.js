import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/tokenStorage', () => ({
  getAccessToken: vi.fn(() => 'token-123'),
  refreshAccessToken: vi.fn(() => Promise.resolve('token-123')),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  hasStoredSession: vi.fn(() => true),
}));
import { fetchDailyWeather } from '../weatherService';

describe('weatherService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('consulta o proxy /weather/daily com lat/lon/start/end e devolve os dias', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        data: { source: 'archive', days: [{ date: '2026-09-22', clima: 'Chuva', reason: 'chuvisco 6 h, 2 mm' }], _links: {} },
      }),
    });

    const days = await fetchDailyWeather({ lat: -20.0741234, lon: -44.826, start: '2026-09-21', end: '2026-09-24' });

    expect(days).toEqual([{ date: '2026-09-22', clima: 'Chuva', reason: 'chuvisco 6 h, 2 mm' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/weather/daily?');
    expect(url).toContain('lat=-20.07412');
    expect(url).toContain('lon=-44.82600');
    expect(url).toContain('start=2026-09-21');
    expect(url).toContain('end=2026-09-24');
    expect(init).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer token-123' } });
  });

  it('sem end usa start; rejeita coordenada ou datas invalidas sem chamar a API', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ data: { days: [] } }) });
    await fetchDailyWeather({ lat: -20, lon: -44, start: '2026-09-21' });
    expect(fetchMock.mock.calls[0][0]).toContain('end=2026-09-21');

    await expect(fetchDailyWeather({ lat: 'x', lon: -44, start: '2026-09-21' })).rejects.toThrow('Coordenada invalida');
    await expect(fetchDailyWeather({ lat: -20, lon: -44, start: '21/09/2026' })).rejects.toThrow('Periodo invalido');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
