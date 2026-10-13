import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsView from '../ReportsView';
import { importReportWorkspace, saveReportWorkspacePhoto, updateReportWorkspace } from '../../../../services/reportWorkspaceService';
import { saveInspection } from '../../../../services/inspectionService';
import { buildFileKey } from '../../../../utils/photoCampaign/photoCampaignAnalysis';

// Linha sintetica: torre N em lat -20 + N * 0.003 (~333 m entre torres).
const DEG_PER_M_LAT = 1 / 111320;
const towerLat = (n) => -20 + n * 0.003;

const mockData = vi.hoisted(() => ({
  workspaces: [
    { id: 'RW-1', nome: 'Campanha set/2026', projectId: 'BMDOPR', status: 'draft', updatedAt: '2026-10-01T10:00:00.000Z' },
    { id: 'RW-2', nome: 'Campanha mar/2026', projectId: 'BMDOPR', inspectionId: 'VS-OLD', status: 'draft', updatedAt: '2026-04-01T10:00:00.000Z' },
  ],
  projects: [{
    id: 'BMDOPR',
    nome: 'Bom Despacho - Ouro Preto',
    torres: '20',
    torresCoordenadas: Array.from({ length: 20 }, (_, i) => ({ numero: String(i + 1), latitude: -20 + (i + 1) * 0.003, longitude: -44 })),
  }],
  inspections: [{ id: 'VS-OLD', projetoId: 'BMDOPR', dataInicio: '2026-03-30', dataFim: '2026-04-07', responsavel: 'Eng.', detalhesDias: [] }],
}));

// EXIF mockado por nome de arquivo.
const META = {
  'a.jpg': { gpsLat: towerLat(5) + 10 * DEG_PER_M_LAT, gpsLon: -44, capturedAt: '2026-09-22T09:00:00', capturedDate: '2026-09-22', capturedTime: '09:00', description: 'BMDOPR\n5' },
  'b.jpg': { gpsLat: towerLat(7) + 30 * DEG_PER_M_LAT, gpsLon: -44, capturedAt: '2026-09-22T11:00:00', capturedDate: '2026-09-22', capturedTime: '11:00', description: null },
};
vi.mock('../../../../utils/photoCampaign/exifMeta', () => ({
  readExifMetaFromFile: async (file) => META[file.name] || null,
}));

vi.mock('../../../../services/reportWorkspaceService', () => ({
  subscribeReportWorkspaces: vi.fn((onData) => { onData(mockData.workspaces); return () => {}; }),
  createReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-9' } }),
  importReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-1' } }),
  listReportWorkspacePhotos: vi.fn().mockResolvedValue([]),
  listTrashedWorkspacePhotos: vi.fn().mockResolvedValue([]),
  trashWorkspacePhoto: vi.fn(),
  restoreWorkspacePhoto: vi.fn(),
  emptyWorkspacePhotoTrash: vi.fn().mockResolvedValue({ data: { count: 0 } }),
  requestWorkspaceKmz: vi.fn(),
  getWorkspaceKmzRequest: vi.fn(),
  saveReportWorkspacePhoto: vi.fn().mockImplementation(async (_ws, photoId, payload) => ({ data: { id: photoId, ...payload } })),
  updateReportWorkspace: vi.fn().mockResolvedValue({ data: { id: 'RW-1' } }),
  deleteReportWorkspacePhoto: vi.fn(),
  cropWorkspacePhotoFooter: vi.fn(),
  undoWorkspacePhotoFooterCrop: vi.fn(),
  processWorkspaceKmz: vi.fn(),
}));

vi.mock('../../../../services/projectService', () => ({
  subscribeProjects: vi.fn((onData) => { onData(mockData.projects); return () => {}; }),
}));

vi.mock('../../../../services/reportCompoundService', () => ({
  subscribeReportCompounds: vi.fn((onData) => { onData([]); return () => {}; }),
  listReportCompounds: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../services/projectPhotoLibraryService', () => ({
  listProjectPhotos: vi.fn().mockResolvedValue([]),
  requestProjectPhotoExport: vi.fn(),
  downloadProjectPhotoExport: vi.fn(),
}));

vi.mock('../../../../services/projectDossierService', () => ({
  listProjectDossiers: vi.fn().mockResolvedValue([]),
  createProjectDossier: vi.fn(),
  runProjectDossierPreflight: vi.fn(),
  generateProjectDossier: vi.fn(),
}));

vi.mock('../../../../services/mediaService', () => ({
  createMediaUpload: vi.fn().mockImplementation(async ({ fileName }) => ({ data: { id: `MED-${fileName}`, upload: { href: 'https://example.com/upload', method: 'PUT', headers: {} } } })),
  uploadMediaBinary: vi.fn().mockResolvedValue({}),
  completeMediaUpload: vi.fn().mockResolvedValue({ data: {} }),
  downloadMediaAsset: vi.fn().mockResolvedValue({ blob: new Blob(['x']) }),
  resolveMediaDownload: vi.fn(),
}));

vi.mock('../../../../services/userService', () => ({
  listProfissoes: vi.fn().mockResolvedValue([]),
  listSignatarios: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../services/inspectionService', () => ({
  subscribeInspections: vi.fn((onData) => { onData(mockData.inspections); return () => {}; }),
  saveInspection: vi.fn().mockImplementation(async (payload) => payload.id || 'VS-NEW'),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fakeFile(name) {
  return { name, type: 'image/jpeg', size: 100, lastModified: 1, webkitRelativePath: '', slice: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }), arrayBuffer: async () => new ArrayBuffer(0) };
}

async function flush(times = 8) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function findButton(text, scope = document.body) {
  return [...scope.querySelectorAll('button')].find((item) => item.textContent.includes(text));
}

async function click(text, scope = document.body) {
  const button = findButton(text, scope);
  expect(button, `botao "${text}"`).toBeTruthy();
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

function changeSelect(el, value) {
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ReportsView — captacao unica de fotos', () => {
  let container;
  let root;
  const showToast = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    showToast.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function openIntake(targetId = 'RW-1') {
    await act(async () => {
      root.render(<ReportsView userEmail="curador@x" showToast={showToast} />);
      await Promise.resolve();
    });
    await flush(3);
    // Abre o colapsavel de import e escolhe o alvo.
    if (!container.querySelector('#rw-import-target')) await click('Importar Fotos');
    changeSelect(container.querySelector('#rw-import-target'), targetId);
    await flush(2);
    expect(container.querySelector('#rw-import-mode')).toBeNull();
    expect(container.querySelector('#rw-import-kmz')).toBeTruthy();
    await click('Selecionar fotos da campanha');
    const input = document.querySelector('#inspection-photo-autofill-folder');
    expect(input).toBeTruthy();
    Object.defineProperty(input, 'files', { value: [fakeFile('a.jpg'), fakeFile('b.jpg')], configurable: true });
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Analisar fotos');
    await flush();
    expect(document.querySelector('[data-testid="photo-autofill-review"]')).toBeTruthy();
  }

  it('sobe as fotos com torre/origem/data do EXIF, pula a sugestao GPS desmarcada e registra o import', async () => {
    await openIntake();
    const dest = document.querySelector('[data-testid="photo-intake-destinations"]');
    expect(dest.querySelector('#photo-intake-dest-workspace').checked).toBe(true);
    expect(dest.querySelector('#photo-intake-dest-workspace').disabled).toBe(true);
    expect(dest.querySelector('#photo-intake-dest-diary').checked).toBe(false);

    await click('Enviar 1 foto para o workspace');
    await flush(10);

    expect(saveReportWorkspacePhoto).toHaveBeenCalledTimes(1);
    const [wsId, , payload] = saveReportWorkspacePhoto.mock.calls[0];
    expect(wsId).toBe('RW-1');
    expect(payload).toMatchObject({ towerId: '5', towerSource: 'exif_label', importSource: 'photo_campaign', curationStatus: 'reviewed', subject: 'torre' });
    expect(payload.captureAt).toBe(new Date(2026, 8, 22, 9, 0, 0).toISOString());
    expect(payload.gpsLat).toBeCloseTo(towerLat(5) + 10 * DEG_PER_M_LAT, 6);

    expect(importReportWorkspace).toHaveBeenCalledTimes(1);
    const summary = importReportWorkspace.mock.calls[0][1];
    expect(summary.importSource).toBe('photo_campaign');
    expect(summary.summaryJson).toMatchObject({ filesReceived: 1, excludedCount: 1, towerSourceCounts: { exif_label: 1 } });
    expect(saveInspection).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('1 foto(s) desmarcadas'), 'info');
  });

  it('com o diario marcado em "criar vistoria nova", cria a vistoria, preenche o diario e vincula o workspace', async () => {
    await openIntake();
    const dest = document.querySelector('[data-testid="photo-intake-destinations"]');
    act(() => { dest.querySelector('#photo-intake-dest-diary').click(); });
    const diaryTarget = dest.querySelector('#photo-intake-dest-diary-target');
    expect(diaryTarget.value).toBe('__new__');
    expect([...diaryTarget.options].some((o) => o.textContent.includes('VS-OLD'))).toBe(true);

    await click('Aplicar ao diário e enviar 1 foto');
    await flush(10);

    // 1a chamada cria a vistoria minima; 2a salva o diario mesclado.
    expect(saveInspection).toHaveBeenCalledTimes(2);
    expect(saveInspection.mock.calls[0][0]).toMatchObject({ projetoId: 'BMDOPR', dataInicio: '2026-09-22', status: 'aberta' });
    const merged = saveInspection.mock.calls[1][0];
    expect(merged.id).toBe('VS-NEW');
    expect(merged.detalhesDias.map((d) => d.data)).toEqual(['2026-09-22']);
    expect(merged.detalhesDias[0].torres).toEqual(['5']);
    expect(updateReportWorkspace).toHaveBeenCalledWith('RW-1', { inspectionId: 'VS-NEW' }, expect.anything());
    expect(saveReportWorkspacePhoto).toHaveBeenCalledTimes(1);
  });

  it('workspace ja vinculado: diario vem apontando para a vistoria vinculada e nao revincula', async () => {
    await openIntake('RW-2');
    const dest = document.querySelector('[data-testid="photo-intake-destinations"]');
    expect(dest.querySelector('#photo-intake-dest-diary-target').value).toBe('VS-OLD');
    act(() => { dest.querySelector('#photo-intake-dest-diary').click(); });
    await click('Aplicar ao diário e enviar 1 foto');
    await flush(10);

    expect(saveInspection).toHaveBeenCalledTimes(1);
    const merged = saveInspection.mock.calls[0][0];
    expect(merged.id).toBe('VS-OLD');
    expect(merged.dataInicio).toBe('2026-03-30');
    expect(merged.dataFim).toBe('2026-09-22');
    expect(updateReportWorkspace).not.toHaveBeenCalled();
  });

  function pendingPayload(inspectionId) {
    const file = fakeFile('a.jpg');
    return {
      inspectionId,
      projectId: 'BMDOPR',
      files: [file],
      assignmentsByFileKey: {
        [buildFileKey(file)]: { towerId: '5', towerSource: 'exif_label', captureAt: '2026-09-22T12:00:00.000Z', gpsLat: towerLat(5), gpsLon: -44, include: true, subject: 'acesso', caption: 'Acesso a torre 5' },
      },
      summary: { photos: 1, days: 1, towers: 1, dateRange: { start: '2026-09-22', end: '2026-09-22' } },
    };
  }

  it('handoff do wizard: com workspace ja vinculado a vistoria, envia direto para ele', async () => {
    const onPhotoImportConsumed = vi.fn();
    await act(async () => {
      root.render(<ReportsView userEmail="curador@x" showToast={showToast} pendingPhotoImport={pendingPayload('VS-OLD')} onPhotoImportConsumed={onPhotoImportConsumed} />);
      await Promise.resolve();
    });
    await flush(10);

    expect(onPhotoImportConsumed).toHaveBeenCalledTimes(1);
    expect(saveReportWorkspacePhoto).toHaveBeenCalledTimes(1);
    expect(saveReportWorkspacePhoto.mock.calls[0][0]).toBe('RW-2');
    expect(saveReportWorkspacePhoto.mock.calls[0][2]).toMatchObject({ towerId: '5', towerSource: 'exif_label', captureAt: '2026-09-22T12:00:00.000Z', importSource: 'photo_campaign', subject: 'acesso', caption: 'Acesso a torre 5' });
    expect(updateReportWorkspace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="rw-pending-campaign"]')).toBeNull();
  });

  it('handoff do wizard sem workspace vinculado: mostra o aviso, pre-preenche o rascunho e envia ao escolher o alvo, vinculando a vistoria', async () => {
    await act(async () => {
      root.render(<ReportsView userEmail="curador@x" showToast={showToast} pendingPhotoImport={pendingPayload('VS-NEW2')} onPhotoImportConsumed={vi.fn()} />);
      await Promise.resolve();
    });
    await flush(4);

    const banner = container.querySelector('[data-testid="rw-pending-campaign"]');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('1 foto(s) da vistoria VS-NEW2 aguardando envio');
    // Nada e enviado sozinho: o usuario escolhe o alvo e confirma.
    expect(saveReportWorkspacePhoto).not.toHaveBeenCalled();

    changeSelect(container.querySelector('#rw-import-target'), 'RW-1');
    await flush(2);
    await click('Enviar 1 foto(s)');
    await flush(10);

    expect(saveReportWorkspacePhoto).toHaveBeenCalledTimes(1);
    expect(saveReportWorkspacePhoto.mock.calls[0][0]).toBe('RW-1');
    expect(updateReportWorkspace).toHaveBeenCalledWith('RW-1', { inspectionId: 'VS-NEW2' }, expect.anything());
    expect(container.querySelector('[data-testid="rw-pending-campaign"]')).toBeNull();
  });
});
