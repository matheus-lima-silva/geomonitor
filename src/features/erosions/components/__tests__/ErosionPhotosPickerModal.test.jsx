globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('../../../../services/reportWorkspaceService', () => ({
  subscribeReportWorkspaces: vi.fn(),
  listReportWorkspacePhotos: vi.fn(),
}));
vi.mock('../../../../services/erosionService', () => ({
  saveErosion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../../services/mediaService', () => ({
  downloadMediaAsset: vi.fn().mockResolvedValue({ blob: new Blob(['x']) }),
}));

import {
  subscribeReportWorkspaces,
  listReportWorkspacePhotos,
} from '../../../../services/reportWorkspaceService';
import { saveErosion } from '../../../../services/erosionService';
import ErosionPhotosPickerModal from '../ErosionPhotosPickerModal';
import { ToastProvider } from '../../../../context/ToastContext';

let root;
let container;
let subCb;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  subscribeReportWorkspaces.mockReset();
  listReportWorkspacePhotos.mockReset();
  saveErosion.mockClear();
  subscribeReportWorkspaces.mockImplementation((cb) => {
    subCb = cb;
    return () => {};
  });
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
  root = createRoot(container);
});

async function renderWith(props) {
  await act(async () => {
    root.render(
      <ToastProvider>
        <ErosionPhotosPickerModal {...props} />
      </ToastProvider>,
    );
  });
}

describe('ErosionPhotosPickerModal', () => {
  it('mostra CTA para criar workspace quando nao ha nenhum no projeto', async () => {
    const onRequestCreateWorkspace = vi.fn();
    await renderWith({
      open: true,
      erosion: { id: 'ERS-1', projetoId: 'P-1' },
      onClose: vi.fn(),
      onRequestCreateWorkspace,
    });
    await act(async () => { subCb([]); });
    await flush();
    const hasCta = container.textContent.includes('Criar banco de fotos');
    expect(hasCta).toBe(true);
  });

  it('bloqueia selecao acima de 6 fotos', async () => {
    listReportWorkspacePhotos.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        id: `RWP-${i}`,
        mediaAssetId: `MA-${i}`,
        caption: `foto ${i}`,
      })),
    );
    await renderWith({
      open: true,
      erosion: { id: 'ERS-1', projetoId: 'P-1' },
      onClose: vi.fn(),
    });
    await act(async () => {
      subCb([{ id: 'RW-1', projectId: 'P-1', titulo: 'A' }]);
    });
    await flush();
    await flush();

    const buttons = container.querySelectorAll('button[aria-pressed]');
    expect(buttons.length).toBe(8);

    for (let i = 0; i < 6; i += 1) {
      await act(async () => { buttons[i].click(); });
    }
    const before = container.querySelectorAll('button[aria-pressed="true"]').length;
    expect(before).toBe(6);

    await act(async () => { buttons[6].click(); });
    const after = container.querySelectorAll('button[aria-pressed="true"]').length;
    expect(after).toBe(6);
  });

  it('salva selecao chamando saveErosion com fotosPrincipais reindexadas', async () => {
    listReportWorkspacePhotos.mockResolvedValue([
      { id: 'RWP-1', mediaAssetId: 'MA-1', caption: 'a' },
      { id: 'RWP-2', mediaAssetId: 'MA-2', caption: 'b' },
    ]);
    const onSaved = vi.fn();
    const onClose = vi.fn();
    await renderWith({
      open: true,
      erosion: { id: 'ERS-X', projetoId: 'P-1' },
      userEmail: 'user@test',
      onClose,
      onSaved,
    });
    await act(async () => {
      subCb([{ id: 'RW-1', projectId: 'P-1', titulo: 'A' }]);
    });
    await flush();
    await flush();

    const cards = container.querySelectorAll('button[aria-pressed]');
    await act(async () => { cards[0].click(); });
    await act(async () => { cards[1].click(); });

    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.trim().startsWith('Salvar'),
    );
    await act(async () => { saveBtn.click(); });
    await flush();

    expect(saveErosion).toHaveBeenCalledTimes(1);
    const [payload, meta] = saveErosion.mock.calls[0];
    expect(payload.id).toBe('ERS-X');
    expect(payload.fotosPrincipais).toHaveLength(2);
    expect(payload.fotosPrincipais[0].sortOrder).toBe(0);
    expect(payload.fotosPrincipais[1].sortOrder).toBe(1);
    expect(meta.merge).toBe(true);
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
