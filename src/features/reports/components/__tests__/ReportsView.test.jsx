import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsView from '../ReportsView';

const mockData = vi.hoisted(() => ({
  workspaces: [{ id: 'RW-1', nome: 'Workspace 1', projectId: 'PRJ-01', status: 'draft', updatedAt: '2026-03-22T10:00:00.000Z' }],
  projects: [{ id: 'PRJ-01', nome: 'Linha Norte' }],
  compounds: [{ id: 'RC-1', nome: 'Composto 1', workspaceIds: ['RW-1'], status: 'draft', updatedAt: '2026-03-22T10:00:00.000Z' }],
  photos: [{ id: 'RPH-1', caption: 'Foto 1', towerId: 'T-01', workspaceId: 'RW-1', importSource: 'structured_folders', includeInReport: true }],
  dossiers: [{ id: 'DOS-1', nome: 'Dossie 1', status: 'draft' }],
}));

vi.mock('../../../../services/reportWorkspaceService', () => ({
  subscribeReportWorkspaces: vi.fn((onData) => { onData(mockData.workspaces); return () => {}; }),
  createReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-2' } }),
  importReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-1' } }),
  saveReportWorkspacePhoto: vi.fn().mockResolvedValue({ data: { id: 'RPH-2' } }),
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
});
