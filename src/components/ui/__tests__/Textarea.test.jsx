import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Textarea from '../Textarea';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Textarea', () => {
  let container;
  let root;
  const setNativeValue = (element, value) => {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
      return;
    }
    if (valueSetter) {
      valueSetter.call(element, value);
      return;
    }
    element.value = value;
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    root = null;
  });

  it('renders label and error message', () => {
    act(() => {
      root.render(
        <Textarea
          id="notes"
          label="Observacoes"
          value="Texto inicial"
          error="Campo obrigatorio"
          onChange={() => {}}
        />,
      );
    });

    const label = container.querySelector('label[for="notes"]');
    const textarea = container.querySelector('textarea#notes');
    expect(label).toBeTruthy();
    expect(label.textContent).toContain('Observacoes');
    expect(textarea).toBeTruthy();
    expect(container.textContent).toContain('Campo obrigatorio');
  });

  it('propagates value changes through onChange', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<Textarea id="desc" onChange={onChange} />);
    });

    const textarea = container.querySelector('textarea#desc');
    expect(textarea).toBeTruthy();

    act(() => {
      setNativeValue(textarea, 'Novo texto');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalled();
  });
});
