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

  it('renders review shell with mock content without auth dependencies', () => {
    renderView('uiReview=sidebar');

    expect(container.textContent).toContain('GeoMonitor UI Review');
    expect(container.querySelector('.app-grid')).toBeTruthy();
    expect(container.querySelector('.side-nav')).toBeTruthy();
  });

  it('applies variant and collapsed state from query string', () => {
    renderView('uiReview=sidebar&reviewVariant=b&reviewState=collapsed');

    const appGrid = container.querySelector('.app-grid');
    const sideNav = container.querySelector('.side-nav');

    expect(appGrid.classList.contains('is-sidebar-review-variant-b')).toBe(true);
    expect(sideNav.classList.contains('is-collapsed')).toBe(true);
  });

  it('falls back to default variant/state when query is invalid', () => {
    renderView('uiReview=sidebar&reviewVariant=legacy&reviewState=unknown');

    const appGrid = container.querySelector('.app-grid');
    const sideNav = container.querySelector('.side-nav');

    expect(appGrid.classList.contains('is-sidebar-review-variant-a')).toBe(true);
    expect(sideNav.classList.contains('is-collapsed')).toBe(false);
  });
});
