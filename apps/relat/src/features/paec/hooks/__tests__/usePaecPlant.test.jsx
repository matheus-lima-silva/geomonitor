import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../services/paecService', () => {
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
    fetchPlant: vi.fn(),
    fetchTemplate: vi.fn(),
    savePlant: vi.fn(),
  };
});

import { fetchPlant, fetchTemplate, savePlant, VersionConflictError } from '../../services/paecService';
import { usePaecPlant, AUTOSAVE_DELAY_MS } from '../usePaecPlant';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function samplePlant(overrides = {}) {
  return {
    id: 'PAEC-1',
    name: 'PCH Anta',
    projectId: null,
    plantType: 'PCH',
    installedCapacityMw: 12.5,
    templateId: 'PAECT-1',
    version: 1,
    fields: { usina: 'PCH Anta' },
    pendencies: [],
    stats: { fieldsFilled: 1, fieldsTotal: 2 },
    ...overrides,
  };
}

function Probe({ api, plantId = 'PAEC-1' }) {
  const hook = usePaecPlant(plantId);
  api.current = hook;
  return null;
}

describe('usePaecPlant', () => {
  let container;
  let root;
  let api;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    api = { current: null };
    savePlant.mockImplementation(async (id, data) => ({ ...data, id, version: (data.version || 1) + 1 }));
    fetchTemplate.mockResolvedValue({ id: 'PAECT-1', manifest: { fields: [{ key: 'cnpj_1', label: 'CNPJ' }] } });
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

  it('carrega a ficha por id e o manifest do template', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderProbe();
    expect(fetchPlant).toHaveBeenCalledWith('PAEC-1');
    expect(fetchTemplate).toHaveBeenCalledWith('PAECT-1');
    expect(api.current.plant.name).toBe('PCH Anta');
    expect(api.current.manifest.fields).toEqual([{ key: 'cnpj_1', label: 'CNPJ' }]);
    expect(api.current.loading).toBe(false);
  });

  it('updateField agenda autosave e avanca a version da resposta', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderProbe();

    act(() => { api.current.updateField('cnpj_1', '00.000.000/0000-00'); });
    expect(api.current.saveStatus).toBe('idle');

    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });
    expect(savePlant).toHaveBeenCalledTimes(1);
    expect(savePlant.mock.calls[0][1].fields).toEqual({ usina: 'PCH Anta', cnpj_1: '00.000.000/0000-00' });
    expect(api.current.plant.version).toBe(2);
    expect(api.current.saveStatus).toBe('saved');

    await act(async () => { vi.advanceTimersByTime(1400); });
    expect(api.current.saveStatus).toBe('idle');
  });

  it('mutacoes consecutivas dentro do debounce geram um unico PUT', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderProbe();

    act(() => { api.current.updateField('cnpj_1', 'a'); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS / 2); });
    act(() => { api.current.updateField('cnpj_1', 'ab'); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });

    expect(savePlant).toHaveBeenCalledTimes(1);
    expect(savePlant.mock.calls[0][1].fields.cnpj_1).toBe('ab');
  });

  it('409 entra em modo conflito e bloqueia novas mutacoes', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    savePlant.mockRejectedValueOnce(new VersionConflictError(7));
    await renderProbe();

    act(() => { api.current.updateField('cnpj_1', 'muda'); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });

    expect(api.current.conflict).toBe(true);
    expect(api.current.saveStatus).toBe('error');

    act(() => { api.current.updateField('cnpj_1', 'ignorada'); });
    expect(api.current.plant.fields.cnpj_1).toBe('muda');

    fetchPlant.mockResolvedValueOnce(samplePlant({ version: 7, fields: { usina: 'Do servidor' } }));
    await act(async () => { await api.current.reload(); });
    expect(api.current.conflict).toBe(false);
    expect(api.current.plant.fields.usina).toBe('Do servidor');
  });

  it('updateListItems agenda autosave e o PUT leva listItems no payload', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderProbe();

    act(() => {
      api.current.updateListItems('brigadistas', [{ nome: 'Fulano', telefone: '(11) 1111-1111' }]);
    });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });

    expect(savePlant).toHaveBeenCalledTimes(1);
    expect(savePlant.mock.calls[0][1].listItems).toEqual({
      brigadistas: [{ nome: 'Fulano', telefone: '(11) 1111-1111' }],
    });
  });

  it('save sem listItems na ficha manda {} no payload (nunca undefined)', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderProbe();

    act(() => { api.current.updateField('cnpj_1', 'x'); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });
    expect(savePlant.mock.calls[0][1].listItems).toEqual({});
  });

  it('updateSectionFlags agenda autosave e o PUT leva sectionFlags no payload', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderProbe();

    act(() => {
      api.current.updateSectionFlags('12_1_3_rede_de', { enabled: false });
    });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });

    expect(savePlant).toHaveBeenCalledTimes(1);
    expect(savePlant.mock.calls[0][1].sectionFlags).toEqual({
      '12_1_3_rede_de': { enabled: false },
    });
  });

  it('save sem sectionFlags na ficha manda {} no payload (nunca undefined)', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderProbe();

    act(() => { api.current.updateField('cnpj_1', 'x'); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50); });
    expect(savePlant.mock.calls[0][1].sectionFlags).toEqual({});
  });

  it('flush salva imediatamente sem esperar o debounce', async () => {
    fetchPlant.mockResolvedValueOnce(samplePlant());
    await renderProbe();

    act(() => { api.current.updateField('cnpj_1', 'Fim'); });
    await act(async () => { await api.current.flush(); });
    expect(savePlant).toHaveBeenCalledTimes(1);
    expect(savePlant.mock.calls[0][1].fields.cnpj_1).toBe('Fim');
  });

  it('erro de carregamento popula error', async () => {
    fetchPlant.mockRejectedValueOnce(new Error('Ficha não encontrada.'));
    await renderProbe();
    expect(api.current.error).toBe('Ficha não encontrada.');
    expect(api.current.plant).toBeNull();
  });
});
