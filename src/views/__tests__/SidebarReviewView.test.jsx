import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SidebarReviewView from '../SidebarReviewView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SidebarReviewView', () => {
  let container;
  let root;
  let originalPath;

  const renderView = (search = '') => {
    const query = search ? `?${search}` : '';
    window.history.replaceState({}, '', `/${query}`);
    act(() => {
      root.render(<SidebarReviewView />);
    });
  };

  beforeEach(() => {
    originalPath = `${window.location.pathname}${window.location.search}` || '/';
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });

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
    window.history.replaceState({}, '', originalPath);
  });

  it('renderiza pagina de review e shell sem depender de auth', () => {
    renderView('uiReview=sidebar');

    expect(container.textContent).toContain('GeoMonitor UI Review');
    expect(container.querySelector('.sidebar-review-shell')).toBeTruthy();
    expect(container.querySelector('[data-sidebar-review-variant="a"]')).toBeTruthy();
  });

  it('aplica variant e estado collapsed via querystring', () => {
    renderView('uiReview=sidebar&reviewVariant=b&reviewState=collapsed');

    expect(container.querySelector('[data-sidebar-review-variant="b"]')).toBeTruthy();
    const hasExpandLabel = [...container.querySelectorAll('button')]
      .some((button) => button.getAttribute('aria-label') === 'Expandir barra lateral');
    expect(hasExpandLabel).toBe(true);
  });

  it('faz fallback para variant/state padrao quando query invalida', () => {
    renderView('uiReview=sidebar&reviewVariant=legacy&reviewState=unknown');

    expect(container.querySelector('[data-sidebar-review-variant="a"]')).toBeTruthy();
    const hasCollapseLabel = [...container.querySelectorAll('button')]
      .some((button) => button.getAttribute('aria-label') === 'Recolher barra lateral');
    expect(hasCollapseLabel).toBe(true);
  });
});
