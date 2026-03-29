import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/tokenStorage', () => ({
  getAccessToken: vi.fn(() => 'token-123'),
  refreshAccessToken: vi.fn(() => Promise.resolve('token-123')),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  hasStoredSession: vi.fn(() => true),
}));
import {
  deleteOperatingLicense,
  saveOperatingLicense,
  subscribeOperatingLicenses,
} from '../licenseService';

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('licenseService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('subscribeOperatingLicenses busca lista via API', async () => {
    const onData = vi.fn();
    const onError = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ id: 'LO-1', tipo: 'Operacao' }] })
    });

    const unsub = subscribeOperatingLicenses(onData, onError);
    await flushPromises();

    expect(fetchMock.mock.calls[0][0]).toContain('/licenses');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer token-123' }
    });
    expect(onData).toHaveBeenCalledWith([expect.objectContaining({ id: 'LO-1' })]);
    expect(onError).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('saveOperatingLicense envia PUT quando id e payload sem links', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'LO-1' } })
    });

    await expect(
      saveOperatingLicense('LO-1', { numero: '123/2026' }, { updatedBy: 'qa@empresa.com', merge: true })
    ).resolves.toEqual(expect.objectContaining({ data: { id: 'LO-1' } }));

    expect(fetchMock.mock.calls[0][0]).toContain('/licenses/LO-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });

  it('saveOperatingLicense usa _links.update quando payload inclui HATEOAS', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'LO-1' } })
    });

    await expect(
      saveOperatingLicense('LO-1', {
        id: 'LO-1',
        numero: '123/2026',
        _links: {
          update: {
            href: 'https://geomonitor-api.fly.dev/api/licenses/LO-1',
            method: 'PUT'
          }
        }
      }, { updatedBy: 'qa@empresa.com' })
    ).resolves.toEqual(expect.objectContaining({ data: { id: 'LO-1' } }));

    expect(fetchMock.mock.calls[0][0]).toContain('/licenses/LO-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });

  it('deleteOperatingLicense envia DELETE com id direto', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(deleteOperatingLicense('LO-1')).resolves.toEqual({});

    expect(fetchMock.mock.calls[0][0]).toContain('/licenses/LO-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('deleteOperatingLicense usa _links.delete quando recurso inclui HATEOAS', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(deleteOperatingLicense({
      id: 'LO-1',
      _links: {
        delete: {
          href: 'https://geomonitor-api.fly.dev/api/licenses/LO-1',
          method: 'DELETE'
        }
      }
    })).resolves.toEqual({});

    expect(fetchMock.mock.calls[0][0]).toContain('/licenses/LO-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});