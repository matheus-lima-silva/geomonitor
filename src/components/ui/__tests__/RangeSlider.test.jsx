import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RangeSlider from '../RangeSlider';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setRangeValue(input, value) {
  const prototype = Object.getPrototypeOf(input);
  const { set } = Object.getOwnPropertyDescriptor(prototype, 'value') || {};
  if (set) set.call(input, String(value));
  else input.value = String(value);
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('RangeSlider', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('modo dual: dois polegares e onChange com [inicio, fim]', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<RangeSlider min={0} max={100} value={[10, 60]} onChange={onChange} label="Faixa" />);
    });
    const inputs = container.querySelectorAll('input[type="range"]');
    expect(inputs).toHaveLength(2);
    setRangeValue(inputs[1], 80);
    expect(onChange).toHaveBeenCalledWith([10, 80]);
    expect(container.textContent).toContain('Faixa');
  });

  it('modo single: um polegar, valor numerico e aria-valuetext formatado', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <RangeSlider single id="faixa-px" min={0} max={200} value={45} onChange={onChange} formatLabel={(n) => `${n} px`} ariaLabel="Faixa a remover" />,
      );
    });
    const inputs = container.querySelectorAll('input[type="range"]');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].id).toBe('faixa-px');
    expect(inputs[0].getAttribute('aria-label')).toBe('Faixa a remover');
    expect(inputs[0].getAttribute('aria-valuetext')).toBe('45 px');
    expect(container.textContent).toContain('0 px');
    expect(container.textContent).toContain('200 px');
    setRangeValue(inputs[0], 90);
    expect(onChange).toHaveBeenCalledWith(90);
  });

  it('modo single limita o valor ao intervalo', () => {
    act(() => {
      root.render(<RangeSlider single min={0} max={200} value={999} onChange={() => {}} ariaLabel="x" />);
    });
    expect(container.querySelector('input[type="range"]').value).toBe('200');
  });
});
