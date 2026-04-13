import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsView from '../ReportsView';
import { getWorkspaceKmzRequest, listReportWorkspacePhotos, requestWorkspaceKmz, saveReportWorkspacePhoto, updateReportWorkspace } from '../../../../services/reportWorkspaceService';
import { downloadProjectPhotoExport, listProjectPhotos, requestProjectPhotoExport } from '../../../../services/projectPhotoLibraryService';
import { createProjectDossier, listProjectDossiers } from '../../../../services/projectDossierService';
import { addWorkspaceToReportCompound, generateReportCompound, listReportCompounds, reorderReportCompound, runReportCompoundPreflight } from '../../../../services/reportCompoundService';
import { downloadMediaAsset } from '../../../../services/mediaService';

const mockData = vi.hoisted(() => ({
  workspaces: [
    { id: 'RW-1', nome: 'Workspace 1', projectId: 'PRJ-01', status: 'draft', updatedAt: '2026-03-22T10:00:00.000Z' },
    { id: 'RW-2', nome: 'Workspace 2', projectId: 'PRJ-01', status: 'draft', updatedAt: '2026-03-22T11:00:00.000Z' },
  ],
  projects: [{ id: 'PRJ-01', nome: 'Linha Norte', torresCoordenadas: [{ numero: '1' }, { numero: '2' }] }],
  compounds: [{ id: 'RC-1', nome: 'Composto 1', workspaceIds: ['RW-1'], orderJson: ['RW-1'], status: 'draft', updatedAt: '2026-03-22T10:00:00.000Z' }],
  workspacePhotos: [{ id: 'RPH-1', caption: 'Foto 1', towerId: 'T-01', workspaceId: 'RW-1', importSource: 'structured_folders', includeInReport: true }],
  projectPhotos: [
    { id: 'RPH-1', caption: 'Foto 1 fundacao', towerId: 'T-01', workspaceId: 'RW-1', importSource: 'structured_folders', includeInReport: true, captureAt: '2026-03-21T10:00:00.000Z' },
    { id: 'RPH-2', caption: 'Vista geral', towerId: 'T-02', workspaceId: 'RW-2', importSource: 'loose_photos', includeInReport: false, captureAt: '2026-03-18T10:00:00.000Z' },
  ],
  dossiers: [{ id: 'DOS-1', nome: 'Dossie 1', status: 'draft' }],
}));

vi.mock('../../../../services/reportWorkspaceService', () => ({
  subscribeReportWorkspaces: vi.fn((onData) => { onData(mockData.workspaces); return () => {}; }),
  createReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-2' } }),
  importReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-1' } }),
  listReportWorkspacePhotos: vi.fn().mockResolvedValue(mockData.workspacePhotos),
  listTrashedWorkspacePhotos: vi.fn().mockResolvedValue([]),
  trashWorkspacePhoto: vi.fn().mockResolvedValue({ status: 'success' }),
  restoreWorkspacePhoto: vi.fn().mockResolvedValue({ status: 'success' }),
  emptyWorkspacePhotoTrash: vi.fn().mockResolvedValue({ data: { count: 0 } }),
  requestWorkspaceKmz: vi.fn().mockResolvedValue({ data: { token: 'kmz-1', statusExecucao: 'completed', outputKmzMediaId: 'MED-KMZ-1' } }),
  getWorkspaceKmzRequest: vi.fn().mockResolvedValue({ data: { token: 'kmz-1', statusExecucao: 'completed', outputKmzMediaId: 'MED-KMZ-1' } }),
  saveReportWorkspacePhoto: vi.fn().mockResolvedValue({ data: { id: 'RPH-2' } }),
  updateReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-1' } }),
}));

vi.mock('../../../../services/projectService', () => ({
  subscribeProjects: vi.fn((onData) => { onData(mockData.projects); return () => {}; }),
}));

vi.mock('../../../../services/reportCompoundService', () => ({
  subscribeReportCompounds: vi.fn((onData) => { onData(mockData.compounds); return () => {}; }),
  listReportCompounds: vi.fn().mockImplementation(async () => mockData.compounds),
  createReportCompound: vi.fn().mockResolvedValue({ data: { id: 'RC-2' } }),
  addWorkspaceToReportCompound: vi.fn().mockResolvedValue({
    data: {
      id: 'RC-1',
      nome: 'Composto 1',
      workspaceIds: ['RW-1', 'RW-2'],
      orderJson: ['RW-1', 'RW-2'],
      status: 'draft',
      updatedAt: '2026-03-22T12:00:00.000Z',
    },
  }),
  reorderReportCompound: vi.fn().mockResolvedValue({
    data: {
      id: 'RC-1',
      nome: 'Composto 1',
      workspaceIds: ['RW-1', 'RW-2'],
      orderJson: ['RW-2', 'RW-1'],
      status: 'draft',
      updatedAt: '2026-03-22T12:00:30.000Z',
    },
  }),
  runReportCompoundPreflight: vi.fn().mockResolvedValue({
    data: {
      workspaceCount: 2,
      foundWorkspaceCount: 2,
      warnings: [],
      canGenerate: true,
    },
  }),
  generateReportCompound: vi.fn().mockResolvedValue({
    data: {
      id: 'RC-1',
      nome: 'Composto 1',
      workspaceIds: ['RW-1', 'RW-2'],
      orderJson: ['RW-2', 'RW-1'],
      status: 'queued',
      updatedAt: '2026-03-22T12:01:00.000Z',
    },
  }),
}));

vi.mock('../../../../services/projectPhotoLibraryService', () => ({
  listProjectPhotos: vi.fn().mockImplementation(async (_projectId, filters = {}) => mockData.projectPhotos.filter((photo) => {
    if (filters.workspaceId && photo.workspaceId !== filters.workspaceId) return false;
    if (filters.towerId && photo.towerId !== filters.towerId) return false;
    if (filters.captionQuery && !String(photo.caption || '').toLowerCase().includes(String(filters.captionQuery || '').toLowerCase())) return false;
    if (filters.dateFrom && String(photo.captureAt || '') < `${filters.dateFrom}T00:00:00.000Z`) return false;
    if (filters.dateTo && String(photo.captureAt || '') > `${filters.dateTo}T23:59:59.999Z`) return false;
    return true;
  })),
  requestProjectPhotoExport: vi.fn().mockResolvedValue({ data: { itemCount: 1, token: 'pex-1' } }),
  downloadProjectPhotoExport: vi.fn().mockResolvedValue({ blob: new Blob(['zip']), fileName: 'photos-PRJ-01-pex.zip' }),
}));

vi.mock('../../../../services/projectDossierService', () => ({
  listProjectDossiers: vi.fn().mockImplementation(async () => mockData.dossiers),
  createProjectDossier: vi.fn().mockResolvedValue({ data: { id: 'DOS-2' } }),
  runProjectDossierPreflight: vi.fn().mockResolvedValue({ data: { canGenerate: true, summary: {} } }),
  generateProjectDossier: vi.fn().mockResolvedValue({ data: { id: 'DOS-1', status: 'queued' } }),
}));

vi.mock('../../../../services/mediaService', () => ({
  createMediaUpload: vi.fn().mockResolvedValue({ data: { id: 'MED-1', upload: { href: 'https://example.com/upload', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } } } }),
  uploadMediaBinary: vi.fn().mockResolvedValue({}),
  completeMediaUpload: vi.fn().mockResolvedValue({ data: { id: 'MED-1' } }),
  downloadMediaAsset: vi.fn().mockResolvedValue({ blob: new Blob(['docx']) }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush(n = 6) { for (let i = 0; i < n; i++) await act(async () => { await Promise.resolve(); }); }

function resetMockData() {
  mockData.workspaces = [
    { id: 'RW-1', nome: 'Workspace 1', projectId: 'PRJ-01', status: 'draft', updatedAt: '2026-03-22T10:00:00.000Z' },
    { id: 'RW-2', nome: 'Workspace 2', projectId: 'PRJ-01', status: 'draft', updatedAt: '2026-03-22T11:00:00.000Z' },
  ];
  mockData.projects = [{ id: 'PRJ-01', nome: 'Linha Norte', torresCoordenadas: [{ numero: '1' }, { numero: '2' }] }];
  mockData.compounds = [{ id: 'RC-1', nome: 'Composto 1', workspaceIds: ['RW-1'], orderJson: ['RW-1'], status: 'draft', updatedAt: '2026-03-22T10:00:00.000Z' }];
  mockData.workspacePhotos = [{ id: 'RPH-1', caption: 'Foto 1', towerId: 'T-01', workspaceId: 'RW-1', importSource: 'structured_folders', includeInReport: true }];
  mockData.projectPhotos = [
    { id: 'RPH-1', caption: 'Foto 1 fundacao', towerId: 'T-01', workspaceId: 'RW-1', importSource: 'structured_folders', includeInReport: true, captureAt: '2026-03-21T10:00:00.000Z' },
    { id: 'RPH-2', caption: 'Vista geral', towerId: 'T-02', workspaceId: 'RW-2', importSource: 'loose_photos', includeInReport: false, captureAt: '2026-03-18T10:00:00.000Z' },
  ];
  mockData.dossiers = [{ id: 'DOS-1', nome: 'Dossie 1', status: 'draft' }];
}

describe('ReportsView', () => {
  let container;
  let root;

  beforeEach(() => {
    resetMockData();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    window.HTMLAnchorElement.prototype.click = vi.fn();
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
    await flush();

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
    await flush();

    const libraryButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Biblioteca do Empreendimento'));
    await act(async () => {
      libraryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain('Baixar Tudo Filtrado');
    expect(container.textContent).toContain('Foto 1 fundacao');
    expect(container.textContent).toContain('Vista geral');
  });

  it('aplica filtros da biblioteca e reaproveita o mesmo recorte na exportacao', async () => {
    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });
    await flush();

    const libraryButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Biblioteca do Empreendimento'));
    await act(async () => {
      libraryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    const workspaceSelect = container.querySelector('#library-workspace');
    const towerSelect = container.querySelector('#library-tower');
    const captionInput = container.querySelector('#library-caption');
    const dateFromInput = container.querySelector('#library-date-from');
    const dateToInput = container.querySelector('#library-date-to');
    const exportButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Baixar Tudo Filtrado'));

    await act(async () => {
      const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      selectSetter.call(workspaceSelect, 'RW-1');
      workspaceSelect.dispatchEvent(new Event('change', { bubbles: true }));
      selectSetter.call(towerSelect, 'T-01');
      towerSelect.dispatchEvent(new Event('change', { bubbles: true }));
      inputSetter.call(captionInput, 'fundacao');
      captionInput.dispatchEvent(new Event('input', { bubbles: true }));
      captionInput.dispatchEvent(new Event('change', { bubbles: true }));
      inputSetter.call(dateFromInput, '2026-03-20');
      dateFromInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateFromInput.dispatchEvent(new Event('change', { bubbles: true }));
      inputSetter.call(dateToInput, '2026-03-21');
      dateToInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateToInput.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(listProjectPhotos).toHaveBeenLastCalledWith(
      'PRJ-01',
      expect.objectContaining({
        workspaceId: 'RW-1',
        towerId: 'T-01',
        captionQuery: 'fundacao',
        dateFrom: '2026-03-20',
        dateTo: '2026-03-21',
      }),
    );
    expect(container.textContent).toContain('Foto 1 fundacao');
    expect(container.textContent).not.toContain('Vista geral');

    await act(async () => {
      exportButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(requestProjectPhotoExport).toHaveBeenCalledWith(
      'PRJ-01',
      expect.objectContaining({
        folderMode: 'tower',
        filters: expect.objectContaining({
          workspaceId: 'RW-1',
          towerId: 'T-01',
          captionQuery: 'fundacao',
          dateFrom: '2026-03-20',
          dateTo: '2026-03-21',
        }),
      }),
      expect.objectContaining({ updatedBy: 'teste@exemplo.com' }),
    );
    expect(downloadProjectPhotoExport).toHaveBeenCalled();
  });

  it('exibe a curadoria do workspace e salva alteracoes da foto', async () => {
    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });
    await flush();

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

  it('cria dossie com escopo editorial configuravel', async () => {
    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const dossierButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Dossie do Empreendimento'));
    await act(async () => {
      dossierButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    const nameInput = container.querySelector('#dossier-name');
    const notesInput = container.querySelector('#dossier-notes');
    const includeFotos = container.querySelector('#dossier-scope-includeFotos');
    const includeErosoes = container.querySelector('#dossier-scope-includeErosoes');
    const createButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Criar Dossie'));

    await act(async () => {
      const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      inputSetter.call(nameInput, 'Dossie Operacional');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      textareaSetter.call(notesInput, 'Escopo editorial ajustado');
      notesInput.dispatchEvent(new Event('input', { bubbles: true }));
      notesInput.dispatchEvent(new Event('change', { bubbles: true }));
      includeFotos.click();
      includeErosoes.click();
    });

    await act(async () => {
      createButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(createProjectDossier).toHaveBeenCalledWith(
      'PRJ-01',
      expect.objectContaining({
        nome: 'Dossie Operacional',
        observacoes: 'Escopo editorial ajustado',
        scopeJson: expect.objectContaining({
          includeLicencas: true,
          includeInspecoes: true,
          includeErosoes: false,
          includeEntregas: true,
          includeWorkspaces: true,
          includeFotos: false,
        }),
      }),
      expect.objectContaining({ updatedBy: 'teste@exemplo.com' }),
    );
  });

  it('adiciona workspace ao composto e expõe preflight e geracao na UI', async () => {
    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });
    await flush();

    const compoundsButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Relatorios Compostos'));
    await act(async () => {
      compoundsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    const workspaceSelect = container.querySelector('#compound-workspace-RC-1');
    const addButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Adicionar Workspace'));
    const preflightButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Rodar Preflight'));
    const generateButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Enfileirar Geracao'));

    await act(async () => {
      const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      selectSetter.call(workspaceSelect, 'RW-2');
      workspaceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(addWorkspaceToReportCompound).toHaveBeenCalledWith(
      'RC-1',
      'RW-2',
      expect.objectContaining({ updatedBy: 'teste@exemplo.com' }),
    );
    expect(container.textContent).toContain('Workspace 2 - Linha Norte');

    const moveUpButton = container.querySelector('[aria-label="Mover Workspace 2 - Linha Norte para cima"]');

    await act(async () => {
      moveUpButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(reorderReportCompound).toHaveBeenCalledWith(
      'RC-1',
      ['RW-2', 'RW-1'],
      expect.objectContaining({ updatedBy: 'teste@exemplo.com' }),
    );
    const orderedRows = [...container.querySelectorAll('[id^="compound-order-RC-1-"]')];
    expect(orderedRows[0]?.id).toBe('compound-order-RC-1-RW-2');
    expect(orderedRows[1]?.id).toBe('compound-order-RC-1-RW-1');

    await act(async () => {
      preflightButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(runReportCompoundPreflight).toHaveBeenCalledWith('RC-1');
    expect(container.textContent).toContain('Pronto para gerar');
    expect(container.textContent).toContain('Declarados: 2');
    expect(container.textContent).toContain('Encontrados: 2');

    await act(async () => {
      generateButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(generateReportCompound).toHaveBeenCalledWith('RC-1');
    expect(container.textContent).toContain('queued');
  });

  it('exibe download do DOCX final para dossie concluido', async () => {
    mockData.dossiers = [{
      id: 'DOS-1',
      nome: 'Dossie 1',
      status: 'completed',
      outputDocxMediaId: 'MED-DOCX-1',
      lastError: '',
    }];

    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });
    await flush();

    const dossierButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Dossie do Empreendimento'));
    await act(async () => {
      dossierButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush();

    const downloadButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Baixar DOCX'));
    expect(downloadButton).toBeTruthy();

    await act(async () => {
      downloadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(downloadMediaAsset).toHaveBeenCalledWith('MED-DOCX-1');
  });

  it('faz refresh curto enquanto houver relatorios em fila ou processando', async () => {
    vi.useFakeTimers();
    mockData.dossiers = [{ id: 'DOS-1', nome: 'Dossie 1', status: 'queued' }];
    mockData.compounds = [{ id: 'RC-1', nome: 'Composto 1', workspaceIds: ['RW-1'], orderJson: ['RW-1'], status: 'processing' }];

    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });
    await flush();
    for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(listProjectDossiers).toHaveBeenCalledTimes(1);
    expect(listReportCompounds).toHaveBeenCalledTimes(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(listProjectDossiers).toHaveBeenCalledTimes(2);
    expect(listReportCompounds).toHaveBeenCalledTimes(1);
  });

  it('autosalva o rascunho da curadoria no draftState do workspace', async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });
    await flush();
    for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const captionInput = container.querySelector('#rw-photo-caption-RPH-1');

    await act(async () => {
      const captionSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      captionSetter.call(captionInput, 'Legenda em rascunho');
      captionInput.dispatchEvent(new Event('input', { bubbles: true }));
      captionInput.dispatchEvent(new Event('change', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(1300);
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

  it('solicita o KMZ do workspace atual e libera o download do artefato final', async () => {
    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
    });
    await flush();

    const requestButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Gerar KMZ com Fotos'));
    expect(requestButton).toBeTruthy();

    await act(async () => {
      requestButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(requestWorkspaceKmz).toHaveBeenCalledWith(
      'RW-1',
      expect.objectContaining({ updatedBy: 'teste@exemplo.com' }),
    );
    expect(getWorkspaceKmzRequest).not.toHaveBeenCalled();

    const downloadButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Baixar KMZ'));
    expect(downloadButton).toBeTruthy();

    await act(async () => {
      downloadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(downloadMediaAsset).toHaveBeenCalledWith('MED-KMZ-1');
  });

  it('gera miniatura quando existe blob valido mesmo sem content-type de imagem', async () => {
    listReportWorkspacePhotos.mockResolvedValueOnce([{
      id: 'RPH-1',
      caption: 'Foto 1',
      towerId: 'T-01',
      workspaceId: 'RW-1',
      importSource: 'structured_folders',
      includeInReport: true,
      mediaAssetId: 'MED-PREVIEW-1',
    }]);
    downloadMediaAsset.mockResolvedValueOnce({
      blob: new Blob(['preview'], { type: 'application/octet-stream' }),
      contentType: 'application/pdf',
    });

    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(downloadMediaAsset).toHaveBeenCalledWith('MED-PREVIEW-1');
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('nao faz retry infinito de miniatura quando o download falha', async () => {
    listReportWorkspacePhotos.mockResolvedValueOnce([{
      id: 'RPH-1',
      caption: 'Foto 1',
      towerId: 'T-01',
      workspaceId: 'RW-1',
      importSource: 'structured_folders',
      includeInReport: true,
      mediaAssetId: 'MED-PREVIEW-ERR',
    }]);
    downloadMediaAsset.mockRejectedValue(new Error('falha de preview'));

    await act(async () => {
      root.render(<ReportsView userEmail="teste@exemplo.com" showToast={vi.fn()} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(downloadMediaAsset).toHaveBeenCalledTimes(1);
    expect(downloadMediaAsset).toHaveBeenCalledWith('MED-PREVIEW-ERR');
  });
});
