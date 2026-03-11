import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select, Textarea } from '../../../components/ui';
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
    if (!open) return;
    if (!utmErrorToken) return;
    setCoordinatesExpanded(true);
  }, [open, utmErrorToken]);

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
    const totalTowers = Number(selectedProject?.torres || 0);
    const currentTower = String(safeFormData.torreRef || '').trim();

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
  }, [selectedProject?.torres, safeFormData.torreRef]);

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
        <h4 className="text-lg font-semibold text-slate-800 m-0">Classificação e caracterização da erosão</h4>
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
            label={isHistoricalRecord ? 'Estágio (grau erosivo)' : 'Estágio (grau erosivo) *'}
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
                <strong>Criticidade:</strong> {criticalitySummary.criticidadeClasse} ({criticalitySummary.criticidadeCodigo}) | Pontos T/P/D/S/E: {formatCriticalityPoints(criticalityBreakdown?.pontos)}
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
