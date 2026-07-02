import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import FieldRow from '../FieldRow';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setNativeValue(element, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
  (setter || ((v) => { element.value = v; })).call(element, value);
}

describe('FieldRow', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renderiza Input para type=text e chama onChange com a chave do campo', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<FieldRow field={{ key: 'cnpj_1', label: 'CNPJ', type: 'text' }} value="123" onChange={onChange} pending={false} />);
    });
    const input = container.querySelector('#paec-field-cnpj_1');
    expect(input.tagName).toBe('INPUT');
    expect(input.value).toBe('123');

    setNativeValue(input, '456');
    await act(async () => { input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith('cnpj_1', '456');
  });

  it('renderiza Textarea para type=multiline', async () => {
    await act(async () => {
      root.render(<FieldRow field={{ key: 'endereco', label: 'Endereço', type: 'multiline' }} value="" onChange={vi.fn()} pending={false} />);
    });
    expect(container.querySelector('#paec-field-endereco').tagName).toBe('TEXTAREA');
  });

  it('mostra o pontinho de pendencia quando pending=true', async () => {
    await act(async () => {
      root.render(<FieldRow field={{ key: 'cnpj_1', label: 'CNPJ', type: 'text' }} value="" onChange={vi.fn()} pending />);
    });
    expect(container.querySelector('[title="Campo pendente"]')).not.toBeNull();
  });

  it('nao mostra o pontinho quando pending=false', async () => {
    await act(async () => {
      root.render(<FieldRow field={{ key: 'cnpj_1', label: 'CNPJ', type: 'text' }} value="123" onChange={vi.fn()} pending={false} />);
    });
    expect(container.querySelector('[title="Campo pendente"]')).toBeNull();
  });
});
