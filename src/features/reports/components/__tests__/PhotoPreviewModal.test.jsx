import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mini-mapa usa Leaflet/react-leaflet; mocka para nao depender de canvas no jsdom.
vi.mock('leaflet', () => ({ default: { divIcon: (opts) => opts } }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Polyline: () => null,
  useMap: () => null,
}));

import PhotoPreviewModal from '../PhotoPreviewModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container = null;
let root = null;

function mount(ui) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(ui);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});

function baseProps(overrides = {}) {
  return {
    photo: { id: 'RPH-2', importSource: 'loose_photos', towerId: '641', caption: 'Legenda' },
    previewUrl: 'blob:preview',
    draft: { caption: 'Legenda', towerId: '641', includeInReport: false },
    busy: '',
    index: 1,
    total: 5,
    onClose: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onChangeCaption: vi.fn(),
    onSave: vi.fn(),
    onToggleInclude: vi.fn(),
    onDownload: vi.fn(),
    onTrash: vi.fn(),
    onCreateErosion: vi.fn(),
    ...overrides,
  };
}

function findButtonByText(text) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text));
}

describe('PhotoPreviewModal — cabecalho e navegacao', () => {
  it('mostra titulo, ID e contador de posicao', () => {
    mount(<PhotoPreviewModal {...baseProps()} />);
    expect(container.textContent).toContain('Preview da foto');
    expect(container.textContent).toContain('RPH-2');
    expect(container.textContent).toContain('2 / 5');
  });

  it('as setas de navegacao (rodape) chamam onPrev/onNext', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onNext, onPrev })} />);
    act(() => container.querySelector('button[aria-label="Próxima foto"]').click());
    act(() => container.querySelector('button[aria-label="Foto anterior"]').click());
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('desabilita a seta anterior no inicio da lista', () => {
    mount(<PhotoPreviewModal {...baseProps({ index: 0, onPrev: undefined })} />);
    expect(container.querySelector('button[aria-label="Foto anterior"]').disabled).toBe(true);
    expect(container.querySelector('button[aria-label="Próxima foto"]').disabled).toBe(false);
  });

  it('setas do teclado navegam, exceto dentro do textarea da legenda', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onNext, onPrev })} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);

    const textarea = container.querySelector('textarea');
    act(() => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('PhotoPreviewModal — autosave da legenda', () => {
  it('nao renderiza botao Salvar (a legenda salva sozinha)', () => {
    mount(<PhotoPreviewModal {...baseProps()} />);
    expect(findButtonByText('Salvar')).toBeFalsy();
    expect(container.textContent).toContain('salva automaticamente');
  });

  it('com a legenda alterada (dirty) chama onSave apos o debounce', () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    // draft.caption ('novo texto') difere de photo.caption ('Legenda') => dirty.
    mount(<PhotoPreviewModal {...baseProps({ onSave, draft: { caption: 'novo texto', towerId: '641', includeInReport: false } })} />);
    expect(onSave).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(700); });
    expect(onSave).toHaveBeenCalled();
  });

  it('digitar na legenda dispara onChangeCaption', () => {
    const onChangeCaption = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onChangeCaption })} />);
    const textarea = container.querySelector('textarea');
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    act(() => {
      nativeSetter.call(textarea, 'texto editado');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChangeCaption).toHaveBeenCalledWith('texto editado');
  });
});

describe('PhotoPreviewModal — incluir no .docx', () => {
  it('com a foto fora do relatorio mostra o botao e chama onToggleInclude(true)', () => {
    const onToggleInclude = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onToggleInclude })} />);
    const btn = findButtonByText('Adicionar ao relatório');
    expect(btn).toBeTruthy();
    act(() => btn.click());
    expect(onToggleInclude).toHaveBeenCalledWith(true);
  });

  it('com a foto incluida mostra estado verde e o link remover chama onToggleInclude(false)', () => {
    const onToggleInclude = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onToggleInclude, draft: { caption: 'Legenda', towerId: '641', includeInReport: true } })} />);
    expect(container.textContent).toContain('No relatório');
    act(() => findButtonByText('remover').click());
    expect(onToggleInclude).toHaveBeenCalledWith(false);
  });

  it('a tecla E alterna a inclusao', () => {
    const onToggleInclude = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onToggleInclude })} />);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' })));
    expect(onToggleInclude).toHaveBeenCalledWith(true);
  });
});

describe('PhotoPreviewModal — lixeira e download', () => {
  it('o icone de lixeira abre a confirmacao inline e confirma com onTrash', () => {
    const onTrash = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onTrash })} />);
    act(() => container.querySelector('button[aria-label="Mover para lixeira"]').click());
    expect(container.textContent).toContain('Excluir esta foto?');
    act(() => findButtonByText('Mover p/ lixeira').click());
    expect(onTrash).toHaveBeenCalledTimes(1);
  });

  it('o icone de baixar chama onDownload', () => {
    const onDownload = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onDownload })} />);
    act(() => container.querySelector('button[aria-label="Baixar foto"]').click());
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});

describe('PhotoPreviewModal — handoff de erosao', () => {
  it('abre o modal de chamada e confirma com onCreateErosion', () => {
    const onCreateErosion = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onCreateErosion })} />);
    act(() => findButtonByText('Criar erosão nesta torre').click());
    expect(container.textContent).toContain('Criar erosão');
    act(() => findButtonByText('Abrir formulário de erosão').click());
    expect(onCreateErosion).toHaveBeenCalledTimes(1);
  });
});
