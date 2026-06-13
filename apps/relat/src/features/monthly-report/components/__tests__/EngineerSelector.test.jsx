import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import EngineerSelector from '../editor/EngineerSelector';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('EngineerSelector', () => {
  let container;
  let root;

  const engineers = [
    { id: 'e1', name: 'Ana Souza' },
    { id: 'e2', name: 'Bia Lima' },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  function render(props = {}) {
    act(() => {
      root.render(
        <EngineerSelector
          engineers={engineers}
          activeIndex={0}
          onSelect={() => {}}
          onAdd={() => {}}
          onRename={() => {}}
          onRemove={() => {}}
          {...props}
        />,
      );
    });
  }

  function click(el) {
    act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  }

  it('mostra avatar de iniciais por engenheiro e o check apenas na linha ativa', () => {
    render();
    click(document.querySelector('[data-testid="eng-selector"]'));
    const pop = document.querySelector('[data-testid="eng-popover"]');
    expect(pop).toBeTruthy();

    const rows = pop.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('AS'); // Ana Souza
    expect(rows[1].textContent).toContain('BL'); // Bia Lima

    // a linha ativa (idx 0) tem o icone "check" a mais que a inativa
    const svgActive = rows[0].querySelectorAll('svg').length;
    const svgInactive = rows[1].querySelectorAll('svg').length;
    expect(svgActive).toBe(svgInactive + 1);
  });
});
