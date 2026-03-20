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
import { normalizeRulesConfig, RULES_DATABASE } from '../features/shared/rulesConfig';
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

const ProjectsView = lazy(() => import('../features/projects/components/ProjectsView'));
const LicensesView = lazy(() => import('../features/licenses/components/LicensesView'));
const InspectionsView = lazy(() => import('../features/inspections/components/InspectionsView'));
const ErosionsView = lazy(() => import('../features/erosions/components/ErosionsView'));
const VisitPlanningView = lazy(() => import('../features/inspections/components/VisitPlanningView'));
const AdminView = lazy(() => import('../features/admin/components/AdminView'));
const FollowupsView = lazy(() => import('../features/followups/components/FollowupsView'));

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

function DashboardMonitoring({ viewModel, onCriticalityBarClick }) {
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
  const [expandedMonthKey, setExpandedMonthKey] = useState(null);
  const [expandedReportRowKey, setExpandedReportRowKey] = useState('');
  const [isHeatMapExpanded, setIsHeatMapExpanded] = useState(false);
  const upcomingScopeCount = reportOccurrences.length;
  const upcomingProjectCount = reportProjectMonthRows.length;
  const hasSearchFilter = Boolean(searchTermApplied);
  const heatMapHeight = isHeatMapExpanded ? EXPANDED_HEATMAP_HEIGHT : DEFAULT_HEATMAP_HEIGHT;
  const heatMapInstanceKey = isHeatMapExpanded ? 'expanded' : 'collapsed';

  return (
    <section className="flex flex-col gap-5 p-2">
      <div>
        <h2 className="text-xl font-bold text-slate-800 m-0">Dashboard de Monitorização</h2>
        <p className="text-sm text-slate-500 mt-1">Resumo de entregas, riscos, obras em curso e evolução recente das erosões.</p>
      </div>

      {/* KPI Cards — tamanho compacto e proporcional */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Críticas', value: criticalCount, icon: 'alert', accent: 'text-red-700' },
          { label: 'Erosões', value: erosionCount, icon: 'alert', accent: 'text-slate-700' },
          { label: 'Vistorias', value: inspectionCount, icon: 'clipboard', accent: 'text-slate-700' },
          { label: 'Empreendimentos', value: projectCount, icon: 'building', accent: 'text-slate-700' },
        ].map(({ label, value, icon, accent }) => (
          <Card key={label} className="flex flex-col gap-1 p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <AppIcon name={icon} />
              {label}
            </div>
            <div className={`text-2xl font-bold ${accent}`}>{value}</div>
          </Card>
        ))}
      </div>

      {hasSearchFilter ? (
        <p className="text-xs text-slate-500 -mt-1">
          Filtro ativo: "{searchTermApplied}". Críticas e Erosões refletem o filtro; Vistorias e Empreendimentos mostram o total geral.
        </p>
      ) : null}

      <div className="grid gap-5 grid-cols-1 xl:grid-cols-2 items-start mt-4">
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

          <Card variant="nested" className="flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 m-0 mb-3">Acompanhamento mensal de entregas</h3>
            <p className="text-xs text-slate-500 mt-0 mb-3">Contagem mensal por projeto e competência.</p>
            <div className="flex flex-col gap-2 mt-4">
              {reportMonthRows.map(([monthKey, count]) => {
                const [year, monthNumber] = monthKey.split('-');
                const detailsId = `monitor-month-details-${monthKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                const isExpanded = expandedMonthKey === monthKey;
                const details = Array.isArray(reportMonthDetailsByKey?.[monthKey]) ? reportMonthDetailsByKey[monthKey] : [];
                return (
                  <div key={monthKey} className="flex flex-col border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      className={`flex items-center justify-between w-full px-4 py-3 transition-colors focus:outline-none ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'bg-white hover:bg-slate-50'}`}
                      aria-expanded={isExpanded ? 'true' : 'false'}
                      aria-controls={detailsId}
                      onClick={() => setExpandedMonthKey((prev) => (prev === monthKey ? null : monthKey))}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-800">{formatMonitoringMonthLabel(monthNumber)}/{year}</span>
                      </span>
                      <strong className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{count}</strong>
                    </button>
                    {isExpanded ? (
                      <div id={detailsId} className="flex flex-col p-4 bg-slate-50 gap-4" role="region" aria-label={`Detalhes de ${formatMonitoringMonthLabel(monthNumber)}/${year}`}>
                        {details.map((item) => {
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
                        {details.length === 0 && (
                          <p className="text-sm text-slate-500 italic">Nenhum empreendimento encontrado para este mês.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {reportMonthRows.length === 0 && <p className="text-sm text-slate-500">Sem entregas por mês para acompanhar.</p>}
            </div>
          </Card>

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
  const [deliveryTracking, setDeliveryTracking] = useState([]);
  const [users, setUsers] = useState([]);
  const [rulesConfig, setRulesConfig] = useState(() => normalizeRulesConfig(RULES_DATABASE));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
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
      (data) => setProjects(data),
      () => show('Erro ao carregar empreendimentos.', 'error'),
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
    const needsMonitoringData = activeTab === 'dashboard' || activeTab === 'followups';
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
      (data) => setRulesConfig(normalizeRulesConfig(data || RULES_DATABASE)),
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
          onCriticalityBarClick={(level) => {
            setCriticalityFilter(level);
            setActiveTab('erosions');
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
