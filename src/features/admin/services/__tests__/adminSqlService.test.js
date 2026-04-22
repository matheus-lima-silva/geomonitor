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

  it('listSnippets devolve array de data', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        data: [
          { id: '1', name: 'A', sqlText: 'SELECT 1', _links: { self: {} } },
          { id: '2', name: 'B', sqlText: 'SELECT 2', _links: { self: {} } },
        ],
        pagination: { page: 1, limit: 2, total: 2, totalPages: 1 },
      }),
    });

    const { listSnippets } = await import('../adminSqlService');
    const items = await listSnippets();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/admin/sql/snippets');
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('A');
  });

  it('createSnippet posta body no formato { data: { name, sqlText, description } }', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        status: 'success',
        data: { id: '10', name: 'Novo', sqlText: 'SELECT 1', _links: { self: {} } },
      }),
    });

    const { createSnippet } = await import('../adminSqlService');
    const data = await createSnippet({ name: 'Novo', sqlText: 'SELECT 1', description: 'desc' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/admin/sql/snippets');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ data: { name: 'Novo', sqlText: 'SELECT 1', description: 'desc' } });
    expect(data.id).toBe('10');
  });

  it('createSnippet propaga 409 com mensagem do backend', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ status: 'error', code: 'SNIPPET_NAME_CONFLICT', message: 'Ja existe snippet com esse nome.' }),
      text: async () => '',
    });

    const { createSnippet } = await import('../adminSqlService');
    await expect(createSnippet({ name: 'Dup', sqlText: 'SELECT 1' })).rejects.toThrow(/Ja existe snippet/);
  });

  it('updateSnippet usa _links.update do snippet', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        data: { id: '10', name: 'Editado', sqlText: 'SELECT 2', _links: { self: {} } },
      }),
    });

    const snippet = { id: '10', name: 'A', _links: { update: { href: 'http://api.test/api/admin/sql/snippets/10', method: 'PUT' } } };
    const { updateSnippet } = await import('../adminSqlService');
    await updateSnippet(snippet, { name: 'Editado', sqlText: 'SELECT 2' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/admin/sql/snippets/10');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ data: { name: 'Editado', sqlText: 'SELECT 2' } });
  });

  it('updateSnippet lanca se _links.update faltar', async () => {
    const { updateSnippet } = await import('../adminSqlService');
    await expect(updateSnippet({ id: '1' }, { name: 'X' })).rejects.toThrow(/Link de atualizacao/);
  });

  it('deleteSnippet usa _links.delete e aceita 204', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

    const snippet = { id: '10', _links: { delete: { href: 'http://api.test/api/admin/sql/snippets/10', method: 'DELETE' } } };
    const { deleteSnippet } = await import('../adminSqlService');
    await deleteSnippet(snippet);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/admin/sql/snippets/10');
    expect(options.method).toBe('DELETE');
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
