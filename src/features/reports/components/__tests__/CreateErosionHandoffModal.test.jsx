import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CreateErosionHandoffModal, { resolveDefaultPointSource } from '../CreateErosionHandoffModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container = null;
let root = null;

function mount(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(ui); });
}

afterEach(() => {
  act(() => { root?.unmount(); });
  container?.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

function findButtonByText(text) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text));
}

const TOWER = [-23.879014, -46.53111];
// ~14 m ao norte da torre.
const PHOTO = [-23.879014 + 14 / 111320, -46.53111];

function baseProps(overrides = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    projectId: 'LT-FINCO',
    towerRef: '606',
    towerPoint: TOWER,
    photoPoint: PHOTO,
    photoId: 'RPH-2',
    ...overrides,
  };
}

describe('CreateErosionHandoffModal', () => {
  it('mostra o contexto read-only da foto/torre com as duas coordenadas e a distancia', () => {
    mount(<CreateErosionHandoffModal {...baseProps()} />);
    expect(container.textContent).toContain('Criar erosão');
    expect(container.textContent).toContain('LT-FINCO');
    expect(container.textContent).toContain('606');
    expect(container.textContent).toContain('RPH-2');
    expect(container.textContent).toContain('-23.879014 -46.531110');
    expect(container.textContent).toMatch(/14 m/);
  });

  it('padrao e a torre cadastrada: confirmar devolve pointSource tower', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    mount(<CreateErosionHandoffModal {...baseProps({ onConfirm, onClose })} />);
    expect(findButtonByText('Torre cadastrada').getAttribute('aria-pressed')).toBe('true');
    expect(findButtonByText('GPS da foto').getAttribute('aria-pressed')).toBe('false');
    act(() => findButtonByText('Abrir formulário de erosão').click());
    expect(onConfirm).toHaveBeenCalledWith({ pointSource: 'tower' });
    act(() => findButtonByText('Cancelar').click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('escolher GPS da foto devolve pointSource photo', () => {
    const onConfirm = vi.fn();
    mount(<CreateErosionHandoffModal {...baseProps({ onConfirm })} />);
    act(() => findButtonByText('GPS da foto').click());
    expect(findButtonByText('GPS da foto').getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).toContain('tirada em cima da erosão');
    act(() => findButtonByText('Abrir formulário de erosão').click());
    expect(onConfirm).toHaveBeenCalledWith({ pointSource: 'photo' });
  });

  it('sem GPS na foto a opcao fica desabilitada e o padrao segue na torre', () => {
    mount(<CreateErosionHandoffModal {...baseProps({ photoPoint: null })} />);
    expect(findButtonByText('GPS da foto').disabled).toBe(true);
    expect(container.textContent).toContain('Foto sem GPS');
    expect(findButtonByText('Torre cadastrada').getAttribute('aria-pressed')).toBe('true');
  });

  it('sem coordenada de torre o padrao cai para o GPS da foto', () => {
    const onConfirm = vi.fn();
    mount(<CreateErosionHandoffModal {...baseProps({ towerPoint: null, onConfirm })} />);
    expect(findButtonByText('Torre cadastrada').disabled).toBe(true);
    expect(findButtonByText('GPS da foto').getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).toContain('Sem coordenada');
    act(() => findButtonByText('Abrir formulário de erosão').click());
    expect(onConfirm).toHaveBeenCalledWith({ pointSource: 'photo' });
  });

  it('resolveDefaultPointSource prioriza a torre', () => {
    expect(resolveDefaultPointSource({ towerPoint: TOWER, photoPoint: PHOTO })).toBe('tower');
    expect(resolveDefaultPointSource({ towerPoint: null, photoPoint: PHOTO })).toBe('photo');
    expect(resolveDefaultPointSource({ towerPoint: null, photoPoint: null })).toBe('tower');
  });

  it('nao renderiza quando fechado', () => {
    mount(<CreateErosionHandoffModal {...baseProps({ open: false })} />);
    expect(container.textContent).toBe('');
  });
});
