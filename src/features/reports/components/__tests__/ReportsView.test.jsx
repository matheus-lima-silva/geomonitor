import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsView from '../ReportsView';
import { listReportWorkspacePhotos, saveReportWorkspacePhoto, updateReportWorkspace } from '../../../../services/reportWorkspaceService';

const mockData = vi.hoisted(() => ({
  workspaces: [{ id: 'RW-1', nome: 'Workspace 1', projectId: 'PRJ-01', status: 'draft', updatedAt: '2026-03-22T10:00:00.000Z' }],
  projects: [{ id: 'PRJ-01', nome: 'Linha Norte', torresCoordenadas: [{ numero: '1' }, { numero: '2' }] }],
  compounds: [{ id: 'RC-1', nome: 'Composto 1', workspaceIds: ['RW-1'], status: 'draft', updatedAt: '2026-03-22T10:00:00.000Z' }],
  photos: [{ id: 'RPH-1', caption: 'Foto 1', towerId: 'T-01', workspaceId: 'RW-1', importSource: 'structured_folders', includeInReport: true }],
  dossiers: [{ id: 'DOS-1', nome: 'Dossie 1', status: 'draft' }],
}));

vi.mock('../../../../services/reportWorkspaceService', () => ({
  subscribeReportWorkspaces: vi.fn((onData) => { onData(mockData.workspaces); return () => {}; }),
  createReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-2' } }),
  importReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-1' } }),
  listReportWorkspacePhotos: vi.fn().mockResolvedValue(mockData.photos),
  saveReportWorkspacePhoto: vi.fn().mockResolvedValue({ data: { id: 'RPH-2' } }),
  updateReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-1' } }),
}));

vi.mock('../../../../services/projectService', () => ({
  subscribeProjects: vi.fn((onData) => { onData(mockData.projects); return () => {}; }),
}));

vi.mock('../../../../services/reportCompoundService', () => ({
  subscribeReportCompounds: vi.fn((onData) => { onData(mockData.compounds); return () => {}; }),
  createReportCompound: vi.fn().mockResolvedValue({ data: { id: 'RC-2' } }),
}));

vi.mock('../../../../services/projectPhotoLibraryService', () => ({
  listProjectPhotos: vi.fn().mockResolvedValue(mockData.photos),
  requestProjectPhotoExport: vi.fn().mockResolvedValue({ data: { itemCount: 1 } }),
}));

vi.mock('../../../../services/projectDossierService', () => ({
  listProjectDossiers: vi.fn().mockResolvedValue(mockData.dossiers),
  createProjectDossier: vi.fn().mockResolvedValue({ data: { id: 'DOS-2' } }),
}));

vi.mock('../../../../services/mediaService', () => ({
  createMediaUpload: vi.fn().mockResolvedValue({ data: { id: 'MED-1', upload: { href: 'https://example.com/upload', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } } } }),
  uploadMediaBinary: vi.fn().mockResolvedValue({}),
  completeMediaUpload: vi.fn().mockResolvedValue({ data: { id: 'MED-1' } }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ReportsView', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renderiza as quatro areas principais do modulo', async () => {
    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });

    expect(container.textContent).toContain('Workspaces');
    expect(container.textContent).toContain('Biblioteca do Empreendimento');
    expect(container.textContent).toContain('Dossie do Empreendimento');
    expect(container.textContent).toContain('Relatorios Compostos');
    expect(container.textContent).toContain('Workspace 1');
  });

  it('troca para a biblioteca do empreendimento e exibe a acao de exportacao', async () => {
    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });

    const libraryButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Biblioteca do Empreendimento'));
    await act(async () => {
      libraryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Baixar Tudo Filtrado');
    expect(container.textContent).toContain('Foto 1');
  });

  it('exibe a curadoria do workspace e salva alteracoes da foto', async () => {
    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });

    expect(listReportWorkspacePhotos).toHaveBeenCalledWith('RW-1');
    expect(container.textContent).toContain('Curadoria do Workspace');

    const captionInput = container.querySelector('#rw-photo-caption-RPH-1');
    const towerSelect = container.querySelector('#rw-photo-tower-RPH-1');
    const includeCheckbox = container.querySelector('#rw-photo-include-RPH-1');
    const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Salvar Curadoria'));

    await act(async () => {
      const captionSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const towerSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      captionSetter.call(captionInput, 'Foto revisada');
      captionInput.dispatchEvent(new Event('input', { bubbles: true }));
      captionInput.dispatchEvent(new Event('change', { bubbles: true }));
      towerSetter.call(towerSelect, '2');
      towerSelect.dispatchEvent(new Event('change', { bubbles: true }));
      includeCheckbox.click();
    });

    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(saveReportWorkspacePhoto).toHaveBeenCalledWith(
      'RW-1',
      'RPH-1',
      expect.objectContaining({
        caption: 'Foto revisada',
        towerId: '2',
        includeInReport: false,
        towerSource: 'manual',
      }),
      expect.objectContaining({ updatedBy: 'teste@exemplo.com' }),
    );
  });

  it('autosalva o rascunho da curadoria no draftState do workspace', async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });

    const captionInput = container.querySelector('#rw-photo-caption-RPH-1');

    await act(async () => {
      const captionSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      captionSetter.call(captionInput, 'Legenda em rascunho');
      captionInput.dispatchEvent(new Event('input', { bubbles: true }));
      captionInput.dispatchEvent(new Event('change', { bubbles: true }));
      vi.advanceTimersByTime(1300);
      await Promise.resolve();
    });

    expect(updateReportWorkspace).toHaveBeenCalledWith(
      'RW-1',
      expect.objectContaining({
        draftState: expect.objectContaining({
          curationDrafts: expect.objectContaining({
            'RPH-1': expect.objectContaining({
              caption: 'Legenda em rascunho',
              towerId: 'T-01',
              includeInReport: true,
            }),
          }),
          autosave: expect.objectContaining({
            status: 'saved',
            photoCount: 1,
          }),
        }),
      }),
      expect.objectContaining({ updatedBy: 'teste@exemplo.com' }),
    );
  });
});
