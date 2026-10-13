import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/serviceFactory', () => ({
  API_BASE_URL: 'https://geo.lima.rio.br/api',
  getAuthToken: vi.fn(async () => 'token-123'),
  createCrudService: () => ({
    subscribe: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }),
}));

import { cropWorkspacePhotoFooter, cropWorkspacePhotoFooterBatch, undoWorkspacePhotoFooterCrop } from '../reportWorkspaceService';

describe('reportWorkspaceService — corte do rodape', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'success', data: { id: 'RPH-1', cropHistory: [{ pixels: 45 }] } }) }));
  });

  afterEach(() => {
    delete global.fetch;
    vi.clearAllMocks();
  });

  it('cropWorkspacePhotoFooter faz POST em /crop-footer com a faixa e o meta', async () => {
    const result = await cropWorkspacePhotoFooter('RW 1', 'RPH-1', { pixels: 45 }, { updatedBy: 'curador@x' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://geo.lima.rio.br/api/report-workspaces/RW%201/photos/RPH-1/crop-footer');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(init.body)).toEqual({ data: { pixels: 45 }, meta: { updatedBy: 'curador@x' } });
    expect(result.data.cropHistory).toHaveLength(1);
  });

  it('cropWorkspacePhotoFooterBatch faz POST em /crop-footer-batch com photoIds, faixa e skipCropped', async () => {
    await cropWorkspacePhotoFooterBatch('RW-1', { photoIds: ['RPH-1', ' RPH-2 ', ''], pixels: 45, skipCropped: true }, { updatedBy: 'curador@x' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://geo.lima.rio.br/api/report-workspaces/RW-1/photos/crop-footer-batch');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ data: { photoIds: ['RPH-1', 'RPH-2'], pixels: 45, skipCropped: true }, meta: { updatedBy: 'curador@x' } });
  });

  it('undoWorkspacePhotoFooterCrop faz POST em /crop-footer/undo', async () => {
    await undoWorkspacePhotoFooterCrop('RW-1', 'RPH-1');
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://geo.lima.rio.br/api/report-workspaces/RW-1/photos/RPH-1/crop-footer/undo');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ meta: {} });
  });

  it('propaga a mensagem e o status do backend em erro', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ message: 'Esta foto nao tem corte para desfazer.' }) }));
    await expect(undoWorkspacePhotoFooterCrop('RW-1', 'RPH-1')).rejects.toMatchObject({ status: 409, message: 'Esta foto nao tem corte para desfazer.' });
  });
});
