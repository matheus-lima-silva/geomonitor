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
  onSearchTermChange = () => { },
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
    { id: 'followups', label: 'Acompanhamentos', icon: 'followups-nav' },
    { id: 'projects', label: 'Empreendimentos', icon: 'projects-nav' },
    { id: 'licenses', label: 'Licenças LO', icon: 'licenses-nav' },
    { id: 'inspections', label: 'Vistorias', icon: 'inspections-nav' },
    { id: 'erosions', label: 'Erosões', icon: 'erosions-nav' },
    { id: 'visit-planning', label: 'Planejamento de Visita', icon: 'visit-nav' },
    { id: 'georelat', label: 'Relatórios', icon: 'file-text' },
  ];

  const adminTabs = user?.role === 'admin' || user?.role === 'manager'
    ? [{ id: 'admin', label: 'Gerenciamento', icon: 'admin-nav' }]
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



  const isCollapsedViewport = isCollapsedRailMode || (sidebarCollapsed && isDesktopViewport);

  const handleTabChange = (tabId) => {
    onChangeTab(tabId);
    setIsMobileNavOpen(false);
  };

  return (
    <div
      className="flex h-screen w-full bg-app-bg overflow-hidden text-slate-800"
      data-sidebar-review-variant={normalizedSidebarReviewVariant}
    >
      {/* Mobile Overlay */}
      <button
        type="button"
        className={`fixed inset-0 bg-slate-850/60 z-40 transition-opacity duration-300 md:hidden ${isMobileNavOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
        onClick={() => setIsMobileNavOpen(false)}
        aria-label="Fechar menu lateral"
      />

      {/* Sidebar */}
      <aside
        id="app-side-nav"
        ref={sideNavRef}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col pt-3 pb-3 bg-gradient-to-b from-slate-900 via-slate-850 to-slate-800 text-slate-300 border-r border-slate-800 transition-all duration-300 
          md:relative md:translate-x-0
          ${isCollapsedViewport ? 'w-[88px]' : 'w-[260px]'}
          ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand / Toggle */}
        <div className={`flex items-center px-4 mb-6 ${isCollapsedViewport ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsedViewport && (
            <div className="flex items-center gap-3 fade-in pl-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 bg-opacity-20 text-brand-500">
                <AppIcon name="monitor" size={20} strokeWidth={2.5} />
              </div>
              <h2 className="text-white font-bold tracking-wide text-lg">GeoMonitor</h2>
            </div>
          )}

          <button
            type="button"
            className="flex items-center justify-center min-w-[32px] w-8 h-8 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={isCollapsedViewport ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            aria-pressed={isCollapsedViewport ? 'true' : 'false'}
          >
            <AppIcon name={isCollapsedViewport ? 'chevron-right' : 'chevron-left'} size={20} />
          </button>
        </div>

        {/* Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">

          {/* Main Navigation */}
          <section>
            {!isCollapsedViewport && <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Navegação</p>}
            <nav className="space-y-1" aria-label="Navegação principal">
              {navigationTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`w-full flex items-center rounded-lg transition-all duration-200 group relative
                      ${isCollapsedViewport ? 'justify-center py-3' : 'px-3 py-2.5 gap-3'}
                      ${isActive
                        ? 'bg-gradient-to-r from-brand-700 to-brand-600 text-white font-medium shadow-md shadow-brand-900/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }
                    `}
                    onClick={() => handleTabChange(tab.id)}
                    title={isCollapsedViewport ? tab.label : ''}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isActive && !isCollapsedViewport && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-white rounded-r-md opacity-80" />
                    )}

                    <span className={`flex items-center justify-center shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                      <AppIcon name={tab.icon} size={isCollapsedViewport ? 22 : 18} />
                    </span>
                    {!isCollapsedViewport && <span className="truncate">{tab.label}</span>}
                  </button>
                )
              })}
            </nav>
          </section>

          {/* Admin Navigation */}
          {adminTabs.length > 0 && (
            <section>
              {!isCollapsedViewport && <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administração</p>}
              <nav className="space-y-1" aria-label="Administração">
                {adminTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`w-full flex items-center rounded-lg transition-all duration-200 group relative
                        ${isCollapsedViewport ? 'justify-center py-3' : 'px-3 py-2.5 gap-3'}
                        ${isActive
                          ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white font-medium shadow-md shadow-slate-900/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                        }
                      `}
                      onClick={() => handleTabChange(tab.id)}
                      title={isCollapsedViewport ? tab.label : ''}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {isActive && !isCollapsedViewport && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-white rounded-r-md opacity-80" />
                      )}

                      <span className={`flex items-center justify-center shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-400'}`}>
                        <AppIcon name={tab.icon} size={isCollapsedViewport ? 22 : 18} />
                      </span>
                      {!isCollapsedViewport && <span className="truncate">{tab.label}</span>}
                    </button>
                  )
                })}
              </nav>
            </section>
          )}

        </div>

        {/* Utilities Footer */}
        <div className="mt-auto px-3 pt-4 border-t border-slate-800 space-y-3">

          {!isCollapsedViewport ? (
            <div className="relative">
              <AppIcon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                placeholder="Procurar..."
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
              />
            </div>
          ) : (
            <button
              type="button"
              title="Procurar"
              className="w-full flex items-center justify-center py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              onClick={() => setSidebarCollapsed(false)}
            >
              <AppIcon name="search" size={22} />
            </button>
          )}

          <hr className="border-slate-800" />

          <button
            type="button"
            className={`w-full flex items-center text-left rounded-lg transition-colors p-2 hover:bg-slate-800 
              ${isCollapsedViewport ? 'justify-center' : 'gap-3'}`}
            onClick={onOpenProfile}
            title={isCollapsedViewport ? 'Meu Perfil' : ''}
          >
            <div className="flex bg-slate-700 text-slate-300 w-9 h-9 rounded-full items-center justify-center shrink-0 border border-slate-600 flex-none shrink-0 overflow-hidden">
              {user?.nome ? user.nome.charAt(0).toUpperCase() : <AppIcon name="user" size={18} />}
            </div>
            {!isCollapsedViewport && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{user?.nome || user?.email || 'Sem identificação'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.cargo || user?.perfil || user?.role || ''}</p>
              </div>
            )}
          </button>

          <button
            type="button"
            className={`w-full flex items-center rounded-lg text-slate-400 hover:text-rose-400 transition-colors
              ${isCollapsedViewport ? 'justify-center py-3' : 'px-3 py-2.5 gap-3 hover:bg-slate-800/80'}`}
            onClick={onLogout}
            title={isCollapsedViewport ? 'Sair' : ''}
          >
            <AppIcon name="logout" size={isCollapsedViewport ? 22 : 18} className="shrink-0" />
            {!isCollapsedViewport && <span>Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-app-bg">
        {/* Mobile Header */}
        {(topNotice || !isDesktopViewport) && (
          <header className={`flex items-center bg-white border-b border-slate-200 px-4 py-3 shrink-0 justify-between ${isDesktopViewport ? 'hidden' : 'flex'}`}>
            <div className="flex items-center gap-3">
              <button
                id="mobile-nav-toggle"
                type="button"
                className="p-1.5 -ml-1.5 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => setIsMobileNavOpen((prev) => !prev)}
                aria-label={isMobileNavOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
                aria-controls="app-side-nav"
                aria-expanded={isMobileNavOpen ? 'true' : 'false'}
              >
                <AppIcon name={isMobileNavOpen ? 'close' : 'menu'} size={24} />
              </button>
              <h1 className="font-semibold text-slate-800 text-lg">GeoMonitor</h1>
            </div>
            {topNotice ? (
              <div className="flex items-center pl-2">
                {topNotice}
              </div>
            ) : null}
          </header>
        )}

        {/* Top Notice (desktop compact icon area) */}
        {topNotice && isDesktopViewport && (
          <div id="shell-topbar-notice-slot" className="px-4 pt-3 pb-1 shrink-0 flex items-center justify-end">
            {topNotice}
          </div>
        )}

        {/* Router Outlet / Content Injection */}
        <div className="flex-1 min-h-0 overflow-auto relative z-0">
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppShell;
