import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import InspectionManager from '../../../components/InspectionManager';
import { deleteInspection, saveInspection } from '../../../services/inspectionService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

function normalizeInspectionPendencies(value) {
  const raw = Array.isArray(value) ? value : [];
  const dedup = new Map();
  raw.forEach((item) => {
    const vistoriaId = String(item?.vistoriaId || '').trim();
    if (!vistoriaId) return;
    dedup.set(vistoriaId, {
      vistoriaId,
      status: String(item?.status || '').trim().toLowerCase() === 'visitada' ? 'visitada' : 'pendente',
      dia: String(item?.dia || '').trim(),
    });
  });
  return [...dedup.values()];
}

function getInspectionPendency(erosion, inspectionId) {
  const vistoriaId = String(inspectionId || '').trim();
  if (!vistoriaId) return null;
  return normalizeInspectionPendencies(erosion?.pendenciasVistoria)
    .find((item) => item.vistoriaId === vistoriaId) || null;
}

function buildInspectionId(projetoId, dataInicio, inspections = []) {
  if (!projetoId || !dataInicio) return '';

  const [yyyy, mm, dd] = String(dataInicio).split('-');
  if (!yyyy || !mm || !dd) return '';
  const dateTag = `${dd}${mm}${yyyy}`;
  const projectTag = String(projetoId).trim().toUpperCase();
  const prefix = `VS-${projectTag}-${dateTag}-`;
  const pattern = new RegExp(`^${prefix}(\\d{4})$`);

  let maxSeq = 0;
  (inspections || []).forEach((ins) => {
    const match = String(ins.id || '').match(pattern);
    if (match) {
      const seq = Number(match[1]);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

const baseForm = {
  id: '',
  projetoId: '',
  dataInicio: '',
  dataFim: '',
  responsavel: '',
  obs: '',
  detalhesDias: [],
};

function hasHotelData(day) {
  return !!String(day?.hotelNome || '').trim()
    || !!String(day?.hotelMunicipio || '').trim()
    || String(day?.hotelLogisticaNota || '').trim() !== ''
    || String(day?.hotelReservaNota || '').trim() !== ''
    || String(day?.hotelEstadiaNota || '').trim() !== ''
    || !!String(day?.hotelTorreBase || '').trim();
}

function formatHotelNote(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '-';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function InspectionsView({
  inspections,
  projects,
  erosions,
  forcedProjectFilterId,
  onClearForcedProjectFilter,
  searchTerm,
  planningDraft,
  onPlanningDraftConsumed,
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(baseForm);
  const [detailsModal, setDetailsModal] = useState(null);

  const filtered = useMemo(() => {
    const t = String(searchTerm || '').toLowerCase();
    return inspections.filter((i) => {
      if (forcedProjectFilterId && i.projetoId !== forcedProjectFilterId) return false;
      if (!t) return true;
      return String(i.id || '').toLowerCase().includes(t)
        || String(i.projetoId || '').toLowerCase().includes(t)
        || String(i.responsavel || '').toLowerCase().includes(t);
    });
  }, [inspections, forcedProjectFilterId, searchTerm]);

  const pendingSummaryByInspection = useMemo(() => {
    const summary = new Map();
    (inspections || []).forEach((inspection) => {
      const inspectionId = String(inspection?.id || '').trim();
      const projectId = String(inspection?.projetoId || '').trim();
      if (!inspectionId || !projectId) {
        if (inspectionId) summary.set(inspectionId, { count: 0, towers: [] });
        return;
      }

      const pending = (erosions || []).filter((erosion) => {
        if (String(erosion?.projetoId || '').trim() !== projectId) return false;
        const pendency = getInspectionPendency(erosion, inspectionId);
        const hasVisitDate = pendency?.status === 'visitada' && String(pendency?.dia || '').trim();
        return !hasVisitDate;
      });
      const towers = [...new Set(pending.map((item) => String(item?.torreRef || '').trim()).filter(Boolean))]
        .sort((a, b) => Number(a) - Number(b));
      summary.set(inspectionId, { count: pending.length, towers });
    });
    return summary;
  }, [inspections, erosions]);

  const forcedProject = projects.find((p) => p.id === forcedProjectFilterId);

  useEffect(() => {
    if (!isFormOpen || isEditing) return;
    const generatedId = buildInspectionId(formData.projetoId, formData.dataInicio, inspections);
    if (!generatedId || generatedId === formData.id) return;
    setFormData((prev) => ({ ...prev, id: generatedId }));
  }, [isFormOpen, isEditing, formData.projetoId, formData.dataInicio, inspections, formData.id]);

  function openNew() {
    setFormData({ ...baseForm, projetoId: forcedProjectFilterId || '' });
    setIsEditing(false);
    setIsFormOpen(true);
  }

  function openEdit(i) {
    setFormData({
      ...baseForm,
      ...i,
      detalhesDias: Array.isArray(i.detalhesDias) ? i.detalhesDias : [],
    });
    setIsEditing(true);
    setIsFormOpen(true);
  }

  async function handleSave() {
    try {
      if (!formData.id || !formData.projetoId || !formData.dataInicio) {
        show('Preencha ID, empreendimento e data de inÃƒÂ­cio.', 'error');
        return;
      }
      if (formData.dataFim && formData.dataFim < formData.dataInicio) {
        show('Data fim nÃƒÂ£o pode ser anterior ÃƒÂ  data inÃƒÂ­cio.', 'error');
        return;
      }

      await saveInspection({
        ...formData,
        dataFim: formData.dataFim || formData.dataInicio,
        status: formData.status || 'aberta',
        detalhesDias: Array.isArray(formData.detalhesDias) ? formData.detalhesDias : [],
      }, { merge: true, updatedBy: user?.email });

      setIsFormOpen(false);
      show('Vistoria salva com sucesso.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao salvar vistoria.', 'error');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(`Excluir vistoria ${id}?`)) return;
    await deleteInspection(id);
    show('Vistoria excluÃƒÂ­da.', 'success');
  }
  function handleExportDetailsPdf() {
    if (!detailsModal) return;
    const win = window.open('', '_blank');
    if (!win) return;

    const relatedErosions = (erosions || []).filter((item) => String(item?.vistoriaId || '').trim() === String(detailsModal.id || '').trim());
    const days = Array.isArray(detailsModal.detalhesDias) ? detailsModal.detalhesDias : [];
    const dayCardsHtml = days.map((day, idx) => {
      const dateLabel = String(day?.data || '').trim() || `Dia ${idx + 1}`;
      const torresTag = String(day?.torresInput || '').trim()
        || (Array.isArray(day?.torres) && day.torres.length > 0 ? day.torres.join(', ') : '');
      const towers = Array.isArray(day?.torresDetalhadas) ? day.torresDetalhadas : [];
      const towersHtml = towers.length > 0
        ? towers.map((tower) => `
            <div class="tower-row ${tower?.temErosao ? 'tower-erosion' : ''}">
              <strong>Torre ${escapeHtml(tower?.numero || '-')}</strong>${escapeHtml(tower?.obs ? ` - ${tower.obs}` : ' - sem observações')}
            </div>
          `).join('')
        : '<div class="empty">Sem torres detalhadas neste dia.</div>';
      const hotelHtml = hasHotelData(day) ? `
        <div class="hotel-box">
          <div class="hotel-title">Dados de hospedagem</div>
          <div><strong>Hotel:</strong> ${escapeHtml(day?.hotelNome || '-')}</div>
          <div><strong>Município:</strong> ${escapeHtml(day?.hotelMunicipio || '-')}</div>
          <div><strong>Torre base:</strong> ${escapeHtml(day?.hotelTorreBase || '-')}</div>
          <div><strong>Notas:</strong> Logística ${escapeHtml(formatHotelNote(day?.hotelLogisticaNota))} | Reserva ${escapeHtml(formatHotelNote(day?.hotelReservaNota))} | Estadia ${escapeHtml(formatHotelNote(day?.hotelEstadiaNota))}</div>
        </div>
      ` : '';
      return `
        <div class="day-card">
          <div><strong>Data:</strong> ${escapeHtml(dateLabel)}</div>
          ${torresTag ? `<div><strong>Torres visitadas:</strong> ${escapeHtml(torresTag)}</div>` : ''}
          <div class="tower-list">${towersHtml}</div>
          ${hotelHtml}
        </div>
      `;
    }).join('');

    const erosionsHtml = relatedErosions.length > 0
      ? relatedErosions.map((item) => `
          <div class="erosion-row">
            <div><strong>${escapeHtml(item?.id || '-')}</strong></div>
            <div>${escapeHtml(item?.torreRef || '-')} | ${escapeHtml(item?.tipo || '-')} | ${escapeHtml(item?.estagio || '-')}</div>
            <div><strong>Impacto:</strong> ${escapeHtml(item?.impacto || '-')}</div>
          </div>
        `).join('')
      : '<div class="empty">Nenhuma erosão vinculada a esta vistoria.</div>';

    win.document.write(`
      <html>
      <head>
        <title>Detalhes da Vistoria ${escapeHtml(detailsModal.id || '-')}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; font-size: 12px; padding: 0; margin: 0; background: #f8fafc; }
          .wrapper { padding: 10px; }
          .header { background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
          .title { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
          .meta { color: #334155; }
          .section { margin-top: 10px; border: 1px solid #dbe4ee; border-radius: 10px; background: #fff; padding: 10px; }
          .section-title { font-size: 13px; font-weight: 700; margin: 0 0 8px; }
          .day-card, .erosion-row { border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 8px; margin-bottom: 8px; }
          .tower-list { display: grid; gap: 5px; margin-top: 6px; }
          .tower-row { border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; }
          .tower-erosion { border-color: #fecaca; background: #fef2f2; }
          .hotel-box { margin-top: 8px; border: 1px solid #bfdbfe; border-radius: 6px; background: #eff6ff; padding: 8px; }
          .hotel-title { color: #1d4ed8; font-weight: 700; margin-bottom: 4px; }
          .empty { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 8px; color: #64748b; background: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1 class="title">Detalhes da Vistoria ${escapeHtml(detailsModal.id || '-')}</h1>
            <div class="meta"><strong>Empreendimento:</strong> ${escapeHtml(detailsModal.projetoId || '-')}</div>
            <div class="meta"><strong>Início:</strong> ${escapeHtml(detailsModal.dataInicio || '-')} | <strong>Fim:</strong> ${escapeHtml(detailsModal.dataFim || '-')}</div>
            <div class="meta"><strong>Responsável:</strong> ${escapeHtml(detailsModal.responsavel || '-')}</div>
          </div>
          <div class="section">
            <h2 class="section-title">Diário de Campo</h2>
            ${dayCardsHtml || '<div class="empty">Sem dados de diário.</div>'}
          </div>
          <div class="section">
            <h2 class="section-title">Erosões Identificadas (${escapeHtml(relatedErosions.length)})</h2>
            ${erosionsHtml}
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <h2>Vistorias</h2>
          <p className="muted">DiÃƒÂ¡rio multi-dia e checklist por torre.</p>
        </div>
        <button type="button" onClick={openNew}>
          <AppIcon name="plus" />
          Nova Vistoria
        </button>
      </div>

      {forcedProject && (
        <div className="notice">
          Filtrado por empreendimento: <strong>{forcedProject.nome || forcedProject.id}</strong>
          <div className="row-actions">
            <button type="button" className="secondary" onClick={onClearForcedProjectFilter}>
              <AppIcon name="reset" />
              Limpar filtro
            </button>
          </div>
        </div>
      )}

      <InspectionManager
        projects={projects}
        erosions={erosions}
        inspections={inspections}
        actorName={String(user?.displayName || user?.email || user?.uid || '').trim()}
        planningDraft={planningDraft}
        onPlanningDraftConsumed={onPlanningDraftConsumed}
      />

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Projeto</th>
              <th>InÃƒÂ­cio</th>
              <th>Fim</th>
              <th>ResponsÃƒÂ¡vel</th>
              <th>PendÃƒÂªncias</th>
              <th>AÃƒÂ§ÃƒÂµes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const pendingSummary = pendingSummaryByInspection.get(i.id) || { count: 0, towers: [] };
              const pendingCount = Number(pendingSummary.count || 0);
              return (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <td>{i.projetoId}</td>
                  <td>{i.dataInicio || '-'}</td>
                  <td>{i.dataFim || '-'}</td>
                  <td>{i.responsavel || '-'}</td>
                  <td>
                    {pendingCount > 0 ? (
                      <span
                        className="status-chip status-warn"
                        title={pendingSummary.towers.length > 0 ? `Torres pendentes: ${pendingSummary.towers.join(', ')}` : 'Existem erosÃƒÂµes pendentes sem data de visita'}
                      >
                        {pendingCount} pendente(s)
                      </span>
                    ) : (
                      <span className="status-chip status-ok">Sem pendÃƒÂªncias</span>
                    )}
                  </td>
                  <td>
                    <div className="inline-row">
                      <button type="button" className="secondary" onClick={() => setDetailsModal(i)}>
                        <AppIcon name="details" />
                        Detalhes
                      </button>
                      <button type="button" className="secondary" onClick={() => openEdit(i)}>
                        <AppIcon name="edit" />
                        Editar
                      </button>
                      <button type="button" className="danger" onClick={() => handleDelete(i.id)}>
                        <AppIcon name="trash" />
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="7" className="muted">Nenhuma vistoria encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="modal-backdrop">
          <div className="modal wide">
            <h3>{isEditing ? 'Editar' : 'Nova'} Vistoria</h3>
            <div className="grid-form">
              <input value={formData.id} onChange={(e) => setFormData({ ...formData, id: e.target.value })} disabled={!isEditing} placeholder="ID" />
              <select value={formData.projetoId} onChange={(e) => setFormData({ ...formData, projetoId: e.target.value })}>
                <option value="">Empreendimento...</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.id} - {p.nome}</option>)}
              </select>
              <input type="date" value={formData.dataInicio} onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })} />
              <input type="date" value={formData.dataFim || ''} onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })} />
              <input value={formData.responsavel || ''} onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })} placeholder="ResponsÃƒÂ¡vel" />
              <input value={formData.obs || ''} onChange={(e) => setFormData({ ...formData, obs: e.target.value })} placeholder="ObservaÃƒÂ§ÃƒÂµes" />
            </div>
            <div className="row-actions">
              <button type="button" onClick={handleSave}>
                <AppIcon name="save" />
                Salvar
              </button>
              <button type="button" className="secondary" onClick={() => setIsFormOpen(false)}>
                <AppIcon name="close" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsModal && (
        <div className="modal-backdrop">
          <div className="modal wide">
            <h3>Detalhes da Vistoria</h3>
            <div className="muted">
              <div><strong>ID:</strong> {detailsModal.id}</div>
              <div><strong>Empreendimento:</strong> {detailsModal.projetoId}</div>
              <div><strong>InÃƒÂ­cio:</strong> {detailsModal.dataInicio || '-'}</div>
              <div><strong>Fim:</strong> {detailsModal.dataFim || '-'}</div>
              <div><strong>ResponsÃƒÂ¡vel:</strong> {detailsModal.responsavel || '-'}</div>
              <div><strong>ObservaÃƒÂ§ÃƒÂµes:</strong> {detailsModal.obs || '-'}</div>
              <div><strong>Dias registados:</strong> {Array.isArray(detailsModal.detalhesDias) ? detailsModal.detalhesDias.length : 0}</div>
            </div>

            {Array.isArray(detailsModal.detalhesDias) && detailsModal.detalhesDias.length > 0 && (
              <div className="panel nested inspection-hotel-section">
                <h4 className="inline-row">
                  <AppIcon name="building" />
                  SeÃ§Ã£o de Hospedagem por Dia
                </h4>
                <p className="muted">Este bloco mostra somente informaÃ§Ãµes de hotel/hospedagem da vistoria.</p>
                {detailsModal.detalhesDias.map((day, idx) => (
                  <div key={`hotel-day-${day?.data || idx}`} className="project-card inspection-hotel-card">
                    <div><strong>Data:</strong> {day?.data || '-'}</div>
                    {(day?.torresInput || (Array.isArray(day?.torres) && day.torres.length > 0)) && (
                      <div>
                        <strong>Torres visitadas:</strong>
                        {' '}
                        {day?.torresInput || day.torres.join(', ')}
                      </div>
                    )}
                    {Array.isArray(day?.torresDetalhadas) && day.torresDetalhadas.length > 0 && (
                      <div className="tower-list">
                        {day.torresDetalhadas.map((tower) => (
                          <div key={`inspection-details-tower-${day?.data || idx}-${tower?.numero || 'x'}`} className={`tower-item ${tower?.temErosao ? 'erosion' : ''}`}>
                            <strong>Torre {tower?.numero || '-'}</strong>
                            <span>{tower?.obs ? ` - ${tower.obs}` : ' - sem observações'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {hasHotelData(day) ? (
                      <>
                        <div><strong>Hotel:</strong> {day?.hotelNome || '-'}</div>
                        <div><strong>MunicÃƒÂ­pio:</strong> {day?.hotelMunicipio || '-'}</div>
                        <div><strong>Torre base:</strong> {day?.hotelTorreBase || '-'}</div>
                        <div>
                          <strong>Notas:</strong>
                          {' '}
                          LogÃƒÂ­stica {formatHotelNote(day?.hotelLogisticaNota)}
                          {' | '}
                          Reserva {formatHotelNote(day?.hotelReservaNota)}
                          {' | '}
                          Estadia {formatHotelNote(day?.hotelEstadiaNota)}
                        </div>
                      </>
                    ) : (
                      <div className="muted">Sem dados de hospedagem nesse dia.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="row-actions">
              <button type="button" onClick={handleExportDetailsPdf}>
                <AppIcon name="pdf" />
                Gerar PDF
              </button>
              <button type="button" className="secondary" onClick={() => setDetailsModal(null)}>
                <AppIcon name="close" />
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default InspectionsView;


