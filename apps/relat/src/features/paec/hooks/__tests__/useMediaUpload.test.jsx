import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('@app/services/mediaService', () => ({
  createMediaUpload: vi.fn(),
  uploadMediaBinary: vi.fn(),
  completeMediaUpload: vi.fn(),
}));
vi.mock('@app/services/reportArchiveService', () => ({
  computeFileSha256: vi.fn(async () => 'abc123'),
}));

import { createMediaUpload, uploadMediaBinary, completeMediaUpload } from '@app/services/mediaService';
import { computeFileSha256 } from '@app/services/reportArchiveService';
import { useMediaUpload } from '../useMediaUpload';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fakeFile({ name = 'rota.png', type = 'image/png', size = 1024 } = {}) {
  return { name, type, size };
}

function Probe({ api }) {
  api.current = useMediaUpload({ purpose: 'paec_attachment', linkedResourceType: 'paec_plant' });
  return null;
}

describe('useMediaUpload', () => {
  let container;
  let root;
  let api;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    api = { current: null };
    createMediaUpload.mockResolvedValue({
      data: { id: 'MEDIA-1', upload: { href: 'http://storage/put', method: 'PUT' } },
    });
    uploadMediaBinary.mockResolvedValue({});
    completeMediaUpload.mockResolvedValue({});
    await act(async () => { root.render(<Probe api={api} />); });
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.clearAllMocks();
  });

  it('encadeia create -> PUT -> complete (com sha256) e retorna o mediaId', async () => {
    let mediaId;
    await act(async () => {
      mediaId = await api.current.uploadFile(fakeFile(), { linkedResourceId: 'PAEC-1' });
    });

    expect(mediaId).toBe('MEDIA-1');
    expect(createMediaUpload).toHaveBeenCalledWith({
      fileName: 'rota.png',
      contentType: 'image/png',
      sizeBytes: 1024,
      purpose: 'paec_attachment',
      linkedResourceType: 'paec_plant',
      linkedResourceId: 'PAEC-1',
    });
    expect(uploadMediaBinary).toHaveBeenCalledWith(
      { href: 'http://storage/put', method: 'PUT' },
      expect.objectContaining({ name: 'rota.png' }),
    );
    expect(computeFileSha256).toHaveBeenCalled();
    expect(completeMediaUpload).toHaveBeenCalledWith({
      id: 'MEDIA-1',
      sha256: 'abc123',
      storedSizeBytes: 1024,
    });
  });

  it('rejeita MIME fora da whitelist de imagem sem chamar a API', async () => {
    await expect(
      act(async () => { await api.current.uploadFile(fakeFile({ type: 'application/pdf' })); }),
    ).rejects.toThrow('Formato não aceito');
    expect(createMediaUpload).not.toHaveBeenCalled();
  });

  it('rejeita arquivo acima de 50 MB sem chamar a API', async () => {
    await expect(
      act(async () => { await api.current.uploadFile(fakeFile({ size: 51 * 1024 * 1024 })); }),
    ).rejects.toThrow('excede 50 MB');
    expect(createMediaUpload).not.toHaveBeenCalled();
  });

  it('propaga o erro quando a criacao do upload falha', async () => {
    createMediaUpload.mockRejectedValueOnce(new Error('storage fora do ar'));
    await expect(
      act(async () => { await api.current.uploadFile(fakeFile()); }),
    ).rejects.toThrow('storage fora do ar');
    expect(completeMediaUpload).not.toHaveBeenCalled();
  });
});
