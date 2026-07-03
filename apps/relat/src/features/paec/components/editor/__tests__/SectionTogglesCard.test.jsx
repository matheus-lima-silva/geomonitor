import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import SectionTogglesCard from '../SectionTogglesCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SECTIONS = [
  { sectionKey: 'recurso_a', defaultTitle: '12.1.1. Recurso A', renumberGroup: '12.1' },
  { sectionKey: 'recurso_b', defaultTitle: '12.1.2. Recurso B', renumberGroup: '12.1' },
];

describe('SectionTogglesCard', () => {
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

  it('mostra o titulo de cada secao e o checkbox marcado por padrao (sem flag = ligada)', async () => {
    await act(async () => {
      root.render(<SectionTogglesCard sections={SECTIONS} sectionFlags={{}} onChange={vi.fn()} />);
    });
    expect(container.textContent).toContain('12.1.1. Recurso A');
    expect(container.textContent).toContain('12.1.2. Recurso B');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(true);
  });

  it('secao com enabled=false comeca desmarcada e sem input de titulo', async () => {
    await act(async () => {
      root.render(
        <SectionTogglesCard
          sections={SECTIONS}
          sectionFlags={{ recurso_b: { enabled: false } }}
          onChange={vi.fn()}
        />,
      );
    });
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes[1].checked).toBe(false);
    // so 1 secao ligada -> so 1 Input de titulo customizado visivel
    expect(container.querySelectorAll('input[aria-label^="Título customizado"]')).toHaveLength(1);
  });

  it('clicar no checkbox chama onChange desligando a secao', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<SectionTogglesCard sections={SECTIONS} sectionFlags={{}} onChange={onChange} />);
    });
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    await act(async () => { checkboxes[1].click(); });
    expect(onChange).toHaveBeenCalledWith('recurso_b', { enabled: false });
  });

  it('clicar no checkbox de uma secao ja desligada liga de novo', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <SectionTogglesCard
          sections={SECTIONS}
          sectionFlags={{ recurso_b: { enabled: false } }}
          onChange={onChange}
        />,
      );
    });
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    await act(async () => { checkboxes[1].click(); });
    expect(onChange).toHaveBeenCalledWith('recurso_b', { enabled: true });
  });

  it('digitar no titulo customizado chama onChange preservando o enabled atual', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<SectionTogglesCard sections={SECTIONS} sectionFlags={{}} onChange={onChange} />);
    });
    const titleInput = container.querySelector('input[aria-label^="Título customizado para 12.1.1"]');
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(titleInput), 'value').set;
    setter.call(titleInput, 'Recurso A Renomeado');
    await act(async () => { titleInput.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith('recurso_a', { titleOverride: 'Recurso A Renomeado' });
  });
});
