import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppShell from '../AppShell';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('AppShell', () => {
  let container;
  let root;

  const buildProps = (overrides = {}) => ({
    activeTab: 'dashboard',
    onChangeTab: vi.fn(),
    user: { nome: 'Teste', perfil: 'Utilizador', role: 'user' },
    onLogout: vi.fn(),
    onOpenProfile: vi.fn(),
    ...overrides,
  });

  const pointerDown = (target) => {
    const event = typeof PointerEvent === 'function'
      ? new PointerEvent('pointerdown', { bubbles: true })
      : new MouseEvent('pointerdown', { bubbles: true });
    target.dispatchEvent(event);
  };

  const renderShell = (props) => {
    act(() => {
      root.render(
        <AppShell {...props}>
          <div>Conteúdo</div>
        </AppShell>,
      );
    });
  };

  beforeEach(() => {
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
    vi.clearAllMocks();
  });

  it('renders top notice slot only when topNotice prop is provided', () => {
    const props = buildProps({ topNotice: <div data-testid="top-notice">Avisos</div> });
    renderShell(props);

    const slot = container.querySelector('#shell-topbar-notice-slot');
    expect(slot).toBeTruthy();
    expect(slot.textContent).toContain('Avisos');
  });

  it('keeps shell layout without notice slot when topNotice is null', () => {
    renderShell(buildProps());

    expect(container.querySelector('#shell-topbar-notice-slot')).toBeNull();
    expect(container.textContent).toContain('Conteúdo');
  });

  it('renders navigation and utility sections, plus admin section for admin role', () => {
    renderShell(buildProps({ user: { nome: 'Admin', perfil: 'Administrador', role: 'admin' } }));

    const sideNav = container.querySelector('.side-nav');
    expect(sideNav.textContent).toContain('Navega');
    expect(sideNav.textContent).toContain('Utilidades');
    expect(sideNav.textContent).toContain('Administra');
  });

  it('toggles mobile drawer state with topbar menu button', () => {
    window.innerWidth = 768;
    renderShell(buildProps());

    const appGrid = container.querySelector('.app-grid');
    const mobileToggle = container.querySelector('.mobile-nav-toggle');

    expect(appGrid.classList.contains('is-mobile-nav-open')).toBe(false);

    act(() => {
      mobileToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(appGrid.classList.contains('is-mobile-nav-open')).toBe(true);

    act(() => {
      mobileToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(appGrid.classList.contains('is-mobile-nav-open')).toBe(false);
  });

  it('closes mobile drawer and changes tab when a nav link is clicked', () => {
    window.innerWidth = 768;
    const props = buildProps();
    renderShell(props);

    const appGrid = container.querySelector('.app-grid');
    const mobileToggle = container.querySelector('.mobile-nav-toggle');

    act(() => {
      mobileToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(appGrid.classList.contains('is-mobile-nav-open')).toBe(true);

    const projectsTab = [...container.querySelectorAll('.side-nav-link')]
      .find((button) => button.textContent.includes('Empreendimentos'));

    expect(projectsTab).toBeTruthy();

    act(() => {
      projectsTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(props.onChangeTab).toHaveBeenCalledWith('projects');
    expect(appGrid.classList.contains('is-mobile-nav-open')).toBe(false);
  });

  it('closes mobile drawer when Escape is pressed', () => {
    window.innerWidth = 768;
    renderShell(buildProps());

    const appGrid = container.querySelector('.app-grid');
    const mobileToggle = container.querySelector('.mobile-nav-toggle');

    act(() => {
      mobileToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(appGrid.classList.contains('is-mobile-nav-open')).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(appGrid.classList.contains('is-mobile-nav-open')).toBe(false);
  });

  it('collapses sidebar when clicking outside in desktop mode', () => {
    renderShell(buildProps());

    const sideNav = container.querySelector('.side-nav');
    const shellContent = container.querySelector('.shell-content');

    expect(sideNav.classList.contains('is-collapsed')).toBe(false);

    act(() => {
      pointerDown(shellContent);
    });

    expect(sideNav.classList.contains('is-collapsed')).toBe(true);
  });

  it('does not collapse sidebar when clicking inside it', () => {
    renderShell(buildProps());

    const sideNav = container.querySelector('.side-nav');

    act(() => {
      pointerDown(sideNav);
    });

    expect(sideNav.classList.contains('is-collapsed')).toBe(false);
  });

  it('renders only fixed icon rail when collapsed', () => {
    renderShell(buildProps({ user: { nome: 'Admin', perfil: 'Administrador', role: 'admin' } }));

    const sideNav = container.querySelector('.side-nav');
    const collapseToggle = sideNav.querySelector('.side-nav-toggle');

    act(() => {
      collapseToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(sideNav.classList.contains('is-collapsed')).toBe(true);
    expect(sideNav.querySelector('.side-nav-group-utilities')).toBeNull();
    expect(sideNav.querySelector('.side-nav-link-label')).toBeNull();
    expect(sideNav.querySelector('.side-nav-icon-rail')).toBeTruthy();

    const iconOnlyLinks = [...sideNav.querySelectorAll('.side-nav-link-icon-only')];
    expect(iconOnlyLinks.length).toBeGreaterThan(0);
    expect(iconOnlyLinks.every((button) => !!button.getAttribute('title'))).toBe(true);
  });

  it('marks the active tab with aria-current="page"', () => {
    renderShell(buildProps({ activeTab: 'dashboard' }));

    const dashboardTab = [...container.querySelectorAll('.side-nav-link')]
      .find((button) => button.textContent.includes('Monitoriza'));
    const projectsTab = [...container.querySelectorAll('.side-nav-link')]
      .find((button) => button.textContent.includes('Empreendimentos'));

    expect(dashboardTab.getAttribute('aria-current')).toBe('page');
    expect(projectsTab.getAttribute('aria-current')).toBeNull();
  });
});
