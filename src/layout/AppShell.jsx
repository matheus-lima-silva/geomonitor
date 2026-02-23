import AppIcon from '../components/AppIcon';

function AppShell({ activeTab, onChangeTab, user, onLogout, onOpenProfile, children }) {
  const tabs = [
    { id: 'dashboard', label: 'MonitorizaÃ§Ã£o', icon: 'monitor' },
    { id: 'projects', label: 'Empreendimentos', icon: 'building' },
    { id: 'licenses', label: 'Licenças LO', icon: 'license' },
    { id: 'inspections', label: 'Vistorias', icon: 'clipboard' },
    { id: 'erosions', label: 'ErosÃµes', icon: 'alert' },
    { id: 'visit-planning', label: 'Planejamento de Visita', icon: 'route' },
    ...(user?.role === 'admin' || user?.role === 'manager' ? [{ id: 'admin', label: 'AdministraÃ§Ã£o', icon: 'shield' }] : []),
  ];

  return (
    <div className="app-grid">
      <aside className="side-nav">
        <h2>GeoMonitor</h2>
        <nav>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'nav-active' : ''}
              onClick={() => onChangeTab(tab.id)}
            >
              <AppIcon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="panel topbar">
          <div>
            <strong>{user?.nome || user?.email}</strong>
            <p className="muted">Perfil: {user?.perfil || user?.role}</p>
          </div>
          <div className="inline-row">
            <button type="button" className="secondary" onClick={onOpenProfile}>
              <AppIcon name="user" />
              Meu Perfil
            </button>
            <button type="button" className="secondary" onClick={onLogout}>
              <AppIcon name="logout" />
              Sair
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export default AppShell;
