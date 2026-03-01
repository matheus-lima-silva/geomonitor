import AppIcon from '../../../components/AppIcon';
import { formatHotelNote, hasHotelData } from '../utils/inspectionWorkflow';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTowerLabel(towerRef) {
  const ref = String(towerRef ?? '').trim();
  if (!ref) return 'Nao informado';
  if (ref === '0') return 'Portico (T0)';
  return `Torre ${ref}`;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function colorByImpact(impact) {
  if (impact === 'Muito Alto') return 'status-danger';
  if (impact === 'Alto') return 'status-warn';
  if (impact === 'Medio' || impact === 'Médio') return 'status-warn';
  return 'status-ok';
}

function InspectionDetailsModal({
  inspection,
  project,
  erosions = [],
  inspections = [],
  onClose,
  onNavigate,
}) {
  const relatedErosions = (erosions || [])
    .filter((item) => String(item?.vistoriaId || '').trim() === String(inspection?.id || '').trim());
  const currentIndex = (inspections || []).findIndex((item) => item?.id === inspection?.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < inspections.length - 1;

  function handlePrevious() {
    if (!hasPrevious) return;
    onNavigate?.(inspections[currentIndex - 1]);
  }

  function handleNext() {
    if (!hasNext) return;
    onNavigate?.(inspections[currentIndex + 1]);
  }

  function handleExportDetailsPdf() {
    const win = window.open('', '_blank');
    if (!win) return;

    const days = Array.isArray(inspection?.detalhesDias) ? inspection.detalhesDias : [];
    const dayCardsHtml = days.map((dia, idx) => {
      const dateLabel = dia?.data ? new Date(`${dia.data}T00:00:00`).toLocaleDateString('pt-BR') : `Dia ${idx + 1}`;
      const towers = Array.isArray(dia?.torresDetalhadas) ? dia.torresDetalhadas : [];
      const towersHtml = towers.length > 0
        ? towers.map((tower) => `
          <div class="tower-row ${tower?.temErosao ? 'tower-erosion' : ''}">
            <strong>${escapeHtml(formatTowerLabel(tower?.numero))}</strong>
            <span>${escapeHtml(tower?.obs ? ` - ${tower.obs}` : ' - sem observacoes')}</span>
          </div>
        `).join('')
        : '<div class="empty">Sem torres detalhadas neste dia.</div>';

      const hotelHtml = hasHotelData(dia) ? `
        <div class="hotel-box">
          <div class="hotel-title">Dados de hospedagem</div>
          <div><strong>Hotel:</strong> ${escapeHtml(dia?.hotelNome || '-')}</div>
          <div><strong>Municipio:</strong> ${escapeHtml(dia?.hotelMunicipio || '-')}</div>
          <div><strong>Torre base:</strong> ${escapeHtml(dia?.hotelTorreBase || '-')}</div>
          <div><strong>Notas:</strong> Logistica ${escapeHtml(formatHotelNote(dia?.hotelLogisticaNota))} | Reserva ${escapeHtml(formatHotelNote(dia?.hotelReservaNota))} | Estadia ${escapeHtml(formatHotelNote(dia?.hotelEstadiaNota))}</div>
        </div>
      ` : '';

      return `
        <div class="day-card avoid-break">
          <div class="day-head">
            <span class="date">${escapeHtml(dateLabel)}</span>
            ${dia?.clima ? `<span class="chip sky">${escapeHtml(dia.clima)}</span>` : ''}
            ${(dia?.torresInput || dia?.torres) ? `<span class="chip gray">Torres: ${escapeHtml(Array.isArray(dia.torres) ? dia.torres.join(', ') : (dia.torresInput || dia.torres))}</span>` : ''}
          </div>
          <div class="day-subtitle">Torres visitadas</div>
          <div class="tower-list">${towersHtml}</div>
          ${hotelHtml}
        </div>
      `;
    }).join('');

    const erosionsHtml = relatedErosions.length > 0
      ? relatedErosions.map((item) => `
        <div class="erosion-row avoid-break">
          <div><strong>${escapeHtml(item?.id || '-')}</strong></div>
          <div>${escapeHtml(String(item?.torreRef ?? '').trim() ? formatTowerLabel(item.torreRef) : '-')} • ${escapeHtml(item?.tipo || '-')} • ${escapeHtml(item?.estagio || '-')}</div>
          <div><strong>Impacto:</strong> ${escapeHtml(item?.impacto || '-')}</div>
        </div>
      `).join('')
      : '<div class="empty">Nenhuma erosao vinculada a esta vistoria.</div>';

    win.document.write(`
      <html>
        <head>
          <title>Detalhes da Vistoria ${escapeHtml(inspection?.id || '-')}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; font-size: 12px; margin: 0; background: #f8fafc; }
            .wrapper { max-width: 100%; }
            .header { background: linear-gradient(135deg, #dbeafe 0%, #e2e8f0 100%); border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; }
            .title { font-size: 19px; font-weight: 700; margin: 0 0 4px 0; color: #1e3a8a; }
            .meta { color: #475569; font-size: 11px; }
            .section { margin-top: 12px; border: 1px solid #dbe4ee; border-radius: 10px; background: #ffffff; padding: 12px; }
            .section-title { font-size: 13px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
            .row { line-height: 1.4; color: #1f2937; }
            .label { color: #475569; font-weight: 600; }
            .day-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 8px; background: #fff; }
            .day-head { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
            .date { font-weight: 700; color: #0f172a; }
            .chip { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 999px; }
            .chip.sky { background: #e0f2fe; color: #0369a1; }
            .chip.gray { background: #f1f5f9; color: #334155; }
            .day-subtitle { font-weight: 700; color: #334155; margin: 4px 0 6px; }
            .tower-list { display: grid; gap: 5px; }
            .tower-row { border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; padding: 6px; }
            .tower-erosion { border-color: #fecaca; background: #fef2f2; }
            .hotel-box { margin-top: 8px; border: 1px solid #bfdbfe; border-radius: 6px; background: #eff6ff; padding: 8px; }
            .hotel-title { color: #1d4ed8; font-weight: 700; margin-bottom: 4px; }
            .erosion-row { border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 8px; margin-bottom: 8px; }
            .empty { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px; color: #64748b; background: #f8fafc; }
            .avoid-break { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="header avoid-break">
              <h1 class="title">Detalhes da Vistoria ${escapeHtml(inspection?.id || '-')}</h1>
              <div class="meta">Empreendimento: ${escapeHtml(inspection?.projetoId || '-')} ${project?.nome ? `(${escapeHtml(project.nome)})` : ''}</div>
              <div class="meta">Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
            </div>

            <div class="section avoid-break">
              <h2 class="section-title">Resumo</h2>
              <div class="summary-grid">
                <div class="row"><span class="label">ID:</span> ${escapeHtml(inspection?.id || '-')}</div>
                <div class="row"><span class="label">Empreendimento:</span> ${escapeHtml(inspection?.projetoId || '-')}</div>
                <div class="row"><span class="label">Data Inicio:</span> ${escapeHtml(inspection?.dataInicio || '-')}</div>
                <div class="row"><span class="label">Data Fim:</span> ${escapeHtml(inspection?.dataFim || '-')}</div>
                <div class="row"><span class="label">Responsavel:</span> ${escapeHtml(inspection?.responsavel || '-')}</div>
                <div class="row"><span class="label">Dias registados:</span> ${escapeHtml(days.length)}</div>
              </div>
              ${inspection?.obs ? `<div class="row" style="margin-top:8px;"><span class="label">Observacoes:</span> ${escapeHtml(inspection.obs).replace(/\n/g, '<br />')}</div>` : ''}
            </div>

            <div class="section">
              <h2 class="section-title">Diario de Campo Detalhado</h2>
              ${dayCardsHtml || '<div class="empty">Sem dias detalhados.</div>'}
            </div>

            <div class="section">
              <h2 class="section-title">Erosoes Identificadas (${escapeHtml(relatedErosions.length)})</h2>
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
    <div className="modal-backdrop inspection-details-backdrop">
      <div className="inspection-details-modal">
        <div className="inspection-details-head">
          <div className="inspection-details-head-title">
            <h3>
              <AppIcon name="clipboard" />
              Detalhes da Vistoria: {inspection?.id}
            </h3>
            <div className="muted">({currentIndex + 1} de {inspections.length})</div>
          </div>
          <div className="inspection-details-head-actions">
            <button type="button" className="secondary" onClick={handlePrevious} disabled={!hasPrevious}>
              <AppIcon name="chevron-left" />
            </button>
            <button type="button" className="secondary" onClick={handleNext} disabled={!hasNext}>
              <AppIcon name="chevron-right" />
            </button>
            <button type="button" onClick={handleExportDetailsPdf}>
              <AppIcon name="pdf" />
              Gerar PDF
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              <AppIcon name="close" />
            </button>
          </div>
        </div>

        <div className="inspection-details-body">
          <div className="inspection-details-info-grid">
            <div className="inspection-details-box">
              <h4><AppIcon name="map" /> Empreendimento</h4>
              {project ? (
                <div className="inspection-details-kv">
                  <div><strong>ID:</strong> {project.id}</div>
                  <div><strong>Nome:</strong> {project.nome || '-'}</div>
                  <div><strong>Tipo:</strong> {project.tipo || '-'}</div>
                  {project.tensao ? <div><strong>Tensao:</strong> {project.tensao} kV</div> : null}
                </div>
              ) : (
                <p className="muted">Projeto nao encontrado.</p>
              )}
            </div>
            <div className="inspection-details-box">
              <h4>Informacoes da Vistoria</h4>
              <div className="inspection-details-kv">
                <div><strong>ID:</strong> {inspection?.id || '-'}</div>
                <div><strong>Data Inicio:</strong> {inspection?.dataInicio || '-'}</div>
                {inspection?.dataFim ? <div><strong>Data Fim:</strong> {inspection.dataFim}</div> : null}
                {inspection?.responsavel ? <div><strong>Responsavel:</strong> {inspection.responsavel}</div> : null}
              </div>
            </div>
          </div>

          {inspection?.obs ? (
            <div className="inspection-details-box">
              <h4>Observacoes</h4>
              <p className="muted">{inspection.obs}</p>
            </div>
          ) : null}

          {Array.isArray(inspection?.detalhesDias) && inspection.detalhesDias.length > 0 ? (
            <div className="inspection-details-box">
              <h4>Diario de Campo Detalhado</h4>
              <div className="inspection-details-days">
                {inspection.detalhesDias.map((day, idx) => (
                  <article key={`${day?.data || idx}`} className="inspection-day-card">
                    <div className="inspection-day-header">
                      <strong>{day?.data ? new Date(`${day.data}T00:00:00`).toLocaleDateString('pt-BR') : 'Data nao informada'}</strong>
                      {day?.clima ? <span className="status-chip status-ok">{day.clima}</span> : null}
                      {(day?.torresInput || day?.torres) ? (
                        <span className="status-chip">Torres: {Array.isArray(day.torres) ? day.torres.join(', ') : (day.torresInput || day.torres)}</span>
                      ) : null}
                    </div>
                    {Array.isArray(day?.torresDetalhadas) && day.torresDetalhadas.length > 0 ? (
                      <div className="inspection-day-towers">
                        {day.torresDetalhadas.map((tower) => (
                          <div key={`${day?.data || idx}-${tower?.numero || 'x'}`} className={`inspection-day-tower ${tower?.temErosao ? 'is-erosion' : ''}`}>
                            <strong>{formatTowerLabel(tower?.numero)}</strong>
                            {tower?.obs ? ` - ${tower.obs}` : ' - sem observacoes'}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {hasHotelData(day) ? (
                      <div className="inspection-day-hotel">
                        <div className="inspection-day-hotel-title">Dados de hospedagem</div>
                        <div><strong>Hotel:</strong> {day?.hotelNome || '-'}</div>
                        <div><strong>Municipio:</strong> {day?.hotelMunicipio || '-'}</div>
                        <div><strong>Torre base:</strong> {day?.hotelTorreBase || '-'}</div>
                        <div>
                          <strong>Notas:</strong>
                          {' '}Logistica {formatHotelNote(day?.hotelLogisticaNota)}
                          {' | '}Reserva {formatHotelNote(day?.hotelReservaNota)}
                          {' | '}Estadia {formatHotelNote(day?.hotelEstadiaNota)}
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="inspection-details-box">
            <h4><AppIcon name="alert" /> Erosoes Identificadas ({relatedErosions.length})</h4>
            {relatedErosions.length > 0 ? (
              <div className="inspection-details-erosions">
                {relatedErosions.map((item) => (
                  <article key={item.id} className="inspection-details-erosion-row">
                    <div className="inspection-details-erosion-main">
                      <div><strong>{item.id}</strong></div>
                      <div className="muted">
                        {String(item?.torreRef ?? '').trim() ? `${formatTowerLabel(item.torreRef)} • ` : ''}
                        {item?.tipo || '-'} • {item?.estagio || '-'}
                      </div>
                    </div>
                    <span className={`status-chip ${colorByImpact(item?.impacto)}`}>{item?.impacto || '-'}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">Nenhuma erosao vinculada a esta vistoria.</p>
            )}
          </div>

          {inspection?.ultimaAtualizacao ? (
            <div className="muted inspection-details-footer">
              <div><strong>Ultima atualizacao:</strong> {new Date(inspection.ultimaAtualizacao).toLocaleString('pt-BR')}</div>
              {inspection?.atualizadoPor ? <div><strong>Por:</strong> {inspection.atualizadoPor}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default InspectionDetailsModal;
