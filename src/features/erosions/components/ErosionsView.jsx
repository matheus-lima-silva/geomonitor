import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { calculateCriticality } from '../../shared/rulesConfig';
import { erosionStatusClass, normalizeErosionStatus } from '../../shared/statusUtils';
import { deleteErosion, saveErosion } from '../../../services/erosionService';
import {
  appendFollowupEvent,
  buildErosionReportRows,
  buildErosionsCsv,
  buildFollowupEvent,
  buildImpactSummary,
  EROSION_LOCATION_OPTIONS,
  filterErosionsForReport,
  normalizeFollowupHistory,
  validateErosionLocation,
} from '../utils/erosionUtils';

const baseForm = {
  id: '',
  projetoId: '',
  vistoriaId: '',
  torreRef: '',
  localTipo: '',
  localDescricao: '',
  tipo: '',
  estagio: '',
  profundidade: '',
  declividade: '',
  largura: '',
  latitude: '',
  longitude: '',
  status: 'Ativo',
  obs: '',
  acompanhamentosResumo: [],
};

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function openReportPdfWindow({ projectId, rows, filters }) {
  const summary = buildImpactSummary(rows);
  const now = new Date();
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
  if (!win) throw new Error('Permita pop-up para exportar PDF.');

  const statusRows = Object.entries(summary.byStatus)
    .map(([k, v]) => `<li><strong>${k}</strong>: ${v}</li>`)
    .join('');
  const impactRows = Object.entries(summary.byImpact)
    .map(([k, v]) => `<li><strong>${k}</strong>: ${v}</li>`)
    .join('');

  const tableRows = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${row.vistoriaId || '-'}</td>
      <td>${row.torreRef || '-'}</td>
      <td>${row.localTipo || '-'}</td>
      <td>${row.status || '-'}</td>
      <td>${row.impacto || '-'}</td>
      <td>${row.ultimaAtualizacao || '-'}</td>
    </tr>
  `).join('');

  win.document.write(`
    <html>
      <head>
        <title>Relatório de Erosões - ${projectId}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { margin: 0 0 8px; }
          .meta { margin-bottom: 16px; color: #334155; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h1>Relatório de Processos Erosivos</h1>
        <div class="meta">
          <div><strong>Empreendimento:</strong> ${projectId}</div>
          <div><strong>Período:</strong> ${filters.dataInicio || '-'} até ${filters.dataFim || '-'}</div>
          <div><strong>Gerado em:</strong> ${now.toLocaleString('pt-BR')}</div>
          <div><strong>Total de erosões:</strong> ${rows.length}</div>
        </div>
        <div class="grid">
          <div class="box">
            <h3>Totais por status</h3>
            <ul>${statusRows || '<li>Sem dados</li>'}</ul>
          </div>
          <div class="box">
            <h3>Totais por impacto</h3>
            <ul>${impactRows || '<li>Sem dados</li>'}</ul>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Vistoria</th>
              <th>Torre</th>
              <th>Local</th>
              <th>Status</th>
              <th>Impacto</th>
              <th>Atualização</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="7">Sem dados para o filtro selecionado.</td></tr>'}
          </tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function ErosionsView({ erosions, projects, inspections, rulesConfig, searchTerm }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(baseForm);
  const [editingId, setEditingId] = useState('');
  const [detailsModal, setDetailsModal] = useState(null);
  const [reportFilters, setReportFilters] = useState({ projetoId: '', dataInicio: '', dataFim: '' });

  const sorted = useMemo(() => {
    const t = String(searchTerm || '').toLowerCase();
    const base = [...erosions].sort((a, b) => String(b.id).localeCompare(String(a.id)));
    if (!t) return base;
    return base.filter((e) =>
      String(e.id || '').toLowerCase().includes(t)
      || String(e.projetoId || '').toLowerCase().includes(t)
      || String(e.torreRef || '').toLowerCase().includes(t)
      || String(e.impacto || '').toLowerCase().includes(t),
    );
  }, [erosions, searchTerm]);

  function openNew() {
    setFormData({ ...baseForm, id: `ERS-${Date.now()}` });
    setEditingId('');
    setIsFormOpen(true);
  }

  function openEdit(erosion) {
    setFormData({
      ...baseForm,
      ...erosion,
      status: normalizeErosionStatus(erosion?.status),
      localTipo: erosion?.localTipo || '',
      localDescricao: erosion?.localDescricao || '',
      acompanhamentosResumo: normalizeFollowupHistory(erosion?.acompanhamentosResumo),
    });
    setEditingId(erosion.id);
    setIsFormOpen(true);
  }

  function hasCoordinates(erosion) {
    const lat = Number(erosion?.latitude);
    const lng = Number(erosion?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }

  function openGoogleMapsRoute(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      show('Coordenadas inválidas para navegação.', 'error');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latNum},${lngNum}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleSave() {
    try {
      if (!formData.id || !formData.projetoId) {
        show('Preencha ID e empreendimento.', 'error');
        return;
      }

      const locationValidation = validateErosionLocation(formData);
      if (!locationValidation.ok) {
        show(locationValidation.message, 'error');
        return;
      }

      const previous = erosions.find((item) => item.id === formData.id) || null;
      const nextPayload = {
        ...formData,
        status: normalizeErosionStatus(formData.status),
      };

      const criticality = calculateCriticality(nextPayload, rulesConfig);
      const followupEvent = buildFollowupEvent(previous, nextPayload, {
        updatedBy: user?.email,
        isCreate: !previous,
      });

      await saveErosion(
        {
          ...nextPayload,
          criticality,
          acompanhamentosResumo: appendFollowupEvent(previous?.acompanhamentosResumo, followupEvent),
        },
        { updatedBy: user?.email, merge: true },
      );

      setIsFormOpen(false);
      show('Erosão salva com sucesso.', 'success');
    } catch (e) {
      show(e.message || 'Erro ao salvar erosão.', 'error');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(`Excluir erosão ${id}?`)) return;
    await deleteErosion(id);
    show('Erosão excluída.', 'success');
  }

  function handleExportCsv() {
    if (!reportFilters.projetoId) {
      show('Selecione um empreendimento para exportar.', 'error');
      return;
    }

    const filteredRows = filterErosionsForReport(erosions, reportFilters, inspections);
    const rows = buildErosionReportRows(filteredRows);
    const csv = buildErosionsCsv(rows);
    const filename = `relatorio-erosoes-${reportFilters.projetoId}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
    show('CSV exportado com sucesso.', 'success');
  }

  function handleExportPdf() {
    if (!reportFilters.projetoId) {
      show('Selecione um empreendimento para exportar.', 'error');
      return;
    }

    const filteredRows = filterErosionsForReport(erosions, reportFilters, inspections);
    const rows = buildErosionReportRows(filteredRows);
    openReportPdfWindow({ projectId: reportFilters.projetoId, rows, filters: reportFilters });
    show('PDF preparado para impressão.', 'success');
  }

  const calc = calculateCriticality(formData, rulesConfig);

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <h2>Erosões</h2>
          <p className="muted">Cadastro e acompanhamento das erosões identificadas.</p>
        </div>
        <button type="button" onClick={openNew}>Nova Erosão</button>
      </div>

      <div className="panel nested">
        <h3>Exportar relatório de erosões</h3>
        <div className="grid-form">
          <select value={reportFilters.projetoId} onChange={(e) => setReportFilters((prev) => ({ ...prev, projetoId: e.target.value }))}>
            <option value="">Empreendimento...</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.id} - {p.nome}</option>)}
          </select>
          <input type="date" value={reportFilters.dataInicio} onChange={(e) => setReportFilters((prev) => ({ ...prev, dataInicio: e.target.value }))} />
          <input type="date" value={reportFilters.dataFim} onChange={(e) => setReportFilters((prev) => ({ ...prev, dataFim: e.target.value }))} />
        </div>
        <div className="row-actions">
          <button type="button" className="secondary" onClick={handleExportCsv}>Exportar CSV</button>
          <button type="button" onClick={handleExportPdf}>Exportar PDF</button>
        </div>
      </div>

      <div className="project-cards">
        {sorted.map((e) => (
          <article key={e.id} className="project-card">
            <h3>{e.id}</h3>
            <div className="muted">
              <div><strong>Projeto:</strong> {e.projetoId || '-'}</div>
              <div><strong>Torre:</strong> {e.torreRef || '-'}</div>
              <div><strong>Local:</strong> {e.localTipo || '-'}</div>
              {e.localTipo === 'Outros' && <div><strong>Detalhe local:</strong> {e.localDescricao || '-'}</div>}
              <div><strong>Impacto:</strong> {e.impacto || '-'}</div>
              <div><strong>Status:</strong> <span className={erosionStatusClass(e.status)}>{normalizeErosionStatus(e.status)}</span></div>
            </div>
            <div className="row-actions two">
              <button type="button" className="secondary" onClick={() => setDetailsModal(e)}>Detalhes</button>
              <button type="button" className="secondary" onClick={() => openEdit(e)}>Editar</button>
              {hasCoordinates(e) && (
                <button type="button" onClick={() => openGoogleMapsRoute(e.latitude, e.longitude)}>Navegar</button>
              )}
              <button type="button" className="danger" onClick={() => handleDelete(e.id)}>Excluir</button>
            </div>
          </article>
        ))}
        {sorted.length === 0 && (
          <article className="project-card">
            <p className="muted">Nenhuma erosão encontrada.</p>
          </article>
        )}
      </div>

      {isFormOpen && (
        <div className="modal-backdrop">
          <div className="modal xwide">
            <h3>{editingId ? 'Editar' : 'Nova'} Erosão</h3>
            <div className="grid-form">
              <input value={formData.id} onChange={(e) => setFormData({ ...formData, id: e.target.value })} placeholder="ID" />
              <select value={formData.projetoId} onChange={(e) => setFormData({ ...formData, projetoId: e.target.value })}>
                <option value="">Empreendimento...</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
              </select>
              <select value={formData.vistoriaId} onChange={(e) => setFormData({ ...formData, vistoriaId: e.target.value })}>
                <option value="">Vistoria...</option>
                {inspections.filter((i) => i.projetoId === formData.projetoId).map((i) => <option key={i.id} value={i.id}>{i.id}</option>)}
              </select>

              <input value={formData.torreRef} onChange={(e) => setFormData({ ...formData, torreRef: e.target.value })} placeholder="Torre" />
              <select value={formData.localTipo} onChange={(e) => setFormData({ ...formData, localTipo: e.target.value, localDescricao: e.target.value === 'Outros' ? formData.localDescricao : '' })}>
                <option value="">Local da erosão...</option>
                {EROSION_LOCATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              {formData.localTipo === 'Outros' ? (
                <input value={formData.localDescricao} onChange={(e) => setFormData({ ...formData, localDescricao: e.target.value })} placeholder="Descreva o local" />
              ) : <div />}

              <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
                <option value="">Tipo...</option>
                <option value="sulco">Sulco</option>
                <option value="ravina">Ravina</option>
                <option value="voçoroca">Voçoroca</option>
                <option value="deslizamento">Deslizamento</option>
              </select>
              <select value={formData.estagio} onChange={(e) => setFormData({ ...formData, estagio: e.target.value })}>
                <option value="">Estágio...</option>
                <option value="inicial">Inicial</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
                <option value="critico">Crítico</option>
              </select>
              <select value={formData.profundidade} onChange={(e) => setFormData({ ...formData, profundidade: e.target.value })}>
                <option value="">Profundidade...</option>
                <option value="<0.5">&lt; 0.5m</option>
                <option value="0.5-1.5">0.5-1.5m</option>
                <option value="1.5-3.0">1.5-3.0m</option>
                <option value=">3.0">&gt; 3.0m</option>
              </select>
              <select value={formData.declividade} onChange={(e) => setFormData({ ...formData, declividade: e.target.value })}>
                <option value="">Declividade...</option>
                <option value="<15">&lt; 15°</option>
                <option value="15-30">15-30°</option>
                <option value="30-45">30-45°</option>
                <option value=">45">&gt; 45°</option>
              </select>
              <select value={formData.largura} onChange={(e) => setFormData({ ...formData, largura: e.target.value })}>
                <option value="">Largura...</option>
                <option value="<1">&lt; 1m</option>
                <option value="1-3">1-3m</option>
                <option value="3-5">3-5m</option>
                <option value=">5">&gt; 5m</option>
              </select>
              <input value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="Latitude" />
              <input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="Longitude" />
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                <option>Ativo</option>
                <option>Monitoramento</option>
                <option>Resolvido</option>
              </select>
              <textarea value={formData.obs} onChange={(e) => setFormData({ ...formData, obs: e.target.value })} placeholder="Observações" rows="3" />
            </div>

            <div className="notice">
              <strong>Impacto:</strong> {calc.impacto} | <strong>Score:</strong> {calc.score} | <strong>Frequência:</strong> {calc.frequencia}
              <br />
              <strong>Intervenção:</strong> {calc.intervencao}
            </div>

            <div className="row-actions">
              <button type="button" onClick={handleSave}>Salvar</button>
              <button type="button" className="secondary" onClick={() => setIsFormOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {detailsModal && (
        <div className="modal-backdrop">
          <div className="modal wide">
            <h3>Detalhes da Erosão</h3>
            <div className="muted">
              <div><strong>ID:</strong> {detailsModal.id}</div>
              <div><strong>Projeto:</strong> {detailsModal.projetoId || '-'}</div>
              <div><strong>Vistoria:</strong> {detailsModal.vistoriaId || '-'}</div>
              <div><strong>Torre:</strong> {detailsModal.torreRef || '-'}</div>
              <div><strong>Local:</strong> {detailsModal.localTipo || '-'}</div>
              {detailsModal.localTipo === 'Outros' && <div><strong>Descrição local:</strong> {detailsModal.localDescricao || '-'}</div>}
              <div><strong>Tipo:</strong> {detailsModal.tipo || '-'}</div>
              <div><strong>Estágio:</strong> {detailsModal.estagio || '-'}</div>
              <div><strong>Impacto:</strong> {detailsModal.impacto || '-'}</div>
              <div><strong>Score:</strong> {detailsModal.score || '-'}</div>
              <div><strong>Frequência:</strong> {detailsModal.frequencia || '-'}</div>
              <div><strong>Intervenção:</strong> {detailsModal.intervencao || '-'}</div>
              <div><strong>Status:</strong> <span className={erosionStatusClass(detailsModal.status)}>{normalizeErosionStatus(detailsModal.status)}</span></div>
              <div><strong>Latitude:</strong> {detailsModal.latitude || '-'}</div>
              <div><strong>Longitude:</strong> {detailsModal.longitude || '-'}</div>
              <div><strong>Observações:</strong> {detailsModal.obs || '-'}</div>
            </div>

            <div className="panel nested">
              <h4>Histórico de acompanhamento</h4>
              {normalizeFollowupHistory(detailsModal.acompanhamentosResumo)
                .slice()
                .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
                .map((event) => (
                  <div key={`${event.timestamp}-${event.resumo}`} className="notice">
                    <div><strong>{new Date(event.timestamp).toLocaleString('pt-BR')}</strong></div>
                    <div>{event.resumo}</div>
                    <div className="muted">Origem: {event.origem || '-'} | Usuário: {event.usuario || '-'} | Status: {event.statusNovo || '-'}</div>
                  </div>
                ))}
              {normalizeFollowupHistory(detailsModal.acompanhamentosResumo).length === 0 && (
                <p className="muted">Sem histórico de acompanhamento registrado.</p>
              )}
            </div>

            <div className="row-actions">
              {hasCoordinates(detailsModal) && (
                <button type="button" onClick={() => openGoogleMapsRoute(detailsModal.latitude, detailsModal.longitude)}>
                  Navegar no Google Maps
                </button>
              )}
              <button type="button" className="secondary" onClick={() => setDetailsModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ErosionsView;
