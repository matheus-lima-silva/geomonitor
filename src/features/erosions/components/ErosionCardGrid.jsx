import AppIcon from '../../../components/AppIcon';
import { Badge, Button } from '../../../components/ui';
import { erosionStatusClass, normalizeErosionStatus } from '../../shared/statusUtils';
import {
  getLocalContextLabel,
  isHistoricalErosionRecord,
  normalizeErosionTechnicalFields,
} from '../../shared/viewUtils';

function getImpactTone(impact) {
  if (impact === 'Muito Alto') return 'critical';
  if (impact === 'Alto') return 'danger';
  if (impact === 'Medio' || impact === 'Médio') return 'warning';
  return 'ok';
}

function ErosionCardGrid({
  erosions = [],
  projects = [],
  onOpenDetails,
  onOpenEdit,
  onRequestDelete,
  onOpenMaps,
  hasCoordinates,
}) {
  const projectsById = new Map((projects || []).map((item) => [String(item?.id || '').trim(), item]));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
      {erosions.map((erosion) => {
        const projectId = String(erosion?.projetoId || '').trim();
        const project = projectsById.get(projectId);
        const normalizedStatus = normalizeErosionStatus(erosion.status);
        const isHistoricalRecord = isHistoricalErosionRecord(erosion);
        const technical = normalizeErosionTechnicalFields(erosion || {});
        const localContexto = technical.localContexto || {};
        const localLabel = getLocalContextLabel(localContexto.localTipo) || '-';
        return (
          <article key={erosion.id} className="flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-3 p-5 pb-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-800 m-0 truncate">{erosion.id || '-'}</h3>
                <span className={erosionStatusClass(erosion.status)}>
                  {normalizedStatus}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral" size="sm">{projectId || '-'}</Badge>
                {String(erosion?.torreRef || '').trim() ? (
                  <Badge tone="neutral" size="sm">{`Torre ${erosion.torreRef}`}</Badge>
                ) : null}
                {isHistoricalRecord ? (
                  <Badge tone="warning" size="sm">Histórico</Badge>
                ) : null}
                <Badge tone={getImpactTone(erosion.impacto)} size="sm">
                  {erosion.impacto || 'Não informado'}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 p-5 pt-4 flex-1">
              {project?.nome ? (
                <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                  <span>Empreendimento</span>
                  <strong className="font-medium text-slate-800 text-right">{project.nome}</strong>
                </div>
              ) : null}
              <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                <span>Tipo</span>
                <strong className="font-medium text-slate-800 text-right">{erosion.tipo || '-'}</strong>
              </div>
              <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                <span>Grau erosivo</span>
                <strong className="font-medium text-slate-800 text-right">{erosion.estagio || '-'}</strong>
              </div>
              <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                <span>Local</span>
                <strong className="font-medium text-slate-800 text-right">{localLabel}</strong>
              </div>
              {isHistoricalRecord ? (
                <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                  <span>Registro</span>
                  <strong className="font-medium text-amber-700 text-right">Histórico de acompanhamento</strong>
                </div>
              ) : null}
              {isHistoricalRecord ? (
                <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                  <span>Intervenção</span>
                  <strong className="font-medium text-slate-800 text-right">{erosion.intervencaoRealizada || erosion.intervencao || '-'}</strong>
                </div>
              ) : null}
              {localContexto.localTipo === 'outros' ? (
                <div className="flex justify-between items-start gap-4 text-sm text-slate-500">
                  <span>Detalhe local</span>
                  <strong className="font-medium text-slate-800 text-right">{localContexto.localDescricao || '-'}</strong>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 p-5 pt-0 mt-auto">
              <Button variant="outline" size="sm" onClick={() => onOpenDetails(erosion)}>
                <AppIcon name="details" />
                Detalhes
              </Button>
              {hasCoordinates(erosion) ? (
                <Button variant="primary" size="sm" onClick={() => onOpenMaps(erosion)}>
                  <AppIcon name="map" />
                  Navegar
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => onOpenEdit(erosion)}>
                <AppIcon name="edit" />
                Editar
              </Button>
              <Button variant="danger" size="sm" onClick={() => onRequestDelete(erosion)}>
                <AppIcon name="trash" />
                Excluir
              </Button>
            </div>
          </article>
        );
      })}

      {erosions.length === 0 ? (
        <article className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center">
          <p className="text-slate-500 italic m-0">Nenhuma erosão encontrada.</p>
        </article>
      ) : null}
    </div>
  );
}

export default ErosionCardGrid;
