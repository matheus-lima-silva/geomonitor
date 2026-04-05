import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Input, Modal, Select } from '../../../components/ui';
import { erosionStatusClass, normalizeErosionStatus } from '../../shared/statusUtils';
import {
  deriveErosionTypeFromTechnicalFields,
  EROSION_TECHNICAL_OPTIONS,
  getLocalContextLabel,
  isHistoricalErosionRecord,
  normalizeErosionTechnicalFields,
  normalizeFollowupEventType,
  normalizeFollowupHistory,
} from '../../shared/viewUtils';
import { normalizeLocationCoordinates, parseCoordinateNumber } from '../../shared/erosionCoordinates';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Tooltip,
  TileLayer,
} from 'react-leaflet';
import { compareTowerNumbers, formatTowerLabel } from '../../projects/utils/kmlUtils';
import {
  buildCriticalitySummaryFromErosion,
  formatCriticalityPoints,
} from '../../shared/criticalitySummary';
import { recalculateAndSaveErosion } from '../../../services/erosionService';
import { resolveErosionCriticality } from '../../../../shared/erosionHelpers';

const EMPTY_EVENT_FORM = {
  tipoEvento: 'obra',
  obraEtapa: 'Projeto',
  descricao: '',
  orgao: '',
  numeroOuDescricao: '',
  autuacaoStatus: 'Aberta',
};

function listValue(value) {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value.join(', ');
}

function buildLabelMap(options = []) {
  return (Array.isArray(options) ? options : []).reduce((acc, item) => {
    const key = String(item?.value || '').trim();
    if (key) acc[key] = String(item?.label || '').trim() || key;
    return acc;
  }, {});
}

function labelValue(value, labelMap = {}) {
  const key = String(value || '').trim();
  if (!key) return '-';
  if (labelMap[key]) return labelMap[key];
  return key.replace(/_/g, ' ');
}

function listLabelValue(value, labelMap = {}) {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value
    .map((item) => labelValue(item, labelMap))
    .join(', ');
}

const CLASS_RANGE_LABELS = {
  profundidade: {
    P1: '<= 1 m',
    P2: '> 1 a 10 m',
    P3: '> 10 a 30 m',
    P4: '> 30 m',
  },
  declividade: {
    D1: '< 10 graus',
    D2: '10 a 25 graus',
    D3: '25 a 45 graus',
    D4: '> 45 graus',
  },
  exposicao: {
    E1: '> 50 m',
    E2: '20 a 50 m',
    E3: '5 a < 20 m',
    E4: '< 5 m',
  },
};

const LEGACY_CLASS_CODE_ALIASES = {
  '<0.5': 'P1',
  '0.5-1.5': 'P2',
  '1.5-3.0': 'P3',
  '>3.0': 'P4',
  '<15': 'D1',
  '15-30': 'D2',
  '30-45': 'D3',
  '>45': 'D4',
};

function deriveDepthClass(value) {
  if (!Number.isFinite(value)) return '';
  if (value <= 1) return 'P1';
  if (value <= 10) return 'P2';
  if (value <= 30) return 'P3';
  return 'P4';
}

function deriveSlopeClass(value) {
  if (!Number.isFinite(value)) return '';
  if (value < 10) return 'D1';
  if (value <= 25) return 'D2';
  if (value <= 45) return 'D3';
  return 'D4';
}

function deriveExposureClass(value) {
  if (!Number.isFinite(value)) return '';
  if (value > 50) return 'E1';
  if (value >= 20) return 'E2';
  if (value >= 5) return 'E3';
  return 'E4';
}

function resolveClassCode(rawClassCode, rangeLabels, fallbackClassCode = '') {
  const raw = String(rawClassCode || '').trim();
  if (raw && rangeLabels[raw]) return raw;
  if (raw && LEGACY_CLASS_CODE_ALIASES[raw]) return LEGACY_CLASS_CODE_ALIASES[raw];
  return fallbackClassCode;
}

function formatClassWithRange(classCode, rangeLabels = {}) {
  const code = String(classCode || '').trim();
  if (!code) return '-';
  const range = rangeLabels[code];
  return range ? `${code} (${range})` : code;
}

function resolveHistoryUserLabel(usuario, currentUser) {
  const persistedValue = String(usuario || '').trim();
  if (!persistedValue) return '-';

  const currentEmail = String(currentUser?.email || '').trim().toLowerCase();
  const currentName = String(currentUser?.nome || '').trim();
  if (currentEmail && currentName && persistedValue.toLowerCase() === currentEmail) {
    return currentName;
  }

  return persistedValue;
}

function ErosionDetailsModal({
  open,
  erosion,
  project,
  relatedInspections = [],
  currentUser = null,
  hasCoordinates,
  onClose,
  onOpenMaps,
  onSaveManualEvent,
  onExportPdf,
  onExportSimplificadaPdf,
}) {
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowAddEventForm(false);
    setSavingEvent(false);
    setEventForm(EMPTY_EVENT_FORM);
    setShowMap(hasCoordinates(erosion));
  }, [open, erosion?.id, hasCoordinates, erosion]);

  useEffect(() => {
    if (!open || !erosion?.id) return;
    if (isHistoricalErosionRecord(erosion)) return;
    const breakdown = resolveErosionCriticality(erosion);
    const hasBreakdown = breakdown && typeof breakdown === 'object';
    const needsRecalc = !hasBreakdown || (breakdown.pontos && breakdown.pontos.A === undefined);
    if (!needsRecalc) return;
    recalculateAndSaveErosion(erosion).catch(() => {});
  }, [open, erosion?.criticalidade, erosion?.criticalidadeV2, erosion?.id]);

  const locationCoordinates = normalizeLocationCoordinates(erosion || {});
  const sortedHistory = useMemo(
    () => normalizeFollowupHistory(erosion?.acompanhamentosResumo)
      .slice()
      .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || ''))),
    [erosion?.acompanhamentosResumo],
  );
  const criticalityHistory = useMemo(
    () => (Array.isArray(erosion?.historicoCriticidade) ? erosion.historicoCriticidade : [])
      .slice()
      .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || ''))),
    [erosion?.historicoCriticidade],
  );

  const currentPoint = useMemo(() => {
    const lat = parseCoordinateNumber(locationCoordinates?.latitude);
    const lng = parseCoordinateNumber(locationCoordinates?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [locationCoordinates?.latitude, locationCoordinates?.longitude]);

  const nearbyTowerMarkers = useMemo(() => {
    const coords = Array.isArray(project?.torresCoordenadas) ? project.torresCoordenadas : [];
    if (coords.length === 0) return [];
    const towerRef = String(erosion?.torreRef || '').trim();
    if (!towerRef) return [];
    const towerCoordinates = coords
      .map((row) => {
        const towerNumber = String(row?.numero || '').trim();
        if (!towerNumber) return null;
        const lat = parseCoordinateNumber(row?.latitude);
        const lng = parseCoordinateNumber(row?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { towerNumber, position: [lat, lng] };
      })
      .filter(Boolean)
      .sort((a, b) => compareTowerNumbers(a.towerNumber, b.towerNumber));
    if (towerCoordinates.length === 0) return [];

    const selectedIdx = towerCoordinates.findIndex(
      (tower) => compareTowerNumbers(tower.towerNumber, towerRef) === 0,
    );
    if (selectedIdx < 0) return [];

    const visibleIndices = [selectedIdx - 1, selectedIdx, selectedIdx + 1]
      .filter((idx) => idx >= 0 && idx < towerCoordinates.length);

    return visibleIndices.map((idx) => {
      const tower = towerCoordinates[idx];
      return {
        key: `tower-${tower.towerNumber}-${idx}`,
        towerNumber: tower.towerNumber,
        position: tower.position,
        label: formatTowerLabel(tower.towerNumber),
        isSelected: idx === selectedIdx,
      };
    });
  }, [project?.torresCoordenadas, erosion?.torreRef]);

  const towerPoint = useMemo(() => {
    const selected = nearbyTowerMarkers.find((m) => m.isSelected);
    return selected ? selected.position : null;
  }, [nearbyTowerMarkers]);

  const linePath = useMemo(() => {
    const coords = Array.isArray(project?.linhaCoordenadas)
      ? project.linhaCoordenadas
      : (Array.isArray(project?.torresCoordenadas) ? project.torresCoordenadas : []);
    return coords
      .map((row) => {
        const lat = parseCoordinateNumber(row?.latitude);
        const lng = parseCoordinateNumber(row?.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      })
      .filter(Boolean);
  }, [project?.linhaCoordenadas, project?.torresCoordenadas]);

  const mapCenter = useMemo(() => {
    if (currentPoint) return currentPoint;
    if (towerPoint) return towerPoint;
    if (nearbyTowerMarkers.length > 0) return nearbyTowerMarkers[0].position;
    if (linePath.length > 0) return linePath[0];
    return [-15.793889, -47.882778];
  }, [currentPoint, towerPoint, nearbyTowerMarkers, linePath]);

  const mapZoom = currentPoint || towerPoint || nearbyTowerMarkers.length > 0 ? 15 : (linePath.length > 0 ? 12 : 5);
  const mapRenderKey = open && mapCenter ? `${mapCenter[0].toFixed(6)}-${mapCenter[1].toFixed(6)}-${mapZoom}` : 'off';

  const saturacaoPorAgua = String(erosion?.saturacaoPorAgua || '').trim();
  const technical = normalizeErosionTechnicalFields(erosion || {});
  const localContexto = technical.localContexto || {};
  const localTipoLabel = getLocalContextLabel(localContexto.localTipo) || '-';
  const isHistoricalRecord = isHistoricalErosionRecord(erosion);
  const usosSolo = technical.usosSolo;
  const tiposFeicao = technical.tiposFeicao;
  const derivedTipo = deriveErosionTypeFromTechnicalFields({ ...erosion, tiposFeicao });
  const criticalitySummary = buildCriticalitySummaryFromErosion(erosion || {});
  const criticalidade = resolveErosionCriticality(erosion || {});
  const alertasAtivos = criticalitySummary.alertas;
  const feicaoLabelMap = useMemo(() => buildLabelMap(EROSION_TECHNICAL_OPTIONS.tiposFeicao), []);
  const usoSoloLabelMap = useMemo(() => buildLabelMap(EROSION_TECHNICAL_OPTIONS.usosSolo), []);
  const presencaAguaLabelMap = useMemo(() => buildLabelMap(EROSION_TECHNICAL_OPTIONS.presencaAguaFundo), []);
  const saturacaoLabelMap = useMemo(() => buildLabelMap(EROSION_TECHNICAL_OPTIONS.saturacaoPorAgua), []);
  const soloLabelMap = useMemo(() => buildLabelMap(EROSION_TECHNICAL_OPTIONS.tipoSolo), []);
  const exposicaoLabelMap = useMemo(() => buildLabelMap(EROSION_TECHNICAL_OPTIONS.localizacaoExposicao), []);
  const estruturaLabelMap = useMemo(() => buildLabelMap(EROSION_TECHNICAL_OPTIONS.estruturaProxima), []);
  const profundidadeClasse = resolveClassCode(
    criticalidade?.profundidade_classe,
    CLASS_RANGE_LABELS.profundidade,
    deriveDepthClass(technical.profundidadeMetros),
  );
  const declividadeClasse = resolveClassCode(
    criticalidade?.declividade_classe,
    CLASS_RANGE_LABELS.declividade,
    deriveSlopeClass(technical.declividadeGraus),
  );
  const exposicaoClasse = resolveClassCode(
    criticalidade?.exposicao_classe,
    CLASS_RANGE_LABELS.exposicao,
    deriveExposureClass(technical.distanciaEstruturaMetros),
  );

  async function handleSaveEvent() {
    const tipo = String(eventForm.tipoEvento || '').trim();
    if (tipo === 'obra') {
      if (!String(eventForm.obraEtapa || '').trim()) return;
      if (!String(eventForm.descricao || '').trim()) return;
    } else if (tipo === 'autuacao') {
      if (!String(eventForm.orgao || '').trim()) return;
      if (!String(eventForm.numeroOuDescricao || '').trim()) return;
      if (!String(eventForm.autuacaoStatus || '').trim()) return;
    } else {
      return;
    }
    setSavingEvent(true);
    try {
      const ok = await onSaveManualEvent(eventForm);
      if (!ok) return;
      setShowAddEventForm(false);
      setEventForm(EMPTY_EVENT_FORM);
    } finally {
      setSavingEvent(false);
    }
  }

  if (!open || !erosion) return null;

  const footer = (
    <>
      <Button variant="primary" onClick={onExportPdf}>
        <AppIcon name="pdf" />
        Gerar PDF
      </Button>
      {onExportSimplificadaPdf ? (
        <Button variant="outline" onClick={onExportSimplificadaPdf}>
          <AppIcon name="pdf" />
          Ficha simplificada
        </Button>
      ) : null}
      <Button variant="outline" onClick={onClose}>
        <AppIcon name="close" />
        Fechar
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detalhes da erosão"
      size="xl"
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        <section className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <h4 className="text-base font-bold text-slate-800 m-0 border-b border-slate-100 pb-2 mb-4">Resumo</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
            <div><strong className="text-slate-900">ID:</strong> {erosion.id || '-'}</div>
            <div><strong className="text-slate-900">Empreendimento:</strong> {erosion.projetoId || '-'}</div>
            <div><strong className="text-slate-900">Nome:</strong> {project?.nome || '-'}</div>
            <div><strong className="text-slate-900">Torre:</strong> {erosion.torreRef || '-'}</div>
            <div><strong className="text-slate-900">Impacto:</strong> {erosion.impacto || '-'}</div>
            <div><strong className="text-slate-900">Registro:</strong> {isHistoricalRecord ? 'Histórico de acompanhamento' : 'Cadastro técnico completo'}</div>
            <div>
              <strong className="text-slate-900">Status:</strong>{' '}
              <span className={erosionStatusClass(erosion.status)}>
                {normalizeErosionStatus(erosion.status)}
              </span>
            </div>
            {isHistoricalRecord ? (
              <div className="md:col-span-2"><strong className="text-slate-900">Intervenção já realizada:</strong> {erosion.intervencaoRealizada || erosion.intervencao || '-'}</div>
            ) : null}
            <div><strong className="text-slate-900">Vistoria principal:</strong> {erosion.vistoriaId || '-'}</div>
            <div><strong className="text-slate-900">Vistorias vinculadas:</strong> {Array.isArray(erosion.vistoriaIds) ? erosion.vistoriaIds.join(', ') || '-' : '-'}</div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <h4 className="text-base font-bold text-slate-800 m-0 border-b border-slate-100 pb-2 mb-4">Classificacao e caracterizacao consolidada</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700">
            {isHistoricalRecord ? (
              <div className="col-span-full bg-amber-50 text-amber-900 p-3 rounded-lg border border-amber-100">
                Este registro foi salvo como histórico de acompanhamento. A criticidade técnica pode não existir porque a intervenção já havia sido executada antes do cadastro.
              </div>
            ) : null}
            <div><strong className="text-slate-900">Tipo:</strong> {labelValue(derivedTipo, feicaoLabelMap)}</div>
            <div><strong className="text-slate-900">Grau erosivo:</strong> {erosion.estagio || '-'}</div>
            <div><strong className="text-slate-900">Local:</strong> {localTipoLabel}</div>
            {localContexto.localTipo === 'outros' ? (
              <div className="col-span-full"><strong className="text-slate-900">Detalhe local:</strong> {localContexto.localDescricao || '-'}</div>
            ) : null}
            <div>
              <strong className="text-slate-900">Profundidade (faixa informada):</strong>{' '}
              {formatClassWithRange(profundidadeClasse, CLASS_RANGE_LABELS.profundidade)}
            </div>
            <div>
              <strong className="text-slate-900">Declividade (faixa informada):</strong>{' '}
              {formatClassWithRange(declividadeClasse, CLASS_RANGE_LABELS.declividade)}
            </div>
            <div>
              <strong className="text-slate-900">Distancia da estrutura (faixa informada):</strong>{' '}
              {formatClassWithRange(exposicaoClasse, CLASS_RANGE_LABELS.exposicao)}
            </div>
            <div><strong className="text-slate-900">Presenca de agua no fundo:</strong> {labelValue(technical.presencaAguaFundo, presencaAguaLabelMap)}</div>
            <div><strong className="text-slate-900">Saturacao por agua:</strong> {labelValue(saturacaoPorAgua, saturacaoLabelMap)}</div>
            <div><strong className="text-slate-900">Tipo de solo:</strong> {labelValue(technical.tipoSolo, soloLabelMap)}</div>
            <div><strong className="text-slate-900">Localizacao de exposicao:</strong> {labelValue(localContexto.exposicao, exposicaoLabelMap)}</div>
            <div><strong className="text-slate-900">Estrutura proxima:</strong> {labelValue(localContexto.estruturaProxima, estruturaLabelMap)}</div>
            <div><strong className="text-slate-900">Sinais de avanco:</strong> {technical.sinaisAvanco ? 'Sim' : 'Nao'}</div>
            <div><strong className="text-slate-900">Vegetacao interior:</strong> {technical.vegetacaoInterior ? 'Sim' : 'Nao'}</div>
            <div className="col-span-full"><strong className="text-slate-900">Tipos de feicao:</strong> {listLabelValue(tiposFeicao, feicaoLabelMap)}</div>
            <div className="col-span-full"><strong className="text-slate-900">Usos do solo:</strong> {listLabelValue(usosSolo, usoSoloLabelMap)}</div>
            {usosSolo.includes('outro') ? (
              <div className="col-span-full"><strong className="text-slate-900">Uso do solo - outro:</strong> {erosion.usoSoloOutro || '-'}</div>
            ) : null}
            {technical.dimensionamento ? (
              <div className="col-span-full whitespace-pre-wrap"><strong className="text-slate-900">Dimensionamento preliminar:</strong> {technical.dimensionamento}</div>
            ) : null}
            <div className="col-span-full bg-slate-50 p-3 rounded-lg border border-slate-100">
              <strong className="text-slate-900">Resumo de criticidade calculada:</strong>{' '}
              Impacto: {criticalitySummary.impacto} | Score: {criticalitySummary.score} | Frequencia: {criticalitySummary.frequencia}
            </div>
            {criticalitySummary.hasBreakdown ? (
              <div className="col-span-full">
                <strong className="text-slate-900">Criticidade:</strong> {criticalitySummary.criticidadeClasse} ({criticalitySummary.criticidadeCodigo}) | Pontos T/P/D/S/E/A: {formatCriticalityPoints(criticalidade?.pontos)}
              </div>
            ) : null}
            {criticalitySummary.solucoesSugeridas.length > 0 ? (
              <div className="col-span-full">
                <strong className="text-slate-900">Solucoes sugeridas:</strong> {criticalitySummary.solucoesSugeridas.join(' | ')}
              </div>
            ) : null}
            {criticalitySummary.sugestoesIntervencao.length > 0 ? (
              <div className="col-span-full">
                <strong className="text-slate-900">Sugestoes de intervencao (opcional):</strong> {criticalitySummary.sugestoesIntervencao.join(' | ')}
              </div>
            ) : null}
            {criticalidade ? (
              <>
                <div><strong className="text-slate-900">Classe tipo erosao:</strong> {criticalidade.tipo_erosao_classe || '-'}</div>
                <div><strong className="text-slate-900">Classe profundidade:</strong> {criticalidade.profundidade_classe || '-'}</div>
                <div><strong className="text-slate-900">Classe declividade:</strong> {criticalidade.declividade_classe || '-'}</div>
                <div><strong className="text-slate-900">Classe solo:</strong> {criticalidade.solo_classe || '-'}</div>
                <div><strong className="text-slate-900">Classe exposicao:</strong> {criticalidade.exposicao_classe || '-'}</div>
                <div><strong className="text-slate-900">Classe atividade:</strong> {criticalidade.atividade_classe || '-'}</div>
                <div><strong className="text-slate-900">Modificador de via:</strong> {criticalidade.pontos?.V ?? 0}</div>
                <div className="col-span-full bg-indigo-50 text-indigo-900 p-3 rounded-lg border border-indigo-100">
                  <strong className="font-bold">Tipo de medida recomendada:</strong> {labelValue(criticalidade.tipo_medida_recomendada, {})}
                </div>
                {criticalitySummary.regraContextual ? (
                  <div className="col-span-full">
                    <strong className="text-slate-900">Regra contextual:</strong> {criticalitySummary.regraContextual}
                  </div>
                ) : null}
              </>
            ) : null}
            {alertasAtivos.length > 0 ? (
              <div className="col-span-full text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100"><strong className="font-bold">Alertas ativos:</strong> {alertasAtivos.join(' | ')}</div>
            ) : null}
            <div className="col-span-full whitespace-pre-wrap"><strong className="text-slate-900">Observacoes:</strong> {erosion.obs || '-'}</div>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 text-sm">
            <strong className="text-slate-900 block mb-2">Fotos (links):</strong>
            {Array.isArray(erosion.fotosLinks) && erosion.fotosLinks.length > 0 ? (
              <ul className="list-disc pl-5 m-0 space-y-1 text-brand-600">
                {erosion.fotosLinks.map((link) => (
                  <li key={link}>
                    <a href={link} target="_blank" rel="noreferrer" className="hover:underline hover:text-brand-800 break-all">{link}</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 m-0">Sem links de fotos.</p>
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <h4 className="text-base font-bold text-slate-800 m-0 border-b border-slate-100 pb-2 mb-4">Localizacao geografica</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-700">
            <div><strong className="text-slate-900">Latitude:</strong> {locationCoordinates.latitude || '-'}</div>
            <div><strong className="text-slate-900">Longitude:</strong> {locationCoordinates.longitude || '-'}</div>
            <div><strong className="text-slate-900">UTM Easting:</strong> {locationCoordinates.utmEasting || '-'}</div>
            <div><strong className="text-slate-900">UTM Northing:</strong> {locationCoordinates.utmNorthing || '-'}</div>
            <div><strong className="text-slate-900">UTM Zona:</strong> {locationCoordinates.utmZone || '-'}</div>
            <div><strong className="text-slate-900">Hemisferio:</strong> {locationCoordinates.utmHemisphere || '-'}</div>
            <div><strong className="text-slate-900">Altitude:</strong> {locationCoordinates.altitude || '-'}</div>
            <div><strong className="text-slate-900">Referencia:</strong> {locationCoordinates.reference || '-'}</div>
          </div>
          {hasCoordinates(erosion) ? (
            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => onOpenMaps(erosion)}>
                <AppIcon name="map" />
                Traçar rota
              </Button>
            </div>
          ) : null}

          {showMap ? (
            <div id="erosion-details-map" className="mt-4 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <div style={{ height: 280 }}>
                <MapContainer
                  key={mapRenderKey}
                  center={mapCenter}
                  zoom={mapZoom}
                  scrollWheelZoom={false}
                  zoomControl={false}
                  dragging={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                  preferCanvas
                  style={{ width: '100%', height: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                    maxZoom={17}
                  />
                  {linePath.length >= 2 ? (
                    <Polyline positions={linePath} pathOptions={{ color: '#0f766e', weight: 3, opacity: 0.75, dashArray: '6 4' }} />
                  ) : null}
                  {nearbyTowerMarkers.map((marker) => (
                    <CircleMarker
                      key={marker.key}
                      center={marker.position}
                      radius={marker.isSelected ? 8 : 6}
                      pathOptions={{
                        fillColor: marker.isSelected ? '#f59e0b' : '#22c55e',
                        color: marker.isSelected ? '#0f172a' : '#14532d',
                        weight: 2,
                        fillOpacity: 0.9,
                      }}
                    >
                      <Tooltip permanent direction="top" offset={[0, -8]}>
                        {marker.label}
                      </Tooltip>
                    </CircleMarker>
                  ))}
                  {currentPoint ? (
                    <CircleMarker
                      center={currentPoint}
                      radius={9}
                      pathOptions={{ fillColor: '#3b82f6', color: '#1d4ed8', weight: 2, fillOpacity: 0.9 }}
                    />
                  ) : null}
                </MapContainer>
              </div>
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-700" /> Erosão</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-amber-500 border-2 border-slate-900" /> Torre selecionada</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-green-500 border-2 border-green-900" /> Torres vizinhas</span>
                {linePath.length >= 2 ? <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-teal-700" /> Linha de transmissão</span> : null}
              </div>
            </div>
          ) : null}
        </section>

        {relatedInspections.length > 0 ? (
          <section className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
            <h4 className="text-base font-bold text-slate-800 m-0 border-b border-slate-100 pb-2 mb-4">Vistorias que abordaram esta erosao</h4>
            <div className="flex flex-col gap-2">
              {relatedInspections.map((row) => (
                <div key={`related-inspection-${row.id}`} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                  <strong className="text-slate-900">{row.id}</strong>
                  {row.inspection?.dataInicio ? ` | inicio: ${row.inspection.dataInicio}` : ''}
                  {row.inspection?.dataFim ? ` | fim: ${row.inspection.dataFim}` : ''}
                  {row.inspection?.responsavel ? ` | resp.: ${row.inspection.responsavel}` : ''}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <h4 className="text-base font-bold text-slate-800 m-0 border-b border-slate-100 pb-2 mb-4">Historico tecnico de criticidade</h4>
          <div className="pl-4 py-2 border-l-2 border-slate-100 flex flex-col gap-4">
            {criticalityHistory.map((item, index) => (
              <article key={`${item.timestamp || 'criticality'}-${index}`} className="relative pl-6 before:absolute before:left-[-21px] before:top-1.5 before:w-2 before:h-2 before:rounded-full before:bg-slate-300">
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <strong className="text-slate-800">{item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '-'}</strong>
                    <Badge tone="neutral" size="sm">{item.situacao || '-'}</Badge>
                  </div>
                  <div className="text-slate-700">
                    Data vistoria: {item.data_vistoria || '-'} | Score anterior: {item.score_anterior ?? '-'} | Score atual: {item.score_atual ?? '-'}
                  </div>
                  <div className="text-slate-500 mt-1">
                    Tendencia: {item.tendencia || '-'} | Intervencao realizada: {item.intervencao_realizada || '-'}
                  </div>
                </div>
              </article>
            ))}
            {criticalityHistory.length === 0 ? <p className="text-sm text-slate-500 m-0 py-2">Sem historico tecnico de criticidade.</p> : null}
          </div>
        </section>

        <section className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-6">
            <h4 className="text-base font-bold text-slate-800 m-0">Historico de acompanhamento</h4>
            <Button
              variant={showAddEventForm ? 'outline' : 'primary'}
              size="sm"
              onClick={() => {
                setShowAddEventForm((prev) => !prev);
                if (showAddEventForm) setEventForm(EMPTY_EVENT_FORM);
              }}
            >
              <AppIcon name={showAddEventForm ? 'close' : 'plus'} />
              {showAddEventForm ? 'Cancelar evento' : 'Adicionar evento'}
            </Button>
          </div>

          {showAddEventForm ? (
            <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-xl mb-6 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  id="event-tipo"
                  label="Tipo de evento"
                  value={eventForm.tipoEvento}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, tipoEvento: e.target.value }))}
                >
                  <option value="obra">Obra</option>
                  <option value="autuacao">Autuação por órgão público</option>
                </Select>
                {eventForm.tipoEvento === 'obra' ? (
                  <Select
                    id="event-obra-etapa"
                    label="Etapa da obra *"
                    value={eventForm.obraEtapa}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, obraEtapa: e.target.value }))}
                  >
                    <option value="Projeto">Projeto</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Concluida">Concluída</option>
                  </Select>
                ) : (
                  <Select
                    id="event-autuacao-status"
                    label="Status da autuação *"
                    value={eventForm.autuacaoStatus}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, autuacaoStatus: e.target.value }))}
                  >
                    <option value="Aberta">Aberta</option>
                    <option value="Recorrida">Recorrida</option>
                    <option value="Encerrada">Encerrada</option>
                  </Select>
                )}
              </div>

              {eventForm.tipoEvento === 'obra' ? (
                <label className="flex flex-col gap-1 w-full text-sm font-semibold text-slate-700">
                  <span>Descricao da obra *</span>
                  <textarea
                    rows="2"
                    className="w-full px-3 py-2 text-sm font-normal border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                    value={eventForm.descricao}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, descricao: e.target.value }))}
                  />
                </label>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    id="event-orgao"
                    label="Órgão público *"
                    value={eventForm.orgao}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, orgao: e.target.value }))}
                  />
                  <Input
                    id="event-numero"
                    label="Nº/Descrição *"
                    value={eventForm.numeroOuDescricao}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, numeroOuDescricao: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 justify-end mt-2 pt-4 border-t border-indigo-200/50">
                <Button variant="primary" size="sm" onClick={handleSaveEvent} disabled={savingEvent}>
                  <AppIcon name="save" />
                  {savingEvent ? 'Salvando...' : 'Salvar evento'}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="pl-4 py-2 border-l-2 border-slate-100 flex flex-col gap-5">
            {sortedHistory.map((item, index) => {
              const itemType = normalizeFollowupEventType(item);
              const typeLabel = itemType === 'obra' ? 'Obra' : (itemType === 'autuacao' ? 'Autuacao' : 'Sistema');
              const markerColor = itemType === 'obra' ? 'bg-indigo-400' : (itemType === 'autuacao' ? 'bg-amber-400' : 'bg-slate-300');
              const userLabel = resolveHistoryUserLabel(item.usuario, currentUser);

              return (
                <article key={`${item.timestamp}-${index}`} className={`relative pl-6 before:absolute before:left-[-21px] before:top-2.5 before:w-2 before:h-2 before:rounded-full ${markerColor}`}>
                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-sm flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-slate-800">{item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '-'}</strong>
                      <Badge tone={itemType === 'obra' ? 'ok' : (itemType === 'autuacao' ? 'warning' : 'neutral')} size="sm">{typeLabel}</Badge>
                    </div>
                    <div className="text-slate-700">{item.resumo || '-'}</div>
                    {itemType === 'obra' ? (
                      <div className="text-slate-500">Etapa: {item.obraEtapa || '-'} | Descricao: {item.descricao || '-'}</div>
                    ) : null}
                    {itemType === 'autuacao' ? (
                      <div className="text-slate-500">
                        Orgao: {item.orgao || '-'} | No/Descricao: {item.numeroOuDescricao || '-'} | Status: {item.autuacaoStatus || '-'}
                      </div>
                    ) : null}
                    <div className="text-slate-400 text-xs mt-1 pt-2 border-t border-slate-100 font-medium">
                      Origem: {item.origem || '-'} | Usuario: {userLabel} | Status da erosao: {item.statusNovo || '-'}
                    </div>
                  </div>
                </article>
              );
            })}
            {sortedHistory.length === 0 ? <p className="text-sm text-slate-500 m-0 py-2">Sem historico de acompanhamento.</p> : null}
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default ErosionDetailsModal;
