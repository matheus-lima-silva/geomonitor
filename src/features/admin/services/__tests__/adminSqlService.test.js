import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../utils/serviceFactory', () => ({
  API_BASE_URL: 'http://api.test/api',
  getAuthToken: vi.fn(async () => 'test-token'),
}));

describe('adminSqlService', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('executeSql posta body no formato { data: { sql } } com bearer token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        data: { columns: ['id'], rows: [{ id: 1 }], rowCount: 1, durationMs: 5, _links: { self: {} } },
      }),
    });

    const { executeSql } = await import('../adminSqlService');
    const data = await executeSql('SELECT id FROM users LIMIT 1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/admin/sql/execute');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(options.body)).toEqual({ data: { sql: 'SELECT id FROM users LIMIT 1' } });
    expect(data.rowCount).toBe(1);
  });

  it('executeSql propaga erro quando backend responde 400', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ status: 'error', code: 'SQL_NOT_READ_ONLY', message: 'Palavra-chave proibida: INSERT.' }),
      text: async () => '',
    });

    const { executeSql } = await import('../adminSqlService');
    await expect(executeSql('INSERT INTO x VALUES (1)')).rejects.toThrow(/INSERT/);
  });

  it('listAudit inclui page e limit na query string', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        data: [{ id: '1', executedBy: 'a', sqlText: 'SELECT 1', status: 'success' }],
        pagination: { page: 2, limit: 10, total: 15, totalPages: 2 },
        _links: { self: { href: 'x' } },
      }),
    });

    const { listAudit } = await import('../adminSqlService');
    const response = await listAudit({ page: 2, limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
    expect(response.items).toHaveLength(1);
    expect(response.pagination.total).toBe(15);
  });
});
