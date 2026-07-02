import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import SectionNav from '../SectionNav';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function click(el) {
  return act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('SectionNav', () => {
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

  const sections = [
    { id: 'sec-0', title: 'Identificação' },
    { id: 'sec-1', title: 'Representante' },
  ];

  it('destaca a secao ativa e mostra contador de pendencias por secao', async () => {
    const pendencyCounts = new Map([['Identificação', 2]]);
    await act(async () => {
      root.render(
        <SectionNav
          sections={sections}
          activeId="sec-1"
          onSectionClick={vi.fn()}
          pendencyCounts={pendencyCounts}
          stats={{ fieldsFilled: 60, fieldsTotal: 80 }}
        />,
      );
    });
    expect(container.textContent).toContain('60 / 80 completos');
    expect(container.textContent).toContain('(2)');
    const activeButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.startsWith('Representante'));
    expect(activeButton.className).toContain('bg-brand-50');
  });

  it('chama onSectionClick com o id da secao clicada', async () => {
    const onSectionClick = vi.fn();
    await act(async () => {
      root.render(
        <SectionNav sections={sections} activeId="sec-0" onSectionClick={onSectionClick} pendencyCounts={new Map()} stats={{}} />,
      );
    });
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.startsWith('Representante'));
    await click(button);
    expect(onSectionClick).toHaveBeenCalledWith('sec-1');
  });
});
