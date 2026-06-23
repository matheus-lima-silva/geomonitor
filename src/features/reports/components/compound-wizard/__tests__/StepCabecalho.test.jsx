import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StepCabecalho from '../StepCabecalho';
import { DEFAULT_DRAFT, REPORT_STYLES, normalizeReportStyle } from '../wizardConstants';

describe('wizardConstants — presets de estilo', () => {
  it('DEFAULT_DRAFT usa o preset institucional axia', () => {
    expect(DEFAULT_DRAFT.reportStyle).toBe('axia');
  });

  it('normalizeReportStyle aceita presets habilitados e cai no padrao caso contrario', () => {
    expect(normalizeReportStyle('axia-arial')).toBe('axia-arial');
    expect(normalizeReportStyle('axia-escuro')).toBe('axia'); // gated/disabled -> padrao
    expect(normalizeReportStyle('inexistente')).toBe('axia');
    expect(normalizeReportStyle(undefined)).toBe('axia');
  });
});

describe('StepCabecalho — seletor de estilo', () => {
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

  function render(props = {}) {
    const draft = { ...DEFAULT_DRAFT, ...(props.draft || {}) };
    const onChange = props.onChange || vi.fn();
    act(() => {
      root.render(<StepCabecalho draft={draft} onChange={onChange} missingRequired={[]} />);
    });
    return { draft, onChange };
  }

  it('renderiza todas as opcoes de estilo, com a gated desabilitada', () => {
    render();
    const select = container.querySelector('#wizard-report-style');
    expect(select).toBeTruthy();
    REPORT_STYLES.forEach((style) => {
      const option = container.querySelector(`option[value="${style.value}"]`);
      expect(option).toBeTruthy();
      expect(option.textContent).toContain(style.label);
    });
    expect(container.querySelector('option[value="axia-escuro"]').disabled).toBe(true);
    expect(container.querySelector('option[value="axia-arial"]').disabled).toBe(false);
  });

  it('selecionar um preset propaga reportStyle via onChange', () => {
    const { onChange } = render();
    const select = container.querySelector('#wizard-report-style');
    act(() => {
      select.value = 'axia-arial';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls.at(-1)[0];
    expect(updater({})).toEqual({ reportStyle: 'axia-arial' });
  });
});
