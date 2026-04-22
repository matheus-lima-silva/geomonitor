import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../utils/serviceFactory', () => ({
  API_BASE_URL: 'http://api.test/api',
  getAuthToken: vi.fn(async () => 'test-token'),
}));

describe('adminAlertsService', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('listAlerts faz GET com status=pending por default', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        data: [
          {
            id: '1',
            type: 'query_count_exceeded',
            payload: { method: 'GET', url: '/api/x', count: 20, threshold: 15 },
            createdAt: '2026-04-22T10:00:00Z',
            acknowledgedAt: null,
            acknowledgedBy: null,
            _links: { self: { href: 'http://api.test/api/admin/alerts/1', method: 'GET' } },
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        _links: {},
      }),
    });

    const { listAlerts } = await import('../adminAlertsService');
    const result = await listAlerts();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('http://api.test/api/admin/alerts');
    expect(url).toContain('status=pending');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=20');
    expect(options.headers.Authorization).toBe('Bearer test-token');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].payload.count).toBe(20);
    expect(result.pagination.total).toBe(1);
  });

  it('listAlerts com status=all passa o filtro', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: [], pagination: {}, _links: {} }),
    });

    const { listAlerts } = await import('../adminAlertsService');
    await listAlerts({ status: 'all' });

    expect(fetchMock.mock.calls[0][0]).toContain('status=all');
  });

  it('listAlerts propaga erro quando backend responde 500', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ status: 'error', message: 'Interno' }),
      text: async () => '',
    });

    const { listAlerts } = await import('../adminAlertsService');
    await expect(listAlerts()).rejects.toThrow(/Interno/);
  });

  it('acknowledgeAlert usa _links.ack quando presente', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: { id: '7', acknowledgedAt: 'now' } }),
    });

    const { acknowledgeAlert } = await import('../adminAlertsService');
    const result = await acknowledgeAlert({
      id: '7',
      _links: { ack: { href: 'http://api.test/api/admin/alerts/7/ack', method: 'POST' } },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/admin/alerts/7/ack');
    expect(options.method).toBe('POST');
    expect(result.status).toBe('success');
  });

  it('acknowledgeAlert cai para URL default quando _links.ack ausente', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: {} }),
    });

    const { acknowledgeAlert } = await import('../adminAlertsService');
    await acknowledgeAlert({ id: '42' });

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/admin/alerts/42/ack');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });
});
