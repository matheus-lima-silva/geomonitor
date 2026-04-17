import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks precisam ser declarados antes de importar o componente.
vi.mock('../../../../services/mediaService', () => ({
  createMediaUpload: vi.fn(),
  uploadMediaBinary: vi.fn(),
}));

vi.mock('../../../../services/reportArchiveService', () => ({
  createCompoundDelivery: vi.fn(),
  attachDeliveredMedia: vi.fn(),
  computeFileSha256: vi.fn(),
}));

import DeliveryUploadModal from '../DeliveryUploadModal';
import { createMediaUpload, uploadMediaBinary } from '../../../../services/mediaService';
import {
  attachDeliveredMedia,
  computeFileSha256,
  createCompoundDelivery,
} from '../../../../services/reportArchiveService';

describe('DeliveryUploadModal', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('executa fluxo completo: deliver -> upload-url -> PUT -> attach-delivered', async () => {
    createCompoundDelivery.mockResolvedValue({ id: 'RA-1', version: 1, compoundId: 'RC-1' });
    createMediaUpload.mockResolvedValue({
      data: {
        id: 'MED-FINAL',
        upload: { href: 'https://example.com/upload', method: 'PUT', headers: {} },
      },
    });
    uploadMediaBinary.mockResolvedValue({ ok: true });
    computeFileSha256.mockResolvedValue('abc123');
    attachDeliveredMedia.mockResolvedValue({ id: 'RA-1', version: 1, deliveredMediaId: 'MED-FINAL' });

    const onDelivered = vi.fn();
    const showToast = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <DeliveryUploadModal
          open
          onClose={onClose}
          compoundId="RC-1"
          compoundName="Composto A"
          userEmail="user@test"
          onDelivered={onDelivered}
          showToast={showToast}
        />,
      );
    });

    const fileInput = document.querySelector('[data-testid="delivery-file-input"]');
    const file = new File(['pdf-bytes'], 'entrega.pdf', { type: 'application/pdf' });
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const submitBtn = document.querySelector('[data-testid="delivery-submit"]');
    await act(async () => {
      submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createCompoundDelivery).toHaveBeenCalledWith('RC-1', { notes: '' }, { updatedBy: 'user@test' });
    expect(createMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'entrega.pdf',
        contentType: 'application/pdf',
        purpose: 'report_archive_delivered',
        linkedResourceType: 'report_archive',
        linkedResourceId: 'RA-1',
      }),
      { updatedBy: 'user@test' },
    );
    expect(uploadMediaBinary).toHaveBeenCalled();
    expect(computeFileSha256).toHaveBeenCalledWith(file);
    expect(attachDeliveredMedia).toHaveBeenCalledWith(
      'RA-1',
      expect.objectContaining({ mediaId: 'MED-FINAL', sha256: 'abc123' }),
      { updatedBy: 'user@test' },
    );
    expect(onDelivered).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Entrega v1'), 'success');
  });

  it('rejeita arquivo com tipo nao suportado', async () => {
    await act(async () => {
      root.render(
        <DeliveryUploadModal
          open
          onClose={vi.fn()}
          compoundId="RC-1"
          compoundName="X"
          userEmail="u@t"
        />,
      );
    });

    const fileInput = document.querySelector('[data-testid="delivery-file-input"]');
    const badFile = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [badFile], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const err = document.querySelector('[data-testid="delivery-error"]');
    expect(err).not.toBeNull();
    expect(err.textContent).toContain('nao suportado');
    expect(document.querySelector('[data-testid="delivery-submit"]').disabled).toBe(true);
  });

  it('mostra erro e nao chama onDelivered quando attach-delivered falha', async () => {
    createCompoundDelivery.mockResolvedValue({ id: 'RA-9', version: 1 });
    createMediaUpload.mockResolvedValue({
      data: { id: 'MED-9', upload: { href: 'https://ex.com', method: 'PUT' } },
    });
    uploadMediaBinary.mockResolvedValue({ ok: true });
    computeFileSha256.mockResolvedValue('h9');
    attachDeliveredMedia.mockRejectedValue(new Error('409 imutavel'));

    const onDelivered = vi.fn();
    await act(async () => {
      root.render(
        <DeliveryUploadModal
          open
          onClose={vi.fn()}
          compoundId="RC-9"
          compoundName="X"
          userEmail="u@t"
          onDelivered={onDelivered}
        />,
      );
    });

    const fileInput = document.querySelector('[data-testid="delivery-file-input"]');
    const file = new File(['bytes'], 'x.pdf', { type: 'application/pdf' });
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      document.querySelector('[data-testid="delivery-submit"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const err = document.querySelector('[data-testid="delivery-error"]');
    expect(err).not.toBeNull();
    expect(err.textContent).toContain('409');
    expect(onDelivered).not.toHaveBeenCalled();
  });
});
