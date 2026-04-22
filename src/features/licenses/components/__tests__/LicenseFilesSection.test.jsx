import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks precisam ser declarados antes de importar o componente.
vi.mock('../../services/licenseAttachmentService', async () => {
  const actual = await vi.importActual('../../services/licenseAttachmentService');
  return {
    ...actual,
    listAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
  };
});

import LicenseFilesSection from '../LicenseFilesSection';
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
} from '../../services/licenseAttachmentService';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('LicenseFilesSection', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    listAttachments.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('sem licenseId mostra mensagem de orientacao e nao busca anexos', async () => {
    await act(async () => {
      root.render(<LicenseFilesSection licenseId="" showToast={vi.fn()} />);
    });
    expect(container.textContent).toContain('Salve a LO primeiro');
    expect(listAttachments).not.toHaveBeenCalled();
  });

  it('com licenseId lista vazia renderiza 2 slots com botao Anexar', async () => {
    listAttachments.mockResolvedValue([]);
    await act(async () => {
      root.render(<LicenseFilesSection licenseId="LO-X" showToast={vi.fn()} />);
    });
    await act(async () => { await flush(); });
    expect(listAttachments).toHaveBeenCalledWith('LO-X');
    expect(container.textContent).toContain('Documento da LO');
    expect(container.textContent).toContain('Plano de Gerenciamento Ambiental');
    const inputs = container.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(2);
    const buttons = container.querySelectorAll('button');
    const anexarButtons = [...buttons].filter((b) => /Anexar PDF/.test(b.textContent));
    expect(anexarButtons).toHaveLength(2);
  });

  it('upload bem-sucedido chama uploadAttachment e atualiza lista', async () => {
    listAttachments.mockResolvedValue([]);
    uploadAttachment.mockResolvedValue({
      slot: 'documentoLO',
      mediaAssetId: 'MED-1',
      fileName: 'lo.pdf',
      sizeBytes: 1024,
      attachedAt: '2026-04-22T00:00:00Z',
      attachedBy: 'user@test',
    });
    const showToast = vi.fn();

    await act(async () => {
      root.render(<LicenseFilesSection licenseId="LO-X" showToast={showToast} />);
    });
    await act(async () => { await flush(); });

    const input = container.querySelector('[data-testid="license-file-input-documentoLO"]');
    const file = new File(['pdf'], 'lo.pdf', { type: 'application/pdf' });
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
    });

    expect(uploadAttachment).toHaveBeenCalledWith('LO-X', 'documentoLO', file);
    expect(showToast).toHaveBeenCalledWith('Arquivo anexado com sucesso.', 'success');
    expect(container.textContent).toContain('lo.pdf');
  });

  it('upload com PDF invalido mostra toast de erro com codigo UNSUPPORTED_MEDIA_TYPE', async () => {
    listAttachments.mockResolvedValue([]);
    const err = new Error('Apenas PDF e aceito.');
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    uploadAttachment.mockRejectedValue(err);
    const showToast = vi.fn();

    await act(async () => {
      root.render(<LicenseFilesSection licenseId="LO-X" showToast={showToast} />);
    });
    await act(async () => { await flush(); });

    const input = container.querySelector('[data-testid="license-file-input-planoGerenciamento"]');
    const file = new File(['x'], 'foo.png', { type: 'image/png' });
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
    });

    expect(showToast).toHaveBeenCalledWith('Apenas PDF é aceito.', 'error');
  });

  it('Remover chama deleteAttachment e tira o item da lista', async () => {
    listAttachments.mockResolvedValue([
      {
        slot: 'documentoLO',
        mediaAssetId: 'MED-1',
        fileName: 'lo.pdf',
        sizeBytes: 1024,
        attachedAt: '2026-04-22T00:00:00Z',
        attachedBy: 'user@test',
      },
    ]);
    deleteAttachment.mockResolvedValue(null);
    const showToast = vi.fn();

    await act(async () => {
      root.render(<LicenseFilesSection licenseId="LO-X" showToast={showToast} />);
    });
    await act(async () => { await flush(); });

    expect(container.textContent).toContain('lo.pdf');

    const buttons = [...container.querySelectorAll('button')];
    const removerBtn = buttons.find((b) => /Remover/.test(b.textContent));
    expect(removerBtn).toBeTruthy();
    await act(async () => {
      removerBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(deleteAttachment).toHaveBeenCalledWith('LO-X', 'documentoLO');
    expect(showToast).toHaveBeenCalledWith('Anexo removido.', 'success');
    expect(container.textContent).not.toContain('lo.pdf');
  });

  it('Baixar chama downloadAttachment com mediaAssetId e fileName', async () => {
    listAttachments.mockResolvedValue([
      {
        slot: 'documentoLO',
        mediaAssetId: 'MED-99',
        fileName: 'documento.pdf',
        sizeBytes: 1000,
      },
    ]);
    downloadAttachment.mockResolvedValue(null);

    await act(async () => {
      root.render(<LicenseFilesSection licenseId="LO-X" showToast={vi.fn()} />);
    });
    await act(async () => { await flush(); });

    const baixarBtn = [...container.querySelectorAll('button')].find((b) => /Baixar/.test(b.textContent));
    await act(async () => {
      baixarBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(downloadAttachment).toHaveBeenCalledWith('MED-99', 'documento.pdf');
  });
});
