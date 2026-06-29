import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RichTextMini from '../RichTextMini';

describe('RichTextMini', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  function renderWith(value, onChange = vi.fn()) {
    act(() => {
      root.render(<RichTextMini id="t1" value={value} onChange={onChange} />);
    });
    const textarea = container.querySelector('[data-testid="t1-textarea"]');
    return { textarea };
  }

  it('insere ** em volta do trecho selecionado ao clicar em negrito', () => {
    const onChange = vi.fn();
    const { textarea } = renderWith('Hello world', onChange);
    textarea.focus();
    textarea.setSelectionRange(6, 11); // 'world'
    const boldBtn = container.querySelector('[data-testid="richtextmini-bold"]');
    act(() => { boldBtn.click(); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('Hello **world**');
  });

  it('insere * em volta do trecho selecionado ao clicar em italico', () => {
    const onChange = vi.fn();
    const { textarea } = renderWith('abc def', onChange);
    textarea.focus();
    textarea.setSelectionRange(4, 7);
    const italicBtn = container.querySelector('[data-testid="richtextmini-italic"]');
    act(() => { italicBtn.click(); });
    expect(onChange.mock.calls[0][0].target.value).toBe('abc *def*');
  });

  it('insere "- " no comeco da linha corrente ao clicar em lista', () => {
    const onChange = vi.fn();
    const { textarea } = renderWith('linha1\nlinha2', onChange);
    textarea.focus();
    textarea.setSelectionRange(10, 10); // meio da "linha2"
    const listBtn = container.querySelector('[data-testid="richtextmini-list"]');
    act(() => { listBtn.click(); });
    expect(onChange.mock.calls[0][0].target.value).toBe('linha1\n- linha2');
  });

  it('mantem disabled quando prop disabled=true', () => {
    act(() => {
      root.render(<RichTextMini id="t2" value="" onChange={vi.fn()} disabled />);
    });
    const boldBtn = container.querySelector('[data-testid="richtextmini-bold"]');
    expect(boldBtn.disabled).toBe(true);
  });

  it('nao renderiza o botao de texto padrao sem a prop template', () => {
    renderWith('');
    expect(container.querySelector('[data-testid="richtextmini-template"]')).toBeNull();
  });

  it('insere o texto padrao no cursor preenchendo o campo vazio', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <RichTextMini id="t3" value="" onChange={onChange} template="Texto típico." />,
      );
    });
    const btn = container.querySelector('[data-testid="richtextmini-template"]');
    act(() => { btn.click(); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('Texto típico.');
  });

  it('insere o texto padrao no cursor sem apagar o conteudo existente', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <RichTextMini id="t4" value="AB" onChange={onChange} template="X" />,
      );
    });
    const textarea = container.querySelector('[data-testid="t4-textarea"]');
    textarea.focus();
    textarea.setSelectionRange(1, 1); // entre A e B
    const btn = container.querySelector('[data-testid="richtextmini-template"]');
    act(() => { btn.click(); });
    expect(onChange.mock.calls[0][0].target.value).toBe('AXB');
  });
});
