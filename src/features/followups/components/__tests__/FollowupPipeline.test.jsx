globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FollowupPipeline from '../FollowupPipeline';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

describe('FollowupPipeline', () => {
  it('renderiza as 5 etapas do fluxo', () => {
    const campaign = { vistorias: [] };
    const due = { state: 'em_dia' };
    act(() => root.render(<FollowupPipeline campaign={campaign} due={due} />));

    const steps = container.querySelectorAll('li');
    expect(steps).toHaveLength(5);
    const text = container.textContent;
    ['Planejamento', 'Campo', 'Curadoria', 'Relatório', 'Emissão'].forEach((label) => {
      expect(text).toContain(label);
    });
  });

  it('marca a etapa atual como late quando a campanha esta atrasada', () => {
    const campaign = { vistorias: [] };
    const due = { state: 'atrasada' };
    act(() => root.render(<FollowupPipeline campaign={campaign} due={due} />));
    // etapa ativa vira 'late' (circulo rose) quando atrasada
    expect(container.querySelector('.bg-rose-600')).toBeTruthy();
  });

  it('marca todas as etapas como concluidas quando a campanha foi entregue', () => {
    const campaign = { delivered: true, vistorias: [] };
    const due = { state: 'entregue' };
    act(() => root.render(<FollowupPipeline campaign={campaign} due={due} />));
    // stage 'concluida' => todos os circulos done (emerald)
    expect(container.querySelectorAll('.bg-emerald-500')).toHaveLength(5);
  });
});
