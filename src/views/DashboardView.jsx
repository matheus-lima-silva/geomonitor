import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import AppIcon from '../components/AppIcon';
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
import { subscribeOperatingLicenses } from '../services/licenseService';
import { normalizeRulesConfig, RULES_DATABASE } from '../features/shared/rulesConfig';
import { normalizeUserStatus } from '../features/shared/statusUtils';
import TopPlanningAlert from '../features/monitoring/components/TopPlanningAlert';
import {
  IMPACT_LEVELS,
  buildMonitoringViewModel,
  formatMonitoringMonthLabel,
  formatTowerLabel,
  getErosionImpact,
} from '../features/monitoring/utils/monitoringViewModel';

const ProjectsView = lazy(() => import('../features/projects/components/ProjectsView'));
const LicensesView = lazy(() => import('../features/licenses/components/LicensesView'));
const InspectionsView = lazy(() => import('../features/inspections/components/InspectionsView'));
const ErosionsView = lazy(() => import('../features/erosions/components/ErosionsView'));
const VisitPlanningView = lazy(() => import('../features/inspections/components/VisitPlanningView'));
const AdminView = lazy(() => import('../features/admin/components/AdminView'));

function getImpactCardClassName(impact) {
  if (impact === 'Muito Alto') return 'monitor-impact-card is-critical';
  if (impact === 'Alto') return 'monitor-impact-card is-high';
  if (impact === 'Medio' || impact === 'Médio') return 'monitor-impact-card is-medium';
  return 'monitor-impact-card is-low';
}

function getImpactChipClassName(impact) {
  if (impact === 'Muito Alto') return 'monitor-impact-chip is-critical';
  if (impact === 'Alto') return 'monitor-impact-chip is-high';
  if (impact === 'Medio' || impact === 'Médio') return 'monitor-impact-chip is-medium';
  return 'monitor-impact-chip is-low';
}

function getCriticalityBarColor(code) {
  if (code === 'C4') return '#7f1d1d';
  if (code === 'C3') return '#b45309';
  if (code === 'C2') return '#0369a1';
  return '#166534';
}

function getHeatColor(weight) {
  if (weight >= 0.85) return '#7f1d1d';
  if (weight >= 0.65) return '#b91c1c';
  if (weight >= 0.45) return '#ea580c';
  if (weight >= 0.25) return '#f59e0b';
  return '#22c55e';
}

function DashboardMonitoring({ viewModel }) {
  const {
    reportOccurrences,
    reportMonthRows,
    reportMonthDetailsByKey,
    impactCounts,
    criticalCount,
    criticalityDistributionRows,
    stabilizationRate,
    heatPoints,
    heatPointsWithoutCoordinates,
    recentErosions,
    projectsById,
    projectCount,
    inspectionCount,
    erosionCount,
  } = viewModel;
  const [expandedMonthKey, setExpandedMonthKey] = useState(null);

  return (
    <section className="panel monitor-dashboard">
      

      <div className="monitor-dashboard-header">
        <h2>Dashboard de Monitorização</h2>
        <p className="muted">Resumo de entregas, riscos e evolução recente das erosões.</p>
      </div>

      <div className="monitor-kpi-grid">
        <article className="project-card monitor-kpi-card">
          <div className="monitor-kpi-title">
            <AppIcon name="building" />
            Empreendimentos
          </div>
          <div className="monitor-kpi-value">{projectCount}</div>
        </article>
        <article className="project-card monitor-kpi-card">
          <div className="monitor-kpi-title">
            <AppIcon name="clipboard" />
            Vistorias
          </div>
          <div className="monitor-kpi-value">{inspectionCount}</div>
        </article>
        <article className="project-card monitor-kpi-card">
          <div className="monitor-kpi-title">
            <AppIcon name="alert" />
            Erosões
          </div>
          <div className="monitor-kpi-value">{erosionCount}</div>
        </article>
        <article className="project-card monitor-kpi-card">
          <div className="monitor-kpi-title">
            <AppIcon name="alert" />
            Críticas
          </div>
          <div className="monitor-kpi-value is-critical">{criticalCount}</div>
        </article>
      </div>

      <div className="monitor-impact-grid">
        {IMPACT_LEVELS.map((impact) => (
          <article key={impact} className={getImpactCardClassName(impact)}>
            <div className="monitor-impact-label">{impact}</div>
            <div className="monitor-impact-value">{impactCounts[impact]}</div>
          </article>
        ))}
      </div>

      <div className="monitor-two-col">
        <article className="panel nested">
          <h3>Distribuicao por criticidade (C1-C4)</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={criticalityDistributionRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" name="Erosoes">
                  {criticalityDistributionRows.map((row) => (
                    <Cell key={`criticality-bar-${row.level}`} fill={getCriticalityBarColor(row.level)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="muted">Taxa de estabilizacao: {stabilizationRate.toFixed(1)}%</p>
        </article>

        <article className="panel nested">
          <h3>Mapa de calor (coordenadas)</h3>
          <div style={{ width: '100%', height: 260, borderRadius: 12, overflow: 'hidden' }}>
            <MapContainer
              center={heatPoints.length > 0 ? [heatPoints[0].latitude, heatPoints[0].longitude] : [-15.793889, -47.882778]}
              zoom={heatPoints.length > 0 ? 10 : 4}
              scrollWheelZoom={false}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {heatPoints.map((point) => (
                <CircleMarker
                  key={`heat-point-${point.id}-${point.latitude}-${point.longitude}`}
                  center={[point.latitude, point.longitude]}
                  radius={6 + (point.peso * 8)}
                  pathOptions={{
                    color: getHeatColor(point.peso),
                    fillColor: getHeatColor(point.peso),
                    fillOpacity: 0.55 + (point.peso * 0.35),
                  }}
                >
                  <Popup>
                    <strong>{point.id || '-'}</strong>
                    <br />
                    Projeto: {point.projetoId || '-'}
                    <br />
                    Criticidade: {point.criticidade || '-'}
                    <br />
                    Score: {point.score}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <p className="muted">
            Pontos no mapa: {heatPoints.length} | Erosoes sem coordenadas: {heatPointsWithoutCoordinates}
          </p>
        </article>
      </div>

      <div className="monitor-two-col">
        <article className="monitor-report-card">
          <div className="monitor-report-card-head">
            <h3>Entregas de Relatórios (próximas)</h3>
          </div>
          <div className="table-scroll">
            <table className="monitor-table">
              <thead className="monitor-report-card-table-head">
                <tr>
                  <th>Origem</th>
                  <th>Escopo</th>
                  <th>Mês/ano entrega</th>
                </tr>
              </thead>
              <tbody className="monitor-report-card-body">
                {reportOccurrences.slice(0, 8).map((item, idx) => (
                  <tr key={`${item.scopeId}-${item.monthKey}-${idx}`}>
                    <td className="monitor-report-main-cell">{item.scopeType === 'lo' ? `LO ${item.loNumero || item.loId || '-'}` : 'Empreendimento vinculado'}</td>
                    <td>{item.scopeSummary || '-'}</td>
                    <td>{formatMonitoringMonthLabel(item.month)}/{item.year}</td>
                  </tr>
                ))}
                {reportOccurrences.length === 0 && (
                  <tr>
                    <td colSpan={3} className="monitor-report-empty-cell">Sem periodicidades de entrega cadastradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel nested monitor-month-card">
          <h3>Acompanhamento mensal de entregas</h3>
          <div className="monitor-month-list">
            {reportMonthRows.map(([monthKey, count]) => {
              const [year, monthNumber] = monthKey.split('-');
              const detailsId = `monitor-month-details-${monthKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              const isExpanded = expandedMonthKey === monthKey;
              const details = Array.isArray(reportMonthDetailsByKey?.[monthKey]) ? reportMonthDetailsByKey[monthKey] : [];
              return (
                <div key={monthKey} className="monitor-month-entry">
                  <button
                    type="button"
                    className={`monitor-month-button${isExpanded ? ' is-expanded' : ''}`}
                    aria-expanded={isExpanded ? 'true' : 'false'}
                    aria-controls={detailsId}
                    onClick={() => setExpandedMonthKey((prev) => (prev === monthKey ? null : monthKey))}
                  >
                    <span className="monitor-month-button-main">
                      <span className="monitor-month-button-label">{formatMonitoringMonthLabel(monthNumber)}/{year}</span>
                    </span>
                    <strong className="monitor-month-button-count">{count}</strong>
                  </button>

                  {isExpanded ? (
                    <div
                      id={detailsId}
                      className="monitor-month-details"
                      role="region"
                      aria-label={`Detalhes de ${formatMonitoringMonthLabel(monthNumber)}/${year}`}
                    >
                      {details.map((item) => {
                        const projectId = String(item?.projectId || '').trim();
                        const projectName = String(item?.projectName || '').trim();
                        const projectLabel = projectName && projectName !== projectId
                          ? `${projectId} - ${projectName}`
                          : (projectId || projectName || '-');

                        return (
                          <article key={`${monthKey}-${projectId || projectLabel}`} className="monitor-month-detail-item">
                            <strong className="monitor-month-detail-title">{projectLabel}</strong>
                            <span className="monitor-month-detail-meta"><strong>Origem:</strong> {item?.sourceSummary || '-'}</span>
                            <span className="monitor-month-detail-meta"><strong>Escopo:</strong> {item?.scopeSummary || '-'}</span>
                          </article>
                        );
                      })}
                      {details.length === 0 && (
                        <p className="monitor-month-detail-empty">Nenhum empreendimento encontrado para este mês.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {reportMonthRows.length === 0 && <p className="muted">Sem entregas por mês para acompanhar.</p>}
          </div>
        </article>
      </div>

      <article className="panel nested monitor-table-card">
        <h3>Erosões recentes</h3>
        <div className="table-scroll">
          <table className="monitor-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Projeto</th>
                <th>Torre</th>
                <th>Impacto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentErosions.map((item) => {
                const projectId = String(item?.projetoId || '').trim();
                const project = projectsById.get(projectId);
                const projectLabel = project ? `${projectId} - ${project.nome || projectId}` : (projectId || '-');
                const impact = getErosionImpact(item);
                return (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{projectLabel}</td>
                    <td>{formatTowerLabel(item?.torreRef)}</td>
                    <td><span className={getImpactChipClassName(impact)}>{impact}</span></td>
                    <td>{item.status || '-'}</td>
                  </tr>
                );
              })}
              {recentErosions.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">Nenhuma erosão registrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function DashboardView() {
  const { user, logout } = useAuth();
  const { show } = useToast();
  const [projects, setProjects] = useState([]);
  const [operatingLicenses, setOperatingLicenses] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [erosions, setErosions] = useState([]);
  const [users, setUsers] = useState([]);
  const [rulesConfig, setRulesConfig] = useState(() => normalizeRulesConfig(RULES_DATABASE));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectionProjectFilterId, setInspectionProjectFilterId] = useState(null);
  const [inspectionPlanningDraft, setInspectionPlanningDraft] = useState(null);
  const [pendingErosionDraft, setPendingErosionDraft] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const dashboardViewModel = useMemo(() => buildMonitoringViewModel({
    projects,
    inspections,
    erosions,
    operatingLicenses,
    searchTerm,
  }), [projects, inspections, erosions, operatingLicenses, searchTerm]);
  const topNotice = activeTab === 'dashboard' && dashboardViewModel.reportPlanningAlerts.length > 0
    ? <TopPlanningAlert alerts={dashboardViewModel.reportPlanningAlerts} />
    : null;

  useEffect(() => {
    const unsubProjects = subscribeProjects(
      (data) => setProjects(data),
      () => show('Erro ao carregar empreendimentos.', 'error'),
    );

    const unsubLicenses = subscribeOperatingLicenses(
      (data) => setOperatingLicenses(data),
      () => show('Erro ao carregar licenças de operação.', 'error'),
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
      unsubLicenses?.();
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
        <button type="button" onClick={logout}>
          <AppIcon name="logout" />
          Sair
        </button>
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

    if (activeTab === 'licenses') {
      return (
        <LicensesView
          licenses={operatingLicenses}
          projects={projects}
          erosions={erosions}
          userEmail={user?.email}
          showToast={show}
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
          onOpenErosionDraft={(draft) => {
            setPendingErosionDraft(draft);
            setActiveTab('erosions');
          }}
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
          pendingDraft={pendingErosionDraft}
          onDraftConsumed={() => setPendingErosionDraft(null)}
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
      return <AdminView users={users} rulesConfig={rulesConfig} searchTerm={searchTerm} erosions={erosions} />;
    }

    if (activeTab === 'dashboard') {
      return (
        <DashboardMonitoring
          viewModel={dashboardViewModel}
        />
      );
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
        topNotice={topNotice}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
      >
        <Suspense fallback={<section className="panel">A carregar módulo...</section>}>
          {renderTab()}
        </Suspense>
      </AppShell>

      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </>
  );
}

export default DashboardView;
