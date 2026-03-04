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

  const clickSidebarToggle = () => {
    // Find the toggle button using its aria-label (which matches both modes) or by an icon it contains.
    const buttons = [...container.querySelectorAll('button')];
    const toggleButton = buttons.find((b) => b.getAttribute('aria-label')?.includes('barra lateral'));
    act(() => {
      toggleButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  const ensureSidebarExpanded = () => {
    const sideNav = container.querySelector('#app-side-nav');
    if (sideNav.classList.contains('w-[88px]')) { // w-[88px] is the collapsed width class
      clickSidebarToggle();
    }
    return sideNav;
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

    const slotContent = container.querySelector('[data-testid="top-notice"]');
    expect(slotContent).toBeTruthy();
    expect(slotContent.textContent).toContain('Avisos');
  });

  it('keeps shell layout without notice slot when topNotice is null', () => {
    renderShell(buildProps());

    expect(container.querySelector('#shell-topbar-notice-slot')).toBeNull();
    expect(container.textContent).toContain('Conteúdo');
  });

  it('starts with sidebar expanded in desktop viewport', () => {
    renderShell(buildProps());

    const sideNav = container.querySelector('#app-side-nav');
    expect(sideNav.classList.contains('w-[88px]')).toBe(false); // Should be expanded (w-[260px])
  });

  it('respects initialSidebarCollapsed prop for deterministic render state', () => {
    renderShell(buildProps({ initialSidebarCollapsed: true }));

    const sideNav = container.querySelector('#app-side-nav');
    expect(sideNav.classList.contains('w-[88px]')).toBe(true); // Should be collapsed
  });

  it('renders navigation and utility sections, plus admin section for admin role', () => {
    renderShell(buildProps({ user: { nome: 'Admin', perfil: 'Administrador', role: 'admin' } }));

    const sideNav = ensureSidebarExpanded();
    expect(sideNav.textContent).toContain('Navegação');
    expect(sideNav.textContent).toContain('Administração');
  });

  it('toggles mobile drawer state with topbar menu button', () => {
    act(() => {
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));
    });
    renderShell(buildProps());

    const mobileToggle = container.querySelector('#mobile-nav-toggle');
    const sideNav = container.querySelector('#app-side-nav');

    expect(mobileToggle).toBeTruthy();
    expect(sideNav.classList.contains('-translate-x-full')).toBe(true); // hidden by default on mobile

    act(() => {
      mobileToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(sideNav.classList.contains('translate-x-0')).toBe(true); // opened

    act(() => {
      mobileToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(sideNav.classList.contains('-translate-x-full')).toBe(true); // closed again
  });

  it('closes mobile drawer and changes tab when a nav link is clicked', () => {
    act(() => {
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));
    });
    const props = buildProps();
    renderShell(props);

    const mobileToggle = container.querySelector('#mobile-nav-toggle');
    const sideNav = container.querySelector('#app-side-nav');

    expect(mobileToggle).toBeTruthy();

    act(() => {
      mobileToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(sideNav.classList.contains('translate-x-0')).toBe(true);

    const projectsTab = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Empreendimentos') || button.title === 'Empreendimentos');

    expect(projectsTab).toBeTruthy();

    act(() => {
      projectsTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(props.onChangeTab).toHaveBeenCalledWith('projects');
    expect(sideNav.classList.contains('-translate-x-full')).toBe(true);
  });

  it('closes mobile drawer when Escape is pressed', () => {
    act(() => {
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));
    });
    renderShell(buildProps());

    const mobileToggle = container.querySelector('#mobile-nav-toggle');
    const sideNav = container.querySelector('#app-side-nav');

    expect(mobileToggle).toBeTruthy();

    act(() => {
      mobileToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(sideNav.classList.contains('translate-x-0')).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(sideNav.classList.contains('-translate-x-full')).toBe(true);
  });

  it('forces sidebar collapse when switching from mobile to desktop viewport', () => {
    act(() => {
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));
    });
    renderShell(buildProps());

    const sideNav = container.querySelector('#app-side-nav');
    expect(sideNav.classList.contains('-translate-x-full')).toBe(true); // Mobile behaves differently, but the component defaults to open if it was desktop.

    act(() => {
      window.innerWidth = 1280;
      window.dispatchEvent(new Event('resize'));
    });

    expect(sideNav.classList.contains('w-[88px]')).toBe(true);
  });

  it('collapses sidebar when clicking outside in desktop mode', () => {
    renderShell(buildProps());

    const sideNav = ensureSidebarExpanded();
    const shellContent = container.querySelector('main'); // Main content area

    expect(sideNav.classList.contains('w-[88px]')).toBe(false);

    act(() => {
      pointerDown(shellContent);
    });

    expect(sideNav.classList.contains('w-[88px]')).toBe(true);
  });

  it('does not collapse sidebar when clicking inside it', () => {
    renderShell(buildProps());

    const sideNav = ensureSidebarExpanded();

    act(() => {
      pointerDown(sideNav);
    });

    expect(sideNav.classList.contains('w-[88px]')).toBe(false);
  });

  it('renders only fixed icon rail when collapsed', () => {
    renderShell(buildProps({
      user: { nome: 'Admin', perfil: 'Administrador', role: 'admin' },
      initialSidebarCollapsed: true,
    }));

    const sideNav = container.querySelector('#app-side-nav');

    expect(sideNav.classList.contains('w-[88px]')).toBe(true);

    // Check that there is no search input rendered in the collapsed state
    expect(sideNav.querySelector('input[type="search"]')).toBeNull();
    // In collapsed mode we don't render text labels for navigation
    expect(sideNav.textContent).not.toContain('Administração');
  });

  it('marks the active tab with aria-current="page"', () => {
    renderShell(buildProps({ activeTab: 'dashboard' }));

    const dashboardTab = [...container.querySelectorAll('button')]
      .find((button) => (button.textContent || '').includes('Monitoriza') || (button.getAttribute('aria-label') || '').includes('Monitoriza') || button.title === 'Monitorização');
    const projectsTab = [...container.querySelectorAll('button')]
      .find((button) => (button.textContent || '').includes('Empreendimentos') || (button.getAttribute('aria-label') || '').includes('Empreendimentos') || button.title === 'Empreendimentos');

    expect(dashboardTab).toBeTruthy();
    expect(projectsTab).toBeTruthy();
    expect(dashboardTab.getAttribute('aria-current')).toBe('page');
    expect(projectsTab.getAttribute('aria-current')).toBeNull();
  });

  it('renders followups tab and routes click to followups id', () => {
    const props = buildProps();
    renderShell(props);

    const followupsTab = [...container.querySelectorAll('button')]
      .find((button) => (button.textContent || '').includes('Acompanhamentos') || (button.getAttribute('aria-label') || '').includes('Acompanhamentos') || button.title === 'Acompanhamentos');

    expect(followupsTab).toBeTruthy();

    act(() => {
      followupsTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(props.onChangeTab).toHaveBeenCalledWith('followups');
  });
});
