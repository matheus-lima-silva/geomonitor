import { useMemo, useState } from 'react';
import AppIcon from '../components/AppIcon';
import AppShell from '../layout/AppShell';

const ALLOWED_REVIEW_VARIANTS = new Set(['current', 'a', 'b']);
const ALLOWED_REVIEW_STATES = new Set(['expanded', 'collapsed']);

function getSidebarReviewParamsFromSearch(search = '') {
  const params = new URLSearchParams(search);
  const rawVariant = params.get('reviewVariant') || 'a';
  const rawState = params.get('reviewState') || 'expanded';

  return {
    reviewVariant: ALLOWED_REVIEW_VARIANTS.has(rawVariant) ? rawVariant : 'a',
    reviewState: ALLOWED_REVIEW_STATES.has(rawState) ? rawState : 'expanded',
  };
}

function SidebarReviewView() {
  const { reviewVariant, reviewState } = useMemo(
    () => getSidebarReviewParamsFromSearch(window.location.search),
    [],
  );
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [logoutCount, setLogoutCount] = useState(0);

  const mockUser = useMemo(
    () => ({
      nome: 'Analista GeoMonitor',
      email: 'analista@geomonitor.dev',
      cargo: 'Engenheira de Campo',
      perfil: 'Administrador',
      role: 'admin',
    }),
    [],
  );

  const topNotice = (
    <div className="sidebar-review-top-notice">
      <AppIcon name="info" />
      <span>Modo de revisão da sidebar ({reviewVariant.toUpperCase()})</span>
    </div>
  );

  return (
    <div className="sidebar-review-page">
      <header className="sidebar-review-toolbar">
        <div>
          <h1>GeoMonitor UI Review</h1>
          <p>Comparação rápida das proporções e ícones da barra lateral.</p>
        </div>
        <div className="sidebar-review-meta">
          <span className="sidebar-review-chip">Variant: {reviewVariant}</span>
          <span className="sidebar-review-chip">State: {reviewState}</span>
          <span className="sidebar-review-chip">Active tab: {activeTab}</span>
          <span className="sidebar-review-chip">Logout clicks: {logoutCount}</span>
        </div>
      </header>

      <div className="sidebar-review-shell">
        <AppShell
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          user={mockUser}
          onLogout={() => setLogoutCount((prev) => prev + 1)}
          onOpenProfile={() => {}}
          topNotice={topNotice}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          initialSidebarCollapsed={reviewState === 'collapsed'}
          sidebarReviewVariant={reviewVariant}
        >
          <section className="panel sidebar-review-panel">
            <h2>Painel de referência</h2>
            <p className="muted">
              Este layout é usado apenas para revisão visual da sidebar no Figma.
            </p>
            <div className="sidebar-review-grid">
              <article className="sidebar-review-card">
                <strong>Resumo de monitoramento</strong>
                <span>7 empreendimentos ativos</span>
                <span>12 vistorias previstas</span>
                <span>3 alertas críticos</span>
              </article>
              <article className="sidebar-review-card">
                <strong>Filtros simulados</strong>
                <span>Termo buscado: {searchTerm || 'Nenhum'}</span>
                <span>Perfil: {mockUser.perfil}</span>
                <span>Responsável: {mockUser.nome}</span>
              </article>
            </div>
          </section>
        </AppShell>
      </div>
    </div>
  );
}

export { getSidebarReviewParamsFromSearch };
export default SidebarReviewView;
