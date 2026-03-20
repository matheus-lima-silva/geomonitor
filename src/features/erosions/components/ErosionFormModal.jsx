import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select, Textarea } from '../../../components/ui';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';
import { compareTowerNumbers, formatTowerLabel } from '../../projects/utils/kmlUtils';
import {
  hasValidDecimalCoordinates,
  isCompleteUtmCoordinates,
  isPartialUtmCoordinates,
  parseCoordinateNumber,
  resolveLocationCoordinatesForSave,
} from '../../shared/erosionCoordinates';
import {
  buildCriticalitySummaryFromCalculation,
  formatCriticalityPoints,
} from '../../shared/criticalitySummary';
import { isHistoricalErosionRecord } from '../../shared/viewUtils';
import ErosionTechnicalFields from './ErosionTechnicalFields';

function MapClickPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick?.(event?.latlng?.lat, event?.latlng?.lng);
    },
  });
  return null;
}

function hasAnyLocationValue(locationCoordinates = {}) {
  return [
    locationCoordinates.latitude,
    locationCoordinates.longitude,
    locationCoordinates.utmEasting,
    locationCoordinates.utmNorthing,
    locationCoordinates.utmZone,
    locationCoordinates.utmHemisphere,
    locationCoordinates.altitude,
    locationCoordinates.reference,
  ].some((value) => String(value || '').trim() !== '');
}

function getCoordinatesStatus(locationCoordinates = {}) {
  if (isCompleteUtmCoordinates(locationCoordinates)) return 'UTM completo';
  if (isPartialUtmCoordinates(locationCoordinates)) return 'UTM incompleto';

  const latitude = parseCoordinateNumber(locationCoordinates.latitude);
  const longitude = parseCoordinateNumber(locationCoordinates.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return 'Decimal';

  return 'Nao preenchido';
}

function ErosionFormModal({
  open,
  isEditing,
  formData,
  setFormData,
  projects = [],
  inspections = [],
  criticality,
  onCancel,
  onSave,
  utmErrorToken = 0,
  validationErrors = {},
}) {
  const [coordinatesExpanded, setCoordinatesExpanded] = useState(false);
  const [showInteractiveMap, setShowInteractiveMap] = useState(false);
  const safeFormData = formData && typeof formData === 'object' ? formData : {};
  const safeProjects = Array.isArray(projects) ? projects.filter((item) => item && typeof item === 'object') : [];
  const safeInspections = Array.isArray(inspections) ? inspections.filter((item) => item && typeof item === 'object') : [];
  const safeCriticality = criticality || {
    impacto: 'Baixo',
    score: 0,
    frequencia: '24 meses',
    intervencao: 'Monitoramento visual',
    breakdown: null,
  };
  const criticalityBreakdown = safeCriticality.breakdown && typeof safeCriticality.breakdown === 'object'
    ? safeCriticality.breakdown
    : null;
  const criticalitySummary = buildCriticalitySummaryFromCalculation(safeCriticality);
  const isHistoricalRecord = isHistoricalErosionRecord(safeFormData);

  const locationCoordinates = {
    latitude: '',
    longitude: '',
    utmEasting: '',
    utmNorthing: '',
    utmZone: '',
    utmHemisphere: '',
    altitude: '',
    reference: '',
    ...(safeFormData.locationCoordinates || {}),
  };

  const coordinatesStatus = useMemo(
    () => getCoordinatesStatus(locationCoordinates),
    [
      locationCoordinates.latitude,
      locationCoordinates.longitude,
      locationCoordinates.utmEasting,
      locationCoordinates.utmNorthing,
      locationCoordinates.utmZone,
      locationCoordinates.utmHemisphere,
    ],
  );

  useEffect(() => {
    if (!open) return;
    setCoordinatesExpanded(hasAnyLocationValue(locationCoordinates));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeFormData.id, open]);

  useEffect(() => {
    if (!open) setShowInteractiveMap(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!utmErrorToken) return;
    setCoordinatesExpanded(true);
  }, [open, utmErrorToken]);

  useEffect(() => {
    if (!open || !coordinatesExpanded) return;
    const lat = parseCoordinateNumber(locationCoordinates.latitude);
    const lng = parseCoordinateNumber(locationCoordinates.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setShowInteractiveMap(true);
    }
  }, [open, coordinatesExpanded, locationCoordinates.latitude, locationCoordinates.longitude]);

  const readOnlyClasses = criticalityBreakdown
    ? {
      profundidadeClasse: criticalityBreakdown.profundidade_classe || '',
      declividadeClasse: criticalityBreakdown.declividade_classe || '',
      exposicaoClasse: criticalityBreakdown.exposicao_classe || '',
    }
    : null;
  const selectedProject = useMemo(
    () => safeProjects.find((project) => String(project?.id || '').trim() === String(safeFormData.projetoId || '').trim()) || null,
    [safeProjects, safeFormData.projetoId],
  );
  const towerOptions = useMemo(() => {
    const currentTower = String(safeFormData.torreRef || '').trim();
    const projectTowers = Array.isArray(selectedProject?.torresCoordenadas)
      ? [...new Set(
        selectedProject.torresCoordenadas
          .map((row) => String(row?.numero || '').trim())
          .filter(Boolean),
      )].sort(compareTowerNumbers)
      : [];

    if (projectTowers.length > 0) {
      if (currentTower && !projectTowers.includes(currentTower)) {
        return [currentTower, ...projectTowers];
      }
      return projectTowers;
    }

    const totalTowers = Number(selectedProject?.torres || 0);

    if (!Number.isFinite(totalTowers) || totalTowers < 0 || totalTowers > 5000) {
      return currentTower ? [currentTower] : [];
    }

    const options = [];
    for (let tower = 0; tower <= totalTowers; tower += 1) {
      options.push(String(tower));
    }

    if (currentTower && !options.includes(currentTower)) {
      options.unshift(currentTower);
    }

    return options;
  }, [selectedProject?.torres, selectedProject?.torresCoordenadas, safeFormData.torreRef]);

  const currentPoint = useMemo(() => {
    const lat = parseCoordinateNumber(locationCoordinates.latitude);
    const lng = parseCoordinateNumber(locationCoordinates.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [locationCoordinates.latitude, locationCoordinates.longitude]);

  const nearbyTowerMarkers = useMemo(() => {
    const coords = Array.isArray(selectedProject?.torresCoordenadas) ? selectedProject.torresCoordenadas : [];
    if (coords.length === 0) return [];
    const towerRef = String(safeFormData.torreRef || '').trim();
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
  }, [selectedProject?.torresCoordenadas, safeFormData.torreRef]);

  const towerPoint = useMemo(() => {
    const selected = nearbyTowerMarkers.find((m) => m.isSelected);
    return selected ? selected.position : null;
  }, [nearbyTowerMarkers]);

  const linePath = useMemo(() => {
    const coords = Array.isArray(selectedProject?.linhaCoordenadas)
      ? selectedProject.linhaCoordenadas
      : (Array.isArray(selectedProject?.torresCoordenadas) ? selectedProject.torresCoordenadas : []);
    return coords
      .map((row) => {
        const lat = parseCoordinateNumber(row?.latitude);
        const lng = parseCoordinateNumber(row?.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      })
      .filter(Boolean);
  }, [selectedProject?.linhaCoordenadas, selectedProject?.torresCoordenadas]);

  const mapCenter = useMemo(() => {
    if (currentPoint) return currentPoint;
    if (towerPoint) return towerPoint;
    if (nearbyTowerMarkers.length > 0) return nearbyTowerMarkers[0].position;
    if (linePath.length > 0) return linePath[0];
    return [-15.793889, -47.882778];
  }, [currentPoint, towerPoint, nearbyTowerMarkers, linePath]);

  const mapZoom = currentPoint || towerPoint || nearbyTowerMarkers.length > 0 ? 15 : (linePath.length > 0 ? 12 : 5);
  const mapRenderKey = `${mapCenter[0].toFixed(6)}-${mapCenter[1].toFixed(6)}-${mapZoom}`;

  if (!open) return null;

  function updateField(field, value) {
    setFormData((prev) => ({
      ...((prev && typeof prev === 'object') ? prev : {}),
      [field]: value,
    }));
  }

  function updateLocationField(field, value) {
    setFormData((prev) => ({
      ...((prev && typeof prev === 'object') ? prev : {}),
      locationCoordinates: {
        ...(((prev && typeof prev === 'object') ? prev : {}).locationCoordinates || {}),
        [field]: value,
      },
    }));
  }

  function applyDecimalCoordinates(latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const nextLatitude = Number(latitude).toFixed(6);
    const nextLongitude = Number(longitude).toFixed(6);
    setCoordinatesExpanded(true);
    setFormData((prev) => {
      const source = (prev && typeof prev === 'object') ? prev : {};
      return {
        ...source,
        locationCoordinates: {
          ...(source.locationCoordinates || {}),
          latitude: nextLatitude,
          longitude: nextLongitude,
        },
      };
    });
  }

  function handleUseTowerCoordinates() {
    if (!towerPoint) return;
    applyDecimalCoordinates(towerPoint[0], towerPoint[1]);
  }

  function handleMapPick(latitude, longitude) {
    applyDecimalCoordinates(latitude, longitude);
  }

  function handleStatusChange(value) {
    setFormData((prev) => ({
      ...((prev && typeof prev === 'object') ? prev : {}),
      status: value,
      registroHistorico: value === 'Estabilizado'
        ? true
        : Boolean(((prev && typeof prev === 'object') ? prev : {}).registroHistorico),
    }));
  }

  function toggleHistoricalRecord(enabled) {
    setFormData((prev) => {
      const source = (prev && typeof prev === 'object') ? prev : {};
      const currentStatus = String(source.status || '').trim() || 'Ativo';
      return {
        ...source,
        registroHistorico: enabled,
        status: enabled
          ? (currentStatus === 'Ativo' ? 'Monitoramento' : currentStatus)
          : (currentStatus === 'Estabilizado' ? 'Monitoramento' : currentStatus),
      };
    });
  }

  const footer = (
    <>
      <Button variant="outline" size="md" onClick={onCancel}>
        <AppIcon name="close" />
        Cancelar
      </Button>
      <Button variant="primary" size="md" onClick={onSave}>
        <AppIcon name="save" />
        Salvar
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`${isEditing ? 'Editar' : 'Nova'} Erosão`}
      size="lg"
      footer={footer}
    >
      <section className="flex flex-col gap-4 mb-8">
        <h4 className="text-lg font-semibold text-slate-800 m-0">Cadastro</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            id="erosion-id"
            label="ID"
            value={safeFormData.id || ''}
            disabled
          />
          <Select
            id="erosion-projeto"
            label="Empreendimento *"
            value={safeFormData.projetoId || ''}
            onChange={(e) => updateField('projetoId', e.target.value)}
            error={validationErrors.projetoId}
          >
            <option value="">Selecione...</option>
            {safeProjects.map((project, index) => (
              <option key={String(project?.id || `project-${index}`)} value={String(project?.id || '')}>
                {String(project?.id || '')}
              </option>
            ))}
          </Select>
          <Select
            id="erosion-vistoria"
            label="Vistoria"
            value={safeFormData.vistoriaId || ''}
            onChange={(e) => {
              const nextInspection = String(e.target.value || '').trim();
              const currentIds = Array.isArray(safeFormData.vistoriaIds) ? safeFormData.vistoriaIds : [];
              const nextIds = [...new Set([...currentIds, nextInspection].filter(Boolean))];
              setFormData((prev) => ({
                ...((prev && typeof prev === 'object') ? prev : {}),
                vistoriaId: nextInspection,
                vistoriaIds: nextIds,
              }));
            }}
          >
            <option value="">Selecione...</option>
            {safeInspections
              .filter((inspection) => String(inspection?.projetoId || '').trim() === String(safeFormData.projetoId || '').trim())
              .map((inspection, index) => (
                <option key={String(inspection?.id || `inspection-${index}`)} value={String(inspection?.id || '')}>
                  {String(inspection?.id || '')}
                </option>
              ))}
          </Select>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 flex flex-col gap-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={isHistoricalRecord}
              onChange={(e) => toggleHistoricalRecord(e.target.checked)}
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-amber-950">Cadastro apenas para histórico de acompanhamento</span>
              <span className="text-sm text-amber-900">
                Esse modo também é ativado automaticamente quando o status for <strong>Estabilizado</strong>.
              </span>
            </div>
          </label>

          {isHistoricalRecord ? (
            <Textarea
              id="erosion-historical-note"
              label="Intervenção já realizada / contexto histórico *"
              rows={3}
              value={safeFormData.intervencaoRealizada || ''}
              onChange={(e) => updateField('intervencaoRealizada', e.target.value)}
              error={validationErrors.intervencaoRealizada}
              placeholder="Ex.: drenagem e reconformação executadas em 2024; cadastro mantido apenas para acompanhamento."
            />
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4 mb-8">
        <h4 className="text-lg font-semibold text-slate-800 m-0">Grau erosivo e caracterização técnica</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {towerOptions.length > 0 ? (
            <Select
              id="erosion-torre"
              label="Torre ref. *"
              value={safeFormData.torreRef || ''}
              onChange={(e) => updateField('torreRef', e.target.value)}
              error={validationErrors.torreRef}
            >
              <option value="">Selecione...</option>
              {towerOptions.map((tower) => (
                <option key={`tower-option-${tower}`} value={tower}>
                  {tower === '0' ? 'Pórtico (T0)' : `Torre ${tower}`}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="erosion-torre-input"
              label="Torre ref. *"
              value={safeFormData.torreRef || ''}
              onChange={(e) => updateField('torreRef', e.target.value)}
              error={validationErrors.torreRef}
            />
          )}
          <Select
            id="erosion-estagio"
            label={isHistoricalRecord ? 'Grau erosivo' : 'Grau erosivo *'}
            value={safeFormData.estagio || ''}
            onChange={(e) => updateField('estagio', e.target.value)}
            error={validationErrors.estagio}
          >
            <option value="">Selecione...</option>
            <option value="inicial">Inicial</option>
            <option value="intermediario">Intermediário</option>
            <option value="avancado">Avançado</option>
            <option value="critico">Crítico</option>
          </Select>
          <Select
            id="erosion-status"
            label="Status"
            value={safeFormData.status || 'Ativo'}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="Ativo">Ativo</option>
            <option value="Monitoramento">Monitoramento</option>
            <option value="Estabilizado">Estabilizado (histórico)</option>
          </Select>
        </div>

        <ErosionTechnicalFields
          formData={safeFormData}
          readOnlyClasses={readOnlyClasses}
          validationErrors={validationErrors}
          isHistoricalRecord={isHistoricalRecord}
          onPatch={(patch) => {
            setFormData((prev) => ({
              ...((prev && typeof prev === 'object') ? prev : {}),
              ...patch,
            }));
          }}
        />
      </section>

      <section className="flex flex-col gap-4 mb-8">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h4 className="text-lg font-semibold text-slate-800 m-0">Localização geográfica</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCoordinatesExpanded((prev) => !prev)}
            aria-expanded={coordinatesExpanded ? 'true' : 'false'}
          >
            <span>{coordinatesStatus}</span>
            <AppIcon name={coordinatesExpanded ? 'chevron-up' : 'chevron-down'} />
          </Button>
        </div>

        {coordinatesExpanded ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="erosion-lat"
                label="Latitude (centesimal)"
                value={locationCoordinates.latitude}
                onChange={(e) => updateLocationField('latitude', e.target.value)}
                placeholder="-22.951958"
              />
              <Input
                id="erosion-lng"
                label="Longitude (centesimal)"
                value={locationCoordinates.longitude}
                onChange={(e) => updateLocationField('longitude', e.target.value)}
                placeholder="-43.210602"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowInteractiveMap((prev) => !prev)}
              >
                <AppIcon name="map" />
                {showInteractiveMap ? 'Fechar mapa interativo' : 'Abrir mapa interativo (relevo)'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleUseTowerCoordinates}
                disabled={!towerPoint}
              >
                <AppIcon name="route" />
                Usar coordenada da torre
              </Button>
              {!towerPoint ? (
                <span className="text-xs text-slate-500">
                  Sem coordenada de torre.
                </span>
              ) : null}
            </div>

            {showInteractiveMap ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  Clique no mapa para definir latitude/longitude.
                </div>
                <div style={{ width: '100%', height: 320 }}>
                  <MapContainer
                    key={mapRenderKey}
                    center={mapCenter}
                    zoom={mapZoom}
                    maxZoom={17}
                    scrollWheelZoom
                    style={{ width: '100%', height: '100%' }}
                  >
                    <TileLayer
                      attribution="Map data: OpenStreetMap contributors | Style: OpenTopoMap"
                      url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                      maxZoom={17}
                      maxNativeZoom={17}
                    />
                    {linePath.length >= 2 ? (
                      <Polyline positions={linePath} pathOptions={{ color: '#0f766e', weight: 3, opacity: 0.75, dashArray: '6 4' }} />
                    ) : null}
                    {nearbyTowerMarkers.map((tower) => (
                      <CircleMarker
                        key={tower.key}
                        center={tower.position}
                        radius={tower.isSelected ? 8 : 6}
                        pathOptions={tower.isSelected
                          ? { color: '#0f172a', fillColor: '#f59e0b', fillOpacity: 0.9, weight: 2 }
                          : { color: '#14532d', fillColor: '#22c55e', fillOpacity: 0.82, weight: 2 }}
                      >
                        <Tooltip permanent direction="top" offset={[0, -8]}>{`T${tower.towerNumber}`}</Tooltip>
                        <Popup>{`${formatTowerLabel(tower.towerNumber)} ${tower.isSelected ? '(selecionada)' : '(vizinha)'}`}</Popup>
                      </CircleMarker>
                    ))}
                    {currentPoint ? (
                      <CircleMarker
                        center={currentPoint}
                        radius={9}
                        pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.95, weight: 2 }}
                      >
                        <Popup>Ponto selecionado</Popup>
                      </CircleMarker>
                    ) : null}
                    <MapClickPicker onPick={handleMapPick} />
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                id="erosion-utm-e"
                label="UTM Easting"
                value={locationCoordinates.utmEasting}
                onChange={(e) => updateLocationField('utmEasting', e.target.value)}
              />
              <Input
                id="erosion-utm-n"
                label="UTM Northing"
                value={locationCoordinates.utmNorthing}
                onChange={(e) => updateLocationField('utmNorthing', e.target.value)}
              />
              <Input
                id="erosion-utm-zone"
                label="UTM Zona"
                value={locationCoordinates.utmZone}
                onChange={(e) => updateLocationField('utmZone', e.target.value)}
              />
              <Select
                id="erosion-utm-hemi"
                label="Hemisfério UTM"
                value={locationCoordinates.utmHemisphere || ''}
                onChange={(e) => updateLocationField('utmHemisphere', e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="N">N</option>
                <option value="S">S</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="erosion-alt"
                label="Altitude"
                value={locationCoordinates.altitude}
                onChange={(e) => updateLocationField('altitude', e.target.value)}
              />
              <Input
                id="erosion-ref"
                label="Referência"
                value={locationCoordinates.reference}
                onChange={(e) => updateLocationField('reference', e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 mb-8">
        <h4 className="text-lg font-semibold text-slate-800 m-0">Medidas e anexos</h4>
        <div className="grid grid-cols-1 gap-4">
          <Textarea
            id="erosion-dimensionamento"
            label="Dimensionamento preliminar"
            rows={3}
            value={safeFormData.dimensionamento || ''}
            onChange={(e) => updateField('dimensionamento', e.target.value)}
            placeholder="Registrar premissas, medidas preliminares ou observacoes tecnicas para futura intervencao."
          />
          <Textarea
            id="erosion-photos"
            label="Fotos (links, um por linha)"
            rows={2}
            className="font-mono"
            value={Array.isArray(safeFormData.fotosLinks) ? safeFormData.fotosLinks.join('\n') : ''}
            onChange={(e) => {
              const rows = String(e.target.value || '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);
              updateField('fotosLinks', rows);
            }}
            error={validationErrors.fotosLinks}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 mb-8">
        <h4 className="text-lg font-semibold text-slate-800 m-0">Observações</h4>
        <Textarea
          id="erosion-obs"
          label="Observações gerais"
          rows={3}
          value={safeFormData.obs || ''}
          onChange={(e) => updateField('obs', e.target.value)}
        />
      </section>

      <div className={`mt-8 p-4 rounded-lg border text-sm flex flex-col gap-2 ${isHistoricalRecord ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
        <div className="text-slate-900"><strong>{isHistoricalRecord ? 'Registro histórico de acompanhamento' : 'Resumo de criticidade calculada'}</strong></div>
        {isHistoricalRecord ? (
          <div>
            A criticidade não será calculada neste salvamento. O sistema vai tratar este cadastro como histórico de acompanhamento da erosão já estabilizada ou previamente intervinda.
          </div>
        ) : (
          <>
            <div>
              <strong>Impacto:</strong> {criticalitySummary.impacto} | <strong>Score:</strong> {criticalitySummary.score} | <strong>Frequência:</strong> {criticalitySummary.frequencia}
            </div>
            {criticalitySummary.hasBreakdown ? (
            <div>
                <strong>Criticidade:</strong> {criticalitySummary.criticidadeClasse} ({criticalitySummary.criticidadeCodigo}) | Pontos T/P/D/S/E/A: {formatCriticalityPoints(criticalityBreakdown?.pontos)}
              </div>
            ) : null}
            {criticalitySummary.solucoesSugeridas.length > 0 ? (
              <div>
                <strong>Soluções sugeridas:</strong> {criticalitySummary.solucoesSugeridas.join(' | ')}
              </div>
            ) : null}
            {criticalitySummary.sugestoesIntervencao.length > 0 ? (
              <div>
                <strong>Sugestões de intervenção (opcional):</strong> {criticalitySummary.sugestoesIntervencao.join(' | ')}
              </div>
            ) : null}
            {criticalitySummary.alertas.length > 0 ? (
              <div>
                <strong>Alertas:</strong> {criticalitySummary.alertas.join(' | ')}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

export default ErosionFormModal;
