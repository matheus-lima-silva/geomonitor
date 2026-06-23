import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
});

function baseProps(overrides = {}) {
  return {
    photo: { id: 'RPH-2', importSource: 'loose_photos', towerId: '641' },
    previewUrl: 'blob:preview',
    draft: { caption: 'Legenda', towerId: '641', includeInReport: true },
    busy: '',
    index: 1,
    total: 5,
    onClose: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onChangeCaption: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
}

function findButtonByText(text) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text));
}

describe('PhotoPreviewModal — navegacao prev/next', () => {
  it('mostra o contador "Foto X de Y" quando ha multiplas fotos', () => {
    mount(<PhotoPreviewModal {...baseProps()} />);
    expect(container.textContent).toContain('Foto 2 de 5');
    expect(findButtonByText('Anterior')).toBeTruthy();
    expect(findButtonByText('Proxima')).toBeTruthy();
  });

  it('nao renderiza navegacao quando ha apenas uma foto', () => {
    mount(
      <PhotoPreviewModal
        {...baseProps({ total: 1, index: 0, onPrev: undefined, onNext: undefined })}
      />,
    );
    expect(container.textContent).not.toContain('Foto 1 de 1');
    expect(findButtonByText('Anterior')).toBeFalsy();
  });

  it('clicar em Proxima/Anterior chama os callbacks', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onNext, onPrev })} />);
    act(() => findButtonByText('Proxima').click());
    act(() => findButtonByText('Anterior').click());
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('desabilita os botoes nas pontas da lista', () => {
    mount(<PhotoPreviewModal {...baseProps({ index: 0, onPrev: undefined })} />);
    expect(findButtonByText('Anterior').disabled).toBe(true);
    expect(findButtonByText('Proxima').disabled).toBe(false);
  });

  it('clicar na imagem avanca para a proxima foto', () => {
    const onNext = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onNext })} />);
    const imgButton = container.querySelector('button[aria-label="Proxima foto"]');
    expect(imgButton).toBeTruthy();
    act(() => imgButton.click());
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('nao torna a imagem clicavel quando estah na ultima foto', () => {
    mount(<PhotoPreviewModal {...baseProps({ index: 4, onNext: undefined })} />);
    expect(container.querySelector('button[aria-label="Proxima foto"]')).toBeFalsy();
    expect(container.querySelector('img')).toBeTruthy();
  });

  it('setas do teclado navegam, exceto quando o foco estah num campo de texto', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    mount(<PhotoPreviewModal {...baseProps({ onNext, onPrev })} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);

    // Setas dentro do textarea de legenda nao devem trocar de foto.
    const textarea = container.querySelector('textarea');
    act(() => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
