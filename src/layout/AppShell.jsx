import { useEffect, useRef, useState } from 'react';
import AppIcon from '../components/AppIcon';

const DESKTOP_BREAKPOINT = 960;
const isDesktopWidth = () => window.innerWidth > DESKTOP_BREAKPOINT;
const normalizeReviewVariant = (variant) => (
  variant === 'a' || variant === 'b' || variant === 'current'
    ? variant
    : 'a'
);
const resolveInitialSidebarCollapsed = (initialSidebarCollapsed) => {
  if (typeof initialSidebarCollapsed === 'boolean') return initialSidebarCollapsed;
  return !isDesktopWidth();
};

function AppShell({
  activeTab,
  onChangeTab,
  user,
  onLogout,
  onOpenProfile,
  topNotice = null,
  searchTerm = '',
  onSearchTermChange = () => {},
  initialSidebarCollapsed,
  sidebarReviewVariant = 'a',
  children,
}) {
  const [isDesktopViewport, setIsDesktopViewport] = useState(isDesktopWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => resolveInitialSidebarCollapsed(initialSidebarCollapsed));
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const sideNavRef = useRef(null);
  const previousDesktopViewportRef = useRef(isDesktopViewport);
  const normalizedSidebarReviewVariant = normalizeReviewVariant(sidebarReviewVariant);

  const navigationTabs = [
    { id: 'dashboard', label: 'Monitorização', icon: 'dashboard-nav' },
    { id: 'projects', label: 'Empreendimentos', icon: 'projects-nav' },
    { id: 'licenses', label: 'Licenças LO', icon: 'licenses-nav' },
    { id: 'inspections', label: 'Vistorias', icon: 'inspections-nav' },
    { id: 'erosions', label: 'Erosões', icon: 'erosions-nav' },
    { id: 'visit-planning', label: 'Planejamento de Visita', icon: 'visit-nav' },
  ];

  const adminTabs = user?.role === 'admin' || user?.role === 'manager'
    ? [{ id: 'admin', label: 'Administração', icon: 'admin-nav' }]
    : [];
  const iconRailTabs = [...navigationTabs, ...adminTabs];

  const isCollapsedRailMode = sidebarCollapsed && isDesktopViewport;

  useEffect(() => {
    const onResize = () => setIsDesktopViewport(isDesktopWidth());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const wasDesktopViewport = previousDesktopViewportRef.current;
    if (!wasDesktopViewport && isDesktopViewport) {
      setSidebarCollapsed(true);
    }
    previousDesktopViewportRef.current = isDesktopViewport;
  }, [isDesktopViewport]);

  useEffect(() => {
    if (!isMobileNavOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileNavOpen]);

  useEffect(() => {
    if (!isDesktopViewport || sidebarCollapsed || isMobileNavOpen) return undefined;

    const onPointerDown = (event) => {
      const sideNavEl = sideNavRef.current;
      if (!sideNavEl) return;
      if (sideNavEl.contains(event.target)) return;
      setSidebarCollapsed(true);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isDesktopViewport, isMobileNavOpen, sidebarCollapsed]);

  const appGridClassName = [
    'app-grid',
    isCollapsedRailMode ? 'is-sidebar-collapsed' : '',
    isMobileNavOpen ? 'is-mobile-nav-open' : '',
    normalizedSidebarReviewVariant === 'a' ? 'is-sidebar-review-variant-a' : '',
    normalizedSidebarReviewVariant === 'b' ? 'is-sidebar-review-variant-b' : '',
  ].filter(Boolean).join(' ');

  const sideNavClassName = [
    'side-nav',
    isCollapsedRailMode ? 'is-collapsed' : '',
    isMobileNavOpen ? 'is-mobile-open' : '',
  ].filter(Boolean).join(' ');

  const handleTabChange = (tabId) => {
    onChangeTab(tabId);
    setIsMobileNavOpen(false);
  };

  return (
    <div className={appGridClassName} data-sidebar-review-variant={normalizedSidebarReviewVariant}>
      <button
        type="button"
        className={`side-nav-overlay ${isMobileNavOpen ? 'is-visible' : ''}`.trim()}
        onClick={() => setIsMobileNavOpen(false)}
        aria-label="Fechar menu lateral"
      />

      <aside id="app-side-nav" ref={sideNavRef} className={sideNavClassName}>
        <div className="side-nav-head">
          <button
            type="button"
            className="side-nav-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={isCollapsedRailMode ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            aria-pressed={isCollapsedRailMode ? 'true' : 'false'}
          >
            <AppIcon name={isCollapsedRailMode ? 'chevron-right' : 'chevron-left'} />
          </button>
          {!isCollapsedRailMode ? (
            <div className="side-nav-brand">
              <AppIcon name="monitor" className="side-nav-brand-icon" />
              <h2 className="side-nav-brand-text">GeoMonitor</h2>
            </div>
          ) : null}
        </div>

        <div className="side-nav-body">
          {isCollapsedRailMode ? (
            <section className="side-nav-group side-nav-group-navigation side-nav-group-icon-rail">
              <nav className="side-nav-links side-nav-icon-rail" aria-label="Navegação principal recolhida">
                {iconRailTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`side-nav-link side-nav-link-icon-only ${
                      activeTab === tab.id
                        ? 'nav-active'
                        : ''
                    }`.trim()}
                    onClick={() => handleTabChange(tab.id)}
                    title={tab.label}
                    aria-label={tab.label}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                  >
                    <span className="side-nav-link-icon">
                      <AppIcon name={tab.icon} />
                    </span>
                  </button>
                ))}
              </nav>
            </section>
          ) : (
            <>
              <section className="side-nav-group side-nav-group-navigation">
                <p className="side-nav-section">Navegação</p>
                <nav
                  className="side-nav-links"
                  aria-label="Navegação principal"
                >
                  {navigationTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`side-nav-link ${
                        activeTab === tab.id
                          ? 'nav-active'
                          : ''
                      }`.trim()}
                      onClick={() => handleTabChange(tab.id)}
                      title={isCollapsedRailMode ? tab.label : ''}
                      aria-current={activeTab === tab.id ? 'page' : undefined}
                    >
                      <span className="side-nav-link-icon">
                        <AppIcon name={tab.icon} />
                      </span>
                      <span className="side-nav-link-label">{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </section>

              {adminTabs.length > 0 ? (
                <section className="side-nav-group side-nav-group-admin">
                  <p className="side-nav-section">Administração</p>
                  <nav className="side-nav-links side-nav-admin-links" aria-label="Administração">
                    {adminTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`side-nav-link ${
                          activeTab === tab.id
                            ? 'nav-active'
                            : ''
                        }`.trim()}
                        onClick={() => handleTabChange(tab.id)}
                        title={isCollapsedRailMode ? tab.label : ''}
                        aria-current={activeTab === tab.id ? 'page' : undefined}
                      >
                        <span className="side-nav-link-icon">
                          <AppIcon name={tab.icon} />
                        </span>
                        <span className="side-nav-link-label">{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                </section>
              ) : null}

              <section className="side-nav-group side-nav-group-utilities">
                <p className="side-nav-section">Utilidades</p>

                <div className="side-nav-profile-wrap">
                  <button type="button" className="side-nav-profile-btn" onClick={onOpenProfile}>
                    <div className="side-nav-profile-title">
                      <AppIcon name="user" className="side-nav-profile-user-icon" />
                      Meu Perfil
                    </div>
                    <strong className="side-nav-profile-name">{user?.nome || user?.email || 'Sem identificação'}</strong>
                    <small className="side-nav-profile-role">{user?.cargo || user?.perfil || user?.role || ''}</small>
                  </button>
                </div>

                <div className="side-nav-search">
                  <label htmlFor="side-nav-search-input" className="side-nav-search-label">Procurar</label>
                  <div className="side-nav-search-box">
                    <AppIcon name="search" className="side-nav-search-icon" />
                    <input
                      id="side-nav-search-input"
                      type="search"
                      className="side-nav-search-input"
                      placeholder="ID, nome, email..."
                      value={searchTerm}
                      onChange={(event) => onSearchTermChange(event.target.value)}
                    />
                  </div>
                </div>

                <button type="button" className="side-nav-head-logout" onClick={onLogout} title={isCollapsedRailMode ? 'Sair' : ''}>
                  <AppIcon name="logout" />
                  Sair
                </button>
              </section>
            </>
          )}
        </div>
      </aside>

      <main className="shell-content">
        {(topNotice || !isDesktopViewport) ? (
          <div className="shell-main-head">
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              aria-label={isMobileNavOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
              aria-controls="app-side-nav"
              aria-expanded={isMobileNavOpen ? 'true' : 'false'}
            >
              <AppIcon name={isMobileNavOpen ? 'close' : 'menu'} />
            </button>
            {topNotice ? (
              <div id="shell-topbar-notice-slot" className="shell-topbar-notice-slot">{topNotice}</div>
            ) : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

export default AppShell;
