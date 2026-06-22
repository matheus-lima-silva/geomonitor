import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../services/monthlyReportService', () => {
  class VersionConflictError extends Error {
    constructor(currentVersion) {
      super('conflict');
      this.name = 'VersionConflictError';
      this.code = 'VERSION_CONFLICT';
      this.currentVersion = currentVersion;
    }
  }
  return {
    VersionConflictError,
    fetchByPeriod: vi.fn(),
    saveReport: vi.fn(),
    generateDocx: vi.fn(),
    getJobStatus: vi.fn(),
    fetchSettings: vi.fn(),
    saveSettings: vi.fn(),
  };
});

import { fetchByPeriod, saveReport, VersionConflictError } from '../../services/monthlyReportService';
import { useMonthlyReport, AUTOSAVE_DELAY_MS } from '../useMonthlyReport';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SETTINGS = {
  team: [{ id: 'm1', name: 'Matheus Lima' }, { id: 'm2', name: 'Victor Britto' }],
  contrato: { numero: '30001490', objeto: 'APOIO', contratante: 'AXIA', contratada: 'CONCREMAT' },
};

function emptyReport(overrides = {}) {
  return {
    id: 'MR-1',
    refYear: 2026,
    refMonth: 4,
    authorName: '',
    status: 'draft',
    version: 1,
    intro: '',
    conclusao: '',
    quadroStyle: 'marcador',
    holidays: [],
    engineers: [],
    ...overrides,
  };
}

function Probe({ api, refYear = 2026, refMonth = 4, settings = SETTINGS }) {
  const hook = useMonthlyReport({ refYear, refMonth, settings });
  api.current = hook;
  return null;
}

describe('useMonthlyReport', () => {
  let container;
  let root;
  let api;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    api = { current: null };
    saveReport.mockImplementation(async (id, data) => ({ ...data, id, version: (data.version || 1) + 1 }));
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  async function renderProbe(props = {}) {
    await act(async () => {
      root.render(<Probe api={api} {...props} />);
    });
  }

  it('semeia mes novo com equipe das settings e textos-modelo, e persiste o seed', async () => {
    fetchByPeriod.mockResolvedValueOnce(emptyReport());
    await renderProbe();

    const { report } = api.current;
    expect(report.engineers.map((e) => e.name)).toEqual(['Matheus Lima', 'Victor Britto']);
    expect(report.engineers[0].id).toMatch(/^MRE-/);
    expect(report.intro).toContain('Matheus Lima e Victor Britto');
    expect(report.intro).toContain('30001490');
    expect(report.conclusao).toContain('campanhas de vistoria');

    // O seed dispara autosave apos o debounce.
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });
    expect(saveReport).toHaveBeenCalledTimes(1);
    expect(saveReport.mock.calls[0][1].engineers).toHaveLength(2);
  });

  it('nao semeia quando o relatorio ja tem engenheiros', async () => {
    fetchByPeriod.mockResolvedValueOnce(emptyReport({
      intro: 'Texto existente',
      engineers: [{ id: 'MRE-x', name: 'Ana', sortOrder: 0, activities: [], projects: [] }],
    }));
    await renderProbe();

    expect(api.current.report.engineers).toHaveLength(1);
    expect(api.current.report.intro).toBe('Texto existente');
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });
    expect(saveReport).not.toHaveBeenCalled();
  });

  it('updateReport agenda autosave e avanca a version da resposta', async () => {
    fetchByPeriod.mockResolvedValueOnce(emptyReport({
      engineers: [{ id: 'MRE-x', name: 'Ana', sortOrder: 0, activities: [], projects: [] }],
    }));
    await renderProbe();

    act(() => {
      api.current.updateReport((r) => ({ ...r, intro: 'Nova introducao' }));
    });
    expect(api.current.saveStatus).toBe('idle');

    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });
    expect(saveReport).toHaveBeenCalledTimes(1);
    expect(saveReport.mock.calls[0][1].intro).toBe('Nova introducao');
    expect(api.current.report.version).toBe(2);
    expect(api.current.saveStatus).toBe('saved');

    // O flash "Salvo" volta para idle.
    await act(async () => { vi.advanceTimersByTime(1400); });
    expect(api.current.saveStatus).toBe('idle');
  });

  it('mutacoes consecutivas dentro do debounce geram um unico PUT', async () => {
    fetchByPeriod.mockResolvedValueOnce(emptyReport({
      engineers: [{ id: 'MRE-x', name: 'Ana', sortOrder: 0, activities: [], projects: [] }],
    }));
    await renderProbe();

    act(() => { api.current.updateReport((r) => ({ ...r, intro: 'a' })); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS / 2); });
    act(() => { api.current.updateReport((r) => ({ ...r, intro: 'ab' })); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });

    expect(saveReport).toHaveBeenCalledTimes(1);
    expect(saveReport.mock.calls[0][1].intro).toBe('ab');
  });

  it('409 entra em modo conflito e bloqueia novas mutacoes', async () => {
    fetchByPeriod.mockResolvedValueOnce(emptyReport({
      engineers: [{ id: 'MRE-x', name: 'Ana', sortOrder: 0, activities: [], projects: [] }],
    }));
    saveReport.mockRejectedValueOnce(new VersionConflictError(7));
    await renderProbe();

    act(() => { api.current.updateReport((r) => ({ ...r, intro: 'muda' })); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });

    expect(api.current.conflict).toBe(true);
    expect(api.current.saveStatus).toBe('error');

    act(() => { api.current.updateReport((r) => ({ ...r, intro: 'ignorada' })); });
    expect(api.current.report.intro).toBe('muda');

    // reload limpa o conflito com o estado do servidor.
    fetchByPeriod.mockResolvedValueOnce(emptyReport({
      version: 7,
      intro: 'Do servidor',
      engineers: [{ id: 'MRE-x', name: 'Ana', sortOrder: 0, activities: [], projects: [] }],
    }));
    await act(async () => { await api.current.reload(); });
    expect(api.current.conflict).toBe(false);
    expect(api.current.report.intro).toBe('Do servidor');
  });

  it('flush salva imediatamente sem esperar o debounce', async () => {
    fetchByPeriod.mockResolvedValueOnce(emptyReport({
      engineers: [{ id: 'MRE-x', name: 'Ana', sortOrder: 0, activities: [], projects: [] }],
    }));
    await renderProbe();

    act(() => { api.current.updateReport((r) => ({ ...r, conclusao: 'Fim' })); });
    await act(async () => { await api.current.flush(); });
    expect(saveReport).toHaveBeenCalledTimes(1);
    expect(saveReport.mock.calls[0][1].conclusao).toBe('Fim');
  });
});
