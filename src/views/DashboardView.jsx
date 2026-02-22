import { Suspense, lazy, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AppShell from '../layout/AppShell';
import MandatoryProfileUpdateView from '../features/auth/components/MandatoryProfileUpdateView';
import ProfileModal from '../features/auth/components/ProfileModal';
import { subscribeProjects } from '../services/projectService';
import { subscribeInspections } from '../services/inspectionService';
import { subscribeErosions } from '../services/erosionService';
import { subscribeUsers } from '../services/userService';
import { subscribeRulesConfig } from '../services/rulesService';
import { normalizeRulesConfig, RULES_DATABASE } from '../features/shared/rulesConfig';
import { normalizeUserStatus } from '../features/shared/statusUtils';
import { buildProjectReportOccurrences } from '../features/projects/utils/reportSchedule';

const ProjectsView = lazy(() => import('../features/projects/components/ProjectsView'));
const InspectionsView = lazy(() => import('../features/inspections/components/InspectionsView'));
const ErosionsView = lazy(() => import('../features/erosions/components/ErosionsView'));
const VisitPlanningView = lazy(() => import('../features/inspections/components/VisitPlanningView'));
const AdminView = lazy(() => import('../features/admin/components/AdminView'));

function Placeholder({ title, text }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">{text}</p>
    </section>
  );
}

function DashboardAlerts({ projects }) {
  const currentYear = new Date().getFullYear();
  const now = new Date();
  const occurrences = projects
    .flatMap((project) => buildProjectReportOccurrences(project, currentYear, currentYear + 1))
    .sort((a, b) => a.sortDate - b.sortDate);

  const nextByProject = new Map();
  occurrences.forEach((occ) => {
    if (!nextByProject.has(occ.projectId) && occ.sortDate >= now.getTime()) {
      nextByProject.set(occ.projectId, occ);
    }
  });

  const alerts = [...nextByProject.values()]
    .map((item) => {
      const target = new Date(item.year, item.month - 1, 1);
      const days = Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return { ...item, days };
    })
    .filter((item) => item.days >= 0 && item.days <= 45)
    .sort((a, b) => a.days - b.days);

  return (
    <section className="panel">
      <h2>Monitorização</h2>
      <p className="muted">Empreendimentos com entrega de relatório em até 45 dias.</p>
      {alerts.length === 0 && <p className="muted">Nenhum empreendimento nesta janela.</p>}
      {alerts.length > 0 && (
        <div className="project-cards">
          {alerts.map((alert) => (
            <article key={`${alert.projectId}-${alert.monthKey}`} className="project-card">
              <h3>{alert.projectName}</h3>
              <div className="muted">
                <div><strong>Código:</strong> {alert.projectId}</div>
                <div><strong>Entrega:</strong> {String(alert.month).padStart(2, '0')}/{alert.year}</div>
                <div><strong>Faltam:</strong> {alert.days} dia(s)</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardView() {
  const { user, logout } = useAuth();
  const { show } = useToast();
  const [projects, setProjects] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [erosions, setErosions] = useState([]);
  const [users, setUsers] = useState([]);
  const [rulesConfig, setRulesConfig] = useState(() => normalizeRulesConfig(RULES_DATABASE));
  const [activeTab, setActiveTab] = useState('projects');
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectionProjectFilterId, setInspectionProjectFilterId] = useState(null);
  const [inspectionPlanningDraft, setInspectionPlanningDraft] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    const unsubProjects = subscribeProjects(
      (data) => setProjects(data),
      () => show('Erro ao carregar empreendimentos.', 'error'),
    );

    const unsubInspections = subscribeInspections(
      (data) => setInspections(data),
      () => show('Erro ao carregar vistorias.', 'error'),
    );

    const unsubErosions = subscribeErosions(
      (data) => setErosions(data),
      () => show('Erro ao carregar erosões.', 'error'),
    );

    return () => {
      unsubProjects?.();
      unsubInspections?.();
      unsubErosions?.();
    };
  }, [show]);

  useEffect(() => {
    const isAdminMenu = user?.role === 'admin' || user?.role === 'manager';
    if (!isAdminMenu) {
      setUsers([]);
      return () => {};
    }

    const unsubUsers = subscribeUsers(
      (data) => setUsers(data),
      () => show('Erro ao carregar utilizadores.', 'error'),
    );

    const unsubRules = subscribeRulesConfig(
      (data) => setRulesConfig(normalizeRulesConfig(data || RULES_DATABASE)),
      () => show('Erro ao carregar regras.', 'error'),
    );

    return () => {
      unsubUsers?.();
      unsubRules?.();
    };
  }, [show, user?.role]);

  function openProjectInspections(projectId) {
    setInspectionProjectFilterId(projectId || null);
    setActiveTab('inspections');
  }

  const accessStatus = normalizeUserStatus(user?.status);
  if (accessStatus !== 'Ativo') {
    return (
      <section className="panel auth">
        <h2>Acesso restrito</h2>
        <p className="muted">
          {accessStatus === 'Pendente'
            ? 'A sua conta está aguardando aprovação de um administrador.'
            : 'A sua conta está inativa. Entre em contato com um administrador.'}
        </p>
        <button type="button" onClick={logout}>Sair</button>
      </section>
    );
  }

  const needsFirstProfileUpdate = user?.perfilAtualizadoPrimeiroLogin !== true
    && (!user?.nome || !user?.cargo || !user?.departamento || !user?.telefone);

  if (needsFirstProfileUpdate) {
    return <MandatoryProfileUpdateView />;
  }

  function renderTab() {
    if (activeTab === 'projects') {
      return (
        <ProjectsView
          projects={projects}
          inspections={inspections}
          userEmail={user?.email}
          showToast={show}
          reloadProjects={async () => null}
          onOpenProjectInspections={openProjectInspections}
          searchTerm={searchTerm}
        />
      );
    }

    if (activeTab === 'inspections') {
      return (
        <InspectionsView
          inspections={inspections}
          projects={projects}
          erosions={erosions}
          searchTerm={searchTerm}
          forcedProjectFilterId={inspectionProjectFilterId}
          onClearForcedProjectFilter={() => setInspectionProjectFilterId(null)}
          planningDraft={inspectionPlanningDraft}
          onPlanningDraftConsumed={() => setInspectionPlanningDraft(null)}
        />
      );
    }

    if (activeTab === 'erosions') {
      return (
        <ErosionsView
          erosions={erosions}
          projects={projects}
          inspections={inspections}
          rulesConfig={rulesConfig}
          searchTerm={searchTerm}
        />
      );
    }

    if (activeTab === 'visit-planning') {
      return (
        <VisitPlanningView
          projects={projects}
          inspections={inspections}
          erosions={erosions}
          onApplySelection={(payload) => {
            setInspectionPlanningDraft(payload);
            setInspectionProjectFilterId(payload.projectId || null);
            setActiveTab('inspections');
          }}
        />
      );
    }

    if (activeTab === 'admin') {
      return <AdminView users={users} rulesConfig={rulesConfig} searchTerm={searchTerm} />;
    }

    if (activeTab === 'dashboard') {
      return <DashboardAlerts projects={projects} />;
    }

    return null;
  }

  return (
    <>
      <AppShell
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        user={user}
        onLogout={logout}
        onOpenProfile={() => setShowProfileModal(true)}
      >
        <section className="panel search-panel">
          <input
            type="search"
            placeholder="Buscar por ID, nome ou email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </section>
        <Suspense fallback={<section className="panel">A carregar módulo...</section>}>
          {renderTab()}
        </Suspense>
      </AppShell>

      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </>
  );
}

export default DashboardView;
