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
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import AppIcon from '../components/AppIcon';
import { Badge, Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AppShell from '../layout/AppShell';
import MandatoryProfileUpdateView from '../features/auth/components/MandatoryProfileUpdateView';
import ProfileModal from '../features/auth/components/ProfileModal';
import TopPlanningAlert from '../features/monitoring/components/TopPlanningAlert';
import { subscribeProjects } from '../services/projectService';
import { subscribeInspections } from '../services/inspectionService';
import { subscribeErosions } from '../services/erosionService';
import { subscribeUsers } from '../services/userService';
import { subscribeRulesConfig } from '../services/rulesService';
import { subscribeOperatingLicenses } from '../services/licenseService';
import { subscribeReportDeliveryTracking } from '../services/reportDeliveryTrackingService';
import { normalizeRulesConfig } from '../features/shared/rulesConfig';
import { normalizeUserStatus } from '../features/shared/statusUtils';
import {
  IMPACT_LEVELS,
  buildMonitoringViewModel,
  formatMonitoringMonthLabel,
  formatTowerLabel,
  getErosionImpact,
} from '../features/monitoring/utils/monitoringViewModel';
import {
  getCriticalityChartColor,
  getHeatChartColor,
} from '../features/monitoring/utils/monitoringColors';
import { MONTH_STATUS, deriveMonthStatus } from '../features/monitoring/utils/monthTimeline';

const ProjectsView = lazy(() => import('../features/projects/components/ProjectsView'));
const LicensesView = lazy(() => import('../features/licenses/components/LicensesView'));
const InspectionsView = lazy(() => import('../features/inspections/components/InspectionsView'));
const ErosionsView = lazy(() => import('../features/erosions/components/ErosionsView'));
const VisitPlanningView = lazy(() => import('../features/inspections/components/VisitPlanningView'));
const AdminView = lazy(() => import('../features/admin/components/AdminView'));
const FollowupsView = lazy(() => import('../features/followups/components/FollowupsView'));
const ReportsView = lazy(() => import('../features/reports/components/ReportsView'));

function formatReportDueDays(days) {
  const safeDays = Number(days);
  if (!Number.isFinite(safeDays)) return 'Sem prazo definido';
  if (safeDays < 0) return `${Math.abs(safeDays)} dia(s) em atraso`;
  if (safeDays === 0) return 'Vence hoje';
  return `${safeDays} dia(s)`;
}

function getReportSourceLabel(item) {
  const sourceApplied = String(item?.sourceApplied || '').toUpperCase();
  if (sourceApplied === 'LO' || String(item?.scopeType || '').toLowerCase() === 'lo') {
    const loLabel = String(item?.loNumero || item?.loId || item?.scopeId || '').trim();
    return loLabel ? `LO ${loLabel}` : 'LO';
  }
  return 'Empreendimento vinculado';
}

function getImpactTone(impact) {
  if (impact === 'Muito Alto') return 'critical';
  if (impact === 'Alto') return 'danger';
  if (impact === 'Medio' || impact === 'Médio') return 'warning';
  return 'ok';
}

const DEFAULT_HEATMAP_HEIGHT = 220;
const EXPANDED_HEATMAP_HEIGHT = 420;

function DashboardHeatMapViewport({ heatPoints, mapHeight }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (typeof map.invalidateSize === 'function') {
      map.invalidateSize(false);
    }
  }, [map, mapHeight]);

  useEffect(() => {
    if (!map) return;
    if (!Array.isArray(heatPoints) || heatPoints.length === 0) return;

    if (heatPoints.length === 1) {
      map.setView([heatPoints[0].latitude, heatPoints[0].longitude], 13, {
        animate: false,
      });
      return;
    }

    map.fitBounds(
      heatPoints.map((point) => [point.latitude, point.longitude]),
      {
        padding: [24, 24],
        maxZoom: 13,
        animate: false,
      },
    );
  }, [heatPoints, map, mapHeight]);

  return null;
}

const EMPTY_MONITORING_VIEW_MODEL = {
  searchTermApplied: '',
  reportOccurrences: [],
  reportProjectMonthRows: [],
  reportMonthRows: [],
  reportMonthDetailsByKey: {},
  workTrackingRows: [],
  impactCounts: {
    'Muito Alto': 0,
    Alto: 0,
    Medio: 0,
    Baixo: 0,
  },
  criticalCount: 0,
  criticalityDistributionRows: [],
  stabilizationRate: 0,
  heatPoints: [],
  heatPointsWithoutCoordinates: 0,
  recentErosions: [],
  projectsById: new Map(),
  projectCount: 0,
  inspectionCount: 0,
  erosionCount: 0,
  reportPlanningAlerts: [],
  reportInvalidOverrides: [],
};

function PendingProjectsPanel({ pendingProjects, onFixSchedule, onFixLO }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const scheduleCount = pendingProjects.filter((i) => i.missingSchedule).length;
  const loCount = pendingProjects.filter((i) => i.missingLO).length;

  const filtered = useMemo(() => {
    let items = pendingProjects;
    if (filter === 'schedule') items = items.filter((i) => i.missingSchedule);
    if (filter === 'lo') items = items.filter((i) => i.missingLO);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      items = items.filter(
        (i) => String(i.id || '').toLowerCase().includes(term) || String(i.nome || '').toLowerCase().includes(term),
      );
    }
    return items;
  }, [pendingProjects, filter, search]);

  const filterButtons = [
    { key: 'all', label: 'Todas', count: pendingProjects.length },
    { key: 'schedule', label: 'Sem data', count: scheduleCount },
    { key: 'lo', label: 'Sem LO', count: loCount },
  ];

  return (
    <Card variant="nested" className="mt-1">
      <h3 className="text-sm font-bold text-amber-800 m-0 mb-3 flex items-center gap-2">
        <AppIcon name="alert" size={16} />
        Empreendimentos com pendencias ({pendingProjects.length})
      </h3>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
        <input
          type="text"
          placeholder="Buscar por sigla ou nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none bg-white"
        />
        <div className="flex flex-wrap items-center gap-2">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === f.key
                  ? 'bg-amber-200 border-amber-400 text-amber-900'
                  : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto max-h-[440px] rounded-lg border border-amber-200">
        <table className="w-full text-left text-sm whitespace-normal min-w-[400px]">
          <thead className="bg-amber-50 text-xs font-semibold text-amber-700 uppercase tracking-wider border-b border-amber-200 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">Empreendimento</th>
              <th className="px-4 py-3">Pendencias</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-amber-100">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-amber-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{item.id} - {item.nome || item.id}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {item.missingSchedule && (
                      <button
                        type="button"
                        onClick={() => onFixSchedule?.(item.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors cursor-pointer"
                      >
                        Sem data de relatorio
                        <AppIcon name="chevron-right" size={12} />
                      </button>
                    )}
                    {item.missingLO && (
                      <button
                        type="button"
                        onClick={() => onFixLO?.(item.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors cursor-pointer"
                      >
                        Sem LO associada
                        <AppIcon name="chevron-right" size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center p-4 text-amber-600 text-xs">
                  Nenhum empreendimento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length !== pendingProjects.length && (
        <p className="text-xs text-amber-600 mt-2 m-0">{filtered.length} de {pendingProjects.length} empreendimentos</p>
      )}
    </Card>
  );
}

function MonthDetailsPanel({ monthKey, details }) {
  const [year, monthNumber] = String(monthKey).split('-');
  const id = `monitor-month-details-${String(monthKey).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const safeDetails = Array.isArray(details) ? details : [];

  return (
    <div
      id={id}
      role="region"
      aria-label={`Detalhes de ${formatMonitoringMonthLabel(monthNumber)}/${year}`}
      className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg"
    >
      {safeDetails.map((item) => {
        const projectId = String(item?.projectId || '').trim();
        const projectName = String(item?.projectName || '').trim();
        const projectLabel = projectName && projectName !== projectId
          ? `${projectId} - ${projectName}`
          : (projectId || projectName || '-');
        return (
          <article key={`${monthKey}-${projectId || projectLabel}`} className="flex flex-col gap-1 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
            <strong className="text-sm font-bold text-slate-800 mb-1">{projectLabel}</strong>
            <span className="text-xs text-slate-600 flex justify-between"><strong>Origem:</strong> {item?.sourceSummary || '-'}</span>
            <span className="text-xs text-slate-600 flex justify-between"><strong>Escopo:</strong> {item?.scopeSummary || '-'}</span>
            <span className="text-xs text-slate-600 flex justify-between"><strong>Prazo:</strong> {formatReportDueDays(item?.dueInDays)}</span>
            <span className="text-xs text-slate-600 flex justify-between items-center mt-1 pt-1 border-t border-slate-50">
              <strong>Status prazo:</strong>{' '}
              <Badge tone={item?.deadlineStatusTone}>{item?.deadlineStatusLabel || 'Sem prazo'}</Badge>
            </span>
            <span className="text-xs text-slate-600 flex justify-between items-center mt-1 pt-1 border-t border-slate-50">
              <strong>Status operacional:</strong>{' '}
              <Badge tone={item?.operationalStatusTone}>{item?.operationalStatusLabel || 'Não iniciado'}</Badge>
            </span>
          </article>
        );
      })}
      {safeDetails.length === 0 && (
        <p className="text-sm text-slate-500 italic m-0">Nenhum empreendimento encontrado para este mês.</p>
      )}
    </div>
  );
}

function monthPillClasses(status, isExpanded) {
  const base = 'shrink-0 inline-flex items-center gap-2 rounded-full border font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
  const expandedRing = isExpanded ? ' ring-2 ring-offset-1 ring-brand-500' : '';
  switch (status) {
    case MONTH_STATUS.PAST_OK:
      return `${base} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 text-xs${expandedRing}`;
    case MONTH_STATUS.PAST_LATE:
      return `${base} border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 px-3 py-1.5 text-xs${expandedRing}`;
    case MONTH_STATUS.CURRENT:
      return `${base} border-brand-500 bg-brand-50 text-brand-800 hover:bg-brand-100 px-4 py-2 text-sm shadow-sm${expandedRing}`;
    case MONTH_STATUS.NEXT:
      return `${base} border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 px-3 py-1.5 text-xs${expandedRing}`;
    default:
      return `${base} border-slate-200 bg-white text-slate-600 hover:bg-slate-50 px-3 py-1.5 text-xs${expandedRing}`;
  }
}

function monthPillLabel(status) {
  switch (status) {
    case MONTH_STATUS.PAST_OK:
      return 'Entregue';
    case MONTH_STATUS.PAST_LATE:
      return 'Atrasado';
    case MONTH_STATUS.CURRENT:
      return 'Mes atual';
    case MONTH_STATUS.NEXT:
      return 'Proximo';
    default:
      return 'Futuro';
  }
}

function DeliveryTimeline({ reportMonthRows, reportMonthDetailsByKey, now }) {
  const enrichedRows = useMemo(() => {
    return (reportMonthRows || []).map(([monthKey, count]) => {
      const details = reportMonthDetailsByKey?.[monthKey] || [];
      const { status, lateCount, offset } = deriveMonthStatus(monthKey, details, now);
      return { monthKey, count, status, lateCount, offset, details };
    });
  }, [reportMonthRows, reportMonthDetailsByKey, now]);

  const currentKey = useMemo(() => {
    const current = enrichedRows.find((row) => row.status === MONTH_STATUS.CURRENT);
    return current ? current.monthKey : null;
  }, [enrichedRows]);

  const [expandedKey, setExpandedKey] = useState(currentKey);
  const [showPastOk, setShowPastOk] = useState(false);

  useEffect(() => {
    if (currentKey && expandedKey === null) {
      setExpandedKey(currentKey);
    }
  }, [currentKey, expandedKey]);

  const pastOkRows = enrichedRows.filter((row) => row.status === MONTH_STATUS.PAST_OK);
  const visibleRows = enrichedRows
    .filter((row) => row.status !== MONTH_STATUS.PAST_OK || showPastOk)
    .sort((a, b) => a.offset - b.offset);

  const expandedRow = expandedKey
    ? enrichedRows.find((row) => row.monthKey === expandedKey) || null
    : null;

  if (enrichedRows.length === 0) {
    return (
      <Card variant="nested" className="flex flex-col">
        <h3 className="text-sm font-bold text-slate-800 m-0 mb-2">Linha do tempo de entregas</h3>
        <p className="text-sm text-slate-500 italic m-0">Sem entregas por mes para acompanhar.</p>
      </Card>
    );
  }

  return (
    <Card variant="nested" className="flex flex-col">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 m-0">Linha do tempo de entregas</h3>
          <p className="text-xs text-slate-500 mt-1 m-0">
            Meses em atraso em vermelho, mes atual em destaque. Clique para ver os empreendimentos.
          </p>
        </div>
        {pastOkRows.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPastOk((value) => !value)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
            aria-expanded={showPastOk ? 'true' : 'false'}
          >
            {showPastOk ? 'Ocultar' : 'Mostrar'} meses resolvidos ({pastOkRows.length})
          </button>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <div className="flex items-center gap-2 pb-2 min-w-max">
          {visibleRows.map((row) => {
            const isExpanded = expandedKey === row.monthKey;
            const [year, monthNumber] = row.monthKey.split('-');
            const detailsId = `monitor-month-details-${row.monthKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            const pillTitle = `${monthPillLabel(row.status)} - ${formatMonitoringMonthLabel(monthNumber)}/${year}`;

            return (
              <button
                key={row.monthKey}
                type="button"
                className={monthPillClasses(row.status, isExpanded)}
                onClick={() => setExpandedKey((prev) => (prev === row.monthKey ? null : row.monthKey))}
                aria-expanded={isExpanded ? 'true' : 'false'}
                aria-controls={detailsId}
                title={pillTitle}
              >
                <span className="font-bold">
                  {formatMonitoringMonthLabel(monthNumber)}/{year}
                </span>
                <span className="inline-flex items-center justify-center rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  {row.count}
                </span>
                {row.status === MONTH_STATUS.PAST_LATE && (
                  <Badge tone="danger">{row.lateCount} atrasad{row.lateCount === 1 ? 'o' : 'os'}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {expandedRow && (
        <div className="mt-3">
          <MonthDetailsPanel monthKey={expandedRow.monthKey} details={expandedRow.details} />
        </div>
      )}
    </Card>
  );
}

function KpiCard({ label, value, icon, accent, onClick, actionLabel }) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wide">
        <AppIcon name={icon} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={actionLabel || `Ir para ${label}`}
        className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-1 text-left w-full transition-colors hover:border-brand-300 hover:bg-brand-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {content}
      </button>
    );
  }

  return (
    <Card className="flex flex-col gap-1 p-4 shadow-sm border border-slate-200">{content}</Card>
  );
}

function DashboardMonitoring({ viewModel, pendingProjects, now, onCriticalityBarClick, onFixSchedule, onFixLO, onNavigate }) {
  const {
    searchTermApplied,
    reportOccurrences,
    reportProjectMonthRows,
    reportMonthRows,
    reportMonthDetailsByKey,
    workTrackingRows,
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
  } = viewModel || EMPTY_MONITORING_VIEW_MODEL;
  const [expandedReportRowKey, setExpandedReportRowKey] = useState('');
  const [isHeatMapExpanded, setIsHeatMapExpanded] = useState(false);
  const upcomingScopeCount = reportOccurrences.length;
  const upcomingProjectCount = reportProjectMonthRows.length;
  const hasSearchFilter = Boolean(searchTermApplied);
  const heatMapHeight = isHeatMapExpanded ? EXPANDED_HEATMAP_HEIGHT : DEFAULT_HEATMAP_HEIGHT;
  const heatMapInstanceKey = isHeatMapExpanded ? 'expanded' : 'collapsed';
  const hasPendingProjects = Array.isArray(pendingProjects) && pendingProjects.length > 0;

  const kpiItems = [
    {
      key: 'critical',
      label: 'Críticas',
      value: criticalCount,
      icon: 'alert',
      accent: 'text-red-700',
      actionLabel: 'Ver erosões criticas C4',
      onClick: () => onNavigate?.('erosions', { criticality: 'C4' }),
    },
    {
      key: 'erosions',
      label: 'Erosões',
      value: erosionCount,
      icon: 'alert',
      accent: 'text-slate-700',
      actionLabel: 'Ver todas as erosões',
      onClick: () => onNavigate?.('erosions'),
    },
    {
      key: 'inspections',
      label: 'Vistorias',
      value: inspectionCount,
      icon: 'clipboard',
      accent: 'text-slate-700',
      actionLabel: 'Ver vistorias',
      onClick: () => onNavigate?.('inspections'),
    },
    {
      key: 'projects',
      label: 'Empreendimentos',
      value: projectCount,
      icon: 'building',
      accent: 'text-slate-700',
      actionLabel: 'Ver empreendimentos',
      onClick: () => onNavigate?.('projects'),
    },
  ];

  return (
    <section className="flex flex-col gap-5 p-2">
      <div>
        <h2 className="text-xl font-bold text-slate-800 m-0">Dashboard de Monitorização</h2>
        <p className="text-sm text-slate-500 mt-1">Resumo de entregas, riscos, obras em curso e evolução recente das erosões.</p>
      </div>

      {hasPendingProjects && (
        <PendingProjectsPanel
          pendingProjects={pendingProjects}
          onFixSchedule={onFixSchedule}
          onFixLO={onFixLO}
        />
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiItems.map((item) => (
          <KpiCard
            key={item.key}
            label={item.label}
            value={item.value}
            icon={item.icon}
            accent={item.accent}
            onClick={item.onClick}
            actionLabel={item.actionLabel}
          />
        ))}
      </div>

      {hasSearchFilter ? (
        <p className="text-xs text-slate-500 -mt-1">
          Filtro ativo: "{searchTermApplied}". Críticas e Erosões refletem o filtro; Vistorias e Empreendimentos mostram o total geral.
        </p>
      ) : null}

      <DeliveryTimeline
        reportMonthRows={reportMonthRows}
        reportMonthDetailsByKey={reportMonthDetailsByKey}
        now={now}
      />

      <div className="grid gap-5 grid-cols-1 xl:grid-cols-2 items-start">
        {/* Coluna esquerda */}
        <div className="flex flex-col gap-4">
          <Card variant="nested">
            <h3 className="text-sm font-bold text-slate-800 m-0 mb-3">Distribuição por criticidade (C1–C4)</h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={criticalityDistributionRows} style={{ cursor: 'pointer' }} onClick={(state) => {
                  if (state?.activeLabel && onCriticalityBarClick) onCriticalityBarClick(state.activeLabel);
                }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Erosões">
                    {criticalityDistributionRows.map((row) => (
                      <Cell key={`criticality-bar-${row.level}`} fill={getCriticalityChartColor(row.level)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-2">Taxa de estabilização: {stabilizationRate.toFixed(1)}%</p>
          </Card>

          <Card variant="nested" className="flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 m-0 mb-3">Entregas de Relatórios (próximas)</h3>
            <p className="text-xs text-slate-500 mt-0 mb-3">
              Escopos agregados: {upcomingScopeCount} | Projetos (competência): {upcomingProjectCount}
            </p>
            <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm table-fixed min-w-[700px]">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-[15%]">Origem</th>
                    <th className="px-4 py-3 w-[30%]">Escopo</th>
                    <th className="px-4 py-3 w-[10%]">Mês/ano</th>
                    <th className="px-4 py-3 w-[15%]">Prazo</th>
                    <th className="px-4 py-3 w-[15%]">Status prazo</th>
                    <th className="px-4 py-3 w-[15%]">Status op.</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {reportOccurrences.slice(0, 8).map((item, idx) => {
                    const rowKey = `${item.scopeId || item.projectId || 'scope'}-${item.monthKey}-${idx}`;
                    const isExpanded = expandedReportRowKey === rowKey;
                    const projectBreakdown = Array.isArray(item.projectBreakdown) ? item.projectBreakdown : [];
                    const canExpand = projectBreakdown.length > 0;

                    return (
                      <tr key={rowKey} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 text-sm whitespace-normal break-words">{getReportSourceLabel(item)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col items-start gap-2 overflow-hidden">
                            <span className="text-slate-600 whitespace-normal break-words" title={item.scopeSummary || ''}>{item.scopeSummary || '-'}</span>
                            {canExpand ? (
                              <button
                                type="button"
                                className="text-xs text-brand-600 font-semibold hover:text-brand-800 hover:underline px-2 py-1 rounded bg-brand-50 mt-1 self-start"
                                aria-expanded={isExpanded ? 'true' : 'false'}
                                onClick={() => setExpandedReportRowKey((prev) => (prev === rowKey ? '' : rowKey))}
                              >
                                {isExpanded ? 'Ocultar projetos' : `Projetos (${projectBreakdown.length})`}
                              </button>
                            ) : null}
                          </div>
                          {isExpanded && canExpand ? (
                            <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-inner overflow-x-auto" role="region" aria-label="Detalhes por projeto">
                              <table className="w-full text-left text-xs table-fixed min-w-[500px]">
                                <thead className="text-slate-500 uppercase tracking-wide border-b border-slate-200">
                                  <tr>
                                    <th className="pb-2 font-semibold w-[20%]">Projeto</th>
                                    <th className="pb-2 font-semibold w-[15%]">Origem</th>
                                    <th className="pb-2 font-semibold w-[15%]">Prazo</th>
                                    <th className="pb-2 font-semibold w-[20%]">Status prazo</th>
                                    <th className="pb-2 font-semibold w-[20%]">Status op.</th>
                                    <th className="pb-2 font-semibold w-[10%]">Override</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {projectBreakdown.map((projectItem) => {
                                    const projectLabel = projectItem.projectName
                                      ? `${projectItem.projectId} - ${projectItem.projectName}`
                                      : projectItem.projectId;
                                    const sourceLabel = projectItem.sourceApplied === 'LO' ? 'LO' : 'Empreendimento';
                                    return (
                                      <tr key={`${rowKey}-${projectItem.projectId}`} className="hover:bg-slate-100/50">
                                        <td className="py-2 pr-2 text-slate-700 whitespace-normal break-words">{projectLabel}</td>
                                        <td className="py-2 pr-2 text-slate-600 whitespace-normal break-words">{sourceLabel}</td>
                                        <td className="py-2 pr-2 text-slate-600">{formatReportDueDays(projectItem.daysUntilDue)}</td>
                                        <td className="py-2 pr-2">
                                          <Badge tone={projectItem.deadlineStatusTone}>
                                            <span className="whitespace-normal text-left">{projectItem.deadlineStatusLabel || 'Sem prazo'}</span>
                                          </Badge>
                                        </td>
                                        <td className="py-2 pr-2">
                                          <Badge tone={projectItem.operationalStatusTone}>
                                            <span className="whitespace-normal text-left">{projectItem.operationalStatusLabel || 'Não iniciado'}</span>
                                          </Badge>
                                        </td>
                                        <td className="py-2 pr-2 text-slate-500">{projectItem.sourceOverrideLabel || 'Automático'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatMonitoringMonthLabel(item.month)}/{item.year}</td>
                        <td className="px-4 py-3 text-slate-600">{formatReportDueDays(item?.daysUntilDue)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={item?.deadlineStatusTone || item?.trackingStatusTone}>
                            <span className="whitespace-normal text-left">{item?.deadlineStatusLabel || item?.trackingStatusLabel || 'Sem prazo'}</span>
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={item?.operationalStatusTone}>
                            <span className="whitespace-normal text-left">{item?.operationalStatusLabel || 'Não iniciado'}</span>
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {reportOccurrences.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm italic">Sem periodicidades de entrega cadastradas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Coluna direita */}
        <div className="flex flex-col gap-4">
          <Card variant="nested" className="flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 m-0 mb-3">Acompanhamento de Obras</h3>
            <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm whitespace-normal min-w-[500px]">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Erosão</th>
                    <th className="px-4 py-3">Projeto</th>
                    <th className="px-4 py-3">Torre</th>
                    <th className="px-4 py-3">Etapa</th>
                    <th className="px-4 py-3">Atualização</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {workTrackingRows.slice(0, 8).map((row) => (
                    <tr key={`monitor-work-${row.erosionId}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{row.erosionId}</td>
                      <td className="px-4 py-3 text-slate-600">{row.projectName ? `${row.projectId} - ${row.projectName}` : row.projectId}</td>
                      <td className="px-4 py-3 text-slate-600">{formatTowerLabel(row.towerRef)}</td>
                      <td className="px-4 py-3 text-slate-600">{row.stage || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.timestamp ? new Date(row.timestamp).toLocaleString('pt-BR') : '-'}</td>
                    </tr>
                  ))}
                  {workTrackingRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500 italic">Sem obras ativas em Projeto ou Em andamento.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card variant="nested" className="flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 m-0 mb-3">Erosões recentes</h3>
            <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm whitespace-normal min-w-[500px]">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Projeto</th>
                    <th className="px-4 py-3">Torre</th>
                    <th className="px-4 py-3">Impacto</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {recentErosions.map((item) => {
                    const projectId = String(item?.projetoId || '').trim();
                    const project = projectsById.get(projectId);
                    const projectLabel = project ? `${projectId} - ${project.nome || projectId}` : (projectId || '-');
                    const impact = getErosionImpact(item);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{item.id}</td>
                        <td className="px-4 py-3 text-slate-600">{projectLabel}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTowerLabel(item?.torreRef)}</td>
                        <td className="px-4 py-3"><Badge tone={getImpactTone(impact)}>{impact}</Badge></td>
                        <td className="px-4 py-3 text-slate-600">{item.status || '-'}</td>
                      </tr>
                    );
                  })}
                  {recentErosions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500 italic">Nenhuma erosão registrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Card variant="nested">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 m-0">Mapa de calor (coordenadas)</h3>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            aria-expanded={isHeatMapExpanded ? 'true' : 'false'}
            aria-controls="dashboard-heatmap-container"
            onClick={() => setIsHeatMapExpanded((value) => !value)}
            title="Alternar tamanho do mapa de calor"
          >
            {isHeatMapExpanded ? 'Recolher mapa' : 'Expandir mapa'}
          </button>
        </div>
        <div
          id="dashboard-heatmap-container"
          data-testid="dashboard-heatmap-container"
          style={{ width: '100%', height: heatMapHeight, borderRadius: 10, overflow: 'hidden' }}
        >
          <MapContainer
            key={heatMapInstanceKey}
            center={heatPoints.length > 0 ? [heatPoints[0].latitude, heatPoints[0].longitude] : [-15.793889, -47.882778]}
            zoom={heatPoints.length > 0 ? 10 : 4}
            scrollWheelZoom={false}
            style={{ width: '100%', height: '100%' }}
          >
            <DashboardHeatMapViewport heatPoints={heatPoints} mapHeight={heatMapHeight} />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Mapa padrão">
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Relevo">
                <TileLayer
                  attribution="Map data: &copy; OpenTopoMap contributors, SRTM | &copy; OpenStreetMap contributors"
                  url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
            </LayersControl>
            {heatPoints.map((point) => (
              <CircleMarker
                key={`heat-point-${point.id}-${point.latitude}-${point.longitude}`}
                center={[point.latitude, point.longitude]}
                radius={6 + (point.peso * 8)}
                pathOptions={{
                  color: getHeatChartColor(point.peso),
                  fillColor: getHeatChartColor(point.peso),
                  fillOpacity: 0.55 + (point.peso * 0.35),
                }}
              >
                <Popup>
                  <strong>{point.id || '-'}</strong>
                  <br />
                  Projeto: {point.projetoId || '-'}
                  <br />
                  Torre: {formatTowerLabel(point.towerRef)}
                  <br />
                  Criticidade: {point.criticidade || '-'}
                  <br />
                  Score: {point.score}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Pontos no mapa: {heatPoints.length} | Erosões sem coordenadas: {heatPointsWithoutCoordinates}
        </p>
      </Card>
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
  const [primaryDataLoaded, setPrimaryDataLoaded] = useState(false);
  const [deliveryTracking, setDeliveryTracking] = useState([]);
  const [users, setUsers] = useState([]);
  const [rulesConfig, setRulesConfig] = useState(() => normalizeRulesConfig({}));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [editProjectId, setEditProjectId] = useState(null);
  const [inspectionProjectFilterId, setInspectionProjectFilterId] = useState(null);
  const [inspectionPlanningDraft, setInspectionPlanningDraft] = useState(null);
  const [pendingErosionDraft, setPendingErosionDraft] = useState(null);
  const [criticalityFilter, setCriticalityFilter] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const dashboardViewModel = useMemo(() => {
    try {
      return buildMonitoringViewModel({
        projects,
        inspections,
        erosions,
        operatingLicenses,
        deliveryTracking,
        searchTerm,
      });
    } catch (error) {
      console.error('[DashboardView] Falha ao montar view model de monitoramento:', error);
      return EMPTY_MONITORING_VIEW_MODEL;
    }
  }, [projects, inspections, erosions, operatingLicenses, deliveryTracking, searchTerm]);

  const pendingProjects = useMemo(() => {
    const coveredIds = new Set();
    operatingLicenses.forEach((lo) => {
      (lo.cobertura || []).forEach((c) => {
        if (c.projetoId) coveredIds.add(String(c.projetoId).toUpperCase());
      });
    });
    return projects
      .map((p) => {
        const config = p?.mesesEntregaRelatorio;
        const months = Array.isArray(config) ? config.filter((m) => Number.isInteger(Number(m)) && Number(m) >= 1 && Number(m) <= 12) : [];
        const missingSchedule = months.length === 0;
        const missingLO = !coveredIds.has(String(p.id).toUpperCase());
        if (!missingSchedule && !missingLO) return null;
        return { id: p.id, nome: p.nome, missingSchedule, missingLO };
      })
      .filter(Boolean);
  }, [projects, operatingLicenses]);

  const topNotice = (
    <div className="flex items-center gap-2">
      {activeTab === 'dashboard' && dashboardViewModel.reportPlanningAlerts.length > 0
        ? <TopPlanningAlert alerts={dashboardViewModel.reportPlanningAlerts} />
        : null}
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold"
        onClick={() => setRefreshNonce((value) => value + 1)}
        title="Atualizar dados da aba atual"
      >
        <AppIcon name="reset" size={14} />
        Atualizar
      </button>
    </div>
  );

  useEffect(() => {
    const unsubProjects = subscribeProjects(
      (data) => { setProjects(data); setPrimaryDataLoaded(true); },
      () => { show('Erro ao carregar empreendimentos.', 'error'); setPrimaryDataLoaded(true); },
    );

    const unsubInspections = subscribeInspections(
      (data) => setInspections(data),
      () => show('Erro ao carregar vistorias.', 'error'),
    );

    const unsubErosions = subscribeErosions(
      (data) => setErosions(data),
      () => show('Erro ao carregar erosoes.', 'error'),
    );

    return () => {
      unsubProjects?.();
      unsubInspections?.();
      unsubErosions?.();
    };
  }, [show, refreshNonce]);

  useEffect(() => {
    const needsMonitoringData = activeTab === 'dashboard' || activeTab === 'followups' || activeTab === 'projects';
    if (!needsMonitoringData) {
      return () => { };
    }

    const unsubLicenses = subscribeOperatingLicenses(
      (data) => setOperatingLicenses(data),
      () => show('Erro ao carregar licencas de operacao.', 'error'),
    );

    const unsubTracking = subscribeReportDeliveryTracking(
      (data) => setDeliveryTracking(data),
      () => show('Erro ao carregar acompanhamentos de entrega.', 'error'),
    );

    return () => {
      unsubLicenses?.();
      unsubTracking?.();
    };
  }, [activeTab, show, refreshNonce]);

  useEffect(() => {
    const isAdminMenu = user?.role === 'admin' || user?.role === 'manager';
    const shouldLoadAdminData = isAdminMenu && activeTab === 'admin';

    if (!shouldLoadAdminData) {
      setUsers([]);
      return () => { };
    }

    const unsubUsers = subscribeUsers(
      (data) => setUsers(data),
      () => show('Erro ao carregar utilizadores.', 'error'),
    );

    const unsubRules = subscribeRulesConfig(
      (data) => setRulesConfig(normalizeRulesConfig(data || {})),
      () => show('Erro ao carregar regras.', 'error'),
    );

    return () => {
      unsubUsers?.();
      unsubRules?.();
    };
  }, [activeTab, show, user?.role, refreshNonce]);

  function openProjectInspections(projectId) {
    setInspectionProjectFilterId(projectId || null);
    setActiveTab('inspections');
  }

  const accessStatus = normalizeUserStatus(user?.status);
  if (accessStatus !== 'Ativo') {
    return (
      <section className="p-8 max-w-md mx-auto mt-12 bg-white rounded-xl shadow-sm border border-slate-200 text-center flex flex-col items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800 m-0">Acesso restrito</h2>
        <p className="text-slate-500 font-medium">
          {accessStatus === 'Pendente'
            ? 'A sua conta está aguardando aprovação de um administrador.'
            : 'A sua conta está inativa. Entre em contato com um administrador.'}
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <AppIcon name="logout" size={18} />
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
          operatingLicenses={operatingLicenses}
          userEmail={user?.email}
          showToast={show}
          reloadProjects={async () => null}
          onOpenProjectInspections={openProjectInspections}
          searchTerm={searchTerm}
          editProjectId={editProjectId}
          onEditProjectHandled={() => setEditProjectId(null)}
          loading={!primaryDataLoaded}
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
          searchTerm={searchTerm}
          loading={!primaryDataLoaded}
        />
      );
    }

    if (activeTab === 'inspections') {
      return (
        <InspectionsView
          inspections={inspections}
          projects={projects}
          erosions={erosions}
          feriados={rulesConfig?.feriados || []}
          searchTerm={searchTerm}
          forcedProjectFilterId={inspectionProjectFilterId}
          onClearForcedProjectFilter={() => setInspectionProjectFilterId(null)}
          planningDraft={inspectionPlanningDraft}
          onPlanningDraftConsumed={() => setInspectionPlanningDraft(null)}
          onOpenErosionDraft={(draft) => {
            setPendingErosionDraft(draft);
            setActiveTab('erosions');
          }}
          loading={!primaryDataLoaded}
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
          criticalityFilter={criticalityFilter}
          onClearCriticalityFilter={() => setCriticalityFilter('')}
        />
      );
    }

    if (activeTab === 'followups') {
      return (
        <FollowupsView
          reportRows={dashboardViewModel.reportProjectMonthRows}
          workRows={dashboardViewModel.workTrackingRows}
          erosions={erosions}
          inspections={inspections}
          projects={projects}
          invalidOverrides={dashboardViewModel.reportInvalidOverrides}
          userActor={String(user?.nome || user?.displayName || user?.email || user?.uid || '').trim()}
          showToast={show}
        />
      );
    }

    if (activeTab === 'visit-planning') {
      return (
        <VisitPlanningView
          projects={projects}
          inspections={inspections}
          erosions={erosions}
          feriados={rulesConfig?.feriados || []}
          onApplySelection={(payload) => {
            setInspectionPlanningDraft(payload);
            setInspectionProjectFilterId(payload.projectId || null);
            setActiveTab('inspections');
          }}
        />
      );
    }

    if (activeTab === 'georelat') {
      return <ReportsView userEmail={user?.email} showToast={show} />;
    }

    if (activeTab === 'admin') {
      return <AdminView users={users} rulesConfig={rulesConfig} searchTerm={searchTerm} erosions={erosions} />;
    }

    if (activeTab === 'dashboard') {
      return (
        <DashboardMonitoring
          viewModel={dashboardViewModel}
          pendingProjects={pendingProjects}
          now={Date.now()}
          onCriticalityBarClick={(level) => {
            setCriticalityFilter(level);
            setActiveTab('erosions');
          }}
          onFixSchedule={(projectId) => {
            setEditProjectId(projectId);
            setActiveTab('projects');
          }}
          onFixLO={(projectId) => {
            setSearchTerm(projectId);
            setActiveTab('licenses');
          }}
          onNavigate={(tab, options = {}) => {
            if (options.criticality) {
              setCriticalityFilter(options.criticality);
            }
            setActiveTab(tab);
          }}
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
        <Suspense fallback={<section className="p-6 text-sm text-slate-500">A carregar modulo...</section>}>
          {renderTab()}
        </Suspense>
      </AppShell>

      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </>
  );
}

export default DashboardView;
