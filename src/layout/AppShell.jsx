function AppShell({ activeTab, onChangeTab, user, onLogout, onOpenProfile, children }) {
  const tabs = [
    { id: 'dashboard', label: 'Monitorização' },
    { id: 'projects', label: 'Empreendimentos' },
    { id: 'inspections', label: 'Vistorias' },
    { id: 'erosions', label: 'Erosões' },
    { id: 'visit-planning', label: 'Planejamento de Visita' },
    ...(user?.role === 'admin' || user?.role === 'manager' ? [{ id: 'admin', label: 'Administração' }] : []),
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
            <button type="button" className="secondary" onClick={onOpenProfile}>Meu Perfil</button>
            <button type="button" className="secondary" onClick={onLogout}>Sair</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export default AppShell;
