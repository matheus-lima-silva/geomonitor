import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AppIcon from '../AppIcon';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Nomes de icone usados pelo portal relat (apps/relat) que nao existiam no
// ICON_MAP e renderizavam o fallback de "ponto" (<circle r="1.5">). Guarda
// contra regressao: se um alias for removido, o icone some na UI do relat.
const RELAT_ICON_NAMES = [
  'settings', 'wand-2', 'pencil', 'columns-3', 'maximize',
  // usados via config dinamica (icon: '...') na nav do modal de configuracoes
  'calendar-x', 'table',
];

describe('AppIcon — aliases usados pelo relat', () => {
  let container;
  let root;

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

  function renderIconMarkup(name) {
    act(() => {
      root.render(<AppIcon name={name} />);
    });
    const svg = container.querySelector('svg');
    return svg ? svg.innerHTML : null;
  }

  it('nome desconhecido cai no fallback de ponto', () => {
    const markup = renderIconMarkup('__nao_existe__');
    expect(markup).toContain('r="1.5"');
  });

  it.each(RELAT_ICON_NAMES)('resolve "%s" para um icone real (nao o fallback)', (name) => {
    const markup = renderIconMarkup(name);
    expect(markup).toBeTruthy();
    expect(markup).not.toContain('r="1.5"');
  });
});
