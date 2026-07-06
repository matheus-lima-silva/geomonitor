globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FollowupEmissionsPanel from '../FollowupEmissionsPanel';

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

const EMISSIONS = [
  { id: 'ARC-2', version: 2, compoundName: 'Dossie LT Norte', deliveredAt: '2026-03-01', deliveredBy: 'ana@ex.com', sha: 'abc123' },
  { id: 'ARC-1', version: 1, compoundName: 'Dossie LT Sul', deliveredAt: '2026-01-10' },
];

describe('FollowupEmissionsPanel', () => {
  it('mostra estado de carregamento', () => {
    act(() => root.render(<FollowupEmissionsPanel loading />));
    expect(container.textContent).toContain('Carregando emissões');
  });

  it('mostra estado de erro sem quebrar', () => {
    act(() => root.render(<FollowupEmissionsPanel error="boom" />));
    expect(container.textContent).toContain('Não foi possível carregar');
  });

  it('mostra estado vazio', () => {
    act(() => root.render(<FollowupEmissionsPanel emissions={[]} />));
    expect(container.textContent).toContain('Nenhuma entrega registrada');
  });

  it('lista as emissoes e aciona callbacks', () => {
    const onNavigate = vi.fn();
    const onToast = vi.fn();
    act(() => root.render(
      <FollowupEmissionsPanel emissions={EMISSIONS} onNavigate={onNavigate} onToast={onToast} />,
    ));

    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.textContent).toContain('Dossie LT Norte');
    expect(container.textContent).toContain('v2');

    act(() => container.querySelector('[aria-label="Abrir Relatório Final"]').click());
    expect(onNavigate).toHaveBeenCalledWith('georelat');

    const downloadBtn = container.querySelector('[aria-label^="Detalhes da emissão"]');
    act(() => downloadBtn.click());
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('módulo Relatórios'), 'info');
  });
});
