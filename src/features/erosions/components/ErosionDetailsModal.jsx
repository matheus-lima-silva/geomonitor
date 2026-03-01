import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { erosionStatusClass, normalizeErosionStatus } from '../../shared/statusUtils';
import {
  deriveErosionTypeFromTechnicalFields,
  getLocalContextLabel,
  normalizeErosionTechnicalFields,
  normalizeFollowupEventType,
  normalizeFollowupHistory,
} from '../utils/erosionUtils';
import { normalizeLocationCoordinates } from '../utils/erosionCoordinates';

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

function ErosionDetailsModal({
  open,
  erosion,
  project,
  relatedInspections = [],
  hasCoordinates,
  onClose,
  onOpenMaps,
  onSaveManualEvent,
  onExportPdf,
}) {
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);

  useEffect(() => {
    if (!open) return;
    setShowAddEventForm(false);
    setSavingEvent(false);
    setEventForm(EMPTY_EVENT_FORM);
  }, [open, erosion?.id]);

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

  const saturacaoPorAgua = String(erosion?.saturacaoPorAgua || '').trim();
  const technical = normalizeErosionTechnicalFields(erosion || {});
  const localContexto = technical.localContexto || {};
  const localTipoLabel = getLocalContextLabel(localContexto.localTipo) || '-';
  const usosSolo = technical.usosSolo;
  const tiposFeicao = technical.tiposFeicao;
  const caracteristicasFeicao = technical.caracteristicasFeicao;
  const derivedTipo = deriveErosionTypeFromTechnicalFields({ ...erosion, tiposFeicao });
  const criticalidadeV2 = erosion?.criticalidadeV2 && typeof erosion.criticalidadeV2 === 'object'
    ? erosion.criticalidadeV2
    : null;
  const alertasAtivos = Array.isArray(erosion?.alertsAtivos) ? erosion.alertsAtivos : [];

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

  return (
    <div className="modal-backdrop erosions-details-backdrop">
      <div className="modal erosions-details-modal">
        <div className="erosions-modal-head">
          <h3>Detalhes da erosao</h3>
          <button type="button" className="secondary erosions-modal-close-btn" onClick={onClose}>
            <AppIcon name="close" />
          </button>
        </div>

        <div className="erosions-modal-body">
          <section className="erosions-details-section">
            <h4>Resumo</h4>
            <div className="erosions-details-grid is-two">
              <div><strong>ID:</strong> {erosion.id || '-'}</div>
              <div><strong>Empreendimento:</strong> {erosion.projetoId || '-'}</div>
              <div><strong>Nome:</strong> {project?.nome || '-'}</div>
              <div><strong>Torre:</strong> {erosion.torreRef || '-'}</div>
              <div><strong>Impacto:</strong> {erosion.impacto || '-'}</div>
              <div>
                <strong>Status:</strong>{' '}
                <span className={erosionStatusClass(erosion.status)}>
                  {normalizeErosionStatus(erosion.status)}
                </span>
              </div>
              <div><strong>Vistoria principal:</strong> {erosion.vistoriaId || '-'}</div>
              <div><strong>Vistorias vinculadas:</strong> {Array.isArray(erosion.vistoriaIds) ? erosion.vistoriaIds.join(', ') || '-' : '-'}</div>
            </div>
          </section>

          <section className="erosions-details-section">
            <h4>Classificacao e caracterizacao consolidada</h4>
            <div className="erosions-details-grid is-two">
              <div><strong>Tipo (derivado):</strong> {derivedTipo || '-'}</div>
              <div><strong>Estagio:</strong> {erosion.estagio || '-'}</div>
              <div><strong>Local:</strong> {localTipoLabel}</div>
              {localContexto.localTipo === 'outros' ? (
                <div className="erosions-details-span-all"><strong>Detalhe local:</strong> {localContexto.localDescricao || '-'}</div>
              ) : null}
              <div><strong>Profundidade real (m):</strong> {Number.isFinite(technical.profundidadeMetros) ? technical.profundidadeMetros : '-'}</div>
              <div><strong>Declividade real (graus):</strong> {Number.isFinite(technical.declividadeGraus) ? technical.declividadeGraus : '-'}</div>
              <div><strong>Distancia da estrutura (m):</strong> {Number.isFinite(technical.distanciaEstruturaMetros) ? technical.distanciaEstruturaMetros : '-'}</div>
              <div><strong>Presenca de agua no fundo:</strong> {technical.presencaAguaFundo || '-'}</div>
              <div><strong>Saturacao por agua:</strong> {saturacaoPorAgua || '-'}</div>
              <div><strong>Tipo de solo:</strong> {technical.tipoSolo || '-'}</div>
              <div><strong>Localizacao de exposicao:</strong> {localContexto.exposicao || '-'}</div>
              <div><strong>Estrutura proxima:</strong> {localContexto.estruturaProxima || '-'}</div>
              <div><strong>Sinais de avanco:</strong> {technical.sinaisAvanco ? 'sim' : 'nao'}</div>
              <div><strong>Vegetacao interior:</strong> {technical.vegetacaoInterior ? 'sim' : 'nao'}</div>
              <div className="erosions-details-span-all"><strong>Tipos de feicao:</strong> {listValue(tiposFeicao)}</div>
              <div className="erosions-details-span-all"><strong>Caracteristicas da feicao:</strong> {listValue(caracteristicasFeicao)}</div>
              <div className="erosions-details-span-all"><strong>Usos do solo:</strong> {listValue(usosSolo)}</div>
              {usosSolo.includes('outro') ? (
                <div className="erosions-details-span-all"><strong>Uso do solo - outro:</strong> {erosion.usoSoloOutro || '-'}</div>
              ) : null}
              <div><strong>Score:</strong> {erosion.score ?? '-'}</div>
              <div><strong>Frequencia:</strong> {erosion.frequencia || '-'}</div>
              {criticalidadeV2 ? (
                <>
                  <div><strong>Criticidade:</strong> {criticalidadeV2.criticidade_classe || '-'} ({criticalidadeV2.codigo || '-'})</div>
                  <div><strong>Score:</strong> {criticalidadeV2.criticidade_score ?? '-'}</div>
                  <div className="erosions-details-span-all">
                    <strong>Pontos T/P/D/S/E:</strong>{' '}
                    {criticalidadeV2.pontos?.T ?? 0}/{criticalidadeV2.pontos?.P ?? 0}/{criticalidadeV2.pontos?.D ?? 0}/{criticalidadeV2.pontos?.S ?? 0}/{criticalidadeV2.pontos?.E ?? 0}
                  </div>
                  <div><strong>Classe tipo erosao:</strong> {criticalidadeV2.tipo_erosao_classe || '-'}</div>
                  <div><strong>Classe profundidade:</strong> {criticalidadeV2.profundidade_classe || '-'}</div>
                  <div><strong>Classe declividade:</strong> {criticalidadeV2.declividade_classe || '-'}</div>
                  <div><strong>Classe solo:</strong> {criticalidadeV2.solo_classe || '-'}</div>
                  <div><strong>Classe exposicao:</strong> {criticalidadeV2.exposicao_classe || '-'}</div>
                  <div className="erosions-details-span-all">
                    <strong>Tipo de medida recomendada:</strong> {criticalidadeV2.tipo_medida_recomendada || '-'}
                  </div>
                  <div className="erosions-details-span-all">
                    <strong>Solucoes sugeridas:</strong> {Array.isArray(criticalidadeV2.lista_solucoes_sugeridas) && criticalidadeV2.lista_solucoes_sugeridas.length > 0 ? criticalidadeV2.lista_solucoes_sugeridas.join(' | ') : '-'}
                  </div>
                  {Array.isArray(criticalidadeV2.lista_solucoes_possiveis_intervencao) && criticalidadeV2.lista_solucoes_possiveis_intervencao.length > 0 ? (
                    <div className="erosions-details-span-all">
                      <strong>Sugestoes de intervencao (opcional):</strong> {criticalidadeV2.lista_solucoes_possiveis_intervencao.join(' | ')}
                    </div>
                  ) : null}
                  {criticalidadeV2.recomendacao_contextual ? (
                    <div className="erosions-details-span-all">
                      <strong>Regra contextual:</strong> {criticalidadeV2.recomendacao_contextual}
                    </div>
                  ) : null}
                </>
              ) : null}
              {alertasAtivos.length > 0 ? (
                <div className="erosions-details-span-all"><strong>Alertas ativos:</strong> {alertasAtivos.join(' | ')}</div>
              ) : null}
              <div className="erosions-details-span-all"><strong>Observacoes:</strong> {erosion.obs || '-'}</div>
            </div>
            <div className="erosions-details-links">
              <strong>Fotos (links):</strong>
              {Array.isArray(erosion.fotosLinks) && erosion.fotosLinks.length > 0 ? (
                <ul>
                  {erosion.fotosLinks.map((link) => (
                    <li key={link}>
                      <a href={link} target="_blank" rel="noreferrer">{link}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Sem links de fotos.</p>
              )}
            </div>
          </section>

          <section className="erosions-details-section">
            <h4>Localizacao geografica</h4>
            <div className="erosions-details-grid is-four">
              <div><strong>Latitude:</strong> {locationCoordinates.latitude || '-'}</div>
              <div><strong>Longitude:</strong> {locationCoordinates.longitude || '-'}</div>
              <div><strong>UTM Easting:</strong> {locationCoordinates.utmEasting || '-'}</div>
              <div><strong>UTM Northing:</strong> {locationCoordinates.utmNorthing || '-'}</div>
              <div><strong>UTM Zona:</strong> {locationCoordinates.utmZone || '-'}</div>
              <div><strong>Hemisferio:</strong> {locationCoordinates.utmHemisphere || '-'}</div>
              <div><strong>Altitude:</strong> {locationCoordinates.altitude || '-'}</div>
              <div><strong>Referencia:</strong> {locationCoordinates.reference || '-'}</div>
            </div>
            <div className="erosions-details-links">
              {hasCoordinates(erosion) ? (
                <div className="row-actions erosions-details-map-action">
                  <button type="button" onClick={() => onOpenMaps(erosion)}>
                    <AppIcon name="map" />
                    Tracar rota
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          {relatedInspections.length > 0 ? (
            <section className="erosions-details-section">
              <h4>Vistorias que abordaram esta erosao</h4>
              <div className="erosions-related-list">
                {relatedInspections.map((row) => (
                  <div key={`related-inspection-${row.id}`} className="erosions-related-item">
                    <strong>{row.id}</strong>
                    {row.inspection?.dataInicio ? ` | inicio: ${row.inspection.dataInicio}` : ''}
                    {row.inspection?.dataFim ? ` | fim: ${row.inspection.dataFim}` : ''}
                    {row.inspection?.responsavel ? ` | resp.: ${row.inspection.responsavel}` : ''}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="erosions-details-section">
            <h4>Historico tecnico de criticidade</h4>
            <div className="erosions-history-list">
              {criticalityHistory.map((item, index, array) => (
                <article key={`${item.timestamp || 'criticality'}-${index}`} className="erosions-history-item is-sistema">
                  {index < array.length - 1 ? <div className="erosions-history-line" /> : null}
                  <div className="erosions-history-content">
                    <div className="erosions-history-meta">
                      <strong>{item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '-'}</strong>
                      <span className="status-chip">{item.situacao || '-'}</span>
                    </div>
                    <div>
                      Data vistoria: {item.data_vistoria || '-'} | Score anterior: {item.score_anterior ?? '-'} | Score atual: {item.score_atual ?? '-'}
                    </div>
                    <div className="muted">
                      Tendencia: {item.tendencia || '-'} | Intervencao realizada: {item.intervencao_realizada || '-'}
                    </div>
                  </div>
                </article>
              ))}
              {criticalityHistory.length === 0 ? <p className="muted">Sem historico tecnico de criticidade.</p> : null}
            </div>
          </section>

          <section className="erosions-details-section">
            <div className="erosions-history-head">
              <h4>Historico de acompanhamento</h4>
              <button
                type="button"
                onClick={() => {
                  setShowAddEventForm((prev) => !prev);
                  if (showAddEventForm) setEventForm(EMPTY_EVENT_FORM);
                }}
              >
                <AppIcon name={showAddEventForm ? 'close' : 'plus'} />
                {showAddEventForm ? 'Cancelar evento' : 'Adicionar evento'}
              </button>
            </div>

            {showAddEventForm ? (
              <div className="erosions-history-form">
                <div className="erosions-form-grid is-two">
                  <label className="erosions-field">
                    <span>Tipo de evento</span>
                    <select value={eventForm.tipoEvento} onChange={(e) => setEventForm((prev) => ({ ...prev, tipoEvento: e.target.value }))}>
                      <option value="obra">Obra</option>
                      <option value="autuacao">Autuacao por orgao publico</option>
                    </select>
                  </label>
                  {eventForm.tipoEvento === 'obra' ? (
                    <label className="erosions-field">
                      <span>Etapa da obra *</span>
                      <select value={eventForm.obraEtapa} onChange={(e) => setEventForm((prev) => ({ ...prev, obraEtapa: e.target.value }))}>
                        <option value="Projeto">Projeto</option>
                        <option value="Em andamento">Em andamento</option>
                        <option value="Concluida">Concluida</option>
                      </select>
                    </label>
                  ) : (
                    <label className="erosions-field">
                      <span>Status da autuacao *</span>
                      <select value={eventForm.autuacaoStatus} onChange={(e) => setEventForm((prev) => ({ ...prev, autuacaoStatus: e.target.value }))}>
                        <option value="Aberta">Aberta</option>
                        <option value="Recorrida">Recorrida</option>
                        <option value="Encerrada">Encerrada</option>
                      </select>
                    </label>
                  )}
                </div>

                {eventForm.tipoEvento === 'obra' ? (
                  <label className="erosions-field">
                    <span>Descricao da obra *</span>
                    <textarea
                      rows="2"
                      value={eventForm.descricao}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, descricao: e.target.value }))}
                    />
                  </label>
                ) : (
                  <div className="erosions-form-grid is-two">
                    <label className="erosions-field">
                      <span>Orgao publico *</span>
                      <input value={eventForm.orgao} onChange={(e) => setEventForm((prev) => ({ ...prev, orgao: e.target.value }))} />
                    </label>
                    <label className="erosions-field">
                      <span>No/Descricao *</span>
                      <input value={eventForm.numeroOuDescricao} onChange={(e) => setEventForm((prev) => ({ ...prev, numeroOuDescricao: e.target.value }))} />
                    </label>
                  </div>
                )}

                <div className="row-actions">
                  <button type="button" onClick={handleSaveEvent} disabled={savingEvent}>
                    <AppIcon name="save" />
                    {savingEvent ? 'Salvando...' : 'Salvar evento'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="erosions-history-list">
              {sortedHistory.map((item, index, array) => {
                const itemType = normalizeFollowupEventType(item);
                const typeLabel = itemType === 'obra' ? 'Obra' : (itemType === 'autuacao' ? 'Autuacao' : 'Sistema');
                const badgeClass = itemType === 'obra'
                  ? 'status-chip status-ok'
                  : (itemType === 'autuacao' ? 'status-chip status-warn' : 'status-chip');
                const markerClass = itemType === 'obra'
                  ? 'is-obra'
                  : (itemType === 'autuacao' ? 'is-autuacao' : 'is-sistema');
                return (
                  <article key={`${item.timestamp}-${index}`} className={`erosions-history-item ${markerClass}`}>
                    {index < array.length - 1 ? <div className="erosions-history-line" /> : null}
                    <div className="erosions-history-content">
                      <div className="erosions-history-meta">
                        <strong>{item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '-'}</strong>
                        <span className={badgeClass}>{typeLabel}</span>
                      </div>
                      <div>{item.resumo || '-'}</div>
                      {itemType === 'obra' ? (
                        <div className="muted">Etapa: {item.obraEtapa || '-'} | Descricao: {item.descricao || '-'}</div>
                      ) : null}
                      {itemType === 'autuacao' ? (
                        <div className="muted">
                          Orgao: {item.orgao || '-'} | No/Descricao: {item.numeroOuDescricao || '-'} | Status: {item.autuacaoStatus || '-'}
                        </div>
                      ) : null}
                      <div className="muted">
                        Origem: {item.origem || '-'} | Usuario: {item.usuario || '-'} | Status da erosao: {item.statusNovo || '-'}
                      </div>
                    </div>
                  </article>
                );
              })}
              {sortedHistory.length === 0 ? <p className="muted">Sem historico de acompanhamento.</p> : null}
            </div>
          </section>
        </div>

        <div className="erosions-modal-foot erosions-details-foot">
          <button type="button" onClick={onExportPdf}>
            <AppIcon name="pdf" />
            Gerar PDF
          </button>
          <button type="button" className="projects-cancel-btn" onClick={onClose}>
            <AppIcon name="close" />
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErosionDetailsModal;
