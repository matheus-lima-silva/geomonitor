import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import {
  EROSION_LOCATION_OPTIONS,
  EROSION_TECHNICAL_OPTIONS,
} from '../utils/erosionUtils';
import {
  isCompleteUtmCoordinates,
  isPartialUtmCoordinates,
  parseCoordinateNumber,
} from '../utils/erosionCoordinates';

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

function normalizeArrayField(value) {
  return Array.isArray(value) ? value : [];
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
    score: 1,
    frequencia: '24 meses',
    intervencao: 'Monitoramento visual',
  };

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

  const tiposFeicao = normalizeArrayField(safeFormData.tiposFeicao);
  const caracteristicasFeicao = normalizeArrayField(safeFormData.caracteristicasFeicao);
  const usosSolo = normalizeArrayField(safeFormData.usosSolo);
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

  function toggleMultiField(field, optionValue, checked) {
    setFormData((prev) => {
      const prevSafe = (prev && typeof prev === 'object') ? prev : {};
      const source = normalizeArrayField(prevSafe[field]);
      const nextSet = new Set(source.map((item) => String(item || '').trim()).filter(Boolean));
      if (checked) {
        nextSet.add(optionValue);
      } else {
        nextSet.delete(optionValue);
      }
      const nextArray = [...nextSet];
      const patch = {
        [field]: nextArray,
      };
      if (field === 'usosSolo' && !nextSet.has('outro')) {
        patch.usoSoloOutro = '';
      }
      return {
        ...prevSafe,
        ...patch,
      };
    });
  }

  return (
    <div className="modal-backdrop erosions-form-backdrop">
      <div className="modal erosions-form-modal">
        <div className="erosions-modal-head">
          <h3>{isEditing ? 'Editar' : 'Nova'} Erosao</h3>
          <button type="button" className="secondary erosions-modal-close-btn" onClick={onCancel}>
            <AppIcon name="close" />
          </button>
        </div>

        <div className="erosions-modal-body">
          <section className="erosions-form-section">
            <h4>Cadastro</h4>
            <div className="erosions-form-grid is-three">
              <label className="erosions-field">
                <span>ID</span>
                <input value={safeFormData.id || ''} disabled />
              </label>
              <label className="erosions-field">
                <span>Empreendimento *</span>
                <select value={safeFormData.projetoId || ''} onChange={(e) => updateField('projetoId', e.target.value)}>
                  <option value="">Selecione...</option>
                  {safeProjects.map((project, index) => (
                    <option key={String(project?.id || `project-${index}`)} value={String(project?.id || '')}>
                      {String(project?.id || '')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="erosions-field">
                <span>Vistoria</span>
                <select
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
                </select>
              </label>
            </div>
          </section>

          <section className="erosions-form-section">
            <h4>Classificacao e caracterizacao da erosao</h4>
            <div className="erosions-form-grid is-three">
              <label className="erosions-field">
                <span>Torre ref.</span>
                {towerOptions.length > 0 ? (
                  <select value={safeFormData.torreRef || ''} onChange={(e) => updateField('torreRef', e.target.value)}>
                    <option value="">Selecione...</option>
                    {towerOptions.map((tower) => (
                      <option key={`tower-option-${tower}`} value={tower}>
                        {tower === '0' ? 'Portico (T0)' : `Torre ${tower}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={safeFormData.torreRef || ''} onChange={(e) => updateField('torreRef', e.target.value)} />
                )}
              </label>
              <label className="erosions-field">
                <span>Local da erosao *</span>
                <select
                  value={safeFormData.localTipo || ''}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setFormData((prev) => ({
                      ...((prev && typeof prev === 'object') ? prev : {}),
                      localTipo: nextValue,
                      localDescricao: nextValue === 'Outros' ? (((prev && typeof prev === 'object') ? prev : {}).localDescricao || '') : '',
                    }));
                  }}
                >
                  <option value="">Selecione...</option>
                  {EROSION_LOCATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="erosions-field">
                <span>Detalhe do local</span>
                <input
                  value={safeFormData.localDescricao || ''}
                  onChange={(e) => updateField('localDescricao', e.target.value)}
                  disabled={safeFormData.localTipo !== 'Outros'}
                  placeholder={safeFormData.localTipo === 'Outros' ? 'Obrigatorio para Outros' : 'Opcional'}
                />
              </label>
            </div>

            <div className="erosions-form-grid is-three">
              <label className="erosions-field">
                <span>Estagio (grau erosivo)</span>
                <select value={safeFormData.estagio || ''} onChange={(e) => updateField('estagio', e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="inicial">Inicial</option>
                  <option value="intermediario">Intermediario</option>
                  <option value="avancado">Avancado</option>
                  <option value="critico">Critico</option>
                </select>
              </label>
              <label className="erosions-field">
                <span>Status</span>
                <select value={safeFormData.status || 'Ativo'} onChange={(e) => updateField('status', e.target.value)}>
                  <option value="Ativo">Ativo</option>
                  <option value="Monitoramento">Monitoramento</option>
                  <option value="Estabilizado">Estabilizado</option>
                </select>
              </label>
              <label className="erosions-field">
                <span>Profundidade (m)</span>
                <select value={safeFormData.profundidade || ''} onChange={(e) => updateField('profundidade', e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="<0.5">&lt; 0.5m</option>
                  <option value="0.5-1.5">0.5 - 1.5m</option>
                  <option value="1.5-3.0">1.5 - 3.0m</option>
                  <option value=">3.0">&gt; 3.0m</option>
                </select>
              </label>
            </div>
            <div className="erosions-form-grid is-four">
              <label className="erosions-field">
                <span>Classe tecnica de declividade (graus)</span>
                <select value={safeFormData.declividadeClasse || ''} onChange={(e) => updateField('declividadeClasse', e.target.value)}>
                  <option value="">Nao informado</option>
                  {EROSION_TECHNICAL_OPTIONS.declividadeClasse.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="erosions-field">
                <span>Classe tecnica de largura maxima (m)</span>
                <select value={safeFormData.larguraMaximaClasse || ''} onChange={(e) => updateField('larguraMaximaClasse', e.target.value)}>
                  <option value="">Nao informado</option>
                  {EROSION_TECHNICAL_OPTIONS.larguraMaximaClasse.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="erosions-field">
                <span>Presenca de agua no fundo</span>
                <select value={safeFormData.presencaAguaFundo || ''} onChange={(e) => updateField('presencaAguaFundo', e.target.value)}>
                  <option value="">Nao informado</option>
                  {EROSION_TECHNICAL_OPTIONS.presencaAguaFundo.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="erosions-field">
                <span>Saturacao por agua</span>
                <select value={safeFormData.saturacaoPorAgua || ''} onChange={(e) => updateField('saturacaoPorAgua', e.target.value)}>
                  <option value="">Nao informado</option>
                  {EROSION_TECHNICAL_OPTIONS.saturacaoPorAgua.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="erosions-form-grid is-two">
              <fieldset className="erosions-checkbox-fieldset">
                <legend>Tipos de feicao adicionais</legend>
                <div className="erosions-checkbox-grid">
                  {EROSION_TECHNICAL_OPTIONS.tiposFeicao.map((option) => (
                    <label key={option.value} className="erosions-checkbox-option">
                      <input
                        type="checkbox"
                        checked={tiposFeicao.includes(option.value)}
                        onChange={(e) => toggleMultiField('tiposFeicao', option.value, e.target.checked)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="erosions-checkbox-fieldset">
                <legend>Caracteristicas da feicao</legend>
                <div className="erosions-checkbox-grid">
                  {EROSION_TECHNICAL_OPTIONS.caracteristicasFeicao.map((option) => (
                    <label key={option.value} className="erosions-checkbox-option">
                      <input
                        type="checkbox"
                        checked={caracteristicasFeicao.includes(option.value)}
                        onChange={(e) => toggleMultiField('caracteristicasFeicao', option.value, e.target.checked)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <fieldset className="erosions-checkbox-fieldset">
              <legend>Usos do solo</legend>
              <div className="erosions-checkbox-grid">
                {EROSION_TECHNICAL_OPTIONS.usosSolo.map((option) => (
                  <label key={option.value} className="erosions-checkbox-option">
                    <input
                      type="checkbox"
                      checked={usosSolo.includes(option.value)}
                      onChange={(e) => toggleMultiField('usosSolo', option.value, e.target.checked)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {usosSolo.includes('outro') ? (
              <label className="erosions-field">
                <span>Uso do solo - outro *</span>
                <input value={safeFormData.usoSoloOutro || ''} onChange={(e) => updateField('usoSoloOutro', e.target.value)} />
              </label>
            ) : null}

            <div className="erosions-form-grid is-three">
              <label className="erosions-field">
                <span>Faixa de servidao</span>
                <select value={safeFormData.faixaServidao || ''} onChange={(e) => updateField('faixaServidao', e.target.value)}>
                  <option value="">Nao informado</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Nao</option>
                </select>
              </label>
              <label className="erosions-field">
                <span>Area de terceiros</span>
                <select value={safeFormData.areaTerceiros || ''} onChange={(e) => updateField('areaTerceiros', e.target.value)}>
                  <option value="">Nao informado</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Nao</option>
                </select>
              </label>
            </div>
          </section>

          <section className="erosions-form-section">
            <div className="erosions-form-section-head">
              <h4>Localizacao geografica</h4>
              <button
                type="button"
                className="secondary erosions-coordinates-toggle"
                onClick={() => setCoordinatesExpanded((prev) => !prev)}
                aria-expanded={coordinatesExpanded ? 'true' : 'false'}
              >
                <span>{coordinatesStatus}</span>
                <AppIcon name={coordinatesExpanded ? 'chevron-up' : 'chevron-down'} />
              </button>
            </div>

            {coordinatesExpanded ? (
              <>
                <div className="erosions-form-grid is-two">
                  <label className="erosions-field">
                    <span>Latitude (centesimal)</span>
                    <input
                      value={locationCoordinates.latitude}
                      onChange={(e) => updateLocationField('latitude', e.target.value)}
                      placeholder="-22.951958"
                    />
                  </label>
                  <label className="erosions-field">
                    <span>Longitude (centesimal)</span>
                    <input
                      value={locationCoordinates.longitude}
                      onChange={(e) => updateLocationField('longitude', e.target.value)}
                      placeholder="-43.210602"
                    />
                  </label>
                </div>

                <div className="erosions-form-grid is-four">
                  <label className="erosions-field">
                    <span>UTM Easting</span>
                    <input value={locationCoordinates.utmEasting} onChange={(e) => updateLocationField('utmEasting', e.target.value)} />
                  </label>
                  <label className="erosions-field">
                    <span>UTM Northing</span>
                    <input value={locationCoordinates.utmNorthing} onChange={(e) => updateLocationField('utmNorthing', e.target.value)} />
                  </label>
                  <label className="erosions-field">
                    <span>UTM Zona</span>
                    <input value={locationCoordinates.utmZone} onChange={(e) => updateLocationField('utmZone', e.target.value)} />
                  </label>
                  <label className="erosions-field">
                    <span>Hemisferio UTM</span>
                    <select value={locationCoordinates.utmHemisphere || ''} onChange={(e) => updateLocationField('utmHemisphere', e.target.value)}>
                      <option value="">Selecione...</option>
                      <option value="N">N</option>
                      <option value="S">S</option>
                    </select>
                  </label>
                </div>

                <div className="erosions-form-grid is-two">
                  <label className="erosions-field">
                    <span>Altitude</span>
                    <input value={locationCoordinates.altitude} onChange={(e) => updateLocationField('altitude', e.target.value)} />
                  </label>
                  <label className="erosions-field">
                    <span>Referencia</span>
                    <input value={locationCoordinates.reference} onChange={(e) => updateLocationField('reference', e.target.value)} />
                  </label>
                </div>
              </>
            ) : null}
          </section>

          <section className="erosions-form-section">
            <h4>Medidas e anexos</h4>
            <div className="erosions-form-grid is-two">
              <label className="erosions-field">
                <span>Medida preventiva</span>
                <textarea
                  rows="2"
                  className="erosions-long-textarea erosions-long-textarea-medium"
                  value={safeFormData.medidaPreventiva || ''}
                  onChange={(e) => updateField('medidaPreventiva', e.target.value)}
                />
              </label>
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
            <h4>Observacoes</h4>
            <label className="erosions-field">
              <span>Observacoes gerais</span>
              <textarea
                rows="3"
                className="erosions-long-textarea erosions-long-textarea-large"
                value={safeFormData.obs || ''}
                onChange={(e) => updateField('obs', e.target.value)}
              />
            </label>
          </section>

          <div className="notice erosions-criticality-notice">
            <strong>Impacto:</strong> {safeCriticality.impacto} | <strong>Score:</strong> {safeCriticality.score} | <strong>Frequencia:</strong> {safeCriticality.frequencia}
            <br />
            <strong>Intervencao:</strong> {safeCriticality.intervencao}
          </div>
        </div>

        <div className="erosions-modal-foot">
          <button type="button" className="projects-save-btn" onClick={onSave}>
            <AppIcon name="save" />
            Salvar
          </button>
          <button type="button" className="projects-cancel-btn" onClick={onCancel}>
            <AppIcon name="close" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErosionFormModal;
