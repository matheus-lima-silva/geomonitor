import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn()
    }
  }
}));

import { auth } from '../../firebase/config';
import {
  listReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  activateReportTemplate,
} from '../reportTemplateService';

describe('reportTemplateService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('token-123')
    };
  });

  it('listReportTemplates busca templates via GET', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ id: 'TPL-1', versionLabel: 'v1' }] }),
    });

    const result = await listReportTemplates();

    expect(fetchMock.mock.calls[0][0]).toContain('/report-templates');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' });
    expect(result).toEqual([{ id: 'TPL-1', versionLabel: 'v1' }]);
  });

  it('listReportTemplates retorna array vazio quando API retorna null', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: null }),
    });

    const result = await listReportTemplates();
    expect(result).toEqual([]);
  });

  it('createReportTemplate envia POST com payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'TPL-NEW' } }),
    });

    await createReportTemplate({ versionLabel: 'v2', sourceKind: 'docx_base' }, { updatedBy: 'user@test.com' });

    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data.versionLabel).toBe('v2');
    expect(body.meta.updatedBy).toBe('user@test.com');
  });

  it('updateReportTemplate envia PUT com id na URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'TPL-1' } }),
    });

    await updateReportTemplate('TPL-1', { versionLabel: 'v1.1' });

    expect(fetchMock.mock.calls[0][0]).toContain('/report-templates/TPL-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });

  it('deleteReportTemplate envia DELETE', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'success' }),
    });

    await deleteReportTemplate('TPL-1');

    expect(fetchMock.mock.calls[0][0]).toContain('/report-templates/TPL-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('activateReportTemplate envia POST para activate', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: 'TPL-1', isActive: true } }),
    });

    await activateReportTemplate('TPL-1');

    expect(fetchMock.mock.calls[0][0]).toContain('/report-templates/TPL-1/activate');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('lanca erro quando API retorna status nao-ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: 'Acesso negado' }),
    });

    await expect(listReportTemplates()).rejects.toThrow('Acesso negado');
  });
});
