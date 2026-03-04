import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select } from '../../../components/ui';
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
      <section className="erosions-form-section">
        <h4>Cadastro</h4>
        <div className="erosions-form-grid is-three">
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
      </section>

      <section className="erosions-form-section">
        <h4>Classificação e caracterização da erosão</h4>
        <div className="erosions-form-grid is-three">
          {towerOptions.length > 0 ? (
            <Select
              id="erosion-torre"
              label="Torre ref."
              value={safeFormData.torreRef || ''}
              onChange={(e) => updateField('torreRef', e.target.value)}
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
              label="Torre ref."
              value={safeFormData.torreRef || ''}
              onChange={(e) => updateField('torreRef', e.target.value)}
            />
          )}
          <Select
            id="erosion-estagio"
            label="Estágio (grau erosivo)"
            value={safeFormData.estagio || ''}
            onChange={(e) => updateField('estagio', e.target.value)}
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
            onChange={(e) => updateField('status', e.target.value)}
          >
            <option value="Ativo">Ativo</option>
            <option value="Monitoramento">Monitoramento</option>
            <option value="Estabilizado">Estabilizado</option>
          </Select>
        </div>

        <ErosionTechnicalFields
          formData={safeFormData}
          readOnlyClasses={readOnlyClasses}
          onPatch={(patch) => {
            setFormData((prev) => ({
              ...((prev && typeof prev === 'object') ? prev : {}),
              ...patch,
            }));
          }}
        />
      </section>

      <section className="erosions-form-section">
        <div className="erosions-form-section-head">
          <h4>Localização geográfica</h4>
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
          <>
            <div className="erosions-form-grid is-two">
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

            <div className="erosions-form-grid is-four">
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

            <div className="erosions-form-grid is-two">
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
          </>
        ) : null}
      </section>

      <section className="erosions-form-section">
        <h4>Medidas e anexos</h4>
        <div className="erosions-form-grid is-two">
          <label className="erosions-field">
            <span>Fotos (links, um por linha)</span>
            <textarea
              rows="2"
              className="erosions-long-textarea erosions-long-textarea-links"
              value={Array.isArray(safeFormData.fotosLinks) ? safeFormData.fotosLinks.join('\n') : ''}
              onChange={(e) => {
                const rows = String(e.target.value || '')
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean);
                updateField('fotosLinks', rows);
              }}
            />
          </label>
        </div>
      </section>

      <section className="erosions-form-section">
        <h4>Observações</h4>
        <label className="erosions-field">
          <span>Observações gerais</span>
          <textarea
            rows="3"
            className="erosions-long-textarea erosions-long-textarea-large"
            value={safeFormData.obs || ''}
            onChange={(e) => updateField('obs', e.target.value)}
          />
        </label>
      </section>

      <div className="notice erosions-criticality-notice">
        <div><strong>Resumo de criticidade calculada</strong></div>
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
      </div>
    </Modal>
  );
}

export default ErosionFormModal;

