import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../services/paecService', () => ({
  fetchPlants: vi.fn(),
  createPlant: vi.fn(),
}));

import { fetchPlants, createPlant } from '../../services/paecService';
import { usePaecPlants } from '../usePaecPlants';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ api }) {
  const hook = usePaecPlants();
  api.current = hook;
  return null;
}

describe('usePaecPlants', () => {
  let container;
  let root;
  let api;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    api = { current: null };
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.clearAllMocks();
  });

  async function renderProbe() {
    await act(async () => {
      root.render(<Probe api={api} />);
    });
  }

  it('carrega a lista de usinas', async () => {
    fetchPlants.mockResolvedValueOnce([
      { id: 'PAEC-1', name: 'UHE Marimbondo' },
      { id: 'PAEC-2', name: 'PCH Anta' },
    ]);
    await renderProbe();
    expect(api.current.loading).toBe(false);
    expect(api.current.plants).toHaveLength(2);
  });

  it('erro de carregamento popula error e zera loading', async () => {
    fetchPlants.mockRejectedValueOnce(new Error('Sem conexão.'));
    await renderProbe();
    expect(api.current.error).toBe('Sem conexão.');
    expect(api.current.loading).toBe(false);
  });

  it('create adiciona a usina criada na lista ordenada por nome', async () => {
    fetchPlants.mockResolvedValueOnce([{ id: 'PAEC-1', name: 'UHE Marimbondo' }]);
    await renderProbe();

    createPlant.mockResolvedValueOnce({ id: 'PAEC-2', name: 'Anta' });
    await act(async () => { await api.current.create({ name: 'Anta', plantType: 'PCH' }); });

    expect(createPlant).toHaveBeenCalledWith({ name: 'Anta', plantType: 'PCH' });
    expect(api.current.plants.map((p) => p.name)).toEqual(['Anta', 'UHE Marimbondo']);
  });

  it('reload busca a lista de novo', async () => {
    fetchPlants.mockResolvedValueOnce([]);
    await renderProbe();
    fetchPlants.mockResolvedValueOnce([{ id: 'PAEC-1', name: 'UHE Marimbondo' }]);
    await act(async () => { await api.current.reload(); });
    expect(api.current.plants).toHaveLength(1);
  });
});
