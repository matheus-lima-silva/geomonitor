import { useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, IconButton, Modal } from '../../../components/ui';
import { formatHotelNote, formatInspectionPeriod, getInspectionStatusMeta, hasHotelData } from '../utils/inspectionWorkflow';
import { buildFeriadosIndex, getFeriadoForDate } from '../../shared/rulesConfig';
import { buildVistoriaPdfDocument, openVistoriaPrintWindow } from '../utils/vistoriaPdfTemplates';

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
  feriados = [],
  onClose,
  onNavigate,
}) {
  const feriadosIndex = useMemo(() => buildFeriadosIndex(feriados), [feriados]);
  const [pdfVariant, setPdfVariant] = useState('sobria');
  const statusMeta = getInspectionStatusMeta(inspection || {});
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
    const documentHtml = buildVistoriaPdfDocument({
      inspection,
      project,
      erosions: relatedErosions,
      variant: pdfVariant,
      user: inspection?.atualizadoPor || '',
    });
    openVistoriaPrintWindow(documentHtml);
  }

  const footer = (
    <>
      <IconButton variant="outline" size="md" onClick={handlePrevious} disabled={!hasPrevious} aria-label="Vistoria anterior">
        <AppIcon name="chevron-left" />
      </IconButton>
      <IconButton variant="outline" size="md" onClick={handleNext} disabled={!hasNext} aria-label="Proxima vistoria">
        <AppIcon name="chevron-right" />
      </IconButton>
      <div className="flex items-center gap-1 mr-1" role="group" aria-label="Variacao do PDF">
        <Button
          variant={pdfVariant === 'sobria' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setPdfVariant('sobria')}
          aria-pressed={pdfVariant === 'sobria'}
        >
          Sobria
        </Button>
        <Button
          variant={pdfVariant === 'marca' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setPdfVariant('marca')}
          aria-pressed={pdfVariant === 'marca'}
        >
          Com marca
        </Button>
      </div>
      <Button variant="primary" size="md" onClick={handleExportDetailsPdf}>
        <AppIcon name="pdf" /> Gerar PDF
      </Button>
      <IconButton variant="outline" size="md" onClick={onClose} aria-label="Fechar detalhes da vistoria">
        <AppIcon name="close" />
      </IconButton>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <AppIcon name="clipboard" /> Detalhes da Vistoria: {inspection?.id}
          <span className="text-sm text-gray-400 font-normal">({currentIndex + 1} de {inspections.length})</span>
        </span>
      }
      size="xl"
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-3">
            <h4 className="text-base font-bold text-slate-800 flex items-center gap-2 m-0 border-b border-slate-100 pb-2"><AppIcon name="map" /> Empreendimento</h4>
            {project ? (
              <div className="flex flex-col gap-1.5 text-sm text-slate-700">
                <div><strong>ID:</strong> {project.id}</div>
                <div><strong>Nome:</strong> {project.nome || '-'}</div>
                <div><strong>Tipo:</strong> {project.tipo || '-'}</div>
                {project.tensao ? <div><strong>Tensao:</strong> {project.tensao} kV</div> : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500 m-0">Projeto nao encontrado.</p>
            )}
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <h4 className="text-base font-bold text-slate-800 m-0">Informacoes da Vistoria</h4>
              {statusMeta ? (
                <Badge tone={statusMeta.tone} size="sm" className="rounded-full shrink-0">
                  <AppIcon name={statusMeta.icon} className="w-3 h-3" aria-hidden="true" />
                  {statusMeta.label}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5 text-sm text-slate-700">
              <div><strong>ID:</strong> {inspection?.id || '-'}</div>
              <div><strong>Periodo:</strong> {formatInspectionPeriod(inspection?.dataInicio, inspection?.dataFim) || '-'}</div>
              {inspection?.responsavel ? <div><strong>Responsavel:</strong> {inspection.responsavel}</div> : null}
            </div>
          </div>
        </div>

        {inspection?.obs ? (
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-3">
            <h4 className="text-base font-bold text-slate-800 m-0 border-b border-slate-100 pb-2">Observacoes</h4>
            <p className="text-sm text-slate-600 m-0 whitespace-pre-wrap">{inspection.obs}</p>
          </div>
        ) : null}

        {Array.isArray(inspection?.detalhesDias) && inspection.detalhesDias.length > 0 ? (
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
            <h4 className="text-base font-bold text-slate-800 m-0 border-b border-slate-100 pb-2">Diario de Campo Detalhado</h4>
            <div className="flex flex-col gap-3">
              {inspection.detalhesDias.map((day, idx) => {
                const feriadoDia = getFeriadoForDate(day?.data, feriadosIndex);
                return (
                <article key={`${day?.data || idx}`} className="border border-slate-200 rounded-xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3 text-slate-800">
                    <strong>{day?.data ? new Date(`${day.data}T00:00:00`).toLocaleDateString('pt-BR') : 'Data nao informada'}</strong>
                    {feriadoDia ? <Badge tone="warning" size="sm">Feriado - {feriadoDia.nome}</Badge> : null}
                    {day?.clima ? <Badge tone="ok" size="sm">{day.clima}</Badge> : null}
                    {(day?.torresInput || day?.torres) ? (
                      <Badge tone="neutral" size="sm">Torres: {Array.isArray(day.torres) ? day.torres.join(', ') : (day.torresInput || day.torres)}</Badge>
                    ) : null}
                  </div>
                  {Array.isArray(day?.torresDetalhadas) && day.torresDetalhadas.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {day.torresDetalhadas.map((tower) => (
                        <div key={`${day?.data || idx}-${tower?.numero || 'x'}`} className={`bg-white border p-2 text-sm rounded-lg flex items-center gap-1 ${tower?.temErosao ? 'border-danger-border bg-danger-light text-danger-dark' : 'border-slate-200 text-slate-700'}`}>
                          <strong>{formatTowerLabel(tower?.numero)}</strong>
                          {tower?.obs ? ` - ${tower.obs}` : ' - sem observacoes'}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {hasHotelData(day) ? (
                    <div className="mt-4 bg-brand-50/50 border border-brand-100 p-3 rounded-lg text-sm text-slate-700 flex flex-col gap-1.5">
                      <div className="font-bold text-brand-800 flex items-center gap-1.5 mb-1">Dados de hospedagem</div>
                      <div><strong>Hotel:</strong> {day?.hotelNome || '-'}</div>
                      <div><strong>Municipio:</strong> {day?.hotelMunicipio || '-'}</div>
                      <div><strong>Torre base:</strong> {day?.hotelTorreBase || '-'}</div>
                      <div className="text-slate-500">
                        <strong>Notas:</strong>
                        {' '}Logistica {formatHotelNote(day?.hotelLogisticaNota)}
                        {' | '}Reserva {formatHotelNote(day?.hotelReservaNota)}
                        {' | '}Estadia {formatHotelNote(day?.hotelEstadiaNota)}
                      </div>
                    </div>
                  ) : null}
                </article>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-3">
          <h4 className="text-base font-bold text-slate-800 flex items-center gap-2 m-0 border-b border-slate-100 pb-2"><AppIcon name="alert" /> Erosoes Identificadas ({relatedErosions.length})</h4>
          {relatedErosions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {relatedErosions.map((item) => (
                <article key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col text-sm text-slate-800">
                    <div><strong>{item.id}</strong></div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {String(item?.torreRef ?? '').trim() ? `${formatTowerLabel(item.torreRef)} • ` : ''}
                      {item?.tipo || '-'} • {item?.estagio || '-'}
                    </div>
                  </div>
                  <Badge tone={colorByImpact(item?.impacto) === 'status-danger' ? 'danger' : (colorByImpact(item?.impacto) === 'status-warn' ? 'warning' : 'ok')} size="sm">{item?.impacto || '-'}</Badge>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 m-0 py-2">Nenhuma erosao vinculada a esta vistoria.</p>
          )}
        </div>

        {inspection?.ultimaAtualizacao ? (
          <div className="text-xs text-slate-400 flex justify-between gap-4 pt-4 mt-2 border-t border-slate-100 uppercase tracking-widest font-semibold">
            <div><strong>Ultima atualizacao:</strong> {new Date(inspection.ultimaAtualizacao).toLocaleString('pt-BR')}</div>
            {inspection?.atualizadoPor ? <div><strong>Por:</strong> {inspection.atualizadoPor}</div> : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export default InspectionDetailsModal;
