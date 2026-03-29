import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/tokenStorage', () => ({
  getAccessToken: vi.fn(() => 'token-123'),
  refreshAccessToken: vi.fn(() => Promise.resolve('token-123')),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  hasStoredSession: vi.fn(() => true),
}));
import { deleteUser, saveUser, subscribeUsers } from '../userService';

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('userService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('subscribeUsers busca utilizadores via API', async () => {
    const onData = vi.fn();
    const onError = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ id: 'U-1', nome: 'Ana' }] })
    });

    const unsub = subscribeUsers(onData, onError);
    await flushPromises();

    expect(fetchMock.mock.calls[0][0]).toContain('/users');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer token-123' }
    });
    expect(onData).toHaveBeenCalledWith([expect.objectContaining({ id: 'U-1', nome: 'Ana' })]);
    expect(onError).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('saveUser aplica id no payload e envia PUT com merge true', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'U-1' } })
    });

    await saveUser('U-1', { nome: 'Ana' }, { updatedBy: 'admin@empresa.com', merge: false });

    expect(fetchMock.mock.calls[0][0]).toContain('/users/U-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      data: { nome: 'Ana', id: 'U-1' },
      meta: { updatedBy: 'admin@empresa.com', merge: true }
    });
  });

  it('saveUser usa _links.update quando payload inclui HATEOAS', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'U-1' } })
    });

    await saveUser('U-1', {
      nome: 'Ana',
      _links: {
        update: {
          href: 'https://geomonitor-api.fly.dev/api/users/U-1',
          method: 'PUT'
        }
      }
    }, { updatedBy: 'admin@empresa.com' });

    expect(fetchMock.mock.calls[0][0]).toContain('/users/U-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });

  it('deleteUser envia DELETE com autenticação', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(deleteUser('U-1')).resolves.toEqual({});

    expect(fetchMock.mock.calls[0][0]).toContain('/users/U-1');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-123' }
    });
  });

  it('deleteUser usa _links.delete quando utilizador inclui HATEOAS', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(deleteUser({
      id: 'U-1',
      _links: {
        delete: {
          href: 'https://geomonitor-api.fly.dev/api/users/U-1',
          method: 'DELETE'
        }
      }
    })).resolves.toEqual({});

    expect(fetchMock.mock.calls[0][0]).toContain('/users/U-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});
